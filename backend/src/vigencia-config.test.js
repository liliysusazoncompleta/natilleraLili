import test from "node:test";
import assert from "node:assert/strict";
import { validateVigenciaConfiguration } from "./vigencia-config.js";

test("vigencia configuration accepts 15- or 30-day collections and ordered dates in the selected year", () => {
  const configuration = validateVigenciaConfiguration({
    year: "2026",
    collectionFrequencyDays: "15",
    startDate: "2026-02-01",
    lastPaymentDate: "2026-12-15"
  });

  assert.equal(configuration.collectionFrequencyDays, 15);
  assert.equal(configuration.startDate.toISOString(), "2026-02-01T00:00:00.000Z");
  assert.equal(configuration.lastPaymentDate.toISOString(), "2026-12-15T00:00:00.000Z");
});

test("vigencia configuration rejects unsupported frequency, invalid dates, reversed dates, and dates outside the year", () => {
  const valid = {
    year: 2026,
    collectionFrequencyDays: 30,
    startDate: "2026-01-01",
    lastPaymentDate: "2026-12-31"
  };

  assert.throws(() => validateVigenciaConfiguration({ ...valid, collectionFrequencyDays: 10 }), /15 o cada 30/);
  assert.throws(() => validateVigenciaConfiguration({ ...valid, startDate: "2026-02-30" }), /fecha de inicio.*válida/);
  assert.throws(() => validateVigenciaConfiguration({ ...valid, startDate: "2026-01-01extra" }), /fecha de inicio/);
  assert.throws(() => validateVigenciaConfiguration({ ...valid, startDate: "2026-12-31", lastPaymentDate: "2026-01-01" }), /posterior/);
  assert.throws(() => validateVigenciaConfiguration({ ...valid, lastPaymentDate: "2027-01-01" }), /pertenecer al año/);
});
