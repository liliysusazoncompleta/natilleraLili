-- Migration for existing Natillera databases.
-- Run once in pgAdmin 4 > Query Tool, connected to the application database.
-- Legacy migration for the original "rifa" table only. It does NOT create the
-- monthly member raffle calendar. For the current Raffles screen, run
-- migracion_rifa_por_socio_y_calendario.sql instead.
BEGIN;

ALTER TABLE "public"."rifa"
  ALTER COLUMN "numero_ganador" DROP NOT NULL,
  ADD COLUMN "recaudado" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "comision_administrativa" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "public"."distribucion_rifa" (
  "id" TEXT NOT NULL,
  "rifa_id" TEXT NOT NULL,
  "socio_id" TEXT,
  "usuario_id" TEXT,
  "tipo" TEXT NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "distribucion_rifa_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "distribucion_rifa_destinatario_check" CHECK (
    ("tipo" IN ('SOCIO', 'GANADOR') AND "socio_id" IS NOT NULL AND "usuario_id" IS NULL)
    OR ("tipo" = 'ADMINISTRADOR' AND "socio_id" IS NULL AND "usuario_id" IS NOT NULL)
  ),
  CONSTRAINT "distribucion_rifa_valor_positivo_check" CHECK ("valor" > 0),
  CONSTRAINT "distribucion_rifa_rifa_id_fkey"
    FOREIGN KEY ("rifa_id") REFERENCES "public"."rifa"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "distribucion_rifa_socio_id_fkey"
    FOREIGN KEY ("socio_id") REFERENCES "public"."socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "distribucion_rifa_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "distribucion_rifa_rifa_id_socio_id_key"
  ON "public"."distribucion_rifa"("rifa_id", "socio_id");
CREATE UNIQUE INDEX "distribucion_rifa_rifa_id_usuario_id_key"
  ON "public"."distribucion_rifa"("rifa_id", "usuario_id");
CREATE UNIQUE INDEX "distribucion_rifa_un_ganador_por_rifa_key"
  ON "public"."distribucion_rifa"("rifa_id") WHERE "tipo" = 'GANADOR';
CREATE INDEX "distribucion_rifa_socio_id_idx" ON "public"."distribucion_rifa"("socio_id");
CREATE INDEX "distribucion_rifa_usuario_id_idx" ON "public"."distribucion_rifa"("usuario_id");

ALTER TABLE "public"."rifa"
  ADD CONSTRAINT "rifa_recaudado_no_negativo_check" CHECK ("recaudado" >= 0),
  ADD CONSTRAINT "rifa_comision_no_negativa_check" CHECK ("comision_administrativa" >= 0),
  ADD CONSTRAINT "rifa_comision_no_supera_recaudado_check" CHECK ("comision_administrativa" <= "recaudado");

COMMIT;
