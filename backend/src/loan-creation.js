import { calculateMonthlyInterest, firstInterestDate, validateLoanTerms } from "./loan-finance.js";

function failure(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

export async function createLoan(prisma, input) {
  const termsError = validateLoanTerms(input);
  if (termsError) throw failure(termsError);
  const interestAnchorAt = firstInterestDate(input.date, input.interestStartDays);
  return prisma.$transaction(async (tx) => {
    const vigencia = await tx.vigencia.findFirst({ where: { id: input.vigenciaId, status: "ABIERTA", deletedAt: null } });
    if (!vigencia) { const error = new Error("Seleccione una vigencia abierta"); error.status = 400; throw error; }
    const member = await tx.member.findFirst({ where: { id: input.memberId, vigenciaId: input.vigenciaId, status: "ACTIVO", deletedAt: null } });
    if (!member) { const error = new Error("Seleccione un socio activo de la vigencia del préstamo"); error.status = 400; throw error; }
    return tx.loan.create({ data: {
      borrowerName: input.type === "SOCIO" ? `${member.firstName} ${member.lastName}`.trim() : input.borrowerName.trim(),
      memberId: member.id, type: input.type, principal: input.principal, rate: Number(input.rate),
      installments: 1, balance: input.principal, vigenciaId: input.vigenciaId,
      date: input.date, interestAnchorAt, lastInterestAt: input.date,
      observations: input.observations || null
    } });
  }, { isolationLevel: "Serializable" });
}

export async function updateLoan(prisma, id, input, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const loan = await tx.loan.findFirst({ where: { id, deletedAt: null }, include: { payments: { select: { id: true }, take: 1 }, vigencia: true } });
    if (!loan) throw failure("Préstamo no encontrado", 404);
    if (loan.vigencia.status !== "ABIERTA" || loan.vigencia.deletedAt) throw failure("Solo se pueden modificar préstamos de una vigencia abierta", 409);
    const financialKeys = ["type", "memberId", "borrowerName", "principal", "rate", "date", "interestStartDays"];
    const changingTerms = financialKeys.some((key) => Object.hasOwn(input, key));
    if (!changingTerms) {
      if (typeof input.observations !== "string") throw failure("Indique las observaciones");
      return tx.loan.update({ where: { id }, data: { observations: input.observations.trim() || null } });
    }
    const accrual = calculateMonthlyInterest({ balance: loan.balance, rate: loan.rate, anchorAt: loan.interestAnchorAt, lastAccruedAt: loan.lastInterestAt, now });
    if (loan.status !== "ACTIVO" || loan.payments.length || Number(loan.generatedInterest) !== 0 ||
      Number(loan.pendingInterest) !== 0 || Number(loan.balance) !== Number(loan.principal) ||
      loan.lastInterestAt > loan.date || accrual.periods > 0) {
      throw failure("No se pueden modificar las condiciones: el préstamo tiene pagos o intereses causados", 409);
    }
    const terms = {
      type: input.type ?? loan.type, memberId: input.memberId ?? loan.memberId,
      borrowerName: input.borrowerName ?? loan.borrowerName, rate: input.rate ?? String(loan.rate)
    };
    const termsError = validateLoanTerms(terms);
    if (termsError) throw failure(termsError);
    const principal = input.principal === undefined ? Number(loan.principal) : input.principal;
    if (typeof principal !== "number" || !Number.isFinite(principal) || principal <= 0) throw failure("El monto debe ser mayor que cero");
    const date = input.date === undefined ? loan.date : input.date;
    if (!(date instanceof Date) || Number.isNaN(date.getTime()) || date > now) throw failure("La fecha de desembolso no es válida");
    const vigenciaId = loan.vigenciaId;
    const member = await tx.member.findFirst({ where: { id: terms.memberId, vigenciaId, status: "ACTIVO", deletedAt: null } });
    if (!member) throw failure("Seleccione un socio activo de la vigencia del préstamo");
    let interestAnchorAt = loan.interestAnchorAt;
    if (input.interestStartDays !== undefined) interestAnchorAt = firstInterestDate(date, input.interestStartDays);
    else if (input.date !== undefined && date.getTime() !== loan.date.getTime()) {
      throw failure("Indique los días para iniciar intereses al cambiar el desembolso");
    }
    return tx.loan.update({ where: { id }, data: {
      type: terms.type, memberId: member.id,
      borrowerName: terms.type === "SOCIO" ? `${member.firstName} ${member.lastName}`.trim() : terms.borrowerName.trim(),
      principal, balance: principal, rate: Number(terms.rate), date, interestAnchorAt,
      lastInterestAt: date,
      ...(input.observations !== undefined ? { observations: input.observations.trim() || null } : {})
    } });
  }, { isolationLevel: "Serializable" });
}
