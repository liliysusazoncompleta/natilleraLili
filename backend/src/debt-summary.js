import { roundMoney } from "./loan-finance.js";

export function summarizeLoanPayments(payments) {
  let total = 0;
  let principal = 0;
  let lastPaymentDate = null;
  for (const payment of payments) {
    if (payment.annulledAt) continue;
    total = roundMoney(total + Number(payment.amount));
    principal = roundMoney(principal + Number(payment.principal));
    if (!lastPaymentDate || payment.date > lastPaymentDate) lastPaymentDate = payment.date;
  }
  return { total, principal, lastPaymentDate };
}
