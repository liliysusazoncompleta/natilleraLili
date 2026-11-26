ALTER TABLE "pago_rifa_mensual"
  ADD COLUMN "valor_descontado" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "descontado_en" TIMESTAMPTZ(3),
  ADD COLUMN "anulado_en" TIMESTAMPTZ(3),
  ADD COLUMN "anulado_por" TEXT;

ALTER TABLE "liquidacion"
  ADD COLUMN "rifas_descontadas" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "pago_rifa_mensual"
  ADD CONSTRAINT "pago_rifa_mensual_valor_descontado_check"
    CHECK ("valor_descontado" >= 0 AND "valor_descontado" <= "valor"),
  ADD CONSTRAINT "pago_rifa_mensual_anulado_por_fkey"
    FOREIGN KEY ("anulado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
