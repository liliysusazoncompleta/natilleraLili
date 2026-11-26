import test from "node:test";
import assert from "node:assert/strict";
import { calculateSettlement, loadSettlement, saveSettlement } from "./liquidation.js";

const member = (id, role = "SOCIO", userId = null) => ({ id, role, userId, vigenciaId: "v", firstName: id, lastName: "", document: id });
const base = () => ({
  members: [member("a", "ADMINISTRADOR", "admin"), member("b")],
  savings: [{ memberId: "a", amount: "100.00" }, { memberId: "b", amount: "100.00" }],
  activities: [], payments: [], loans: [], fees: [], distributions: []
});

test("reparte sin crear dinero y suma premios, reparto y comisión mensual a sus destinatarios", () => {
  const data = base();
  data.activities = [{ name: "Actividad", participantCost: "20.00", participants: [{ memberId: "b", gain: "100.00", payments: [{ amount: "5.00" }] }], sales: [{ memberId: "b", quantity: 2, unitPrice: "10.00", payments: [{ amount: "3.00" }] }] }];
  data.payments = [{ interest: "100.00" }];
  data.distributions = [
    { id: "1", type: "ADMINISTRADOR", userId: "admin", amount: "3.00" },
    { id: "2", type: "GANADOR", memberId: "a", amount: "40.00" },
    { id: "3", type: "SOCIO", memberId: "b", amount: "57.00" }
  ];
  const result = calculateSettlement(data);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.items[0].finalAmount, "197.50");
  assert.equal(result.items[1].finalAmount, "302.50");
  assert.equal(result.items[0].adminCommission, "9.00");
  assert.equal(result.items[1].raffleGain, "57.00");
  assert.equal(result.items[1].outstandingActivity, "15.00");
  assert.equal(result.items[1].outstandingSales, "17.00");
  assert.equal(result.totalProfit, "200.00");
});

test("incluye y reparte en el cierre los intereses descontados, con descuentos de rifa primero", () => {
  const data = base();
  data.savings = [{ memberId: "a", amount: "100.00" }];
  data.fees = [{ id: "f", memberId: "a", amount: "20.00", discountedAmount: "0.00" }];
  data.loans = [{ id: "l", memberId: "a", balance: "50.00", pendingInterest: "10.00" }];
  const result = calculateSettlement(data);
  assert.equal(result.items[0].raffleFeesDiscounted, "20.00");
  assert.equal(result.items[0].loanDebtDiscounted, "60.00");
  assert.equal(result.items[0].finalAmount, "30.00");
  assert.equal(result.items[0].loanPayments[0].interest, 1000);
  assert.equal(result.collectedInterest, "10.00");
  assert.equal(result.items[0].adminCommission, "0.30");
});

test("informa deuda sin cubrir y distribuye centavos sin pérdida", () => {
  const data = base();
  data.savings = [{ memberId: "a", amount: "0.01" }, { memberId: "b", amount: "0.01" }];
  data.payments = [{ interest: "0.03" }];
  data.loans = [{ id: "l", memberId: "b", balance: "100.00", pendingInterest: "0.00" }];
  const result = calculateSettlement(data);
  assert.equal(result.items[0].loanGain, "0.02");
  assert.equal(result.items[1].loanGain, "0.01");
  assert.equal(result.items[1].outstandingLoan, "99.98");
});

test("bloquea distribuciones de administradores sin socio activo vinculado", () => {
  const data = base();
  data.distributions = [{ id: "x", type: "ADMINISTRADOR", userId: "unknown", amount: "3.00" }];
  assert.match(calculateSettlement(data).blockers[0], /sin socio activo|no tiene un socio activo/);
});

test("no distribuye ahorros de socios inactivos ni descuenta préstamos de otra vigencia sin revisión", () => {
  const data = base();
  data.savings.push({ memberId: "inactivo", amount: "20.00" });
  data.loans = [{ id: "otro", memberId: "a", vigenciaId: "anterior", balance: "1.00", pendingInterest: "2.00" }];
  const result = calculateSettlement(data);
  assert.equal(result.blockers.length, 2);
  assert.match(result.blockers.join(" "), /otra vigencia/);
});

test("bloquea intereses sin ahorros y comisiones sin administrador activo", () => {
  const data = base();
  data.members = [member("b")];
  data.savings = [];
  data.payments = [{ interest: "10.00" }];
  const result = calculateSettlement(data);
  assert.equal(result.blockers.length, 2);
});

test("la vista previa detecta cambios y advierte sorteos abiertos sin bloquearlos", async () => {
  const data = base();
  const tx = {
    vigencia: { findFirst: async () => ({ id: "v", year: 2026, status: "ABIERTA" }) },
    member: { findMany: async () => data.members },
    saving: { findMany: async () => data.savings },
    activity: { findMany: async () => data.activities },
    loanPayment: { findMany: async () => data.payments },
    loan: { findMany: async () => data.loans },
    raffleMemberPayment: { findMany: async () => data.fees },
    raffleProgramDistribution: { findMany: async () => data.distributions },
    raffle: { findMany: async () => [] },
    raffleMonth: { count: async () => 1 },
    liquidation: { count: async () => 0 }
  };
  const before = await loadSettlement(tx, "v");
  data.savings[0].amount = "101.00";
  const after = await loadSettlement(tx, "v");
  assert.notEqual(before.fingerprint, after.fingerprint);
  assert.equal(before.notices.length, 1);
  assert.equal(before.blockers.length, 0);
});

test("reconoce el premio histórico con ganador sin inventar un recaudo o comisión", async () => {
  const data = base();
  const tx = {
    vigencia: { findFirst: async () => ({ id: "v", year: 2026, status: "ABIERTA" }) },
    member: { findMany: async () => data.members },
    saving: { findMany: async () => data.savings },
    activity: { findMany: async () => [] },
    loanPayment: { findMany: async () => [] },
    loan: { findMany: async () => [] },
    raffleMemberPayment: { findMany: async () => [] },
    raffleProgramDistribution: { findMany: async () => [] },
    raffle: { findMany: async () => [{ id: "r", winnerId: "b", prize: "15.00", collectedAmount: "0.00", distributions: [] }] },
    raffleMonth: { count: async () => 0 },
    liquidation: { count: async () => 0 }
  };
  const result = await loadSettlement(tx, "v");
  assert.equal(result.items[1].raffleGain, "15.00");
  assert.equal(result.items[0].adminCommission, "0.00");
  assert.deepEqual(result.blockers, []);
});

test("no guarda una liquidación con bloqueos", async () => {
  await assert.rejects(() => saveSettlement({}, { blockers: ["Comisión sin socio"] }, "admin"), /Comisión sin socio/);
});
