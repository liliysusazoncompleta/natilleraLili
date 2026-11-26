import test from "node:test";
import assert from "node:assert/strict";
import { calculateActivityGains, calculateParticipantBalance, calculateSaleTotals, calculateActivityTotals, pendingSaleDebts, snapshotSaleProduct } from "./activity-finance.js";

test("activity gains are restricted to participants and allocated by their savings", () => {
  const gains = calculateActivityGains({
    income: 100,
    costs: 10,
    participants: [
      { id: "member-1", savings: 300 },
      { id: "member-2", savings: 100 }
    ]
  });

  assert.deepEqual(gains, [
    { memberId: "member-1", gain: 67.5 },
    { memberId: "member-2", gain: 22.5 }
  ]);
});

test("activity gains are split equally when participants have no savings", () => {
  const gains = calculateActivityGains({
    income: 10,
    costs: 0,
    participants: [{ id: "member-1", savings: 0 }, { id: "member-2", savings: 0 }, { id: "member-3", savings: 0 }]
  });

  assert.deepEqual(gains, [
    { memberId: "member-1", gain: 3.33 },
    { memberId: "member-2", gain: 3.33 },
    { memberId: "member-3", gain: 3.34 }
  ]);
});

test("activity gain allocation never creates a negative share when profit is only one cent", () => {
  const gains = calculateActivityGains({
    income: 0.01,
    costs: 0,
    participants: [{ id: "member-1", savings: 0 }, { id: "member-2", savings: 0 }, { id: "member-3", savings: 0 }]
  });

  assert.deepEqual(gains.map(({ gain }) => gain), [0, 0, 0.01]);
});

test("participant payment balance supports partial installments and cannot become negative", () => {
  assert.deepEqual(calculateParticipantBalance(50, [10, 15]), {
    amountDue: 50,
    amountPaid: 25,
    balance: 25
  });
  assert.deepEqual(calculateParticipantBalance(50, [25, 30]), {
    amountDue: 50,
    amountPaid: 55,
    balance: 0
  });
});

test("sales add product revenue and cost without charging other participants", () => {
  const sales = [
    { quantity: 3, unitCost: "0.10", unitPrice: "0.25" },
    { quantity: 2, unitCost: "1.20", unitPrice: "2.50" }
  ];
  assert.deepEqual(calculateSaleTotals(sales[0]), { cost: 0.3, price: 0.75 });
  const totals = calculateActivityTotals({ income: "10.00", costs: "2.00" }, sales);
  assert.deepEqual(totals, { income: 15.75, costs: 4.7 });
  assert.deepEqual(calculateActivityGains({ ...totals, participants: [{ id: "p", savings: 0 }] }), [{ memberId: "p", gain: 11.05 }]);
  assert.deepEqual(calculateParticipantBalance(0.75, [0.25, 0.3]), { amountDue: 0.75, amountPaid: 0.55, balance: 0.2 });
});

test("sale amounts reject invalid quantities and totals beyond the database limit", () => {
  for (const quantity of [0, -1, 1.5, 2147483648]) {
    assert.throws(() => calculateSaleTotals({ quantity, unitCost: 1, unitPrice: 1 }), RangeError);
  }
  assert.throws(() => calculateSaleTotals({ quantity: 2, unitCost: "999999999999.99", unitPrice: 0 }), RangeError);
  assert.throws(() => calculateActivityTotals({ income: "999999999999.99", costs: 0 }, [{ quantity: 1, unitCost: 0, unitPrice: 0.01 }]), RangeError);
});

test("pending sales are listed once for each buyer, independently of activity participation", () => {
  const buyer = { id: "buyer", firstName: "Comprador" };
  const sale = {
    id: "sale-1", activityId: "activity-1", activity: { name: "Actividad" },
    member: buyer, product: "Producto", quantity: 2, unitCost: "1.00", unitPrice: "5.00",
    payments: [{ amount: "3.00" }]
  };
  assert.deepEqual(pendingSaleDebts([sale, { ...sale, id: "paid", payments: [{ amount: "10.00" }] }]), [{
    member: buyer,
    detail: {
      saleId: "sale-1", activityId: "activity-1", name: "Actividad", product: "Producto",
      quantity: 2, amountDue: 10, amountPaid: 3, pending: 7
    }
  }]);
  assert.deepEqual(pendingSaleDebts([]), []);
});

test("sale snapshots catalog values, preserves prior prices and rejects excess payments", () => {
  const product = { name: "Rifa", unitCost: "2.00", unitPrice: "5.00" };
  const sale = snapshotSaleProduct(product, 3, 4);
  product.name = "Nuevo nombre";
  product.unitCost = "4.00";
  product.unitPrice = "9.00";
  assert.deepEqual(sale, { product: "Rifa", quantity: 3, unitCost: "2.00", unitPrice: "5.00" });
  assert.deepEqual(calculateSaleTotals(sale), { cost: 6, price: 15 });
  assert.throws(() => snapshotSaleProduct(product, 1, 10), /abono supera/);
});
