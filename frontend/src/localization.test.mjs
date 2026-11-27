import test from "node:test";
import assert from "node:assert/strict";
import { displayValue, isInternalIdentifierField, labelForField } from "./localization.js";

test("internal identifier fields are hidden from generic table columns", () => {
  for (const field of ["id", "entityId", "entity_id", "code", "codigo", "CODIGO"]) {
    assert.equal(isInternalIdentifierField(field), true, `${field} should be hidden`);
    assert.equal(labelForField(field), "");
  }

  for (const field of ["memberId", "raffleNumber", "document"]) {
    assert.equal(isInternalIdentifierField(field), false, `${field} is a meaningful business field`);
  }
});

test("vigencia date-only fields display the selected calendar date without timezone shifts", () => {
  const date = "2026-02-15T00:00:00.000Z";
  const expected = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" })
    .format(new Date(date));
  assert.equal(displayValue("startDate", date), expected);
  assert.equal(displayValue("lastPaymentDate", date), expected);
});
