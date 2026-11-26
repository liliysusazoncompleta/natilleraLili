import test from "node:test";
import assert from "node:assert/strict";
import { createLoan, updateLoan } from "./loan-creation.js";
import { calculateMonthlyInterest, validateLoanTerms } from "./loan-finance.js";

const date = new Date("2026-01-15T00:00:00Z");
const input = { type: "PARTICULAR", memberId: "avalista", borrowerName: "Persona externa", rate: "7.25", principal: 200000, vigenciaId: "vigencia", date, interestStartDays: 5 };

function fakePrisma({ member = { id: "avalista", firstName: "Ana", lastName: "Socio" }, vigencia = { id: "vigencia" } } = {}) {
  const calls = [];
  const tx = {
    vigencia: { findFirst: async (args) => { calls.push(["vigencia", args]); return vigencia; } },
    member: { findFirst: async (args) => { calls.push(["member", args]); return member; } },
    loan: { create: async ({ data }) => { calls.push(["create", data]); return data; } }
  };
  return { calls, $transaction: async (fn, options) => { assert.equal(options.isolationLevel, "Serializable"); return fn(tx); } };
}

test("préstamo particular conserva deudor, tasa y socio avalista", async () => {
  const prisma = fakePrisma();
  const loan = await createLoan(prisma, input);
  assert.equal(loan.borrowerName, "Persona externa");
  assert.equal(loan.type, "PARTICULAR");
  assert.equal(loan.memberId, "avalista");
  assert.equal(loan.rate, 7.25);
  assert.deepEqual(prisma.calls[1][1].where, { id: "avalista", vigenciaId: "vigencia", status: "ACTIVO", deletedAt: null });
  assert.equal(loan.interestAnchorAt.toISOString(), "2026-01-20T00:00:00.000Z");
  assert.equal(calculateMonthlyInterest({ balance: loan.balance, rate: loan.rate, anchorAt: loan.interestAnchorAt, lastAccruedAt: date, now: new Date("2026-01-20T00:00:00Z") }).generated, 14500);
});

function fakeUpdatePrisma(overrides = {}) {
  const loan = {
    id: "loan", type: "PARTICULAR", borrowerName: "Persona externa", memberId: "avalista",
    principal: 200000, rate: 7.25, balance: 200000, generatedInterest: 0, pendingInterest: 0,
    status: "ACTIVO", date, interestAnchorAt: new Date("2026-01-20T00:00:00Z"),
    lastInterestAt: date, vigenciaId: "vigencia", vigencia: { status: "ABIERTA" }, payments: [], ...overrides
  };
  const tx = {
    loan: { findFirst: async () => loan, update: async ({ data }) => ({ ...loan, ...data }) },
    member: { findFirst: async () => ({ id: "avalista", firstName: "Ana", lastName: "Socio" }) }
  };
  return { $transaction: async (fn) => fn(tx) };
}

test("se pueden editar condiciones sin pagos ni intereses causados", async () => {
  const item = await updateLoan(fakeUpdatePrisma(), "loan", { rate: "9", principal: 250000, interestStartDays: 30 }, new Date("2026-01-19T00:00:00Z"));
  assert.equal(item.rate, 9);
  assert.equal(item.balance, 250000);
  assert.equal(item.interestAnchorAt.toISOString(), "2026-02-14T00:00:00.000Z");
});

test("no permite alterar condiciones con pagos o periodos causados, incluso a tasa cero", async () => {
  const now = new Date("2026-01-20T00:00:00Z");
  await assert.rejects(updateLoan(fakeUpdatePrisma({ payments: [{ id: "pago" }] }), "loan", { rate: "9" }, now), /pagos o intereses/);
  await assert.rejects(updateLoan(fakeUpdatePrisma({ rate: 0 }), "loan", { rate: "9" }, now), /pagos o intereses/);
  await assert.rejects(updateLoan(fakeUpdatePrisma({ generatedInterest: 10 }), "loan", { rate: "9" }, now), /pagos o intereses/);
  const item = await updateLoan(fakeUpdatePrisma({ payments: [{ id: "pago" }] }), "loan", { observations: "Aclaración" }, now);
  assert.equal(item.observations, "Aclaración");
});

test("editar fecha requiere días de inicio explícitos y no altera calendarios anteriores", async () => {
  const legacy = { interestAnchorAt: date, lastInterestAt: date };
  const now = new Date("2026-01-19T00:00:00Z");
  const item = await updateLoan(fakeUpdatePrisma(legacy), "loan", { rate: "9" }, now);
  assert.equal(item.interestAnchorAt.toISOString(), date.toISOString());
  await assert.rejects(updateLoan(fakeUpdatePrisma(legacy), "loan", { date: new Date("2026-01-16T00:00:00Z") }, now), /Indique los días/);
});

test("préstamo de socio utiliza el nombre del socio seleccionado", async () => {
  const loan = await createLoan(fakePrisma(), { ...input, type: "SOCIO", borrowerName: "Otro", rate: "3.5" });
  assert.equal(loan.borrowerName, "Ana Socio");
  assert.equal(loan.type, "SOCIO");
  assert.equal(loan.rate, 3.5);
});

test("no se admite avalista inexistente o vigencia cerrada", async () => {
  const withoutMember = fakePrisma({ member: null });
  await assert.rejects(createLoan(withoutMember, input), /socio activo/);
  assert.ok(!withoutMember.calls.some(([name]) => name === "create"));
  const closed = fakePrisma({ vigencia: null });
  await assert.rejects(createLoan(closed, input), /vigencia abierta/);
});

test("tipo, aval y tasa se validan sin asumir 5 o 10 por ciento", () => {
  assert.equal(validateLoanTerms(input), null);
  assert.equal(validateLoanTerms({ ...input, rate: "0" }), null);
  assert.equal(validateLoanTerms({ ...input, rate: "999.99" }), null);
  for (const rate of ["", "-1", "1000", "7.123", "abc", null]) assert.ok(validateLoanTerms({ ...input, rate }));
  assert.ok(validateLoanTerms({ ...input, memberId: "" }));
  assert.ok(validateLoanTerms({ ...input, borrowerName: " " }));
  assert.ok(validateLoanTerms({ ...input, type: "OTRO" }));
});
