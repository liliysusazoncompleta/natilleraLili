import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateRaffleFeeDiscount,
  calculateRaffleDistribution,
  isRaffleDateInVigencia,
  normalizeRaffleAmount,
  planRaffleSchedule,
  projectRaffleDistribution
} from "./raffle-finance.js";

test("raffle amounts are normalized exactly to cents and reject extra decimals", () => {
  assert.equal(normalizeRaffleAmount("123.4"), "123.40");
  assert.throws(() => normalizeRaffleAmount("1.005"), /máximo dos decimales/);
});

test("raffle fee discounts apply in order, cap at the available balance, and preserve partial balances", () => {
  const result = allocateRaffleFeeDiscount([
    { id: "fee-1", amount: "20.00", discountedAmount: "0.00" },
    { id: "fee-2", amount: "20.00", discountedAmount: "5.00" },
    { id: "fee-3", amount: "10.00", discountedAmount: "0.00" }
  ], "31.00");

  assert.deepEqual(result, {
    total: "31.00",
    remaining: "0.00",
    allocations: [
      { id: "fee-1", amount: "20.00" },
      { id: "fee-2", amount: "11.00" }
    ]
  });
});

test("raffle fee discounts leave unpaid amounts untouched when no balance is available", () => {
  const result = allocateRaffleFeeDiscount([
    { id: "fee-1", amount: "12.50", discountedAmount: "2.50" }
  ], "0.00");

  assert.deepEqual(result, { total: "0.00", remaining: "0.00", allocations: [] });
});

test("raffle schedule accepts any date within the vigencia year in Colombia time", () => {
  const colombiaDecemberSix = new Date("2026-12-07T00:05:00.000Z");
  const colombiaNovemberSix = new Date("2026-11-07T00:05:00.000Z");
  assert.equal(isRaffleDateInVigencia(colombiaDecemberSix, 2026), true);
  assert.equal(isRaffleDateInVigencia(colombiaNovemberSix, 2026), true);
  assert.equal(isRaffleDateInVigencia(new Date("2027-01-01T05:00:00.000Z"), 2026), false);
  assert.equal(isRaffleDateInVigencia(new Date("invalid"), 2026), false);
});

test("no-winner raffle gives 3 percent to administrators and splits the remainder among participants", () => {
  const result = calculateRaffleDistribution({
    collectedAmount: 100,
    winner: null,
    members: [{ id: "member-1" }, { id: "member-2" }, { id: "member-3" }],
    administrators: [{ id: "admin-1" }, { id: "admin-2" }]
  });

  assert.equal(result.prize, "0.00");
  assert.equal(result.adminCommission, "3.00");
  assert.deepEqual(result.distributions.map(({ amount }) => amount), ["1.50", "1.50", "32.34", "32.33", "32.33"]);
  assert.equal(result.distributions.reduce((sum, item) => sum + Number(item.amount), 0), 100);
});

test("winning raffle gives 97 percent to the winner and splits 3 percent among admins", () => {
  const result = calculateRaffleDistribution({
    collectedAmount: 1000,
    winner: { id: "member-1" },
    members: [],
    administrators: [{ id: "admin-1" }, { id: "admin-2" }]
  });

  assert.equal(result.prize, "970.00");
  assert.equal(result.adminCommission, "30.00");
  assert.deepEqual(result.distributions, [
    { userId: "admin-1", type: "ADMINISTRADOR", amount: "15.00" },
    { userId: "admin-2", type: "ADMINISTRADOR", amount: "15.00" },
    { memberId: "member-1", type: "GANADOR", amount: "970.00" }
  ]);
});

test("raffle distribution rejects a positive collection without recipients", () => {
  assert.throws(() => calculateRaffleDistribution({
    collectedAmount: 10,
    winner: null,
    members: [],
    administrators: []
  }), /No hay destinatarios activos/);
});

test("open raffle projections include only eligible payments and preserve cents", () => {
  const projection = projectRaffleDistribution([
    { memberId: "a", amount: "0.05", eligible: true },
    { memberId: "b", amount: "0.05", eligible: true },
    { memberId: "c", amount: "5.00", eligible: false }
  ]);
  assert.equal(projection.collectedAmount, "0.10");
  assert.equal(projection.adminCommission, "0.00");
  assert.equal(projection.winnerAmount, "0.10");
  assert.equal(projection.noWinnerAmount, "0.10");
  assert.equal(projection.eligibleCount, 2);
  assert.deepEqual(projection.noWinnerShares.map((item) => item.amount), ["0.05", "0.05"]);
  assert.equal(projectRaffleDistribution([]).collectedAmount, "0.00");
});

test("no-winner projection and closure allocate the same commission and remainder", () => {
  const entries = [
    { memberId: "a", amount: "5000.00", eligible: true },
    { memberId: "b", amount: "5000.00", eligible: true }
  ];
  const projection = projectRaffleDistribution(entries);
  const payout = calculateRaffleDistribution({
    collectedAmount: projection.collectedAmount, winner: null,
    members: entries.map((entry) => ({ id: entry.memberId })),
    administrators: [{ id: "admin" }]
  });
  assert.equal(projection.adminCommission, "300.00");
  assert.equal(projection.noWinnerAmount, "9700.00");
  assert.deepEqual(projection.noWinnerShares.map((item) => item.amount), ["4850.00", "4850.00"]);
  assert.deepEqual(projection.noWinnerShares, payout.distributions.filter((item) => item.type === "SOCIO"));
  assert.equal(payout.adminCommission, projection.adminCommission);
  assert.throws(() => calculateRaffleDistribution({ collectedAmount: "100.00", winner: null, members: [{ id: "a" }], administrators: [] }), /destinatarios/);
  assert.deepEqual(calculateRaffleDistribution({ collectedAmount: "0.00", winner: null, members: [], administrators: [] }).distributions, []);
});

test("calendar changes preserve existing and closed draws and allow future additions", () => {
  const dates = Array(12).fill(null);
  const existingDate = new Date("2026-03-10T18:00:00Z");
  const months = [{ id: "old", month: 3, drawAt: existingDate, finalizedAt: new Date("2026-03-11T00:00:00Z") }];
  const now = new Date("2026-05-01T00:00:00Z");
  dates[2] = existingDate.toISOString();
  dates[5] = "2026-06-10T18:00:00Z";
  assert.deepEqual(planRaffleSchedule(dates, months, 2026, now), [{ month: 6, drawAt: new Date(dates[5]), existingId: null }]);
  dates[2] = "2026-06-11T18:00:00Z";
  assert.throws(() => planRaffleSchedule(dates, months, 2026, now), /cerrado/);
  dates[2] = null;
  assert.throws(() => planRaffleSchedule(dates, months, 2026, now), /eliminar/);
  dates[2] = existingDate.toISOString();
  dates[5] = "2026-04-10T18:00:00Z";
  assert.throws(() => planRaffleSchedule(dates, months, 2026, now), /futuras/);
});
