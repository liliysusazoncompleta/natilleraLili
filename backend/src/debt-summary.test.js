import test from "node:test";
import assert from "node:assert/strict";
import { summarizeLoanPayments } from "./debt-summary.js";

test("suma todos los pagos registrados sin incluir anulaciones y conserva última fecha", () => {
  const summary = summarizeLoanPayments([
    { amount: "100.25", principal: "80.20", date: new Date("2026-03-01") },
    { amount: "200.10", principal: "150.00", date: new Date("2026-01-01") },
    { amount: "999", principal: "999", date: new Date("2026-04-01"), annulledAt: new Date() }
  ]);
  assert.equal(summary.total, 300.35);
  assert.equal(summary.principal, 230.20);
  assert.equal(summary.lastPaymentDate.toISOString(), "2026-03-01T00:00:00.000Z");
  assert.deepEqual(summarizeLoanPayments([]), { total: 0, principal: 0, lastPaymentDate: null });
});
