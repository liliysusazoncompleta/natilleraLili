ALTER TABLE "vigencia"
  ADD COLUMN "frecuencia_recaudo_dias" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "fecha_inicio" DATE,
  ADD COLUMN "fecha_ultimo_pago" DATE;

UPDATE "vigencia"
SET
  "fecha_inicio" = make_date("anio", 1, 1),
  "fecha_ultimo_pago" = make_date("anio", 12, 31);

ALTER TABLE "vigencia"
  ALTER COLUMN "fecha_inicio" SET NOT NULL,
  ALTER COLUMN "fecha_ultimo_pago" SET NOT NULL,
  ADD CONSTRAINT "vigencia_frecuencia_recaudo_dias_check"
    CHECK ("frecuencia_recaudo_dias" IN (15, 30)),
  ADD CONSTRAINT "vigencia_fechas_recaudo_orden_check"
    CHECK ("fecha_inicio" <= "fecha_ultimo_pago"),
  ADD CONSTRAINT "vigencia_fechas_recaudo_anio_check"
    CHECK (
      EXTRACT(YEAR FROM "fecha_inicio") = "anio"
      AND EXTRACT(YEAR FROM "fecha_ultimo_pago") = "anio"
    );
