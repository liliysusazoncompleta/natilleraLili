import test from "node:test";
import assert from "node:assert/strict";
import { helpGuides, searchGuides, visibleGuides } from "./help.mjs";

test("guías de socio respetan permisos y omiten operaciones administrativas", () => {
  const guides = visibleGuides("SOCIO", { deudas: { consultar: true }, rifas: { ver: true, consultar: false } });
  assert.ok(guides.some((guide) => guide.id === "deudas"));
  assert.ok(guides.some((guide) => guide.id === "clave"));
  assert.ok(!guides.some((guide) => guide.id === "rifa-socio"));
  assert.ok(!guides.some((guide) => guide.role === "ADMINISTRADOR"));
  assert.ok(visibleGuides("SOCIO", null).every((guide) => !guide.module));
});

test("administrador tiene todas las guías y rutas válidas", () => {
  assert.equal(visibleGuides("ADMINISTRADOR", null).length, helpGuides.length);
  assert.equal(new Set(helpGuides.map((guide) => guide.id)).size, helpGuides.length);
  assert.ok(helpGuides.every((guide) => guide.title && guide.example.length >= 2 && guide.steps.length && (!guide.path || guide.path.startsWith("/"))));
});

test("búsqueda tolera acentos, plurales y preguntas sin coincidencia", () => {
  const guides = visibleGuides("ADMINISTRADOR", null);
  assert.equal(searchGuides(guides, "¿Cómo cambio mi contraseña?")[0].id, "clave");
  assert.ok(searchGuides(guides, "mis deudas").some((guide) => guide.id === "deudas"));
  assert.ok(searchGuides(guides, "registrar productos de ventas").some((guide) => guide.id === "ventas"));
  assert.equal(searchGuides(guides, "mariposa intergaláctica").length, 0);
  assert.equal(searchGuides(guides, "cómo puedo")[0], undefined);
});

test("búsqueda no devuelve guías de módulos sin permiso", () => {
  const guides = visibleGuides("SOCIO", {});
  assert.equal(searchGuides(guides, "deudas").length, 0);
  assert.ok(searchGuides(guides, "contraseña").some((guide) => guide.id === "clave"));
});
