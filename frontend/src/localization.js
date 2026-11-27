const fieldLabels = {
  email: "Correo electrónico",
  passwordHash: "Contraseña cifrada",
  role: "Rol",
  status: "Estado",
  year: "Año",
  collectionFrequencyDays: "Frecuencia de recaudo",
  startDate: "Inicio de la vigencia",
  lastPaymentDate: "Último pago de la vigencia",
  closedAt: "Fecha de cierre",
  createdAt: "Fecha de creación",
  updatedAt: "Última actualización",
  deletedAt: "Fecha de eliminación",
  deletedBy: "Eliminado por",
  tokenHash: "Token cifrado",
  userId: "Usuario",
  expiresAt: "Fecha de vencimiento",
  revokedAt: "Fecha de revocación",
  document: "Documento",
  firstName: "Nombres",
  lastName: "Apellidos",
  birthDate: "Fecha de nacimiento",
  phone: "Teléfono",
  address: "Dirección",
  joinedAt: "Fecha de ingreso",
  raffleNumber: "Número de rifa",
  vigenciaId: "Vigencia",
  memberId: "Socio",
  date: "Fecha",
  amount: "Valor",
  observation: "Observación",
  name: "Nombre",
  description: "Descripción",
  income: "Ingresos",
  costs: "Costos",
  participantCost: "Valor por participante",
  amountDue: "Valor a pagar",
  amountPaid: "Valor abonado",
  activityId: "Actividad",
  gain: "Ganancia",
  borrowerName: "Nombre del prestatario",
  type: "Tipo",
  principal: "Capital prestado",
  rate: "Tasa de interés",
  installments: "Número de cuotas",
  balance: "Saldo pendiente",
  pendingInterest: "Intereses pendientes",
  generatedInterest: "Intereses generados",
  interestAnchorAt: "Inicio del cálculo de intereses",
  lastInterestAt: "Último cálculo de intereses",
  observations: "Observaciones",
  loanId: "Préstamo",
  interest: "Intereses",
  mora: "Mora",
  previousBalance: "Saldo anterior",
  newBalance: "Nuevo saldo",
  recordedBy: "Registrado por",
  annulledAt: "Fecha de anulación",
  cancellationReason: "Motivo de anulación",
  winningNumber: "Número ganador",
  prize: "Premio entregado",
  collectedAmount: "Total recaudado",
  winnerId: "Socio ganador",
  concept: "Concepto",
  dueDate: "Fecha de vencimiento",
  savings: "Ahorros",
  activityGain: "Ganancias de actividades",
  loanGain: "Ganancias de préstamos",
  raffleGain: "Ganancias de rifas",
  adminCommission: "Comisión administrativa",
  raffleFeesDiscounted: "Cuotas de rifas descontadas",
  discountedAmount: "Valor descontado",
  debtsDiscounted: "Deudas descontadas",
  finalAmount: "Valor final",
  roleSnapshot: "Rol al cierre",
  action: "Acción",
  entity: "Registro",
  metadata: "Detalles",
  ipAddress: "Dirección IP",
  total: "Total",
  sum: "Suma",
  page: "Página",
  pageSize: "Registros por página",
  format: "Formato"
};

const internalIdentifierFields = new Set(["id", "entityid", "code", "codigo"]);

const enumLabels = {
  SOCIO: "Socio",
  ADMINISTRADOR: "Administrador",
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
  ELIMINADO: "Eliminado",
  ABIERTA: "Abierta",
  CERRADA: "Cerrada",
  LIQUIDADA: "Liquidada",
  PARTICULAR: "Particular",
  PAGADO: "Pagado",
  DESCUENTO: "Descuento",
  DESCUENTO_PARCIAL: "Descuento parcial",
  DESCONTADO: "Descontado",
  "DESCUENTO PARCIAL": "Descuento parcial",
  "PAGO FUERA DE PLAZO": "Pago fuera de plazo",
  RAFFLE_FEE_ANNULLED: "Anulación de pago de rifa",
  FINALIZADO: "Finalizado",
  VENCIDO: "Vencido",
  CASTIGADO: "Castigado",
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  DESCONTADA: "Descontada",
  CANCELADA: "Cancelada",
  CREATE: "Creación",
  UPDATE: "Actualización",
  SOFT_DELETE: "Eliminación lógica",
  CHANGE_ROLE: "Cambio de rol",
  LIQUIDATE: "Liquidación",
  ANNUL: "Anulación",
  LOGIN_SUCCESS: "Inicio de sesión correcto",
  LOGIN_FAILED: "Intento de inicio de sesión fallido",
  LOGIN_REJECTED: "Inicio de sesión rechazado"
};

const currencyFields = new Set([
  "amount", "income", "costs", "principal", "balance", "pendingInterest", "generatedInterest", "previousBalance", "newBalance", "interest", "mora",
  "prize", "gain", "savings", "activityGain", "loanGain", "raffleGain",
  "adminCommission", "raffleFeesDiscounted", "discountedAmount", "debtsDiscounted", "finalAmount", "sum"
]);

const dateFields = new Set([
  "date", "birthDate", "joinedAt", "closedAt", "createdAt", "updatedAt",
  "deletedAt", "expiresAt", "revokedAt", "dueDate", "interestAnchorAt", "lastInterestAt", "annulledAt", "discountedAt", "lastPaymentDate",
  "startDate"
]);

const dateOnlyFields = new Set(["startDate", "lastPaymentDate"]);

export function labelForField(field) {
  if (isInternalIdentifierField(field)) return "";
  return fieldLabels[field] || field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toLocaleUpperCase("es-CO"));
}

export function isInternalIdentifierField(field) {
  return internalIdentifierFields.has(field.replace(/[^a-z0-9]/gi, "").toLocaleLowerCase("en-US"));
}

export function displayValue(field, value, item = {}) {
  if (value === null || value === undefined || value === "") return "—";

  const relatedValues = {
    memberId: item.member && `${item.member.firstName || ""} ${item.member.lastName || ""}`.trim(),
    winnerId: item.winner && `${item.winner.firstName || ""} ${item.winner.lastName || ""}`.trim(),
    vigenciaId: item.vigencia?.year,
    loanId: item.loan?.borrowerName
  };
  if (relatedValues[field]) return String(relatedValues[field]);

  if (dateFields.has(field)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        ...(dateOnlyFields.has(field) ? { timeZone: "UTC" } : {})
      }).format(date);
    }
  }

  if (currencyFields.has(field) && Number.isFinite(Number(value))) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 2 }).format(Number(value));
  }

  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (field === "rate" && Number.isFinite(Number(value))) return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(Number(value))} %`;
  if (typeof value === "number") return new Intl.NumberFormat("es-CO").format(value);
  return enumLabels[value] || String(value);
}
