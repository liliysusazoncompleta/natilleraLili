ALTER TABLE "vigencia"
  ADD COLUMN IF NOT EXISTS "frecuencia_recaudo_dias" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "fecha_inicio" DATE,
  ADD COLUMN IF NOT EXISTS "fecha_ultimo_pago" DATE;

UPDATE "vigencia"
SET
  "fecha_inicio" = COALESCE("fecha_inicio", make_date("anio", 1, 1)),
  "fecha_ultimo_pago" = COALESCE("fecha_ultimo_pago", make_date("anio", 12, 31));

ALTER TABLE "vigencia"
  ALTER COLUMN "fecha_inicio" SET NOT NULL,
  ALTER COLUMN "fecha_ultimo_pago" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vigencia_frecuencia_recaudo_dias_check') THEN
    ALTER TABLE "vigencia" ADD CONSTRAINT "vigencia_frecuencia_recaudo_dias_check"
      CHECK ("frecuencia_recaudo_dias" IN (15, 30));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vigencia_fechas_recaudo_orden_check') THEN
    ALTER TABLE "vigencia" ADD CONSTRAINT "vigencia_fechas_recaudo_orden_check"
      CHECK ("fecha_inicio" <= "fecha_ultimo_pago");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vigencia_fechas_recaudo_anio_check') THEN
    ALTER TABLE "vigencia" ADD CONSTRAINT "vigencia_fechas_recaudo_anio_check"
      CHECK (
        EXTRACT(YEAR FROM "fecha_inicio") = "anio"
        AND EXTRACT(YEAR FROM "fecha_ultimo_pago") = "anio"
      );
  END IF;
END $$;
