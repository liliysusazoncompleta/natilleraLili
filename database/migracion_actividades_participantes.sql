-- Ejecutar una vez en pgAdmin 4 > Query Tool, después de respaldar la base.
-- Agrega el valor por participante y los abonos; no elimina datos existentes.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.actividad') IS NULL
     OR to_regclass('public.actividad_participante') IS NULL
     OR to_regclass('public.usuario') IS NULL THEN
    RAISE EXCEPTION
      'Faltan tablas base de actividades o usuarios. Confirme que está en la base natillera y que ejecutó el esquema inicial.';
  END IF;
END $$;

ALTER TABLE "public"."actividad"
  ADD COLUMN IF NOT EXISTS "valor_por_participante" DECIMAL(14,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'actividad_valor_por_participante_no_negativo_check'
      AND conrelid = to_regclass('public.actividad')
  ) THEN
    ALTER TABLE "public"."actividad"
      ADD CONSTRAINT "actividad_valor_por_participante_no_negativo_check"
      CHECK ("valor_por_participante" >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."pago_actividad_participante" (
  "id" TEXT NOT NULL,
  "actividad_id" TEXT NOT NULL,
  "socio_id" TEXT NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,
  "pagado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "observaciones" TEXT,
  "registrado_por" TEXT NOT NULL,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pago_actividad_participante_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pago_actividad_participante_valor_positivo_check" CHECK ("valor" > 0),
  CONSTRAINT "pago_actividad_participante_participante_fkey"
    FOREIGN KEY ("actividad_id", "socio_id")
    REFERENCES "public"."actividad_participante"("actividad_id", "socio_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pago_actividad_participante_registrado_por_fkey"
    FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "pago_actividad_participante_actividad_id_socio_id_pagado_en_idx"
  ON "public"."pago_actividad_participante"("actividad_id", "socio_id", "pagado_en");

COMMIT;
