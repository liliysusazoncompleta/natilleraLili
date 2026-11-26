import { createHash } from "node:crypto";
import { allocateRaffleFeeDiscount } from "./raffle-finance.js";

const conflict = (message) => Object.assign(new Error(message), { status: 409 });

function cents(value) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw conflict("Hay un valor monetario inválido; revise los registros antes de liquidar.");
  const result = BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw conflict("El valor excede el límite de cálculo seguro.");
  return Number(result);
}

function sum(values) {
  const total = values.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total)) throw conflict("El total excede el límite de cálculo seguro.");
  return total;
}

const money = (value) => (value / 100).toFixed(2);

function split(total, weights) {
  const denominator = weights.reduce((n, weight) => n + BigInt(weight), 0n);
  if (!denominator) return weights.map(() => 0);
  const parts = weights.map((weight, index) => {
    const numerator = BigInt(total) * BigInt(weight);
    return { index, value: Number(numerator / denominator), remainder: numerator % denominator };
  });
  let rest = total - sum(parts.map((part) => part.value));
  for (const part of [...parts].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)) {
    if (!rest) break;
    part.value += 1;
    rest -= 1;
  }
  return parts.map((part) => part.value);
}

function computePayment(loans, available) {
  let left = available;
  return loans.map((loan) => {
    const interest = Math.min(cents(loan.pendingInterest), left);
    left -= interest;
    const principal = Math.min(cents(loan.balance), left);
    left -= principal;
    return { id: loan.id, interest, principal };
  });
}

export function calculateSettlement({ members, savings, activities, payments, loans, fees, distributions }) {
  if (!members.length) throw conflict("La vigencia no tiene socios activos para liquidar.");
  const warnings = [];
  const byId = new Map(members.map((member, index) => [member.id, index]));
  const byUser = new Map(members.filter((member) => member.userId).map((member) => [member.userId, byId.get(member.id)]));
  const memberSavings = members.map(() => 0);
  for (const saving of savings) {
    const index = byId.get(saving.memberId);
    if (index === undefined && cents(saving.amount)) warnings.push(`Hay ahorros del socio ${saving.memberId} que no está activo en esta vigencia.`);
    if (index !== undefined) memberSavings[index] = sum([memberSavings[index], cents(saving.amount)]);
  }
  const activityGross = members.map(() => 0);
  const activityDebt = members.map(() => 0);
  const salesDebt = members.map(() => 0);
  for (const activity of activities) for (const participant of activity.participants) {
    const index = byId.get(participant.memberId);
    const gain = cents(participant.gain);
    if (index === undefined && gain) warnings.push(`La actividad "${activity.name}" tiene ganancias asignadas a un socio no activo en esta vigencia.`);
    if (index !== undefined) {
      activityGross[index] = sum([activityGross[index], gain]);
      const paid = sum(participant.payments.map((payment) => cents(payment.amount)));
      activityDebt[index] = sum([activityDebt[index], Math.max(0, cents(activity.participantCost) - paid)]);
    }
  }
  for (const activity of activities) for (const sale of activity.sales) {
    const index = byId.get(sale.memberId);
    if (index === undefined) continue;
    const due = cents(sale.unitPrice) * sale.quantity;
    if (!Number.isSafeInteger(due)) throw conflict("El valor de una venta excede el límite de cálculo seguro.");
    const paid = sum(sale.payments.map((payment) => cents(payment.amount)));
    salesDebt[index] = sum([salesDebt[index], Math.max(0, due - paid)]);
  }
  const raffleGains = members.map(() => 0);
  const raffleAdmin = members.map(() => 0);
  for (const distribution of distributions) {
    const index = distribution.type === "ADMINISTRADOR" ? byUser.get(distribution.userId) : byId.get(distribution.memberId);
    const amount = cents(distribution.amount);
    if (index === undefined && amount) {
      warnings.push(`La distribución de rifa ${distribution.id} (${money(amount)}) no tiene un socio activo asociado al destinatario.`);
    } else if (index !== undefined) {
      const target = distribution.type === "ADMINISTRADOR" ? raffleAdmin : raffleGains;
      target[index] = sum([target[index], amount]);
    }
  }
  const activityTotal = sum(activityGross);
  const collectedInterest = sum(payments.map((payment) => cents(payment.interest)));
  const adminWeights = members.map((member) => member.role === "ADMINISTRADOR" ? 1 : 0);
  const feeTotals = members.map((member) => sum(fees.filter((fee) => fee.memberId === member.id).map((fee) => Math.max(0, cents(fee.amount) - cents(fee.discountedAmount)))));
  const memberLoans = members.map((member) => loans.filter((loan) => loan.memberId === member.id));
  for (const loan of memberLoans.flat()) {
    if (loan.vigenciaId && loan.vigenciaId !== members[0].vigenciaId) {
      warnings.push(`El préstamo ${loan.id} pertenece a otra vigencia. Registre su pago por separado antes de liquidar para evitar repartir sus intereses dos veces.`);
    }
  }
  const loanTotals = memberLoans.map((items) => sum(items.flatMap((loan) => [cents(loan.balance), cents(loan.pendingInterest)])));
  let extraInterest = 0;
  let state;
  const seen = new Set();
  for (let iteration = 0; iteration < 10000; iteration += 1) {
    if (seen.has(extraInterest)) throw conflict("El reparto de intereses descontados no converge a centavos; revise las deudas antes de liquidar.");
    seen.add(extraInterest);
    const interestTotal = sum([collectedInterest, extraInterest]);
    const profit = sum([activityTotal, interestTotal]);
    const commission = Number((BigInt(profit) * 3n + 50n) / 100n);
    const [activityCommission, loanCommission] = split(commission, [activityTotal, interestTotal]);
    if (commission && !adminWeights.some(Boolean)) warnings.push("No hay socio administrador activo para recibir la comisión anual.");
    if (interestTotal - loanCommission > 0 && !memberSavings.some(Boolean)) warnings.push("No hay ahorros para repartir los intereses cobrados.");
    const activityShares = split(activityTotal - activityCommission, activityGross);
    const loanShares = split(interestTotal - loanCommission, memberSavings);
    const commissions = split(commission, adminWeights);
    const planned = members.map((member, index) => {
      const gains = sum([activityShares[index], loanShares[index], raffleGains[index], raffleAdmin[index], commissions[index]]);
      const available = sum([memberSavings[index], gains]);
      const feeDiscount = Math.min(feeTotals[index], available);
      const loanDiscount = Math.min(loanTotals[index], available - feeDiscount);
      return {
        memberId: member.id, member: { firstName: member.firstName, lastName: member.lastName, document: member.document },
        roleSnapshot: member.role, savings: money(memberSavings[index]), activityGain: money(activityShares[index]),
        loanGain: money(loanShares[index]), raffleGain: money(raffleGains[index]),
        adminCommission: money(sum([raffleAdmin[index], commissions[index]])),
        raffleCommission: money(raffleAdmin[index]), annualCommission: money(commissions[index]),
        raffleFeesDiscounted: money(feeDiscount), loanDebtDiscounted: money(loanDiscount),
        debtsDiscounted: money(sum([feeDiscount, loanDiscount])),
        outstandingRaffle: money(feeTotals[index] - feeDiscount), outstandingLoan: money(loanTotals[index] - loanDiscount),
        outstandingActivity: money(activityDebt[index]), outstandingSales: money(salesDebt[index]),
        finalAmount: money(available - feeDiscount - loanDiscount),
        loanPayments: computePayment(memberLoans[index], loanDiscount)
      };
    });
    const nextInterest = sum(planned.flatMap((item) => item.loanPayments.map((payment) => payment.interest)));
    if (nextInterest === extraInterest) {
      state = { items: planned, totalSavings: money(sum(memberSavings)), totalProfit: money(profit), commissionTotal: money(commission), collectedInterest: money(interestTotal) };
      break;
    }
    extraInterest = nextInterest;
  }
  if (!state) throw conflict("El cálculo de intereses no convergió; revise las deudas antes de liquidar.");
  return { ...state, blockers: [...new Set(warnings)] };
}

export async function loadSettlement(tx, vigenciaId) {
  const vigencia = await tx.vigencia.findFirst({ where: { id: vigenciaId, deletedAt: null } });
  if (!vigencia) throw Object.assign(new Error("Vigencia no encontrada"), { status: 404 });
  if (vigencia.status === "LIQUIDADA") throw conflict("La vigencia ya fue liquidada.");
  const [members, savings, activities, payments, loans, fees, monthly, legacy, openDraws, existing] = await Promise.all([
    tx.member.findMany({ where: { vigenciaId, status: "ACTIVO", deletedAt: null }, orderBy: { id: "asc" } }),
    tx.saving.findMany({ where: { vigenciaId, deletedAt: null }, orderBy: { id: "asc" } }),
    tx.activity.findMany({
      where: { vigenciaId, deletedAt: null },
      include: { participants: { include: { payments: true }, orderBy: { memberId: "asc" } }, sales: { include: { payments: true } } },
      orderBy: { id: "asc" }
    }),
    tx.loanPayment.findMany({ where: { annulledAt: null, loan: { vigenciaId, deletedAt: null } }, orderBy: { id: "asc" } }),
    tx.loan.findMany({ where: { deletedAt: null, OR: [{ balance: { gt: 0 } }, { pendingInterest: { gt: 0 } }] }, orderBy: [{ date: "asc" }, { id: "asc" }] }),
    tx.raffleMemberPayment.findMany({ where: { paidAt: null, raffleMonth: { program: { vigenciaId } } }, orderBy: [{ raffleMonth: { drawAt: "asc" } }, { id: "asc" }] }),
    tx.raffleProgramDistribution.findMany({ where: { raffleMonth: { finalizedAt: { not: null }, program: { vigenciaId } } }, orderBy: { id: "asc" } }),
    tx.raffle.findMany({ where: { vigenciaId, deletedAt: null }, include: { distributions: { orderBy: { id: "asc" } } }, orderBy: { id: "asc" } }),
    tx.raffleMonth.count({ where: { program: { vigenciaId }, finalizedAt: null } }),
    tx.liquidation.count({ where: { vigenciaId } })
  ]);
  if (existing) throw conflict("Ya existen registros de liquidación para esta vigencia; deben revisarse antes del cierre.");
  const legacyDistributions = legacy.flatMap((raffle) => {
    if (!raffle.distributions.length && raffle.winnerId && cents(raffle.prize) && !cents(raffle.collectedAmount)) {
      return [{ id: `premio-historico-${raffle.id}`, memberId: raffle.winnerId, type: "GANADOR", amount: raffle.prize }];
    }
    return raffle.distributions;
  });
  const result = calculateSettlement({ members, savings, activities, payments, loans, fees, distributions: [...monthly, ...legacyDistributions] });
  for (const raffle of legacy) {
    const recordedWinnerPrize = raffle.winnerId && cents(raffle.prize) && !cents(raffle.collectedAmount);
    if (!raffle.distributions.length && !recordedWinnerPrize && (cents(raffle.collectedAmount) || cents(raffle.prize))) result.blockers.push(`La rifa histórica ${raffle.id} no tiene distribuciones registradas; revise sus beneficiarios.`);
  }
  const publicResult = {
    vigencia: { id: vigencia.id, year: vigencia.year, status: vigencia.status },
    ...result,
    notices: openDraws ? [`Hay ${openDraws} sorteo(s) sin cerrar; no se incluyen distribuciones futuras.`] : []
  };
  const fingerprint = createHash("sha256").update(JSON.stringify({ publicResult, loans, fees })).digest("hex");
  return { ...publicResult, fingerprint, loans, fees };
}

export async function saveSettlement(tx, settlement, userId) {
  if (settlement.blockers.length) throw conflict(settlement.blockers.join(" "));
  const now = new Date();
  for (const item of settlement.items) {
    const fees = settlement.fees.filter((fee) => fee.memberId === item.memberId);
    const allocations = allocateRaffleFeeDiscount(fees, item.raffleFeesDiscounted);
    if (allocations.remaining !== "0.00") throw conflict("No fue posible aplicar el descuento de rifas.");
    for (const allocation of allocations.allocations) {
      const fee = fees.find((row) => row.id === allocation.id);
      const changed = await tx.raffleMemberPayment.updateMany({
        where: { id: fee.id, paidAt: null, discountedAmount: fee.discountedAmount },
        data: { discountedAmount: money(sum([cents(fee.discountedAmount), cents(allocation.amount)])), discountedAt: now }
      });
      if (changed.count !== 1) throw conflict("Una cuota de rifa cambió durante la liquidación.");
    }
    for (const payment of item.loanPayments) {
      if (!payment.interest && !payment.principal) continue;
      const loan = settlement.loans.find((row) => row.id === payment.id);
      const balance = money(cents(loan.balance) - payment.principal);
      const pendingInterest = money(cents(loan.pendingInterest) - payment.interest);
      const changed = await tx.loan.updateMany({
        where: { id: loan.id, balance: loan.balance, pendingInterest: loan.pendingInterest, deletedAt: null },
        data: { balance, pendingInterest, status: balance === "0.00" && pendingInterest === "0.00" ? "FINALIZADO" : loan.status }
      });
      if (changed.count !== 1) throw conflict("Un préstamo cambió durante la liquidación.");
      await tx.loanPayment.create({ data: {
        loanId: loan.id, amount: money(payment.principal + payment.interest), principal: money(payment.principal),
        interest: money(payment.interest), mora: 0, previousBalance: loan.balance, newBalance: balance,
        observations: `Descuento automático en liquidación de vigencia ${settlement.vigencia.year}`, recordedBy: userId
      } });
    }
    await tx.liquidation.create({ data: {
      vigenciaId: settlement.vigencia.id, memberId: item.memberId, savings: item.savings,
      activityGain: item.activityGain, loanGain: item.loanGain, raffleGain: item.raffleGain,
      adminCommission: item.adminCommission, raffleFeesDiscounted: item.raffleFeesDiscounted,
      debtsDiscounted: item.debtsDiscounted, finalAmount: item.finalAmount, roleSnapshot: item.roleSnapshot
    } });
  }
  const closed = await tx.vigencia.updateMany({ where: { id: settlement.vigencia.id, status: settlement.vigencia.status }, data: { status: "LIQUIDADA", closedAt: now } });
  if (closed.count !== 1) throw conflict("La vigencia cambió durante la liquidación.");
}
