import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import cron from "node-cron";
import swaggerUi from "swagger-ui-express";
import { PrismaClient } from "@prisma/client";
import { createAppConfig } from "./config.js";
import { canAccessWithoutMember, savePasswordChange, validatePassword, verifyPasswordChange } from "./password.js";
import { addMonthsClamped, allocatePayment, calculateMonthlyInterest, roundMoney, validateLoanTerms } from "./loan-finance.js";
import { createLoan, updateLoan } from "./loan-creation.js";
import { summarizeLoanPayments } from "./debt-summary.js";
import { loadSettlement, saveSettlement } from "./liquidation.js";
import { calculateActivityGains, calculateParticipantBalance, calculateSaleTotals, calculateActivityTotals, saleWithBalance, pendingSaleDebts, snapshotSaleProduct } from "./activity-finance.js";
import {
  calculateRaffleDistribution,
  isRaffleDateInVigencia,
  normalizeRaffleAmount,
  planRaffleSchedule,
  projectRaffleDistribution,
  sumRaffleAmounts
} from "./raffle-finance.js";

const app = express();
const prisma = new PrismaClient();
const { port, jwtSecret, corsOrigins } = createAppConfig();

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || corsOrigins.includes(origin)),
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

const openapi = {
  openapi: "3.0.3",
  info: { title: "La Natillera de Lili API", version: "1.0.0" },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Vigencia: { type: "object", properties: { id: { type: "string" }, year: { type: "integer" }, status: { type: "string" } } },
      Member: { type: "object", properties: { id: { type: "string" }, document: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" }, role: { type: "string" }, status: { type: "string" } } }
    }
  },
  paths: {
    "/auth/login": { post: { summary: "Iniciar sesión", responses: { 200: { description: "JWT and refresh token" } } } },
    "/vigencias": { get: { summary: "Listar vigencias", security: [{ bearerAuth: [] }], responses: { 200: { description: "Listado paginado" } } } },
    "/socios": { get: { summary: "Listar socios", security: [{ bearerAuth: [] }], responses: { 200: { description: "Listado paginado" } } } },
    "/ahorros": { get: { summary: "Listar ahorros", security: [{ bearerAuth: [] }], responses: { 200: { description: "Listado paginado" } } } },
    "/dashboard": { get: { summary: "KPIs ejecutivos", security: [{ bearerAuth: [] }], responses: { 200: { description: "Indicadores" } } } }
  }
};

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: process.env.JWT_EXPIRES_IN || "15m" });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Token requerido" });
  try {
    const tokenUser = jwt.verify(header.slice(7), jwtSecret);
    prisma.user.findUnique({ where: { id: tokenUser.sub } })
      .then(async (user) => {
        if (!user || user.deletedAt || user.status !== "ACTIVO" || (user.lockedUntil && user.lockedUntil > new Date())) {
          return res.status(401).json({ error: "La cuenta está inactiva o bloqueada" });
        }
        req.user = { sub: user.id, email: user.email, role: user.role };
        const member = await prisma.member.findUnique({ where: { userId: user.id }, select: { id: true } });
        req.memberId = member?.id || null;
        next();
      })
      .catch(next);
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "ADMINISTRADOR") return res.status(403).json({ error: "Se requiere rol administrador" });
  next();
}

const permissionModules = [
  "dashboard", "perfil", "socios", "usuarios", "ahorros", "prestamos", "pagos",
  "actividades", "rifas", "deudas", "liquidaciones", "vigencias", "reportes", "configuracion"
];
const permissionActions = ["ver", "consultar", "crear", "editar", "eliminar", "aprobar", "exportar", "imprimir"];

function defaultPermission(role, module, action) {
  if (role === "ADMINISTRADOR") return true;
  if (!["ver", "consultar"].includes(action)) return false;
  return ["dashboard", "perfil", "socios", "ahorros", "prestamos", "pagos", "actividades", "rifas", "deudas", "liquidaciones", "reportes"].includes(module);
}

function requirePermission(module, action) {
  return async (req, res, next) => {
    try {
      if (req.user.role === "ADMINISTRADOR") return next();
      const configured = await prisma.rolePermission.findUnique({
        where: { role_module_action: { role: req.user.role, module, action } }
      });
      const allowed = configured ? configured.allowed : defaultPermission(req.user.role, module, action);
      if (!allowed) return res.status(403).json({ error: "No tiene permiso para esta acción" });
      next();
    } catch (error) { next(error); }
  };
}

function requireResourcePermission(action) {
  const moduleByResource = {
    socios: "socios", usuarios: "usuarios", ahorros: "ahorros", prestamos: "prestamos",
    actividades: "actividades", rifas: "rifas", vigencias: "vigencias"
  };
  return (req, res, next) => {
    const module = moduleByResource[req.params.resource];
    if (!module) return res.status(404).json({ error: "Recurso no disponible" });
    return requirePermission(module, action)(req, res, next);
  };
}

async function applyFieldPermissions(role, module, items) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const permissions = await prisma.roleFieldPermission.findMany({ where: { role, module } });
  const configured = new Map(permissions.map((permission) => [permission.field, permission.visible]));
  const safeDefaults = {
    dashboard: ["totalAhorrado", "totalPrestado", "carteraPendiente", "deudasPendientes", "numeroRifa", "gananciasPropias", "valorProyectadoLiquidacion", "rifasPendientes"],
    socios: ["id", "firstName", "lastName", "raffleNumber", "status"],
    ahorros: ["id", "date", "amount", "observation"],
    prestamos: ["id", "borrowerName", "type", "principal", "balance", "rate", "status", "date", "pendingInterest", "generatedInterest"],
    pagos: ["id", "loanId", "loan", "recordedByUser", "date", "amount", "principal", "interest", "mora", "previousBalance", "newBalance", "observations", "annulledAt"],
  actividades: ["id", "name", "description", "date", "participantCost", "participants"],
    rifas: ["id", "date", "winningNumber", "winnerId", "winner", "prize", "distributions"],
    deudas: ["id", "loanId", "memberId", "member", "borrowerName", "concept", "principal", "capitalPendiente", "interesesPendientes", "amount", "totalAbonado", "lastPaymentDate", "status", "paymentHistoryMismatch"],
    liquidaciones: ["id", "vigencia", "savings", "activityGain", "loanGain", "raffleGain", "raffleFeesDiscounted", "finalAmount"]
  }[module] || ["id"];

  return items.map((item) => Object.fromEntries(
    Object.entries(item)
      .filter(([field]) => configured.has(field) ? configured.get(field) : role === "ADMINISTRADOR" || safeDefaults.includes(field))
      .map(([field, value]) => [
        field,
        value
      ])
  ));
}

async function applyObjectFieldPermissions(role, module, item) {
  const [filtered] = await applyFieldPermissions(role, module, [item]);
  return filtered;
}

async function audit(req, action, entity, entityId, metadata, client = prisma) {
  await client.auditLog.create({ data: { userId: req.user?.sub, action, entity, entityId, metadata: metadata ?? undefined, ipAddress: req.ip } });
}

async function ensureFutureRaffleEntries(tx, member) {
  if (member.status !== "ACTIVO" || member.deletedAt || !["SOCIO", "ADMINISTRADOR"].includes(member.role)) return 0;
  if (member.role === "ADMINISTRADOR") {
    const saving = await tx.saving.findFirst({
      where: { memberId: member.id, vigenciaId: member.vigenciaId, deletedAt: null },
      select: { id: true }
    });
    if (!saving) return 0;
  }

  const now = new Date();
  const program = await tx.raffleProgram.findUnique({
    where: { vigenciaId: member.vigenciaId },
    select: {
      months: { where: { drawAt: { gt: now }, finalizedAt: null }, select: { id: true, monthlyAmount: true } }
    }
  });
  if (!program?.months.length) return 0;

  const created = await tx.raffleMemberPayment.createMany({
    data: program.months.map((month) => ({
      id: crypto.randomUUID(),
      raffleMonthId: month.id,
      memberId: member.id,
      amount: month.monthlyAmount
    })),
    skipDuplicates: true
  });
  return created.count;
}

async function recalculateActivityGains(tx, activity) {
  const sales = await tx.activitySale.findMany({ where: { activityId: activity.id } });
  let totals;
  try {
    totals = calculateActivityTotals(activity, sales);
  } catch (error) {
    if (error instanceof RangeError) error.status = 400;
    throw error;
  }
  const participants = await tx.activityParticipant.findMany({
    where: { activityId: activity.id },
    select: { memberId: true }
  });
  if (!participants.length) return;

  const savings = await tx.saving.groupBy({
    by: ["memberId"],
    where: {
      memberId: { in: participants.map(({ memberId }) => memberId) },
      vigenciaId: activity.vigenciaId,
      deletedAt: null
    },
    _sum: { amount: true }
  });
  const savingsByMember = new Map(savings.map((row) => [row.memberId, Number(row._sum.amount || 0)]));
  const gains = calculateActivityGains({
    ...totals,
    participants: participants.map(({ memberId }) => ({
      id: memberId,
      savings: savingsByMember.get(memberId) || 0
    }))
  });

  for (const { memberId, gain } of gains) {
    await tx.activityParticipant.update({
      where: { activityId_memberId: { activityId: activity.id, memberId } },
      data: { gain }
    });
  }
}

function parseActivityProduct(body) {
  if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 200) {
    const error = new Error("Ingrese el producto (máximo 200 caracteres)");
    error.status = 400;
    throw error;
  }
  const unitCost = parseActivityAmount(body.unitCost, "Costo unitario");
  const unitPrice = parseActivityAmount(body.unitPrice, "Precio unitario");
  return { name: body.name.trim(), unitCost, unitPrice };
}

function parseSaleQuantity(value, unitCost, unitPrice) {
  const quantity = Number(value);
  try {
    calculateSaleTotals({ quantity, unitCost, unitPrice });
  } catch (error) {
    if (error instanceof RangeError) error.status = 400;
    throw error;
  }
  return quantity;
}

function parseActivityAmount(value, label) {
  if (value === undefined || value === null || String(value).trim() === "") {
    const error = new Error(`${label} es obligatorio`);
    error.status = 400;
    throw error;
  }
  const raw = String(value).trim();
  const amount = Number(raw);
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(raw) || !Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100))) {
    const error = new Error(`${label} debe ser un valor no negativo con máximo dos decimales`);
    error.status = 400;
    throw error;
  }
  return roundMoney(amount);
}

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "La Natillera de Lili" }));

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const login = email || username;
    const user = await prisma.user.findFirst({ where: { OR: [{ email: login }, { username: login }] } });
    if (!user) {
      await prisma.accessLog.create({ data: { event: "LOGIN_FAILED", success: false, ipAddress: req.ip, userAgent: req.get("user-agent") } });
      return res.status(401).json({ error: "Credenciales inválidas o cuenta no disponible" });
    }
    if (user.deletedAt || user.status !== "ACTIVO" || (user.lockedUntil && user.lockedUntil > new Date())) {
      await prisma.accessLog.create({ data: { userId: user.id, event: "LOGIN_REJECTED", success: false, ipAddress: req.ip, userAgent: req.get("user-agent") } });
      return res.status(401).json({ error: "Credenciales inválidas o cuenta no disponible" });
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      const attempts = user.failedLoginAttempts + 1;
      const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: attempts, lockedUntil } });
      await prisma.accessLog.create({ data: { userId: user.id, event: "LOGIN_FAILED", success: false, ipAddress: req.ip, userAgent: req.get("user-agent") } });
      return res.status(401).json({ error: lockedUntil ? "Cuenta bloqueada por 15 minutos tras varios intentos" : "Credenciales inválidas" });
    }
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await prisma.accessLog.create({ data: { userId: user.id, event: "LOGIN_SUCCESS", success: true, ipAddress: req.ip, userAgent: req.get("user-agent") } });
    const accessToken = signAccessToken(user);
    const refreshToken = crypto.randomBytes(48).toString("hex");
    await prisma.refreshToken.create({
      data: {
        tokenHash: crypto.createHash("sha256").update(refreshToken).digest("hex"),
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });
    res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, role: user.role, username: user.username, firstName: user.firstName, lastName: user.lastName } });
  } catch (error) { next(error); }
});

app.post("/api/auth/refresh", async (req, res, next) => {
  try {
    const tokenHash = crypto.createHash("sha256").update(req.body.refreshToken || "").digest("hex");
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!stored || stored.user.deletedAt || stored.user.status !== "ACTIVO" || stored.revokedAt || stored.expiresAt < new Date()) return res.status(401).json({ error: "Refresh token inválido" });
    res.json({ accessToken: signAccessToken(stored.user) });
  } catch (error) { next(error); }
});

app.use("/api", authenticate);

app.post("/api/auth/cambiar-clave", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, message: { error: "Demasiados intentos. Inténtelo más tarde" } }), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true, passwordHash: true } });
    if (!user) return res.status(401).json({ error: "Cuenta no disponible" });
    const error = await verifyPasswordChange(req.body.currentPassword, req.body.newPassword, user.passwordHash);
    if (error) return res.status(400).json({ error });
    const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    const updated = await savePasswordChange(prisma, user, passwordHash);
    if (!updated) return res.status(409).json({ error: "La cuenta o contraseña cambió; vuelva a intentarlo" });
    await audit(req, "CHANGE_PASSWORD", "user", user.id);
    res.json({ message: "Contraseña actualizada. Inicie sesión nuevamente." });
  } catch (error) { next(error); }
});

app.use("/api", (req, res, next) => {
  if (!canAccessWithoutMember(req.user.role, req.memberId, req.path)) {
    return res.status(403).json({ error: "Su cuenta aún no tiene un perfil de socio asociado. Solicite la vinculación al administrador." });
  }
  next();
});

app.get("/api/auth/permisos", async (req, res, next) => {
  try {
    const configured = await prisma.rolePermission.findMany({ where: { role: req.user.role } });
    const permissions = Object.fromEntries(permissionModules.map((module) => [module, Object.fromEntries(
      permissionActions.map((action) => {
        const found = configured.find((item) => item.module === module && item.action === action);
        return [action, found ? found.allowed : defaultPermission(req.user.role, module, action)];
      })
    )]));
    res.json({ role: req.user.role, permissions });
  } catch (error) { next(error); }
});

function paginate(query) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}

function utcDay(value) {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

async function accrueLoanInterest(now = new Date(), client = prisma) {
  const loans = await client.loan.findMany({
    where: { status: "ACTIVO", balance: { gt: 0 }, deletedAt: null },
    select: { id: true, balance: true, rate: true, pendingInterest: true, generatedInterest: true, interestAnchorAt: true, lastInterestAt: true }
  });
  for (const loan of loans) {
    const accrual = calculateMonthlyInterest({
      balance: loan.balance, rate: loan.rate, anchorAt: loan.interestAnchorAt,
      lastAccruedAt: loan.lastInterestAt, now
    });
    if (!accrual.periods) continue;
    await client.loan.updateMany({
      where: {
        id: loan.id,
        lastInterestAt: loan.lastInterestAt,
        balance: loan.balance,
        pendingInterest: loan.pendingInterest,
        interestAnchorAt: loan.interestAnchorAt,
        rate: loan.rate,
        status: "ACTIVO"
      },
      data: {
        pendingInterest: roundMoney(Number(loan.pendingInterest) + accrual.generated),
        generatedInterest: roundMoney(Number(loan.generatedInterest) + accrual.generated),
        lastInterestAt: accrual.lastAccruedAt
      }
    });
  }
}

async function resolveVigenciaId(vigenciaId) {
  if (vigenciaId) return vigenciaId;
  const vigencia = await prisma.vigencia.findFirst({ where: { deletedAt: null, status: "ABIERTA" }, orderBy: { year: "desc" } });
  return vigencia?.id;
}

app.get("/api/vigencias", requirePermission("vigencias", "consultar"), requireAdmin, async (req, res, next) => {
  try {
    const p = paginate(req.query);
    const where = { deletedAt: null };
    if (req.query.status) where.status = req.query.status;
    if (req.query.vigenciaId) where.vigenciaId = req.query.vigenciaId;
    if (req.query.search) {
      const year = Number(req.query.search);
      if (Number.isInteger(year)) where.year = year;
    }
    const [items, total] = await Promise.all([
      prisma.vigencia.findMany({ where, skip: p.skip, take: p.take, orderBy: { year: "desc" } }),
      prisma.vigencia.count({ where })
    ]);
    res.json({ items, total, page: p.page, pageSize: p.pageSize });
  } catch (error) { next(error); }
});

app.post("/api/vigencias", requirePermission("vigencias", "crear"), requireAdmin, async (req, res, next) => {
  try {
    const year = Number(req.body.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: "Debe indicar un año de vigencia válido" });
    }
    const item = await prisma.vigencia.create({ data: { year, status: "ABIERTA" } });
    await audit(req, "CREATE", "vigencia", item.id, { year: item.year });
    res.status(201).json(item);
  } catch (error) { next(error); }
});

app.patch("/api/vigencias/:id", requirePermission("vigencias", "editar"), requireAdmin, async (req, res, next) => {
  try {
    const item = await prisma.vigencia.update({ where: { id: req.params.id }, data: { status: req.body.status, closedAt: req.body.status === "CERRADA" ? new Date() : undefined } });
    await audit(req, "UPDATE", "vigencia", item.id, { status: item.status });
    res.json(item);
  } catch (error) { next(error); }
});

app.get("/api/socios", requirePermission("socios", "consultar"), async (req, res, next) => {
  try {
    const p = paginate(req.query);
    const where = { deletedAt: null };
    if (req.user.role === "SOCIO") {
      if (!req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
      where.id = req.memberId;
    }
    if (req.query.vigenciaId) where.vigenciaId = req.query.vigenciaId;
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) where.OR = [
      { firstName: { contains: req.query.search, mode: "insensitive" } },
      { lastName: { contains: req.query.search, mode: "insensitive" } },
      { document: { contains: req.query.search, mode: "insensitive" } }
    ];
    const [items, total] = await Promise.all([prisma.member.findMany({ where, skip: p.skip, take: p.take, orderBy: { lastName: "asc" }, include: { vigencia: true } }), prisma.member.count({ where })]);
    res.json({ items: await applyFieldPermissions(req.user.role, "socios", items), total, page: p.page, pageSize: p.pageSize });
  } catch (error) { next(error); }
});

app.get("/api/perfil", requirePermission("perfil", "consultar"), async (req, res, next) => {
  try {
    if (!req.memberId) return res.status(404).json({ error: "No hay un perfil de socio asociado a esta cuenta" });
    const member = await prisma.member.findFirst({ where: { id: req.memberId, deletedAt: null }, include: { vigencia: true } });
    if (!member) return res.status(404).json({ error: "Perfil no encontrado" });
    const [item] = await applyFieldPermissions(req.user.role, "socios", [member]);
    res.json({ items: [item], total: 1 });
  } catch (error) { next(error); }
});

app.post("/api/socios", requirePermission("socios", "crear"), requireAdmin, async (req, res, next) => {
  try {
    const vigenciaId = await resolveVigenciaId(req.body.vigenciaId);
    if (!vigenciaId) return res.status(400).json({ error: "Debe existir una vigencia abierta" });
    if (!req.body.document?.trim() || !req.body.firstName?.trim() || !req.body.lastName?.trim()) {
      return res.status(400).json({ error: "Documento, nombres y apellidos son obligatorios" });
    }
    const item = await prisma.$transaction(async (tx) => {
      const member = await tx.member.create({ data: {
        document: req.body.document,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        birthDate: req.body.birthDate ? new Date(req.body.birthDate) : undefined,
        phone: req.body.phone,
        email: req.body.email,
        address: req.body.address,
        raffleNumber: req.body.raffleNumber,
        role: req.body.role || "SOCIO",
        status: req.body.status || "ACTIVO",
        vigenciaId
      } });
      if (member.role === "SOCIO") await ensureFutureRaffleEntries(tx, member);
      return member;
    }, { isolationLevel: "Serializable" });
    await audit(req, "CREATE", "member", item.id, { document: item.document });
    res.status(201).json(item);
  } catch (error) { next(error); }
});

app.patch("/api/socios/:id", requirePermission("socios", "editar"), requireAdmin, async (req, res, next) => {
  try {
    const item = await prisma.$transaction(async (tx) => {
      const member = await tx.member.update({ where: { id: req.params.id }, data: req.body });
      await ensureFutureRaffleEntries(tx, member);
      return member;
    }, { isolationLevel: "Serializable" });
    await audit(req, "UPDATE", "member", item.id, req.body);
    res.json(item);
  } catch (error) { next(error); }
});

app.get("/api/ahorros", requirePermission("ahorros", "consultar"), async (req, res, next) => {
  try {
    const p = paginate(req.query);
    const where = { deletedAt: null };
    if (req.user.role === "SOCIO") {
      if (!req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
      where.memberId = req.memberId;
    }
    if (req.query.memberId) where.memberId = req.query.memberId;
    if (req.query.vigenciaId) where.vigenciaId = req.query.vigenciaId;
    if (req.query.search) where.OR = [
      { observation: { contains: req.query.search, mode: "insensitive" } },
      { member: { OR: [
        { firstName: { contains: req.query.search, mode: "insensitive" } },
        { lastName: { contains: req.query.search, mode: "insensitive" } },
        { document: { contains: req.query.search, mode: "insensitive" } }
      ] } }
    ];
    const [items, total, totals] = await Promise.all([
      prisma.saving.findMany({ where, skip: p.skip, take: p.take, orderBy: { date: "desc" }, include: { member: true, vigencia: true } }),
      prisma.saving.count({ where }),
      prisma.saving.aggregate({ where, _sum: { amount: true } })
    ]);
    res.json({ items: await applyFieldPermissions(req.user.role, "ahorros", items), total, sum: totals._sum.amount || 0, page: p.page, pageSize: p.pageSize });
  } catch (error) { next(error); }
});

app.post("/api/ahorros", requirePermission("ahorros", "crear"), requireAdmin, async (req, res, next) => {
  try {
    const vigenciaId = await resolveVigenciaId(req.body.vigenciaId);
    const amount = Number(req.body.amount);
    if (!req.body.memberId || !vigenciaId || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Socio, vigencia y monto válido son obligatorios" });
    }
    const result = await prisma.$transaction(async (tx) => {
      const period = await tx.vigencia.findFirst({ where: { id: vigenciaId, deletedAt: null, status: "ABIERTA" } });
      if (!period) {
        const error = new Error("Solo se pueden registrar ahorros en una vigencia abierta");
        error.status = 409;
        throw error;
      }
      const member = await tx.member.findFirst({
        where: { id: req.body.memberId, vigenciaId, status: "ACTIVO", deletedAt: null }
      });
      if (!member) {
        const error = new Error("El socio debe estar activo y pertenecer a la vigencia seleccionada");
        error.status = 400;
        throw error;
      }
      const item = await tx.saving.create({
        data: {
          memberId: req.body.memberId,
          vigenciaId,
          amount,
          date: req.body.date ? new Date(req.body.date) : undefined,
          observation: req.body.observation
        }
      });
      await ensureFutureRaffleEntries(tx, member);
      return item;
    }, { isolationLevel: "Serializable" });
    const item = result;
    await audit(req, "CREATE", "saving", item.id, { amount: String(item.amount) });
    res.status(201).json(item);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.get("/api/prestamos", requirePermission("prestamos", "consultar"), async (req, res, next) => {
  try {
    await accrueLoanInterest();
    const p = paginate(req.query);
    const where = req.query.status ? { status: req.query.status, deletedAt: null } : { deletedAt: null };
    if (req.query.memberId) where.memberId = req.query.memberId;
    if (req.query.vigenciaId) where.vigenciaId = req.query.vigenciaId;
    if (req.query.search) where.OR = [
      { borrowerName: { contains: req.query.search, mode: "insensitive" } },
      { member: { OR: [
        { firstName: { contains: req.query.search, mode: "insensitive" } },
        { lastName: { contains: req.query.search, mode: "insensitive" } },
        { document: { contains: req.query.search, mode: "insensitive" } }
      ] } }
    ];
    if (req.user.role === "SOCIO") {
      if (!req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
      where.memberId = req.memberId;
    }
    const [items, total] = await Promise.all([prisma.loan.findMany({ where, skip: p.skip, take: p.take, orderBy: { date: "desc" }, include: { member: true, vigencia: true, payments: true } }), prisma.loan.count({ where })]);
    res.json({ items: await applyFieldPermissions(req.user.role, "prestamos", items), total, page: p.page, pageSize: p.pageSize });
  } catch (error) { next(error); }
});

app.post("/api/prestamos", requirePermission("prestamos", "crear"), requireAdmin, async (req, res, next) => {
  try {
    const principal = parseActivityAmount(req.body.principal, "Monto");
    const termsError = validateLoanTerms(req.body);
    if (termsError) return res.status(400).json({ error: termsError });
    const rate = Number(req.body.rate);
    const vigenciaId = await resolveVigenciaId(req.body.vigenciaId);
    const loanDate = req.body.date ? new Date(req.body.date) : new Date();
    if (!vigenciaId || !Number.isFinite(principal) || principal <= 0 || Number.isNaN(loanDate.getTime()) || loanDate > new Date()) {
      return res.status(400).json({ error: "Deudor, vigencia, monto y tasa válida son obligatorios" });
    }
    const item = await createLoan(prisma, { ...req.body, principal, vigenciaId, date: loanDate });
    await audit(req, "CREATE", "loan", item.id, { principal, rate, type: item.type, memberId: item.memberId });
    res.status(201).json(item);
  } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); }
});

app.patch("/api/prestamos/:id", requirePermission("prestamos", "editar"), requireAdmin, async (req, res, next) => {
  try {
    await accrueLoanInterest();
    const allowed = ["type", "memberId", "borrowerName", "principal", "rate", "date", "interestStartDays", "observations"];
    const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (!Object.keys(data).length) return res.status(400).json({ error: "No hay cambios para guardar" });
    if ("observations" in data && typeof data.observations !== "string") return res.status(400).json({ error: "Las observaciones deben ser texto" });
    if ("principal" in data) {
      data.principal = parseActivityAmount(data.principal, "Monto");
      if (data.principal <= 0) return res.status(400).json({ error: "El monto debe ser mayor que cero" });
    }
    if ("date" in data) {
      if (typeof data.date !== "string" || !data.date.trim()) return res.status(400).json({ error: "Indique una fecha de desembolso válida" });
      data.date = new Date(data.date);
    }
    const item = await updateLoan(prisma, req.params.id, data);
    await audit(req, "UPDATE", "loan", item.id, { fields: Object.keys(data) });
    res.json(item);
  } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); }
});

app.get("/api/prestamos/resumen", requirePermission("prestamos", "consultar"), async (req, res, next) => {
  try {
    await accrueLoanInterest();
    const loanWhere = { deletedAt: null, ...(req.query.vigenciaId ? { vigenciaId: req.query.vigenciaId } : {}) };
    if (req.user.role === "SOCIO") {
      if (!req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
      loanWhere.memberId = req.memberId;
    }
    const [loans, payments, memberCount] = await Promise.all([
      prisma.loan.findMany({ where: loanWhere, select: { memberId: true, principal: true, balance: true, pendingInterest: true, generatedInterest: true, status: true } }),
      prisma.loanPayment.findMany({ where: { loan: loanWhere, annulledAt: null }, select: { principal: true, interest: true } }),
      req.user.role === "SOCIO"
        ? Promise.resolve(1)
        : prisma.member.count({ where: { status: "ACTIVO", ...(req.query.vigenciaId ? { vigenciaId: req.query.vigenciaId } : {}) } })
    ]);
    const membersWithDebt = new Set(
      loans.filter((loan) => Number(loan.balance) > 0 || Number(loan.pendingInterest) > 0)
        .map((loan) => loan.memberId)
        .filter(Boolean)
    ).size;
    const summary = {
      capitalPrestadoTotal: loans.reduce((sum, loan) => sum + Number(loan.principal), 0),
      capitalRecuperado: payments.reduce((sum, payment) => sum + Number(payment.principal), 0),
      capitalPendiente: loans.reduce((sum, loan) => sum + Number(loan.balance), 0),
      interesesGenerados: loans.reduce((sum, loan) => sum + Number(loan.generatedInterest), 0),
      interesesPendientes: loans.reduce((sum, loan) => sum + Number(loan.pendingInterest), 0),
      interesesRecaudados: payments.reduce((sum, payment) => sum + Number(payment.interest), 0),
      prestamosActivos: loans.filter((loan) => loan.status === "ACTIVO").length,
      prestamosFinalizados: loans.filter((loan) => ["FINALIZADO", "PAGADO"].includes(loan.status)).length,
      prestamosConDeuda: loans.filter((loan) => Number(loan.balance) > 0 || Number(loan.pendingInterest) > 0).length,
      sociosConDeuda: membersWithDebt,
      sociosAlDia: Math.max(0, memberCount - membersWithDebt)
    };
    summary.gananciasDistribuibles = summary.interesesRecaudados;
    res.json(summary);
  } catch (error) { next(error); }
});

app.post("/api/pagos", requirePermission("pagos", "crear"), requireAdmin, async (req, res, next) => {
  try {
    await accrueLoanInterest();
    const amount = Number(req.body.amount);
    const paymentDate = req.body.date ? new Date(req.body.date) : new Date();
    if (!req.body.loanId || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Préstamo y valor de pago válido son obligatorios" });
    if (Number.isNaN(paymentDate.getTime()) || paymentDate > new Date()) return res.status(400).json({ error: "La fecha del pago no es válida" });
    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({ where: { id: req.body.loanId } });
      if (!loan) return { error: "Préstamo no encontrado", status: 404 };
      if (loan.status !== "ACTIVO") return { error: "El préstamo no está activo", status: 400 };
      if (utcDay(paymentDate) < utcDay(loan.date)) return { error: "La fecha del pago no puede ser anterior al desembolso", status: 400 };
      if (utcDay(paymentDate) < utcDay(loan.lastInterestAt)) return { error: "La fecha del pago no puede ser anterior al último cálculo de intereses", status: 400 };
      const balanceBefore = roundMoney(Number(loan.balance));
      const allocation = allocatePayment(amount, balanceBefore, loan.pendingInterest);
      if (!allocation) return { error: "El pago supera el total adeudado del préstamo", status: 400 };
      const payment = await tx.loanPayment.create({ data: {
        loanId: loan.id,
        amount: allocation.amount,
        principal: allocation.principal,
        interest: allocation.interest,
        mora: 0,
        previousBalance: balanceBefore,
        newBalance: allocation.balance,
        observations: req.body.observations || null,
        recordedBy: req.user.sub,
        date: paymentDate
      } });
      await tx.loan.update({ where: { id: loan.id }, data: {
        balance: allocation.balance,
        pendingInterest: allocation.pendingInterest,
        status: allocation.balance === 0 && allocation.pendingInterest === 0 ? "FINALIZADO" : "ACTIVO"
      } });
      return { payment };
    }, { isolationLevel: "Serializable" });
    if (result.error) return res.status(result.status).json({ error: result.error });
    const { payment } = result;
    await audit(req, "CREATE", "loan_payment", payment.id, { loanId: payment.loanId, amount, interest: payment.interest, principal: payment.principal });
    res.status(201).json(payment);
  } catch (error) { next(error); }
});

app.get("/api/pagos", requirePermission("pagos", "consultar"), async (req, res, next) => {
  try {
    await accrueLoanInterest();
    const p = paginate(req.query);
    const loanWhere = {};
    if (req.user.role === "SOCIO") {
      if (!req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
      loanWhere.memberId = req.memberId;
    }
    const where = { loan: loanWhere };
    if (req.query.loanId) where.loanId = req.query.loanId;
    if (req.query.status === "ANULADO") where.annulledAt = { not: null };
    if (req.query.status === "REGISTRADO") where.annulledAt = null;
    if (req.query.date) {
      const day = new Date(`${req.query.date}T00:00:00.000Z`);
      const nextDay = new Date(day);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      where.date = { gte: day, lt: nextDay };
    }
    if (req.query.search) where.loan = {
      ...loanWhere,
      OR: [
        { borrowerName: { contains: req.query.search, mode: "insensitive" } },
        { member: { OR: [
          { firstName: { contains: req.query.search, mode: "insensitive" } },
          { lastName: { contains: req.query.search, mode: "insensitive" } }
        ] } }
      ]
    };
    const [items, total] = await Promise.all([
      prisma.loanPayment.findMany({ where, skip: p.skip, take: p.take, orderBy: { date: "desc" }, include: { loan: { include: { member: true } }, recordedByUser: { select: { firstName: true, lastName: true } } } }),
      prisma.loanPayment.count({ where })
    ]);
    res.json({ items: await applyFieldPermissions(req.user.role, "pagos", items), total, page: p.page, pageSize: p.pageSize });
  } catch (error) { next(error); }
});

async function paymentBelongsToClosedSettlement(tx, payment) {
  if (payment.loan.vigencia.status !== "LIQUIDADA") return false;
  const last = await tx.liquidation.findFirst({
    where: { vigenciaId: payment.loan.vigenciaId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true }
  });
  return !last || payment.createdAt <= last.createdAt;
}

app.patch("/api/pagos/:id", requirePermission("pagos", "editar"), requireAdmin, async (req, res, next) => {
  try {
    await accrueLoanInterest();
    const paymentDate = req.body.date ? new Date(req.body.date) : null;
    if (paymentDate && (Number.isNaN(paymentDate.getTime()) || paymentDate > new Date())) return res.status(400).json({ error: "La fecha del pago no es válida" });
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.loanPayment.findUnique({ where: { id: req.params.id }, include: { loan: { include: { vigencia: true } } } });
      if (!payment || payment.annulledAt) return { error: "Pago activo no encontrado", status: 404 };
      if (await paymentBelongsToClosedSettlement(tx, payment)) return { error: "No se puede modificar un pago incluido en una liquidación", status: 409 };
      if (paymentDate && utcDay(paymentDate) < utcDay(payment.loan.date)) return { error: "La fecha del pago no puede ser anterior al desembolso", status: 400 };
      if (paymentDate && utcDay(paymentDate) < utcDay(payment.loan.lastInterestAt)) return { error: "La fecha del pago no puede ser anterior al último cálculo de intereses", status: 400 };
      const laterPayment = await tx.loanPayment.findFirst({ where: { loanId: payment.loanId, annulledAt: null, createdAt: { gt: payment.createdAt } } });
      if (laterPayment || utcDay(payment.loan.lastInterestAt) > utcDay(payment.date)) return { error: "No se puede editar un pago después de pagos o intereses posteriores; anúlelo mediante el procedimiento contable", status: 409 };
      const amount = req.body.amount === undefined ? Number(payment.amount) : Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return { error: "El valor del pago debe ser mayor que cero", status: 400 };
      const loan = payment.loan;
      const priorBalance = roundMoney(Number(loan.balance) + Number(payment.principal));
      const priorInterest = roundMoney(Number(loan.pendingInterest) + Number(payment.interest));
      const allocation = allocatePayment(amount, priorBalance, priorInterest);
      if (!allocation) return { error: "El pago supera el total adeudado del préstamo", status: 400 };
      const updated = await tx.loanPayment.update({ where: { id: payment.id }, data: {
        amount: allocation.amount, interest: allocation.interest, principal: allocation.principal,
        previousBalance: priorBalance, newBalance: allocation.balance,
        observations: req.body.observations === undefined ? payment.observations : req.body.observations,
        date: paymentDate || payment.date
      } });
      await tx.loan.update({ where: { id: loan.id }, data: {
        balance: allocation.balance, pendingInterest: allocation.pendingInterest,
        status: allocation.balance === 0 && allocation.pendingInterest === 0 ? "FINALIZADO" : "ACTIVO"
      } });
      return { payment: updated };
    }, { isolationLevel: "Serializable" });
    if (result.error) return res.status(result.status).json({ error: result.error });
    await audit(req, "UPDATE", "loan_payment", result.payment.id, { amount: String(result.payment.amount) });
    res.json(result.payment);
  } catch (error) { next(error); }
});

app.delete("/api/pagos/:id", requirePermission("pagos", "eliminar"), requireAdmin, async (req, res, next) => {
  try {
    await accrueLoanInterest();
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.loanPayment.findUnique({ where: { id: req.params.id }, include: { loan: { include: { vigencia: true } } } });
      if (!payment || payment.annulledAt) return { error: "Pago activo no encontrado", status: 404 };
      if (await paymentBelongsToClosedSettlement(tx, payment)) return { error: "No se puede anular un pago incluido en una liquidación", status: 409 };
      const laterPayment = await tx.loanPayment.findFirst({ where: { loanId: payment.loanId, annulledAt: null, createdAt: { gt: payment.createdAt } } });
      if (laterPayment || utcDay(payment.loan.lastInterestAt) > utcDay(payment.date)) return { error: "No se puede anular un pago después de pagos o intereses posteriores; primero debe corregirse el movimiento más reciente", status: 409 };
      const loan = payment.loan;
      const balance = roundMoney(Number(loan.balance) + Number(payment.principal));
      const pendingInterest = roundMoney(Number(loan.pendingInterest) + Number(payment.interest));
      const annulled = await tx.loanPayment.update({ where: { id: payment.id }, data: {
        annulledAt: new Date(), annulledBy: req.user.sub,
        cancellationReason: req.body.reason || "Anulación administrativa"
      } });
      await tx.loan.update({ where: { id: loan.id }, data: { balance, pendingInterest, status: "ACTIVO" } });
      return { payment: annulled };
    }, { isolationLevel: "Serializable" });
    if (result.error) return res.status(result.status).json({ error: result.error });
    await audit(req, "ANNUL", "loan_payment", result.payment.id, { reason: result.payment.cancellationReason });
    res.json({ id: result.payment.id, annulledAt: result.payment.annulledAt });
  } catch (error) { next(error); }
});

app.get("/api/actividades", requirePermission("actividades", "consultar"), async (req, res, next) => {
  try {
    const p = paginate(req.query);
    const where = req.user.role === "SOCIO"
      ? { deletedAt: null, OR: [{ participants: { some: { memberId: req.memberId || "" } } }, { sales: { some: { memberId: req.memberId || "" } } }] }
      : { deletedAt: null };
    if (req.query.vigenciaId) where.vigenciaId = req.query.vigenciaId;
    if (req.query.search) where.AND = [{ OR: [
      { name: { contains: req.query.search, mode: "insensitive" } },
      { description: { contains: req.query.search, mode: "insensitive" } }
    ] }];
    if (req.query.date) {
      const day = new Date(`${req.query.date}T00:00:00.000Z`);
      const nextDay = new Date(day);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      where.date = { gte: day, lt: nextDay };
    }
    const [items, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { date: "desc" },
        include: {
          vigencia: true,
          participants: {
            where: req.user.role === "SOCIO" ? { memberId: req.memberId } : undefined,
            include: {
              member: true,
              payments: {
                orderBy: { paidAt: "asc" },
                include: { recordedBy: { select: { firstName: true, lastName: true } } }
              }
            },
            orderBy: { member: { lastName: "asc" } }
          }
        }
      }),
      prisma.activity.count({ where })
    ]);
    const withBalances = items.map((activity) => ({
      ...activity,
      participants: activity.participants.map((participant) => {
        const balance = calculateParticipantBalance(
          activity.participantCost,
          participant.payments.map((payment) => payment.amount)
        );
        return {
          ...participant,
          ...balance,
          paymentStatus: balance.balance === 0
            ? "PAGADO"
            : Number(balance.amountPaid) > 0
              ? "ABONADO"
              : "PENDIENTE"
        };
      })
    }));
    res.json({ items: await applyFieldPermissions(req.user.role, "actividades", withBalances), total, page: p.page, pageSize: p.pageSize });
  } catch (error) { next(error); }
});

function requireActivityProductClient(_req, res, next) {
  if (!prisma.activityProduct) {
    return res.status(503).json({ error: "El cliente Prisma no incluye el catálogo de productos. Detenga el backend, ejecute pnpm --filter @natillera/backend prisma:generate y reinicie el backend." });
  }
  next();
}

app.get("/api/actividades/:id/productos", requirePermission("actividades", "consultar"), requireAdmin, requireActivityProductClient, async (req, res, next) => {
  try {
    const activity = await prisma.activity.findFirst({ where: { id: req.params.id, deletedAt: null }, select: { id: true } });
    if (!activity) return res.status(404).json({ error: "Actividad no encontrada" });
    const items = await prisma.activityProduct.findMany({ where: { activityId: activity.id }, orderBy: [{ name: "asc" }, { id: "asc" }] });
    res.json({ items });
  } catch (error) { next(error); }
});

app.post("/api/actividades/:id/productos", requirePermission("actividades", "editar"), requireAdmin, requireActivityProductClient, async (req, res, next) => {
  try {
    const data = parseActivityProduct(req.body);
    const product = await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.findFirst({ where: { id: req.params.id, deletedAt: null }, include: { vigencia: true } });
      if (!activity) { const error = new Error("Actividad no encontrada"); error.status = 404; throw error; }
      if (activity.vigencia.status !== "ABIERTA") { const error = new Error("La vigencia no está abierta"); error.status = 409; throw error; }
      return tx.activityProduct.create({ data: { ...data, activityId: activity.id } });
    }, { isolationLevel: "Serializable" });
    await audit(req, "CREATE", "activity_product", product.id, { activityId: req.params.id, ...data });
    res.status(201).json(product);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.put("/api/actividades/:id/productos/:productId", requirePermission("actividades", "editar"), requireAdmin, requireActivityProductClient, async (req, res, next) => {
  try {
    const data = parseActivityProduct(req.body);
    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.activityProduct.findFirst({
        where: { id: req.params.productId, activityId: req.params.id, activity: { deletedAt: null } },
        include: { activity: { include: { vigencia: true } } }
      });
      if (!existing) { const error = new Error("Producto no encontrado"); error.status = 404; throw error; }
      if (existing.activity.vigencia.status !== "ABIERTA") { const error = new Error("La vigencia no está abierta"); error.status = 409; throw error; }
      return tx.activityProduct.update({ where: { id: existing.id }, data });
    }, { isolationLevel: "Serializable" });
    await audit(req, "UPDATE", "activity_product", product.id, { activityId: req.params.id, ...data });
    res.json(product);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.get("/api/actividades/:id/ventas", requirePermission("actividades", "consultar"), async (req, res, next) => {
  try {
    if (req.user.role === "SOCIO" && !req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
    const activity = await prisma.activity.findFirst({
      where: {
        id: req.params.id, deletedAt: null,
        ...(req.user.role === "SOCIO" ? { OR: [
          { participants: { some: { memberId: req.memberId } } },
          { sales: { some: { memberId: req.memberId } } }
        ] } : {})
      }, select: { id: true }
    });
    if (!activity) return res.status(404).json({ error: "Actividad no encontrada" });
    const sales = await prisma.activitySale.findMany({
      where: { activityId: activity.id, ...(req.user.role === "SOCIO" ? { memberId: req.memberId } : {}) },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        payments: { orderBy: { paidAt: "asc" }, include: { recordedBy: { select: { firstName: true, lastName: true } } } }
      }, orderBy: { createdAt: "asc" }
    });
    res.json({ items: sales.map(saleWithBalance) });
  } catch (error) { next(error); }
});

app.post("/api/actividades/:id/ventas", requirePermission("actividades", "editar"), requireAdmin, requireActivityProductClient, async (req, res, next) => {
  try {
    if (typeof req.body.memberId !== "string" || !req.body.memberId) return res.status(400).json({ error: "Seleccione el socio comprador" });
    if (typeof req.body.productId !== "string" || !req.body.productId) return res.status(400).json({ error: "Seleccione un producto de la actividad" });
    const initialPayment = parseActivityAmount(req.body.initialPayment ?? 0, "Abono inicial");
    const sale = await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.findFirst({ where: { id: req.params.id, deletedAt: null }, include: { vigencia: true } });
      if (!activity) { const error = new Error("Actividad no encontrada"); error.status = 404; throw error; }
      if (activity.vigencia.status !== "ABIERTA") { const error = new Error("La vigencia no está abierta"); error.status = 409; throw error; }
      const member = await tx.member.findFirst({ where: { id: req.body.memberId, vigenciaId: activity.vigenciaId, status: "ACTIVO", deletedAt: null } });
      if (!member) { const error = new Error("El comprador debe ser un socio activo de la vigencia"); error.status = 400; throw error; }
      const product = await tx.activityProduct.findFirst({ where: { id: req.body.productId, activityId: activity.id } });
      if (!product) { const error = new Error("El producto no pertenece a esta actividad"); error.status = 400; throw error; }
      const quantity = parseSaleQuantity(req.body.quantity, product.unitCost, product.unitPrice);
      let saleData;
      try { saleData = snapshotSaleProduct(product, quantity, initialPayment); }
      catch (error) { if (error instanceof RangeError) error.status = 400; throw error; }
      const created = await tx.activitySale.create({
        data: {
          ...saleData,
          activityId: activity.id, memberId: member.id,
          ...(initialPayment > 0 ? { payments: { create: { amount: initialPayment, recordedById: req.user.sub } } } : {})
        }
      });
      await recalculateActivityGains(tx, activity);
      return created;
    }, { isolationLevel: "Serializable" });
    await audit(req, "CREATE", "activity_sale", sale.id, { activityId: req.params.id, memberId: req.body.memberId, productId: req.body.productId, quantity: sale.quantity, initialPayment });
    res.status(201).json(sale);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.put("/api/actividades/:id/ventas/:saleId", requirePermission("actividades", "editar"), requireAdmin, async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.activitySale.findFirst({
        where: { id: req.params.saleId, activityId: req.params.id, activity: { deletedAt: null } },
        include: { activity: { include: { vigencia: true } }, payments: true }
      });
      if (!sale) { const error = new Error("Venta no encontrada"); error.status = 404; throw error; }
      if (sale.activity.vigencia.status !== "ABIERTA") { const error = new Error("La vigencia no está abierta"); error.status = 409; throw error; }
      const quantity = parseSaleQuantity(req.body.quantity, sale.unitCost, sale.unitPrice);
      const paid = calculateParticipantBalance(0, sale.payments.map((payment) => payment.amount)).amountPaid;
      if (calculateSaleTotals({ quantity, unitCost: sale.unitCost, unitPrice: sale.unitPrice }).price < paid) { const error = new Error("El valor de la venta no puede ser menor que los abonos registrados"); error.status = 409; throw error; }
      const updated = await tx.activitySale.update({ where: { id: sale.id }, data: { quantity } });
      await recalculateActivityGains(tx, sale.activity);
      return updated;
    }, { isolationLevel: "Serializable" });
    await audit(req, "UPDATE", "activity_sale", result.id, { quantity: result.quantity });
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.delete("/api/actividades/:id/ventas/:saleId", requirePermission("actividades", "editar"), requireAdmin, async (req, res, next) => {
  try {
    await prisma.$transaction(async (tx) => {
      const sale = await tx.activitySale.findFirst({
        where: { id: req.params.saleId, activityId: req.params.id, activity: { deletedAt: null } },
        include: { activity: { include: { vigencia: true } }, payments: { select: { id: true } } }
      });
      if (!sale) { const error = new Error("Venta no encontrada"); error.status = 404; throw error; }
      if (sale.activity.vigencia.status !== "ABIERTA" || sale.payments.length) {
        const error = new Error("No se puede eliminar una venta con abonos o de una vigencia cerrada"); error.status = 409; throw error;
      }
      await tx.activitySale.delete({ where: { id: sale.id } });
      await recalculateActivityGains(tx, sale.activity);
    }, { isolationLevel: "Serializable" });
    await audit(req, "DELETE", "activity_sale", req.params.saleId, { activityId: req.params.id });
    res.json({ id: req.params.saleId });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.post("/api/actividades/:id/ventas/:saleId/abonos", requirePermission("actividades", "editar"), requireAdmin, async (req, res, next) => {
  try {
    const amount = parseActivityAmount(req.body.amount, "El abono");
    if (amount <= 0) return res.status(400).json({ error: "El abono debe ser mayor que cero" });
    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.activitySale.findFirst({
        where: { id: req.params.saleId, activityId: req.params.id, activity: { deletedAt: null } },
        include: { payments: true, activity: { include: { vigencia: true } } }
      });
      if (!sale) { const error = new Error("Venta no encontrada"); error.status = 404; throw error; }
      if (sale.activity.vigencia.status !== "ABIERTA") { const error = new Error("La vigencia no está abierta"); error.status = 409; throw error; }
      const balance = saleWithBalance(sale).balance;
      if (amount > balance) { const error = new Error(`El abono supera el saldo pendiente de ${balance}`); error.status = 400; throw error; }
      return tx.activitySalePayment.create({ data: {
        saleId: sale.id, amount, recordedById: req.user.sub, observations: req.body.observations || null
      } });
    }, { isolationLevel: "Serializable" });
    await audit(req, "PAYMENT", "activity_sale_payment", result.id, { saleId: req.params.saleId, amount });
    res.status(201).json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.post("/api/actividades", requirePermission("actividades", "crear"), requireAdmin, async (req, res, next) => {
  try {
    const vigenciaId = await resolveVigenciaId(req.body.vigenciaId);
    if (!req.body.name?.trim() || !vigenciaId) {
      return res.status(400).json({ error: "Nombre y vigencia son obligatorios" });
    }
    const income = parseActivityAmount(req.body.income, "Ingresos");
    const costs = parseActivityAmount(req.body.costs, "Costos");
    const participantCost = parseActivityAmount(req.body.participantCost ?? 0, "Valor por participante");
    const date = req.body.date ? new Date(req.body.date) : undefined;
    if (date && !Number.isFinite(date.getTime())) return res.status(400).json({ error: "Ingrese una fecha válida" });
    const memberIds = [...new Set(Array.isArray(req.body.participantIds) ? req.body.participantIds : [])];
    const item = await prisma.$transaction(async (tx) => {
      const vigencia = await tx.vigencia.findFirst({ where: { id: vigenciaId, deletedAt: null } });
      if (!vigencia) {
        const error = new Error("Vigencia no encontrada");
        error.status = 404;
        throw error;
      }
      if (vigencia.status !== "ABIERTA") {
        const error = new Error("Solo se pueden registrar actividades en una vigencia abierta");
        error.status = 409;
        throw error;
      }
      const activity = await tx.activity.create({
        data: {
          name: req.body.name.trim(),
          description: req.body.description || null,
          date,
          income,
          costs,
          participantCost,
          vigenciaId
        }
      });
      if (memberIds.length) {
        const members = await tx.member.findMany({
          where: { id: { in: memberIds }, vigenciaId, status: "ACTIVO", deletedAt: null },
          select: { id: true }
        });
        if (members.length !== memberIds.length) {
          const error = new Error("Todos los participantes deben ser socios activos de la vigencia");
          error.status = 400;
          throw error;
        }
        await tx.activityParticipant.createMany({
          data: memberIds.map((memberId) => ({ activityId: activity.id, memberId }))
        });
        await recalculateActivityGains(tx, activity);
      }
      return activity;
    }, { isolationLevel: "Serializable" });
    await audit(req, "CREATE", "activity", item.id, { income, costs, participantCost });
    res.status(201).json(item);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.patch("/api/actividades/:id", requirePermission("actividades", "editar"), requireAdmin, async (req, res, next) => {
  try {
    const data = {};
    for (const field of ["income", "costs", "participantCost"]) {
      if (Object.hasOwn(req.body, field)) {
        data[field] = parseActivityAmount(
          req.body[field],
          field === "participantCost" ? "Valor por participante" : field === "income" ? "Ingresos" : "Costos"
        );
      }
    }
    if (Object.hasOwn(req.body, "name")) {
      if (typeof req.body.name !== "string" || !req.body.name.trim()) return res.status(400).json({ error: "El nombre es obligatorio" });
      data.name = req.body.name.trim();
    }
    if (Object.hasOwn(req.body, "description")) data.description = req.body.description || null;
    if (Object.hasOwn(req.body, "date")) {
      const date = new Date(req.body.date);
      if (!Number.isFinite(date.getTime())) return res.status(400).json({ error: "Ingrese una fecha válida" });
      data.date = date;
    }
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.activity.findFirst({
        where: { id: req.params.id, deletedAt: null },
        include: { vigencia: { select: { status: true } } }
      });
      if (!existing) {
        const error = new Error("Actividad no encontrada");
        error.status = 404;
        throw error;
      }
      if (existing.vigencia.status !== "ABIERTA") {
        const error = new Error("No se puede modificar una actividad de una vigencia cerrada");
        error.status = 409;
        throw error;
      }
      const participantCost = data.participantCost ?? Number(existing.participantCost);
      if (participantCost < Number(existing.participantCost)) {
        const payments = await tx.activityParticipantPayment.findMany({
          where: { activityId: existing.id },
          select: { memberId: true, amount: true }
        });
        const paidByMember = new Map();
        for (const payment of payments) {
          paidByMember.set(payment.memberId, (paidByMember.get(payment.memberId) || 0) + Number(payment.amount));
        }
        if ([...paidByMember.values()].some((paid) => paid > participantCost)) {
          const error = new Error("El valor por participante no puede ser menor que un abono ya registrado");
          error.status = 409;
          throw error;
        }
      }
      const activity = await tx.activity.update({ where: { id: existing.id }, data });
      await recalculateActivityGains(tx, activity);
      return activity;
    }, { isolationLevel: "Serializable" });
    await audit(req, "UPDATE", "activity", result.id, data);
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.put("/api/actividades/:id/participantes", requirePermission("actividades", "editar"), requireAdmin, async (req, res, next) => {
  try {
    if (!Array.isArray(req.body.memberIds)) return res.status(400).json({ error: "Envíe la lista de socios participantes" });
    const memberIds = [...new Set(req.body.memberIds)];
    const result = await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.findFirst({
        where: { id: req.params.id, deletedAt: null },
        include: { vigencia: { select: { status: true } } }
      });
      if (!activity) {
        const error = new Error("Actividad no encontrada");
        error.status = 404;
        throw error;
      }
      if (activity.vigencia.status !== "ABIERTA") {
        const error = new Error("No se pueden modificar participantes de una actividad en una vigencia cerrada");
        error.status = 409;
        throw error;
      }
      const members = memberIds.length
        ? await tx.member.findMany({
          where: { id: { in: memberIds }, vigenciaId: activity.vigenciaId, status: "ACTIVO", deletedAt: null },
          select: { id: true }
        })
        : [];
      if (members.length !== memberIds.length) {
        const error = new Error("Todos los participantes deben ser socios activos de la vigencia");
        error.status = 400;
        throw error;
      }

      const existing = await tx.activityParticipant.findMany({
        where: { activityId: activity.id },
        select: { memberId: true }
      });
      const removedIds = existing.map(({ memberId }) => memberId).filter((memberId) => !memberIds.includes(memberId));
      if (removedIds.length) {
        const hasPayments = await tx.activityParticipantPayment.findFirst({
          where: { activityId: activity.id, memberId: { in: removedIds } },
          select: { id: true }
        });
        if (hasPayments) {
          const error = new Error("No se puede retirar a un participante con abonos registrados");
          error.status = 409;
          throw error;
        }
        await tx.activityParticipant.deleteMany({ where: { activityId: activity.id, memberId: { in: removedIds } } });
      }
      await tx.activityParticipant.createMany({
        data: memberIds.map((memberId) => ({ activityId: activity.id, memberId })),
        skipDuplicates: true
      });
      await recalculateActivityGains(tx, activity);
      return tx.activityParticipant.findMany({
        where: { activityId: activity.id },
        include: { member: true, payments: { orderBy: { paidAt: "asc" } } },
        orderBy: { member: { lastName: "asc" } }
      });
    }, { isolationLevel: "Serializable" });
    await audit(req, "UPDATE", "activity_participants", req.params.id, { memberIds });
    res.json({ items: result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.post("/api/actividades/:id/participantes/:memberId/abonos", requirePermission("actividades", "editar"), requireAdmin, async (req, res, next) => {
  try {
    const amount = parseActivityAmount(req.body.amount, "El abono");
    if (amount <= 0) return res.status(400).json({ error: "El abono debe ser mayor que cero" });
    const paidAt = req.body.paidAt ? new Date(req.body.paidAt) : new Date();
    if (!Number.isFinite(paidAt.getTime()) || paidAt > new Date()) {
      return res.status(400).json({ error: "La fecha del abono no es válida" });
    }
    const result = await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.findFirst({
        where: { id: req.params.id, deletedAt: null },
        include: {
          vigencia: { select: { status: true } },
          participants: {
            where: { memberId: req.params.memberId },
            include: { payments: { select: { amount: true } } }
          }
        }
      });
      if (!activity) {
        const error = new Error("Actividad no encontrada");
        error.status = 404;
        throw error;
      }
      if (activity.vigencia.status !== "ABIERTA") {
        const error = new Error("No se pueden registrar abonos después del cierre de la vigencia");
        error.status = 409;
        throw error;
      }
      const participant = activity.participants[0];
      if (!participant) {
        const error = new Error("El socio no está registrado como participante de esta actividad");
        error.status = 404;
        throw error;
      }
      const balance = calculateParticipantBalance(
        activity.participantCost,
        participant.payments.map((payment) => payment.amount)
      );
      if (amount > balance.balance) {
        const error = new Error(`El abono supera el saldo pendiente de ${balance.balance}`);
        error.status = 400;
        throw error;
      }
      const payment = await tx.activityParticipantPayment.create({
        data: {
          id: crypto.randomUUID(),
          activityId: activity.id,
          memberId: participant.memberId,
          amount,
          paidAt,
          observations: req.body.observations || null,
          recordedById: req.user.sub
        }
      });
      return { payment, balance: calculateParticipantBalance(activity.participantCost, [...participant.payments.map(({ amount: paid }) => paid), amount]) };
    }, { isolationLevel: "Serializable" });
    await audit(req, "ACTIVITY_PARTICIPANT_PAYMENT", "activity_participant_payment", result.payment.id, {
      activityId: req.params.id,
      memberId: req.params.memberId,
      amount,
      paidAt
    });
    res.status(201).json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.post("/api/rifas-mensuales/configuracion", requirePermission("rifas", "crear"), requireAdmin, async (req, res, next) => {
  try {
    let monthlyAmount;
    try {
      monthlyAmount = normalizeRaffleAmount(req.body.monthlyAmount);
    } catch (error) {
      if (error instanceof RangeError) return res.status(400).json({ error: error.message });
      throw error;
    }
    if (Number(monthlyAmount) <= 0) {
      return res.status(400).json({ error: "El valor mensual por socio debe ser mayor que cero" });
    }

    const vigencia = await prisma.vigencia.findFirst({
      where: { id: req.body.vigenciaId, deletedAt: null },
      select: { id: true, year: true, status: true }
    });
    if (!vigencia) return res.status(400).json({ error: "Seleccione una vigencia válida" });
    if (vigencia.status !== "ABIERTA") return res.status(409).json({ error: "Solo se pueden configurar rifas para una vigencia abierta" });

    const drawDates = req.body.drawDates;
    if (!Array.isArray(drawDates) || drawDates.length !== 12) {
      return res.status(400).json({ error: "Debe enviar una posición por cada mes; las fechas son opcionales para meses sin sorteo" });
    }
    const schedules = drawDates.flatMap((drawAt, index) => {
      if (drawAt === null || drawAt === "") return [];
      return [{ month: index + 1, drawAt: new Date(drawAt) }];
    });
    if (!schedules.length) {
      return res.status(400).json({ error: "Debe programar al menos un sorteo en la vigencia" });
    }
    if (schedules.some(({ drawAt }) => !isRaffleDateInVigencia(drawAt, vigencia.year))) {
      return res.status(400).json({ error: "Cada sorteo debe tener una fecha válida dentro del año de la vigencia" });
    }

    const { program, memberCount } = await prisma.$transaction(async (tx) => {
      const members = await tx.member.findMany({
        where: {
          vigenciaId: vigencia.id,
          status: "ACTIVO",
          deletedAt: null,
          OR: [
            { role: "SOCIO" },
            { role: "ADMINISTRADOR", savings: { some: { vigenciaId: vigencia.id, deletedAt: null } } }
          ]
        },
        select: { id: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }]
      });
      if (!members.length) {
        const error = new Error("La vigencia no tiene participantes activos con derecho a rifas");
        error.status = 400;
        throw error;
      }
      const createdProgram = await tx.raffleProgram.create({
        data: {
          vigenciaId: vigencia.id,
          monthlyAmount,
          months: {
            create: schedules.map(({ month, drawAt }) => ({
              month,
              drawAt,
              monthlyAmount,
              entries: {
                create: members.map(({ id: memberId }) => ({ memberId, amount: monthlyAmount }))
              }
            }))
          }
        },
        include: { months: { orderBy: { month: "asc" } } }
      });
      return { program: createdProgram, memberCount: members.length };
    }, { isolationLevel: "Serializable" });

    await audit(req, "CREATE", "raffle_program", program.id, {
      vigenciaId: vigencia.id,
      monthlyAmount,
      scheduledDraws: program.months.length,
      memberCount
    });
    res.status(201).json(program);
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Ya existe una configuración de rifas para esta vigencia" });
    if (error.status) return res.status(error.status).json({ error: error.message });
    if (error.code === "P2021" || error.code === "P2022") {
      console.error("La base de datos no tiene el esquema de rifas mensuales por socio:", error);
      const migration = error.code === "P2021"
        ? "database/migracion_rifa_por_socio_y_calendario.sql"
        : "database/migracion_control_cuotas_rifa.sql";
      return res.status(503).json({
        error: `La base de datos aún no tiene el esquema requerido para rifas mensuales. Ejecute ${migration} en pgAdmin 4 y reinicie el backend.`
      });
    }
    next(error);
  }
});

app.patch("/api/rifas-mensuales/configuracion", requirePermission("rifas", "editar"), requireAdmin, async (req, res, next) => {
  try {
    let monthlyAmount;
    try { monthlyAmount = normalizeRaffleAmount(req.body.monthlyAmount); }
    catch (error) { if (error instanceof RangeError) return res.status(400).json({ error: error.message }); throw error; }
    if (Number(monthlyAmount) <= 0) return res.status(400).json({ error: "El valor mensual por socio debe ser mayor que cero" });
    if (!Array.isArray(req.body.drawDates) || req.body.drawDates.length !== 12) {
      return res.status(400).json({ error: "Debe enviar una posición por cada mes" });
    }
    const result = await prisma.$transaction(async (tx) => {
      const program = await tx.raffleProgram.findUnique({
        where: { vigenciaId: req.body.vigenciaId },
        include: { vigencia: true, months: true }
      });
      if (!program || program.vigencia.deletedAt) { const error = new Error("Configuración no encontrada"); error.status = 404; throw error; }
      if (program.vigencia.status !== "ABIERTA") { const error = new Error("La vigencia no está abierta"); error.status = 409; throw error; }
      const now = new Date();
      const members = await tx.member.findMany({
        where: { vigenciaId: program.vigenciaId, status: "ACTIVO", deletedAt: null, OR: [
          { role: "SOCIO" },
          { role: "ADMINISTRADOR", savings: { some: { vigenciaId: program.vigenciaId, deletedAt: null } } }
        ] },
        select: { id: true }
      });
      let added = 0;
      let changed = 0;
      const changes = planRaffleSchedule(req.body.drawDates, program.months, program.vigencia.year, now);
      for (const { month, drawAt, existingId } of changes) {
        if (existingId) {
          await tx.raffleMonth.update({ where: { id: existingId }, data: { drawAt } });
          changed += 1;
        } else {
          if (!members.length) { const error = new Error("La vigencia no tiene participantes activos con derecho a rifas"); error.status = 400; throw error; }
          await tx.raffleMonth.create({ data: {
            programId: program.id, month, drawAt, monthlyAmount,
            entries: { create: members.map(({ id: memberId }) => ({ memberId, amount: monthlyAmount })) }
          } });
          added += 1;
        }
      }
      await tx.raffleProgram.update({ where: { id: program.id }, data: { monthlyAmount } });
      return {
        id: program.id, added, changed, monthlyAmount,
        previousMonthlyAmount: String(program.monthlyAmount),
        scheduleChanges: changes.map(({ month, drawAt, existingId }) => ({
          month, drawAt: drawAt.toISOString(),
          previousDrawAt: existingId ? program.months.find((item) => item.id === existingId).drawAt.toISOString() : null
        }))
      };
    }, { isolationLevel: "Serializable" });
    await audit(req, "UPDATE", "raffle_program", result.id, { vigenciaId: req.body.vigenciaId, previousMonthlyAmount: result.previousMonthlyAmount, monthlyAmount, scheduleChanges: result.scheduleChanges });
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.get("/api/rifas-mensuales", requirePermission("rifas", "consultar"), async (req, res, next) => {
  try {
    if (req.user.role === "SOCIO" && !req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
    const where = { program: { vigencia: { deletedAt: null } } };
    if (req.query.vigenciaId) where.program.vigenciaId = req.query.vigenciaId;
    const entryWhere = req.user.role === "SOCIO" ? { memberId: req.memberId } : undefined;
    const distributionWhere = req.user.role === "SOCIO" ? { memberId: req.memberId } : undefined;
    const months = await prisma.raffleMonth.findMany({
      where,
      orderBy: [{ program: { vigencia: { year: "desc" } } }, { month: "asc" }],
      include: {
        program: { include: { vigencia: { select: { id: true, year: true } } } },
        winner: { select: { id: true, firstName: true, lastName: true, raffleNumber: true } },
        entries: {
          where: entryWhere,
          include: {
            member: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                raffleNumber: true,
                status: true,
                role: true,
                deletedAt: true
              }
            }
          },
          orderBy: [{ member: { lastName: "asc" } }, { member: { firstName: "asc" } }]
        },
        distributions: {
          where: distributionWhere,
          include: {
            member: { select: { id: true, firstName: true, lastName: true } },
            user: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        }
      }
    });
    const entryMemberIds = [...new Set(months.flatMap((month) => month.entries.map((entry) => entry.memberId)))];
    const savingsByMember = entryMemberIds.length
      ? await prisma.saving.groupBy({
        by: ["memberId", "vigenciaId"],
        where: {
          memberId: { in: entryMemberIds },
          vigenciaId: { in: [...new Set(months.map((month) => month.program.vigenciaId))] },
          deletedAt: null
        }
      })
      : [];
    const membersWithVigenciaSavings = new Set(savingsByMember.map(({ memberId, vigenciaId }) => `${memberId}:${vigenciaId}`));
    const items = months.map((month) => {
      if (month.monthlyAmount == null) {
        const error = new Error("El cliente Prisma no incluye el valor mensual por sorteo. Detenga el backend, ejecute prisma:generate y reinícielo.");
        error.status = 503;
        throw error;
      }
      const isOwnWin = month.winnerMemberId === req.memberId;
      const entries = month.entries.map((entry) => {
        const member = entry.member;
        const hasVigenciaSavings = membersWithVigenciaSavings.has(`${entry.memberId}:${month.program.vigenciaId}`);
        const isEligibleRole = member.role === "SOCIO" || (member.role === "ADMINISTRADOR" && hasVigenciaSavings);
        const isPaidOnTime = Boolean(entry.paidAt && entry.paidAt < month.drawAt);
        const discount = Number(entry.discountedAmount);
        return {
          ...entry,
          member: { ...member, hasVigenciaSavings },
          status: isPaidOnTime ? "PAGADO" : discount >= Number(entry.amount) ? "DESCONTADO" : discount > 0 ? "DESCUENTO PARCIAL" : entry.paidAt ? "PAGO FUERA DE PLAZO" : "PENDIENTE",
          eligible: Boolean(isPaidOnTime && member.status === "ACTIVO" && isEligibleRole && !member.deletedAt)
        };
      });
      return {
        ...month,
        monthlyAmount: month.monthlyAmount,
        programMonthlyAmount: req.user.role === "SOCIO" ? undefined : month.program.monthlyAmount,
        vigenciaId: month.program.vigenciaId,
        vigencia: month.program.vigencia,
        winner: req.user.role === "SOCIO" && !isOwnWin ? null : month.winner,
        winnerMemberId: req.user.role === "SOCIO" ? (isOwnWin ? req.memberId : null) : month.winnerMemberId,
        collectedAmount: req.user.role === "SOCIO" ? undefined : month.collectedAmount,
        adminCommission: req.user.role === "SOCIO" ? undefined : month.adminCommission,
        projection: req.user.role === "ADMINISTRADOR" && !month.finalizedAt ? projectRaffleDistribution(entries) : undefined,
        entries
      };
    });
    res.json({ items, total: items.length });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.post("/api/rifas-mensuales/:id/pagos/:memberId", requirePermission("rifas", "editar"), requireAdmin, async (req, res, next) => {
  try {
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const entry = await tx.raffleMemberPayment.findUnique({
        where: { raffleMonthId_memberId: { raffleMonthId: req.params.id, memberId: req.params.memberId } },
        include: {
          raffleMonth: {
            include: {
              program: { select: { vigenciaId: true, vigencia: { select: { status: true } } } }
            }
          },
          member: { select: { id: true, status: true, role: true, deletedAt: true } }
        }
      });
      if (!entry) {
        const error = new Error("No existe una cuota de rifa para ese socio y mes");
        error.status = 404;
        throw error;
      }
      if (entry.raffleMonth.finalizedAt) {
        const error = new Error("El sorteo de este mes ya fue cerrado");
        error.status = 409;
        throw error;
      }
      if (entry.raffleMonth.program.vigencia.status !== "ABIERTA") {
        const error = new Error("La vigencia ya está cerrada");
        error.status = 409;
        throw error;
      }
      if (now >= entry.raffleMonth.drawAt) {
        const error = new Error("El pago debe registrarse antes de la fecha y hora del sorteo");
        error.status = 409;
        throw error;
      }
      const hasCurrentSavings = entry.member.role === "ADMINISTRADOR" && await tx.saving.findFirst({
        where: {
          memberId: entry.member.id,
          vigenciaId: entry.raffleMonth.program.vigenciaId,
          deletedAt: null
        },
        select: { id: true }
      });
      if (entry.member.role === "ADMINISTRADOR" && !hasCurrentSavings) {
        const error = new Error("Un miembro con rol ADMINISTRADOR debe tener ahorros en la vigencia para participar");
        error.status = 409;
        throw error;
      }
      if (
        entry.member.status !== "ACTIVO" ||
        !["SOCIO", "ADMINISTRADOR"].includes(entry.member.role) ||
        entry.member.deletedAt
      ) {
        const error = new Error("El socio no está activo para registrar esta cuota");
        error.status = 409;
        throw error;
      }
      if (entry.paidAt) {
        const error = new Error("La cuota de este socio ya está pagada");
        error.status = 409;
        throw error;
      }

      const changed = await tx.raffleMemberPayment.updateMany({
        where: { id: entry.id, paidAt: null },
        data: { paidAt: now, recordedById: req.user.sub }
      });
      if (changed.count !== 1) {
        const error = new Error("La cuota ya fue actualizada por otro administrador");
        error.status = 409;
        throw error;
      }
      return tx.raffleMemberPayment.findUnique({ where: { id: entry.id } });
    }, { isolationLevel: "Serializable" });
    await audit(req, "RAFFLE_FEE_PAID", "raffle_month_payment", updated.id, {
      raffleMonthId: updated.raffleMonthId,
      memberId: updated.memberId,
      amount: String(updated.amount),
      paidAt: updated.paidAt
    });
    res.json(updated);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.patch("/api/rifas-mensuales/:id/pagos/:memberId/anular", requirePermission("rifas", "editar"), requireAdmin, async (req, res, next) => {
  try {
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const entry = await tx.raffleMemberPayment.findUnique({
        where: { raffleMonthId_memberId: { raffleMonthId: req.params.id, memberId: req.params.memberId } },
        include: { raffleMonth: { include: { program: { select: { vigencia: { select: { status: true } } } } } } }
      });
      if (!entry) {
        const error = new Error("No existe una cuota de rifa para ese socio y mes");
        error.status = 404;
        throw error;
      }
      if (entry.raffleMonth.finalizedAt) {
        const error = new Error("No se puede anular un pago de un sorteo cerrado");
        error.status = 409;
        throw error;
      }
      if (entry.raffleMonth.program.vigencia.status !== "ABIERTA") {
        const error = new Error("No se puede anular el pago después del cierre de la vigencia");
        error.status = 409;
        throw error;
      }
      if (now >= entry.raffleMonth.drawAt) {
        const error = new Error("El pago solo se puede anular antes de la fecha y hora del sorteo");
        error.status = 409;
        throw error;
      }
      if (!entry.paidAt) {
        const error = new Error("La cuota ya está pendiente de pago");
        error.status = 409;
        throw error;
      }
      const changed = await tx.raffleMemberPayment.updateMany({
        where: { id: entry.id, paidAt: entry.paidAt },
        data: { paidAt: null, recordedById: null, annulledAt: now, annulledById: req.user.sub }
      });
      if (changed.count !== 1) {
        const error = new Error("El pago ya fue actualizado por otro administrador");
        error.status = 409;
        throw error;
      }
      return tx.raffleMemberPayment.findUnique({ where: { id: entry.id } });
    }, { isolationLevel: "Serializable" });
    await audit(req, "RAFFLE_FEE_ANNULLED", "raffle_month_payment", updated.id, {
      raffleMonthId: updated.raffleMonthId,
      memberId: updated.memberId,
      amount: String(updated.amount),
      annulledAt: updated.annulledAt
    });
    res.json(updated);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.patch("/api/rifas-mensuales/:id/fecha", requirePermission("rifas", "editar"), requireAdmin, async (req, res, next) => {
  try {
    const drawAt = new Date(req.body.drawAt);
    if (!Number.isFinite(drawAt.getTime())) return res.status(400).json({ error: "Ingrese una fecha y hora válida" });
    if (drawAt <= new Date()) return res.status(400).json({ error: "La nueva fecha del sorteo debe ser futura" });

    const month = await prisma.raffleMonth.findUnique({
      where: { id: req.params.id },
      include: { program: { include: { vigencia: { select: { year: true } } } } }
    });
    if (!month) return res.status(404).json({ error: "No se encontró el sorteo mensual" });
    if (month.finalizedAt) return res.status(409).json({ error: "No se puede cambiar la fecha de un sorteo ya cerrado" });
    if (!isRaffleDateInVigencia(drawAt, month.program.vigencia.year)) {
      return res.status(400).json({ error: "La nueva fecha debe estar dentro del año de la vigencia" });
    }

    const changed = await prisma.raffleMonth.updateMany({
      where: { id: month.id, finalizedAt: null },
      data: { drawAt }
    });
    if (changed.count !== 1) return res.status(409).json({ error: "El sorteo ya fue cerrado; actualice la información" });
    const updated = await prisma.raffleMonth.findUnique({ where: { id: month.id } });
    await audit(req, "UPDATE", "raffle_month_schedule", updated.id, {
      previousDrawAt: month.drawAt,
      drawAt: updated.drawAt
    });
    res.json(updated);
  } catch (error) {
    if (error.code === "P2021" || error.code === "P2022") {
      console.error("La base de datos no tiene el esquema de rifas mensuales por socio:", error);
      const migration = error.code === "P2021"
        ? "database/migracion_rifa_por_socio_y_calendario.sql"
        : "database/migracion_control_cuotas_rifa.sql";
      return res.status(503).json({
        error: `La base de datos aún no tiene el esquema requerido para rifas mensuales. Ejecute ${migration} en pgAdmin 4 y reinicie el backend.`
      });
    }
    next(error);
  }
});

app.post("/api/rifas-mensuales/:id/sortear", requirePermission("rifas", "aprobar"), requireAdmin, async (req, res, next) => {
  try {
    const now = new Date();
    const winnerMemberId = req.body.winnerMemberId?.trim() || null;
    const winningNumber = req.body.winningNumber?.trim() || null;
    if (winningNumber && winningNumber.length > 20) {
      return res.status(400).json({ error: "El número ganador no puede exceder 20 caracteres" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const month = await tx.raffleMonth.findUnique({
        where: { id: req.params.id },
        include: { program: { select: { vigenciaId: true } } }
      });
      if (!month) {
        const error = new Error("No se encontró el sorteo mensual");
        error.status = 404;
        throw error;
      }
      if (month.finalizedAt) {
        const error = new Error("Este sorteo ya fue cerrado");
        error.status = 409;
        throw error;
      }
      if (now < month.drawAt) {
        const error = new Error("El sorteo solo se puede cerrar en la fecha y hora programadas o después");
        error.status = 409;
        throw error;
      }

      const eligibleEntries = await tx.raffleMemberPayment.findMany({
        where: {
          raffleMonthId: month.id,
          paidAt: { not: null, lt: month.drawAt },
          member: {
            status: "ACTIVO",
            deletedAt: null,
            OR: [
              { role: "SOCIO" },
              {
                role: "ADMINISTRADOR",
                savings: { some: { vigenciaId: month.program.vigenciaId, deletedAt: null } }
              }
            ]
          }
        },
        include: { member: { select: { id: true, firstName: true, lastName: true, raffleNumber: true } } },
        orderBy: [{ member: { lastName: "asc" } }, { member: { firstName: "asc" } }]
      });
      let winnerEntry = null;
      if (winnerMemberId) {
        winnerEntry = eligibleEntries.find(({ member }) => member.id === winnerMemberId);
      } else if (winningNumber) {
        winnerEntry = eligibleEntries.find(({ member }) => member.raffleNumber === winningNumber);
      }
      if ((winnerMemberId || winningNumber) && !winnerEntry) {
        const error = new Error("El ganador debe ser un socio activo que haya pagado antes del sorteo");
        error.status = 400;
        throw error;
      }
      if (winnerEntry && winningNumber && winnerEntry.member.raffleNumber !== winningNumber) {
        const error = new Error("El socio seleccionado no corresponde al número ganador indicado");
        error.status = 400;
        throw error;
      }

      const collectedAmount = sumRaffleAmounts(eligibleEntries.map(({ amount }) => String(amount)));
      const administrators = Number(collectedAmount) > 0
        ? await tx.user.findMany({
          where: { role: "ADMINISTRADOR", status: "ACTIVO", deletedAt: null },
          select: { id: true },
          orderBy: { id: "asc" }
        })
        : [];
      if (Number(collectedAmount) > 0 && administrators.length === 0) {
        const error = new Error("No hay administradores activos para recibir la comisión");
        error.status = 409;
        throw error;
      }
      const payout = calculateRaffleDistribution({
        collectedAmount,
        winner: winnerEntry?.member || null,
        members: eligibleEntries.map(({ member }) => member),
        administrators
      });
      if (payout.distributions.length) {
        await tx.raffleProgramDistribution.createMany({
          data: payout.distributions.map((distribution) => ({ ...distribution, raffleMonthId: month.id }))
        });
      }
      const raffleMonth = await tx.raffleMonth.update({
        where: { id: month.id },
        data: {
          collectedAmount,
          winningNumber: winnerEntry ? (winningNumber || winnerEntry.member.raffleNumber) : null,
          winnerMemberId: winnerEntry?.memberId || null,
          prize: payout.prize,
          adminCommission: payout.adminCommission,
          finalizedAt: now
        },
        include: {
          winner: { select: { id: true, firstName: true, lastName: true, raffleNumber: true } },
          distributions: {
            include: {
              member: { select: { id: true, firstName: true, lastName: true } },
              user: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
          }
        }
      });
      return raffleMonth;
    }, { isolationLevel: "Serializable" });
    await audit(req, "RAFFLE_DRAW_CLOSED", "raffle_month", result.id, {
      collectedAmount: String(result.collectedAmount),
      winnerMemberId: result.winnerMemberId,
      adminCommission: String(result.adminCommission),
      distributions: result.distributions.length
    });
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.get("/api/rifas", requirePermission("rifas", "consultar"), async (req, res, next) => {
  try {
    const p = paginate(req.query);
    if (req.user.role === "SOCIO" && !req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
    const where = { deletedAt: null };
    if (req.user.role === "SOCIO") {
      where.OR = [
        { winnerId: req.memberId },
        { distributions: { some: { memberId: req.memberId } } }
      ];
    }
    if (req.query.vigenciaId) where.vigenciaId = req.query.vigenciaId;
    if (req.query.search) where.OR = [
      { winningNumber: { contains: req.query.search, mode: "insensitive" } },
      { winner: { OR: [
        { firstName: { contains: req.query.search, mode: "insensitive" } },
        { lastName: { contains: req.query.search, mode: "insensitive" } }
      ] } }
    ];
    if (req.user.role === "SOCIO" && req.query.search) {
      where.AND = [{ OR: where.OR }];
      where.OR = [
        { winnerId: req.memberId },
        { distributions: { some: { memberId: req.memberId } } }
      ];
    }
    if (req.query.date) {
      const day = new Date(`${req.query.date}T00:00:00.000Z`);
      const nextDay = new Date(day);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      where.date = { gte: day, lt: nextDay };
    }
    const distributionWhere = req.user.role === "SOCIO" ? { memberId: req.memberId } : undefined;
    const [items, total] = await Promise.all([
      prisma.raffle.findMany({
        where, skip: p.skip, take: p.take, orderBy: { date: "desc" },
        include: {
          winner: true,
          vigencia: true,
          distributions: {
            where: distributionWhere,
            include: {
              member: { select: { id: true, firstName: true, lastName: true } },
              user: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
          }
        }
      }),
      prisma.raffle.count({ where })
    ]);
    res.json({ items: await applyFieldPermissions(req.user.role, "rifas", items), total, page: p.page, pageSize: p.pageSize });
  } catch (error) { next(error); }
});

app.post("/api/rifas", requirePermission("rifas", "crear"), requireAdmin, (_req, res) => {
  res.status(410).json({ error: "El registro directo fue reemplazado por rifas mensuales con cuotas individuales" });
});

app.get("/api/deudas", requirePermission("deudas", "consultar"), async (req, res, next) => {
  try {
    await accrueLoanInterest();
    const p = paginate(req.query);
    const where = { deletedAt: null, ...(req.query.vigenciaId ? { vigenciaId: req.query.vigenciaId } : {}) };
    if (req.user.role === "SOCIO") {
      if (!req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
      where.memberId = req.memberId;
    }
    if (req.query.memberId && req.user.role !== "SOCIO") where.memberId = req.query.memberId;
    if (req.query.search) where.OR = [
      { borrowerName: { contains: req.query.search, mode: "insensitive" } },
      { member: { OR: [
        { firstName: { contains: req.query.search, mode: "insensitive" } },
        { lastName: { contains: req.query.search, mode: "insensitive" } },
        { document: { contains: req.query.search, mode: "insensitive" } }
      ] } }
    ];
    const [loans, total] = await Promise.all([
      prisma.loan.findMany({ where, skip: p.skip, take: p.take, orderBy: { date: "desc" }, include: { member: true, vigencia: true } }),
      prisma.loan.count({ where })
    ]);
    const payments = loans.length ? await prisma.loanPayment.findMany({
      where: { loanId: { in: loans.map((loan) => loan.id) }, annulledAt: null },
      select: { loanId: true, amount: true, principal: true, date: true, annulledAt: true }
    }) : [];
    const paymentSummary = new Map();
    for (const payment of payments) {
      if (!paymentSummary.has(payment.loanId)) paymentSummary.set(payment.loanId, []);
      paymentSummary.get(payment.loanId).push(payment);
    }
    const items = loans.map((loan) => {
      const summary = summarizeLoanPayments(paymentSummary.get(loan.id) || []);
      return ({
      id: loan.id, loanId: loan.id, concept: `Préstamo ${loan.type.toLowerCase()}`,
      borrowerName: loan.borrowerName, memberId: loan.memberId, member: loan.member,
      vigenciaId: loan.vigenciaId, vigencia: loan.vigencia, principal: loan.principal,
      capitalPendiente: loan.balance, interesesPendientes: loan.pendingInterest,
      amount: roundMoney(Number(loan.balance) + Number(loan.pendingInterest)),
      totalAbonado: summary.total,
      lastPaymentDate: summary.lastPaymentDate,
      paymentHistoryMismatch: Math.abs(roundMoney(Number(loan.principal) - Number(loan.balance) - summary.principal)) >= 0.01,
      status: Number(loan.balance) === 0 && Number(loan.pendingInterest) === 0 ? "CANCELADA" : "PENDIENTE"
    }); });
    let filteredItems = await applyFieldPermissions(req.user.role, "deudas", items);
    if (req.query.status) filteredItems = filteredItems.filter((item) => item.status === req.query.status);
    res.json({ items: filteredItems, total: req.query.status ? filteredItems.length : total, page: p.page, pageSize: p.pageSize });
  } catch (error) { next(error); }
});

app.get("/api/deudas/pendientes", requirePermission("deudas", "consultar"), async (req, res, next) => {
  try {
    await accrueLoanInterest();
    if (req.user.role === "SOCIO" && !req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
    const memberFilter = req.user.role === "SOCIO" ? req.memberId : req.query.memberId;
    const vigenciaId = req.query.vigenciaId || undefined;
    const search = req.query.search?.trim();
    const memberWhere = {
      deletedAt: null,
      ...(memberFilter ? { id: memberFilter } : {}),
      ...(search ? { OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { document: { contains: search, mode: "insensitive" } }
      ] } : {})
    };
    const [participants, loans, raffleFees, sales] = await Promise.all([
      prisma.activityParticipant.findMany({
        where: { activity: { deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}) }, member: memberWhere },
        include: { activity: true, member: true, payments: { select: { amount: true } } }
      }),
      prisma.loan.findMany({
        where: {
          deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}), member: memberWhere,
          OR: [{ balance: { gt: 0 } }, { pendingInterest: { gt: 0 } }]
        },
        include: { member: true }
      }),
      prisma.raffleMemberPayment.findMany({
        where: {
          paidAt: null, member: memberWhere,
          raffleMonth: { program: vigenciaId ? { vigenciaId } : {} }
        },
        include: { member: true, raffleMonth: { select: { month: true, drawAt: true } } },
        orderBy: { raffleMonth: { drawAt: "asc" } }
      }),
      prisma.activitySale.findMany({
        where: { activity: { deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}) }, member: memberWhere },
        include: { activity: true, member: true, payments: { select: { amount: true } } }
      })
    ]);

    const byMember = new Map();
    const entryFor = (member) => {
      if (!byMember.has(member.id)) {
        byMember.set(member.id, {
          memberId: member.id,
          memberName: `${member.firstName} ${member.lastName}`,
          activities: [], sales: [], raffles: [], loans: [],
          totals: { activities: 0, sales: 0, raffles: 0, loans: 0, total: 0 }
        });
      }
      return byMember.get(member.id);
    };
    const add = (entry, key, detail) => {
      entry[key].push(detail);
      entry.totals[key] = roundMoney(entry.totals[key] + detail.pending);
      entry.totals.total = roundMoney(entry.totals.total + detail.pending);
    };

    for (const participant of participants) {
      const { balance, amountDue, amountPaid } = calculateParticipantBalance(
        participant.activity.participantCost, participant.payments.map((payment) => payment.amount)
      );
      if (balance > 0) {
        add(entryFor(participant.member), "activities", {
          activityId: participant.activityId, name: participant.activity.name,
          date: participant.activity.date, amountDue, amountPaid, pending: balance
        });
      }
    }
    for (const { member, detail } of pendingSaleDebts(sales)) {
      add(entryFor(member), "sales", detail);
    }
    for (const fee of raffleFees) {
      const pending = roundMoney(Number(fee.amount) - Number(fee.discountedAmount));
      if (pending > 0) {
        add(entryFor(fee.member), "raffles", {
          raffleMonthId: fee.raffleMonthId, month: fee.raffleMonth.month,
          drawAt: fee.raffleMonth.drawAt, amountDue: Number(fee.amount), pending
        });
      }
    }
    for (const loan of loans) {
      add(entryFor(loan.member), "loans", {
        loanId: loan.id, type: loan.type, borrowerName: loan.borrowerName, date: loan.date,
        capital: Number(loan.balance), interest: Number(loan.pendingInterest),
        pending: roundMoney(Number(loan.balance) + Number(loan.pendingInterest))
      });
    }

    const items = [...byMember.values()].sort((a, b) => a.memberName.localeCompare(b.memberName, "es"));
    const totals = items.reduce((sum, item) => ({
      activities: roundMoney(sum.activities + item.totals.activities),
      sales: roundMoney(sum.sales + item.totals.sales),
      raffles: roundMoney(sum.raffles + item.totals.raffles),
      loans: roundMoney(sum.loans + item.totals.loans),
      total: roundMoney(sum.total + item.totals.total)
    }), { activities: 0, sales: 0, raffles: 0, loans: 0, total: 0 });
    res.json({ items, totals });
  } catch (error) { next(error); }
});

app.get("/api/usuarios", requirePermission("usuarios", "consultar"), requireAdmin, async (req, res, next) => {
  try {
    const p = paginate(req.query);
    const where = req.query.status ? { status: req.query.status } : {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.search) where.OR = [
      { firstName: { contains: req.query.search, mode: "insensitive" } },
      { lastName: { contains: req.query.search, mode: "insensitive" } },
      { document: { contains: req.query.search, mode: "insensitive" } },
      { email: { contains: req.query.search, mode: "insensitive" } },
      { username: { contains: req.query.search, mode: "insensitive" } }
    ];
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, skip: p.skip, take: p.take, orderBy: { createdAt: "desc" }, select: { id: true, email: true, username: true, firstName: true, lastName: true, document: true, role: true, status: true, createdAt: true, lastLoginAt: true, lockedUntil: true, member: { select: { id: true, firstName: true, lastName: true } } } }),
      prisma.user.count({ where })
    ]);
    res.json({ items, total, page: p.page, pageSize: p.pageSize });
  } catch (error) { next(error); }
});

app.post("/api/usuarios", requirePermission("usuarios", "crear"), requireAdmin, async (req, res, next) => {
  try {
    const { email, username, firstName, lastName, document, password, role = "SOCIO", memberId } = req.body;
    if (!email || !username || !firstName || !lastName || !password || !["SOCIO", "ADMINISTRADOR"].includes(role)) {
      return res.status(400).json({ error: "Nombres, apellidos, correo, usuario, contraseña y rol son obligatorios" });
    }
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, username, firstName, lastName, document: document || null, passwordHash, role } });
      if (memberId) {
        const linked = await tx.member.updateMany({ where: { id: memberId, userId: null, deletedAt: null }, data: { userId: created.id } });
        if (linked.count !== 1) { const error = new Error("El perfil no existe o ya está vinculado"); error.status = 409; throw error; }
      }
      return created;
    });
    await audit(req, "CREATE", "user", user.id, { role, username });
    res.status(201).json({ id: user.id, email: user.email, username: user.username, role: user.role });
  } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); }
});

app.patch("/api/usuarios/:id", requirePermission("usuarios", "editar"), requireAdmin, async (req, res, next) => {
  try {
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: "Usuario no encontrado" });
    const allowed = ["email", "username", "firstName", "lastName", "document", "role"];
    const data = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (data.role && !["SOCIO", "ADMINISTRADOR"].includes(data.role)) return res.status(400).json({ error: "Rol no válido" });
    if ("document" in data && !data.document) data.document = null;
    const linkedMember = await prisma.member.findUnique({ where: { userId: before.id } });
    const effectiveRole = data.role || before.role;
    const targetMemberId = req.body.memberId || linkedMember?.id;
    if (data.role === "SOCIO" && targetMemberId) {
      const targetMember = await prisma.member.findUnique({ where: { id: targetMemberId }, select: { userId: true } });
      if (!targetMember) return res.status(404).json({ error: "Perfil de socio no encontrado" });
      if (targetMember.userId && targetMember.userId !== before.id) return res.status(409).json({ error: "El perfil ya está vinculado a otro usuario" });
    }
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: req.params.id }, data });
      if (linkedMember && targetMemberId !== linkedMember.id) {
        const unlinked = await tx.member.updateMany({ where: { id: linkedMember.id, userId: updated.id }, data: { userId: null } });
        if (unlinked.count !== 1) { const error = new Error("La vinculación cambió; actualice la información e inténtelo nuevamente"); error.status = 409; throw error; }
      }
      if (targetMemberId) {
        const linked = await tx.member.updateMany({
          where: { id: targetMemberId, deletedAt: null, OR: [{ userId: null }, { userId: updated.id }] },
          data: { userId: updated.id, role: effectiveRole }
        });
        if (linked.count !== 1) { const error = new Error("El perfil no existe o ya está vinculado"); error.status = 409; throw error; }
      }
      return updated;
    });
    if (before.role !== user.role) await audit(req, "CHANGE_ROLE", "user", user.id, { previousRole: before.role, role: user.role });
    else await audit(req, "UPDATE", "user", user.id, { fields: Object.keys(data) });
    res.json({ id: user.id, email: user.email, username: user.username, role: user.role, status: user.status });
  } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); }
});

app.post("/api/usuarios/:id/restablecer-clave", requirePermission("usuarios", "editar"), requireAdmin, async (req, res, next) => {
  try {
    const { password } = req.body;
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash: await bcrypt.hash(password, 12), failedLoginAttempts: 0, lockedUntil: null } });
    await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(req, "RESET_PASSWORD", "user", user.id);
    res.json({ message: "Contraseña restablecida" });
  } catch (error) { next(error); }
});

app.patch("/api/usuarios/:id/estado", requirePermission("usuarios", "editar"), requireAdmin, async (req, res, next) => {
  try {
    if (req.params.id === req.user.sub && req.body.status !== "ACTIVO") {
      return res.status(400).json({ error: "No puede desactivar ni bloquear su propia cuenta" });
    }
    const status = req.body.status;
    if (!["ACTIVO", "INACTIVO", "BLOQUEADO"].includes(status)) return res.status(400).json({ error: "Estado no permitido" });
    const user = await prisma.user.update({ where: { id: req.params.id }, data: {
      status,
      lockedUntil: status === "BLOQUEADO" ? new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000) : null,
      ...(status === "ACTIVO" ? { deletedAt: null, deletedBy: null } : {})
    } });
    if (status !== "ACTIVO") await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(req, status === "ACTIVO" ? "UNBLOCK_USER" : "CHANGE_USER_STATUS", "user", user.id, { previousStatus: status === "ACTIVO" ? "INACTIVO/BLOQUEADO" : "ACTIVO", status });
    res.json({ id: user.id, status: user.status });
  } catch (error) { next(error); }
});

app.get("/api/usuarios/:id/accesos", requirePermission("usuarios", "consultar"), requireAdmin, async (req, res, next) => {
  try {
    const p = paginate(req.query);
    const [items, total] = await Promise.all([
      prisma.accessLog.findMany({ where: { userId: req.params.id }, skip: p.skip, take: p.take, orderBy: { createdAt: "desc" } }),
      prisma.accessLog.count({ where: { userId: req.params.id } })
    ]);
    res.json({ items, total, page: p.page, pageSize: p.pageSize });
  } catch (error) { next(error); }
});

const roleFields = {
  dashboard: ["totalAhorrado", "totalPrestado", "carteraPendiente", "deudasPendientes", "sociosActivos", "gananciasActividades", "gananciasPrestamos", "gananciasRifas", "comisionAdministrativa", "valorTotalEntregar", "numeroRifa", "gananciasPropias", "valorProyectadoLiquidacion", "rifasPendientes"],
  socios: ["document", "phone", "address", "email", "raffleNumber", "status", "role"],
  ahorros: ["date", "amount", "observation"],
  prestamos: ["borrowerName", "type", "principal", "balance", "rate", "status", "date"],
  pagos: ["date", "amount", "principal", "interest", "mora"],
  actividades: ["name", "description", "date", "participantCost", "participants"],
  rifas: ["date", "winningNumber", "prize"],
  deudas: ["concept", "amount", "status", "dueDate"],
  liquidaciones: ["savings", "activityGain", "loanGain", "raffleGain", "raffleFeesDiscounted", "finalAmount"]
};

app.get("/api/permisos", requireAdmin, async (_req, res, next) => {
  try {
    const [actions, fields] = await Promise.all([
      prisma.rolePermission.findMany(),
      prisma.roleFieldPermission.findMany()
    ]);
    const result = {};
    for (const role of ["ADMINISTRADOR", "SOCIO"]) {
      result[role] = {
        modules: Object.fromEntries(permissionModules.map((module) => [module, Object.fromEntries(
          permissionActions.map((action) => {
            const configured = actions.find((permission) => permission.role === role && permission.module === module && permission.action === action);
            return [action, configured ? configured.allowed : defaultPermission(role, module, action)];
          })
        )])),
        fields: Object.fromEntries(Object.entries(roleFields).map(([module, moduleFields]) => [module, Object.fromEntries(
          moduleFields.map((field) => {
            const configured = fields.find((permission) => permission.role === role && permission.module === module && permission.field === field);
            const defaultVisible = role === "ADMINISTRADOR" || !["document", "phone", "address", "email"].includes(field);
            return [field, configured ? configured.visible : defaultVisible];
          })
        )]))
      };
    }
    res.json({ modules: permissionModules, actions: permissionActions, fields: roleFields, roles: result });
  } catch (error) { next(error); }
});

app.put("/api/permisos/:role", requireAdmin, async (req, res, next) => {
  try {
    const role = req.params.role;
    if (!["ADMINISTRADOR", "SOCIO"].includes(role)) return res.status(400).json({ error: "Rol no válido" });
    const changes = [];
    await prisma.$transaction(async (tx) => {
      for (const [module, permissions] of Object.entries(req.body.modules || {})) {
        if (!permissionModules.includes(module)) continue;
        for (const [action, allowed] of Object.entries(permissions)) {
          if (!permissionActions.includes(action) || typeof allowed !== "boolean") continue;
          const previous = await tx.rolePermission.findUnique({ where: { role_module_action: { role, module, action } } });
          const before = previous ? previous.allowed : defaultPermission(role, module, action);
          await tx.rolePermission.upsert({
            where: { role_module_action: { role, module, action } },
            create: { role, module, action, allowed, updatedBy: req.user.sub },
            update: { allowed, updatedBy: req.user.sub }
          });
          if (before !== allowed) changes.push({ role, module, action, previous: before, next: allowed });
        }
      }
      for (const [module, fields] of Object.entries(req.body.fields || {})) {
        if (!roleFields[module]) continue;
        for (const [field, visible] of Object.entries(fields)) {
          if (!roleFields[module].includes(field) || typeof visible !== "boolean") continue;
          const previous = await tx.roleFieldPermission.findUnique({ where: { role_module_field: { role, module, field } } });
          const before = previous ? previous.visible : role === "ADMINISTRADOR" || !["document", "phone", "address", "email"].includes(field);
          await tx.roleFieldPermission.upsert({
            where: { role_module_field: { role, module, field } },
            create: { role, module, field, visible, updatedBy: req.user.sub },
            update: { visible, updatedBy: req.user.sub }
          });
          if (before !== visible) changes.push({ role, module, field, previous: before, next: visible });
        }
      }
    });
    for (const change of changes) await audit(req, "UPDATE_PERMISSION", "role_permission", role, change);
    res.json({ role, updated: changes.length });
  } catch (error) { next(error); }
});

app.get("/api/auditoria/permisos", requireAdmin, async (req, res, next) => {
  try {
    const p = paginate(req.query);
    const where = { action: "UPDATE_PERMISSION" };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, skip: p.skip, take: p.take, include: { user: { select: { email: true, username: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.auditLog.count({ where })
    ]);
    res.json({ items, total, page: p.page, pageSize: p.pageSize });
  } catch (error) { next(error); }
});

app.get("/api/reportes/dashboard", requirePermission("reportes", "consultar"), async (req, res, next) => {
  try {
    const baseMemberId = req.user.role === "SOCIO" ? req.memberId : null;
    const where = {
      ...(req.query.vigenciaId ? { vigenciaId: req.query.vigenciaId } : {}),
      ...(baseMemberId ? { memberId: baseMemberId } : {})
    };
    const [savingRows, loans, liquidations] = await Promise.all([
      prisma.saving.aggregate({ where, _sum: { amount: true } }),
      prisma.loan.aggregate({ where, _sum: { principal: true, balance: true } }),
      prisma.liquidation.aggregate({ where: { ...(req.query.vigenciaId ? { vigenciaId: req.query.vigenciaId } : {}), ...(baseMemberId ? { memberId: baseMemberId } : {}) }, _sum: { finalAmount: true } })
    ]);
    res.json({ balanceGeneral: savingRows._sum.amount || 0, carteraPrestada: loans._sum.principal || 0, carteraPendiente: loans._sum.balance || 0, totalLiquidado: liquidations._sum.finalAmount || 0 });
  } catch (error) { next(error); }
});

app.get("/api/reportes", requirePermission("reportes", "consultar"), async (req, res, next) => {
  const items = [
      ...(req.user.role === "ADMINISTRADOR"
        ? [
            { id: "balance", name: "Balance general", format: "PDF / Excel" },
            { id: "state", name: "Estado financiero", format: "PDF / Excel" },
            { id: "gains", name: "Ganancias por vigencia", format: "PDF / Excel" },
            { id: "portfolio", name: "Cartera de préstamos", format: "PDF / Excel" }
          ]
        : []),
      { id: "personal", name: "Mis reportes personales", format: "PDF / Excel" },
      { id: "liquidation", name: "Liquidación anual", format: "PDF / Excel" }
    ];
  const search = req.query.search?.toLocaleLowerCase("es");
  res.json({ items: search ? items.filter((item) => item.name.toLocaleLowerCase("es").includes(search) || item.id.includes(search)) : items });
});

app.get("/api/dashboard", requirePermission("dashboard", "ver"), async (req, res, next) => {
  try {
    const vigenciaId = req.query.vigenciaId;
    if (req.user.role === "SOCIO") {
      if (!req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
      const savingWhere = { memberId: req.memberId, deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}) };
      await accrueLoanInterest();
      const [savings, loans, liquidation, member, sales] = await Promise.all([
        prisma.saving.aggregate({ where: savingWhere, _sum: { amount: true } }),
        prisma.loan.aggregate({ where: { memberId: req.memberId, deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}) }, _sum: { principal: true, balance: true, pendingInterest: true } }),
        prisma.liquidation.findFirst({ where: { memberId: req.memberId, ...(vigenciaId ? { vigenciaId } : {}) }, orderBy: { createdAt: "desc" } }),
        prisma.member.findUnique({ where: { id: req.memberId }, select: { raffleNumber: true, vigenciaId: true } }),
        prisma.activitySale.findMany({
          where: { memberId: req.memberId, activity: { deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}) } },
          include: { payments: { select: { amount: true } } }
        })
      ]);
      const raffleVigenciaId = vigenciaId || member?.vigenciaId;
      const raffleEntries = raffleVigenciaId
        ? await prisma.raffleMemberPayment.findMany({
          where: {
            memberId: req.memberId,
            raffleMonth: {
              program: { vigenciaId: raffleVigenciaId, vigencia: { deletedAt: null } }
            }
          },
          select: {
            id: true,
            amount: true,
            paidAt: true,
            discountedAmount: true,
            discountedAt: true,
            annulledAt: true,
            raffleMonth: { select: { month: true, drawAt: true, finalizedAt: true } }
          },
          orderBy: { raffleMonth: { drawAt: "asc" } }
        })
        : [];
      const personalDashboard = {
        scope: "SOCIO",
        totalAhorrado: savings._sum.amount || 0,
        totalPrestado: loans._sum.principal || 0,
        carteraPendiente: loans._sum.balance || 0,
        deudasPendientes: roundMoney(Number(loans._sum.balance || 0) + Number(loans._sum.pendingInterest || 0)
          + sales.reduce((sum, sale) => sum + saleWithBalance(sale).balance, 0)),
        numeroRifa: member?.raffleNumber || null,
        gananciasPropias: liquidation ? roundMoney(Number(liquidation.activityGain) + Number(liquidation.loanGain) + Number(liquidation.raffleGain)) : null,
        valorProyectadoLiquidacion: liquidation?.finalAmount ?? null,
        rifasPendientes: raffleEntries.map((entry) => ({
          id: entry.id,
          month: entry.raffleMonth.month,
          drawAt: entry.raffleMonth.drawAt,
          amount: entry.amount,
          paidAt: entry.paidAt,
          discountedAmount: entry.discountedAmount,
          discountedAt: entry.discountedAt,
          annulledAt: entry.annulledAt,
          status: entry.paidAt && entry.paidAt < entry.raffleMonth.drawAt
            ? "PAGADO"
            : Number(entry.discountedAmount) >= Number(entry.amount)
              ? "DESCONTADO"
              : Number(entry.discountedAmount) > 0
                ? "DESCUENTO PARCIAL"
                : "PENDIENTE",
          participates: Boolean(entry.paidAt && entry.paidAt < entry.raffleMonth.drawAt)
        }))
      };
      return res.json(await applyObjectFieldPermissions(req.user.role, "dashboard", personalDashboard));
    }
    await accrueLoanInterest();
    const memberWhere = vigenciaId ? { vigenciaId, status: "ACTIVO" } : { status: "ACTIVO" };
    const [savings, loans, activeMembers] = await Promise.all([
      prisma.saving.aggregate({ where: { deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}) }, _sum: { amount: true } }),
      prisma.loan.aggregate({ where: { deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}) }, _sum: { principal: true, balance: true, pendingInterest: true, generatedInterest: true } }),
      prisma.member.count({ where: memberWhere })
    ]);
    const [paidCapital, collectedInterest, activeLoans, completedLoans, activities, activitySales, monthlyRaffleGains, legacyRaffleGains, legacyWinnerPrizes, closedAmounts] = await Promise.all([
      prisma.loanPayment.aggregate({ where: { annulledAt: null, loan: { deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}) } }, _sum: { principal: true } }),
      prisma.loanPayment.aggregate({ where: { annulledAt: null, loan: { deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}) } }, _sum: { interest: true } }),
      prisma.loan.count({ where: { ... (vigenciaId ? { vigenciaId } : {}), deletedAt: null, status: "ACTIVO" } }),
      prisma.loan.count({ where: { ... (vigenciaId ? { vigenciaId } : {}), deletedAt: null, status: { in: ["FINALIZADO", "PAGADO"] } } }),
      prisma.activityParticipant.aggregate({ where: { activity: { deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}) } }, _sum: { gain: true } }),
      prisma.activitySale.findMany({
        where: { activity: { deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}) } },
        include: { payments: { select: { amount: true } } }
      }),
      prisma.raffleProgramDistribution.aggregate({
        where: { type: { in: ["SOCIO", "GANADOR"] }, raffleMonth: { finalizedAt: { not: null }, program: { ...(vigenciaId ? { vigenciaId } : {}), vigencia: { deletedAt: null } } } },
        _sum: { amount: true }
      }),
      prisma.raffleDistribution.aggregate({
        where: { type: { in: ["SOCIO", "GANADOR"] }, raffle: { deletedAt: null, ...(vigenciaId ? { vigenciaId } : {}) } },
        _sum: { amount: true }
      }),
      prisma.raffle.aggregate({
        where: { deletedAt: null, winnerId: { not: null }, collectedAmount: 0, distributions: { none: {} }, ...(vigenciaId ? { vigenciaId } : {}) },
        _sum: { prize: true }
      }),
      vigenciaId ? prisma.liquidation.aggregate({ where: { vigenciaId, vigencia: { status: "LIQUIDADA" } }, _sum: { finalAmount: true }, _count: true }) : Promise.resolve(null)
    ]);
    const adminDashboard = {
      totalAhorrado: savings._sum.amount || 0,
      totalPrestado: loans._sum.principal || 0,
      carteraPendiente: loans._sum.balance || 0,
      deudasPendientes: roundMoney(Number(loans._sum.balance || 0) + Number(loans._sum.pendingInterest || 0)
        + activitySales.reduce((sum, sale) => sum + saleWithBalance(sale).balance, 0)),
      capitalRecuperado: paidCapital._sum.principal || 0,
      interesesPendientes: loans._sum.pendingInterest || 0,
      interesesRecaudados: collectedInterest._sum.interest || 0,
      interesesGenerados: loans._sum.generatedInterest || 0,
      prestamosActivos: activeLoans,
      prestamosFinalizados: completedLoans,
      sociosActivos: activeMembers,
      gananciasActividades: activities._sum.gain || 0,
      gananciasPrestamos: collectedInterest._sum.interest || 0,
      gananciasRifas: roundMoney(Number(monthlyRaffleGains._sum.amount || 0) + Number(legacyRaffleGains._sum.amount || 0) + Number(legacyWinnerPrizes._sum.prize || 0)),
      comisionAdministrativa: null,
      valorTotalEntregar: closedAmounts?._count ? closedAmounts._sum.finalAmount : null
    };
    res.json(await applyObjectFieldPermissions(req.user.role, "dashboard", adminDashboard));
  } catch (error) { next(error); }
});

app.get("/api/liquidaciones", requirePermission("liquidaciones", "consultar"), async (req, res, next) => {
  try {
    if (req.user.role === "SOCIO" && !req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
    const p = paginate(req.query);
    const where = req.user.role === "SOCIO" ? { memberId: req.memberId } : {};
    if (req.query.vigenciaId) where.vigenciaId = req.query.vigenciaId;
    if (req.query.search) where.member = {
      OR: [
        { firstName: { contains: req.query.search, mode: "insensitive" } },
        { lastName: { contains: req.query.search, mode: "insensitive" } },
        { document: { contains: req.query.search, mode: "insensitive" } }
      ]
    };
    const [items, total] = await Promise.all([
      prisma.liquidation.findMany({ where, skip: p.skip, take: p.take, include: { member: { select: { id: true, firstName: true, lastName: true } }, vigencia: { select: { id: true, year: true, status: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.liquidation.count({ where })
    ]);
    res.json({ items: await applyFieldPermissions(req.user.role, "liquidaciones", items), total, page: p.page, pageSize: p.pageSize });
  } catch (error) { next(error); }
});

app.get("/api/liquidaciones/:vigenciaId/preview", requirePermission("liquidaciones", "aprobar"), requireAdmin, async (req, res, next) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await accrueLoanInterest(new Date(), tx);
      return loadSettlement(tx, req.params.vigenciaId);
    }, { isolationLevel: "Serializable", timeout: 30000 });
    const { loans, fees, ...preview } = result;
    res.json(preview);
  } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); }
});

app.post("/api/liquidaciones/:vigenciaId", requirePermission("liquidaciones", "aprobar"), requireAdmin, async (req, res, next) => {
  try {
    if (typeof req.body?.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(req.body.fingerprint)) {
      return res.status(400).json({ error: "Consulte una vista previa antes de confirmar la liquidaci?n" });
    }
    const result = await prisma.$transaction(async (tx) => {
      await accrueLoanInterest(new Date(), tx);
      const current = await loadSettlement(tx, req.params.vigenciaId);
      if (current.fingerprint !== req.body.fingerprint) {
        const error = new Error("Los datos cambiaron. Actualice la vista previa antes de confirmar.");
        error.status = 409;
        throw error;
      }
      await saveSettlement(tx, current, req.user.sub);
      await audit(req, "LIQUIDATE", "vigencia", req.params.vigenciaId, { memberCount: current.items.length, totalProfit: current.totalProfit }, tx);
      return current;
    }, { isolationLevel: "Serializable", timeout: 30000 });
    const { loans, fees, ...response } = result;
    res.status(201).json(response);
  } catch (error) { if (error.status) return res.status(error.status).json({ error: error.message }); next(error); }
});

app.get("/api/liquidaciones/:vigenciaId", requirePermission("liquidaciones", "consultar"), async (req, res, next) => {
  try {
    if (req.user.role === "SOCIO" && !req.memberId) return res.status(403).json({ error: "Usuario sin socio vinculado" });
    const where = {
      vigenciaId: req.params.vigenciaId,
      ...(req.user.role === "SOCIO" ? { memberId: req.memberId } : {})
    };
    const items = await prisma.liquidation.findMany({ where, include: { member: { select: { id: true, firstName: true, lastName: true } }, vigencia: { select: { id: true, year: true, status: true } } }, orderBy: { member: { lastName: "asc" } } });
    res.json({ items: await applyFieldPermissions(req.user.role, "liquidaciones", items) });
  } catch (error) { next(error); }
});

app.delete("/api/:resource/:id", requireResourcePermission("eliminar"), requireAdmin, async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    const now = new Date();
    const deletedBy = req.user.sub;
    let item;
    switch (resource) {
      case "socios":
        item = await prisma.member.update({ where: { id }, data: { status: "ELIMINADO", deletedAt: now, deletedBy } });
        break;
      case "usuarios":
        if (id === deletedBy) return res.status(400).json({ error: "No puede eliminar su propia cuenta" });
        item = await prisma.user.update({ where: { id }, data: { status: "ELIMINADO", deletedAt: now, deletedBy } });
        await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
        break;
      case "ahorros":
      case "prestamos":
      case "rifas":
        item = await prisma.$transaction(async (tx) => {
          const model = { ahorros: tx.saving, prestamos: tx.loan, rifas: tx.raffle }[resource];
          const record = await model.findFirst({ where: { id, deletedAt: null }, include: { vigencia: true } });
          if (!record) { const error = new Error("Registro no encontrado"); error.status = 404; throw error; }
          if (record.vigencia.status === "LIQUIDADA") {
            const error = new Error("No se puede eliminar un registro de una vigencia liquidada"); error.status = 409; throw error;
          }
          return model.update({ where: { id }, data: { deletedAt: now, deletedBy } });
        }, { isolationLevel: "Serializable" });
        break;
      case "actividades":
        item = await prisma.$transaction(async (tx) => {
          const activity = await tx.activity.findFirst({ where: { id, deletedAt: null }, include: { vigencia: true, sales: { select: { id: true }, take: 1 } } });
          if (!activity) { const error = new Error("Actividad no encontrada"); error.status = 404; throw error; }
          if (activity.vigencia.status !== "ABIERTA" || activity.sales.length) {
            const error = new Error("No se puede eliminar una actividad con ventas o de una vigencia cerrada"); error.status = 409; throw error;
          }
          return tx.activity.update({ where: { id }, data: { deletedAt: now, deletedBy } });
        }, { isolationLevel: "Serializable" });
        break;
      case "vigencias":
        item = await prisma.vigencia.update({ where: { id }, data: { deletedAt: now, deletedBy } });
        break;
      default:
        return res.status(404).json({ error: "Recurso no admite eliminación lógica" });
    }
    await audit(req, "SOFT_DELETE", resource, id, { deletedBy });
    res.json({ id: item.id, deletedAt: now });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.code === "P2034") return res.status(409).json({ error: "El registro cambió durante la operación; actualice la información e inténtelo nuevamente" });
  if (error.code === "P2021" || error.code === "P2022") {
    const missingSchemaItem = String(error.meta?.table || error.meta?.column || "");
    if (/valor_por_socio/i.test(missingSchemaItem)) {
      return res.status(503).json({
        error: "Falta la actualización de rifas por sorteo. Ejecute database/migracion_valor_rifa_por_sorteo.sql y regenere el cliente Prisma."
      });
    }
    if (/producto_actividad/i.test(missingSchemaItem)) {
      return res.status(503).json({
        error: "Falta el catálogo de productos. Ejecute database/migracion_catalogo_productos_actividad.sql y regenere el cliente Prisma."
      });
    }
    if (/venta_actividad|pago_venta_actividad/i.test(missingSchemaItem)) {
      return res.status(503).json({
        error: "La base de datos no tiene el esquema de ventas de actividades. Ejecute database/migracion_ventas_actividades.sql o aplique las migraciones Prisma y reinicie el backend."
      });
    }
    const missingCalendar = error.code === "P2021" || /programa_rifa|rifa_mensual|distribucion_rifa_mensual/i.test(missingSchemaItem);
    const migration = missingCalendar
      ? "database/migracion_rifa_por_socio_y_calendario.sql"
      : "database/migracion_control_cuotas_rifa.sql";
    return res.status(503).json({
      error: `La base de datos aún no tiene el esquema requerido para rifas mensuales. En pgAdmin 4 ejecute ${migration} y reinicie el backend.`
    });
  }
  const status = error.code?.startsWith("P") ? 400 : 500;
  res.status(status).json({ error: status === 400 ? "Datos inválidos o recurso relacionado no válido" : "Error interno del servidor" });
});

cron.schedule("0 2 * * *", () => {
  console.log(`[${new Date().toISOString()}] Revisión diaria de vigencias y préstamos`);
  accrueLoanInterest().catch((error) => console.error("No fue posible acumular los intereses mensuales:", error));
});

app.listen(port, () => console.log(`La Natillera de Lili API listening on http://localhost:${port}`));
