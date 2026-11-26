function toCents(value) {
  const amount = Number(value);
  if (
    !/^\d{1,12}(?:\.\d{1,2})?$/.test(String(value)) ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isSafeInteger(Math.round(amount * 100))
  ) {
    throw new RangeError("El valor debe ser un monto no negativo válido");
  }
  return Math.round(amount * 100);
}

function fromCents(cents) {
  return Number((cents / 100).toFixed(2));
}

export function calculateActivityGains({ income, costs, participants }) {
  const profitCents = Math.max(0, toCents(income) - toCents(costs));
  if (!participants.length) return [];

  const weights = participants.map(({ savings }) => Math.max(0, Number(savings) || 0));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const normalizedWeights = totalWeight > 0
    ? weights.map((weight) => weight / totalWeight)
    : weights.map(() => 1 / weights.length);
  const allocations = normalizedWeights.map((weight, index) => {
    const exactCents = profitCents * weight;
    return { index, cents: Math.floor(exactCents), fraction: exactCents % 1 };
  });
  let remainder = profitCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
  const remainderOrder = [...allocations].sort((left, right) =>
    right.fraction - left.fraction || right.index - left.index
  );
  for (let index = 0; index < remainder; index += 1) {
    remainderOrder[index].cents += 1;
  }

  return participants.map((participant, index) => ({
    memberId: participant.id,
    gain: fromCents(allocations[index].cents)
  }));
}

export function calculateParticipantBalance(amountDue, payments) {
  const dueCents = toCents(amountDue);
  const paidCents = payments.reduce((total, amount) => total + toCents(amount), 0);
  return {
    amountDue: fromCents(dueCents),
    amountPaid: fromCents(paidCents),
    balance: fromCents(Math.max(0, dueCents - paidCents))
  };
}

export function calculateSaleTotals({ quantity, unitCost, unitPrice }) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2147483647) {
    throw new RangeError("La cantidad debe ser un entero positivo válido");
  }
  const cost = toCents(unitCost) * quantity;
  const price = toCents(unitPrice) * quantity;
  if (!Number.isSafeInteger(cost) || !Number.isSafeInteger(price) || cost > 99999999999999 || price > 99999999999999) {
    throw new RangeError("El total de la venta excede el valor permitido");
  }
  return { cost: fromCents(cost), price: fromCents(price) };
}

export function snapshotSaleProduct(product, quantity, initialPayment) {
  const data = { product: product.name, quantity, unitCost: product.unitCost, unitPrice: product.unitPrice };
  if (toCents(initialPayment) > toCents(calculateSaleTotals(data).price)) {
    throw new RangeError("El abono supera el valor de la venta");
  }
  return data;
}

export function saleWithBalance(sale) {
  const totals = calculateSaleTotals(sale);
  return {
    ...sale,
    totalCost: totals.cost,
    ...calculateParticipantBalance(totals.price, sale.payments.map((payment) => payment.amount))
  };
}

export function pendingSaleDebts(sales) {
  return sales.flatMap((sale) => {
    const { balance, amountDue, amountPaid } = saleWithBalance(sale);
    return balance > 0 ? [{
      member: sale.member,
      detail: {
        saleId: sale.id, activityId: sale.activityId, name: sale.activity.name,
        product: sale.product, quantity: sale.quantity, amountDue, amountPaid, pending: balance
      }
    }] : [];
  });
}

export function calculateActivityTotals(activity, sales) {
  let income = toCents(activity.income);
  let costs = toCents(activity.costs);
  for (const sale of sales) {
    const totals = calculateSaleTotals(sale);
    income += toCents(totals.price);
    costs += toCents(totals.cost);
  }
  if (income > 99999999999999 || costs > 99999999999999) {
    throw new RangeError("Los totales de la actividad exceden el valor permitido");
  }
  return { income: fromCents(income), costs: fromCents(costs) };
}
