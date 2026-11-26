-- Ejecutar una vez en pgAdmin 4 > Query Tool, después de respaldar la base.
-- Conserva el historial de auditoría y no crea ni elimina tablas.
-- ROLLBACK limpia una transacción abortada de un intento anterior en esta sesión.
ROLLBACK;
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.pago_rifa_mensual') IS NULL THEN
    RAISE EXCEPTION
      'No existe public.pago_rifa_mensual. Ejecute primero database/migracion_rifa_por_socio_y_calendario.sql y vuelva a ejecutar este script.';
  END IF;
  IF to_regclass('public.liquidacion') IS NULL THEN
    RAISE EXCEPTION
      'No existe public.liquidacion. Verifique que está conectado a la base de datos de Natillera.';
  END IF;
  IF to_regclass('public.usuario') IS NULL THEN
    RAISE EXCEPTION
      'No existe public.usuario. Verifique que está conectado a la base de datos de Natillera.';
  END IF;
END $$;

ALTER TABLE "public"."pago_rifa_mensual"
  ADD COLUMN IF NOT EXISTS "valor_descontado" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "descontado_en" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "anulado_en" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "anulado_por" TEXT;

ALTER TABLE "public"."liquidacion"
  ADD COLUMN IF NOT EXISTS "rifas_descontadas" DECIMAL(14,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pago_rifa_mensual_valor_descontado_check'
      AND conrelid = to_regclass('public.pago_rifa_mensual')
  ) THEN
    ALTER TABLE "public"."pago_rifa_mensual"
      ADD CONSTRAINT "pago_rifa_mensual_valor_descontado_check"
      CHECK ("valor_descontado" >= 0 AND "valor_descontado" <= "valor");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pago_rifa_mensual_anulado_por_fkey'
      AND conrelid = to_regclass('public.pago_rifa_mensual')
  ) THEN
    ALTER TABLE "public"."pago_rifa_mensual"
      ADD CONSTRAINT "pago_rifa_mensual_anulado_por_fkey"
      FOREIGN KEY ("anulado_por") REFERENCES "public"."usuario"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
