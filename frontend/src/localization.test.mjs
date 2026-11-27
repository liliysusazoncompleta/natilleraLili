import test from "node:test";
import assert from "node:assert/strict";
import { isInternalIdentifierField, labelForField } from "./localization.js";

test("internal identifier fields are hidden from generic table columns", () => {
  for (const field of ["id", "entityId", "entity_id", "code", "codigo", "CODIGO"]) {
    assert.equal(isInternalIdentifierField(field), true, `${field} should be hidden`);
    assert.equal(labelForField(field), "");
  }

  for (const field of ["memberId", "raffleNumber", "document"]) {
    assert.equal(isInternalIdentifierField(field), false, `${field} is a meaningful business field`);
  }
});
