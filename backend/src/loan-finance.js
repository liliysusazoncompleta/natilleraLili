export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validateLoanTerms({ type, memberId, borrowerName, rate }) {
  if (!["SOCIO", "PARTICULAR"].includes(type)) return "Seleccione si el deudor es socio o particular";
  if (typeof memberId !== "string" || !memberId.trim()) {
    return type === "PARTICULAR" ? "Seleccione el socio que avala el préstamo" : "Seleccione el socio deudor";
  }
  if (type === "PARTICULAR" && (typeof borrowerName !== "string" || !borrowerName.trim())) {
    return "Indique el nombre del deudor particular";
  }
  const raw = typeof rate === "number" ? String(rate) : typeof rate === "string" ? rate.trim() : "";
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(raw) || Number(raw) > 999.99) {
    return "La tasa mensual debe estar entre 0 y 999,99, con máximo dos decimales";
  }
  return null;
}

export function parseInterestStartDays(value) {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,5}$/.test(raw) || Number(raw) < 1 || Number(raw) > 36500) {
    throw Object.assign(new Error("Indique los días para iniciar intereses: entre 1 y 36500"), { status: 400 });
  }
  return Number(raw);
}

export function firstInterestDate(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + parseInterestStartDays(days));
  return result;
}

export function addMonthsClamped(date, months) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function monthDifference(start, end) {
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
}

export function calculateMonthlyInterest({ balance, rate, anchorAt, lastAccruedAt, now = new Date() }) {
  const anchor = new Date(anchorAt);
  let cursor = new Date(lastAccruedAt);
  const nextPeriod = cursor < anchor ? 0 : Math.max(1, monthDifference(anchor, cursor) + 1);
  let period = nextPeriod;
  let periods = 0;
  while (true) {
    const dueAt = addMonthsClamped(anchor, period);
    if (dueAt > now || dueAt <= cursor) break;
    cursor = dueAt;
    periods += 1;
    period += 1;
  }
  const monthlyInterest = roundMoney(Number(balance) * Number(rate) / 100);
  return {
    periods,
    generated: roundMoney(monthlyInterest * periods),
    lastAccruedAt: cursor
  };
}

export function allocatePayment(amount, balance, pendingInterest) {
  const value = roundMoney(Number(amount));
  const capitalBalance = roundMoney(Number(balance));
  const interestBalance = roundMoney(Number(pendingInterest));
  const interest = Math.min(interestBalance, value);
  const principal = roundMoney(value - interest);
  if (principal > capitalBalance) return null;
  return {
    amount: value,
    interest: roundMoney(interest),
    principal,
    balance: roundMoney(capitalBalance - principal),
    pendingInterest: roundMoney(interestBalance - interest)
  };
}
