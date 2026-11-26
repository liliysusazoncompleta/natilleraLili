-- Respaldar la base y ejecutar una sola vez después de las migraciones de actividades.
BEGIN;

CREATE TABLE "venta_actividad" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actividad_id" TEXT NOT NULL REFERENCES "actividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "socio_id" TEXT NOT NULL REFERENCES "socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "producto" TEXT NOT NULL CHECK (length(trim("producto")) > 0),
  "cantidad" INTEGER NOT NULL CHECK ("cantidad" > 0),
  "costo_unitario" DECIMAL(14,2) NOT NULL CHECK ("costo_unitario" >= 0),
  "precio_unitario" DECIMAL(14,2) NOT NULL CHECK ("precio_unitario" >= 0),
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "venta_actividad_actividad_id_socio_id_idx" ON "venta_actividad"("actividad_id", "socio_id");

CREATE TABLE "pago_venta_actividad" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "venta_id" TEXT NOT NULL REFERENCES "venta_actividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "valor" DECIMAL(14,2) NOT NULL CHECK ("valor" > 0),
  "pagado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "observaciones" TEXT,
  "registrado_por" TEXT NOT NULL REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "pago_venta_actividad_venta_id_pagado_en_idx" ON "pago_venta_actividad"("venta_id", "pagado_en");

COMMIT;
