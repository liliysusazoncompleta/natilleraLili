import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { canAccessWithoutMember, savePasswordChange, validatePassword, verifyPasswordChange } from "./password.js";

test("validación de contraseñas respeta longitud y límite de bcrypt", () => {
  assert.ok(validatePassword("corta"));
  assert.ok(validatePassword(null));
  assert.ok(validatePassword("á".repeat(37)));
  assert.equal(validatePassword("temporal123"), null);
});

test("cambio de contraseña verifica clave actual y exige una distinta", async () => {
  const hash = await bcrypt.hash("temporal123", 4);
  assert.match(await verifyPasswordChange("incorrecta", "nueva1234", hash), /actual es incorrecta/);
  assert.match(await verifyPasswordChange("temporal123", "temporal123", hash), /diferente/);
  assert.ok(await verifyPasswordChange("temporal123", "corta", hash));
  assert.equal(await verifyPasswordChange("temporal123", "nueva1234", hash), null);
});

test("cuenta socio sin perfil no puede consultar otros recursos", () => {
  assert.equal(canAccessWithoutMember("SOCIO", null, "/perfil"), true);
  assert.equal(canAccessWithoutMember("SOCIO", null, "/auth/permisos"), true);
  for (const path of ["/dashboard", "/socios", "/ahorros", "/prestamos", "/deudas", "/rifas", "/liquidaciones", "/reportes"]) {
    assert.equal(canAccessWithoutMember("SOCIO", null, path), false, path);
  }
  assert.equal(canAccessWithoutMember("SOCIO", "member-id", "/dashboard"), true);
  assert.equal(canAccessWithoutMember("ADMINISTRADOR", null, "/dashboard"), true);
});

test("al cambiar la clave se revocan los tokens en la misma transacción", async () => {
  const calls = [];
  const tx = {
    user: { updateMany: async (args) => { calls.push(args); return { count: 1 }; } },
    refreshToken: { updateMany: async (args) => { calls.push(args); } }
  };
  const prisma = { $transaction: async (fn, options) => { assert.equal(options.isolationLevel, "Serializable"); return fn(tx); } };
  assert.equal(await savePasswordChange(prisma, { id: "usuario", passwordHash: "anterior" }, "nuevo"), true);
  assert.equal(calls[0].where.passwordHash, "anterior");
  assert.equal(calls[0].data.passwordHash, "nuevo");
  assert.deepEqual(calls[1].where, { userId: "usuario", revokedAt: null });
  assert.ok(calls[1].data.revokedAt instanceof Date);
});

test("un cambio concurrente no revoca tokens ni reemplaza la nueva clave", async () => {
  const tx = {
    user: { updateMany: async () => ({ count: 0 }) },
    refreshToken: { updateMany: async () => assert.fail("no debe revocar tokens") }
  };
  const prisma = { $transaction: async (fn) => fn(tx) };
  assert.equal(await savePasswordChange(prisma, { id: "usuario", passwordHash: "anterior" }, "nuevo"), false);
});
