-- Ejecutar en pgAdmin 4 > Query Tool, conectado a la base natillera.
-- Haga un Backup antes de ejecutar. Este script conserva los registros existentes.

ALTER TYPE "estado_prestamo" ADD VALUE IF NOT EXISTS 'FINALIZADO';
ALTER TYPE "estado_deuda" ADD VALUE IF NOT EXISTS 'CANCELADA';

ALTER TABLE "prestamo"
  ADD COLUMN IF NOT EXISTS "intereses_pendientes" NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "intereses_generados" NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fecha_ancla_interes" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "ultimo_calculo_interes" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "observaciones" TEXT;

-- Se inicia el cálculo mensual a partir de la aplicación de esta migración;
-- no se cobran intereses retroactivos por meses anteriores.
UPDATE "prestamo"
SET "ultimo_calculo_interes" = NOW()
WHERE "ultimo_calculo_interes" IS NULL;

UPDATE "prestamo" prestamo
SET "intereses_generados" = COALESCE((
  SELECT SUM(pago."interes")
  FROM "pago_prestamo" pago
  WHERE pago."prestamo_id" = prestamo."id"
), 0)
WHERE prestamo."intereses_generados" = 0;

ALTER TABLE "pago_prestamo"
  ADD COLUMN IF NOT EXISTS "saldo_anterior" NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS "nuevo_saldo" NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS "observaciones" TEXT,
  ADD COLUMN IF NOT EXISTS "registrado_por" TEXT,
  ADD COLUMN IF NOT EXISTS "anulado_en" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "anulado_por" TEXT,
  ADD COLUMN IF NOT EXISTS "motivo_anulacion" TEXT;

WITH saldos AS (
  SELECT
    pago."id",
    GREATEST(
      prestamo."monto" - COALESCE(
        SUM(pago."capital") OVER (
          PARTITION BY pago."prestamo_id"
          ORDER BY pago."fecha", pago."creado_en", pago."id"
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ), 0
      ),
      0
    ) AS anterior
  FROM "pago_prestamo" pago
  JOIN "prestamo" prestamo ON prestamo."id" = pago."prestamo_id"
)
UPDATE "pago_prestamo" pago
SET
  "saldo_anterior" = saldos.anterior,
  "nuevo_saldo" = GREATEST(saldos.anterior - pago."capital", 0)
FROM saldos
WHERE pago."id" = saldos."id"
  AND (pago."saldo_anterior" IS NULL OR pago."nuevo_saldo" IS NULL);

ALTER TABLE "pago_prestamo"
  ALTER COLUMN "saldo_anterior" SET NOT NULL,
  ALTER COLUMN "nuevo_saldo" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pago_prestamo_registrado_por_fkey'
  ) THEN
    ALTER TABLE "pago_prestamo"
      ADD CONSTRAINT "pago_prestamo_registrado_por_fkey"
      FOREIGN KEY ("registrado_por") REFERENCES "usuario"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_prestamo_estado_intereses"
  ON "prestamo"("estado", "ultimo_calculo_interes");
CREATE INDEX IF NOT EXISTS "idx_pago_prestamo_fecha"
  ON "pago_prestamo"("prestamo_id", "fecha");
CREATE INDEX IF NOT EXISTS "idx_pago_prestamo_anulado"
  ON "pago_prestamo"("anulado_en")
  WHERE "anulado_en" IS NULL;
