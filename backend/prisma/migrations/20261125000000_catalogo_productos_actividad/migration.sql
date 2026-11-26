CREATE TABLE "producto_actividad" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actividad_id" TEXT NOT NULL REFERENCES "actividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "nombre" TEXT NOT NULL CHECK (length(trim("nombre")) > 0),
  "costo_unitario" DECIMAL(14,2) NOT NULL CHECK ("costo_unitario" >= 0),
  "precio_unitario" DECIMAL(14,2) NOT NULL CHECK ("precio_unitario" >= 0),
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "producto_actividad_actividad_id_idx" ON "producto_actividad"("actividad_id");
