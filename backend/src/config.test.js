import test from "node:test";
import assert from "node:assert/strict";
import { createAppConfig } from "./config.js";

const productionEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://localhost:5432/natillera",
  JWT_SECRET: "a-production-secret-with-at-least-32-characters",
  CORS_ORIGIN: "https://natillera.example"
};

test("production config requires a strong JWT secret", () => {
  assert.throws(
    () => createAppConfig({ ...productionEnvironment, JWT_SECRET: "short" }),
    /JWT_SECRET/
  );
});

test("production config requires a database URL and an explicit CORS origin", () => {
  assert.throws(
    () => createAppConfig({ ...productionEnvironment, DATABASE_URL: "" }),
    /DATABASE_URL/
  );
  assert.throws(
    () => createAppConfig({ ...productionEnvironment, CORS_ORIGIN: "" }),
    /CORS_ORIGIN/
  );
});

test("production config parses explicit CORS origins and validates the port", () => {
  const config = createAppConfig({
    ...productionEnvironment,
    PORT: "443",
    CORS_ORIGIN: "https://natillera.example, https://admin.example"
  });

  assert.equal(config.port, 443);
  assert.deepEqual(config.corsOrigins, [
    "https://natillera.example",
    "https://admin.example",
    "https://liliysusazoncompleta.github.io"
  ]);
  const pagesConfig = createAppConfig({
    ...productionEnvironment,
    CORS_ORIGIN: "https://liliysusazoncompleta.github.io"
  });
  assert.deepEqual(pagesConfig.corsOrigins, ["https://liliysusazoncompleta.github.io"]);
  assert.throws(
    () => createAppConfig({ ...productionEnvironment, PORT: "70000" }),
    /PORT/
  );
});
