import test from "node:test";
import assert from "node:assert/strict";
import { allocatePayment, calculateMonthlyInterest, firstInterestDate } from "./loan-finance.js";

test("primer interés al cumplir los días indicados y siguientes por aniversario", () => {
  const date = new Date("2026-01-25T00:00:00Z");
  for (const days of [1, 2, 5, 30]) {
    const anchorAt = firstInterestDate(date, days);
    const before = new Date(anchorAt.getTime() - 1);
    assert.equal(calculateMonthlyInterest({ balance: 1000, rate: 5, anchorAt, lastAccruedAt: date, now: before }).generated, 0);
    const first = calculateMonthlyInterest({ balance: 1000, rate: 5, anchorAt, lastAccruedAt: date, now: anchorAt });
    assert.equal(first.generated, 50);
    assert.equal(first.lastAccruedAt.toISOString(), anchorAt.toISOString());
    assert.equal(calculateMonthlyInterest({ balance: 1000, rate: 5, anchorAt, lastAccruedAt: first.lastAccruedAt, now: anchorAt }).periods, 0);
  }
  const anchorAt = firstInterestDate(date, 5);
  assert.equal(calculateMonthlyInterest({ balance: 1000, rate: 5, anchorAt, lastAccruedAt: date, now: new Date("2026-03-30T00:00:00Z") }).generated, 150);
});

test("valida los días de inicio de intereses", () => {
  for (const days of ["", 0, -1, 1.5, 36501, "abc"]) assert.throws(() => firstInterestDate(new Date(), days), /días/);
});

test("monthly interest is not generated before the monthly anniversary", () => {
  const accrual = calculateMonthlyInterest({
    balance: 1_000_000,
    rate: 5,
    anchorAt: new Date("2026-01-15T00:00:00.000Z"),
    lastAccruedAt: new Date("2026-01-15T00:00:00.000Z"),
    now: new Date("2026-02-14T23:59:59.000Z")
  });

  assert.equal(accrual.periods, 0);
  assert.equal(accrual.generated, 0);
});

test("monthly interest compounds by periods on the original month-end anniversary", () => {
  const accrual = calculateMonthlyInterest({
    balance: 1_000_000,
    rate: 5,
    anchorAt: new Date("2026-01-31T00:00:00.000Z"),
    lastAccruedAt: new Date("2026-01-31T00:00:00.000Z"),
    now: new Date("2026-03-31T00:00:00.000Z")
  });

  assert.equal(accrual.periods, 2);
  assert.equal(accrual.generated, 100_000);
  assert.equal(accrual.lastAccruedAt.toISOString(), "2026-03-31T00:00:00.000Z");
});

test("migrated loans start accruing one month after the migration anchor", () => {
  const accrual = calculateMonthlyInterest({
    balance: 800_000,
    rate: 10,
    anchorAt: new Date("2026-02-15T00:00:00.000Z"),
    lastAccruedAt: new Date("2026-02-15T00:00:00.000Z"),
    now: new Date("2026-03-15T00:00:00.000Z")
  });

  assert.equal(accrual.periods, 1);
  assert.equal(accrual.generated, 80_000);
});

test("payments cover outstanding interest before reducing principal", () => {
  assert.deepEqual(allocatePayment(200, 1_000, 50), {
    amount: 200,
    interest: 50,
    principal: 150,
    balance: 850,
    pendingInterest: 0
  });
});

test("payments cannot exceed the remaining principal and interest", () => {
  assert.equal(allocatePayment(1_051, 1_000, 50), null);
});
