-- Add monthly collection and immutable payout records for raffles.
ALTER TABLE "rifa"
  ALTER COLUMN "numero_ganador" DROP NOT NULL,
  ADD COLUMN "recaudado" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "comision_administrativa" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE TABLE "distribucion_rifa" (
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
  CONSTRAINT "distribucion_rifa_valor_positivo_check" CHECK ("valor" > 0)
);

CREATE UNIQUE INDEX "distribucion_rifa_rifa_id_socio_id_key"
  ON "distribucion_rifa"("rifa_id", "socio_id");
CREATE UNIQUE INDEX "distribucion_rifa_rifa_id_usuario_id_key"
  ON "distribucion_rifa"("rifa_id", "usuario_id");
CREATE UNIQUE INDEX "distribucion_rifa_un_ganador_por_rifa_key"
  ON "distribucion_rifa"("rifa_id") WHERE "tipo" = 'GANADOR';
CREATE INDEX "distribucion_rifa_socio_id_idx" ON "distribucion_rifa"("socio_id");
CREATE INDEX "distribucion_rifa_usuario_id_idx" ON "distribucion_rifa"("usuario_id");

ALTER TABLE "rifa"
  ADD CONSTRAINT "rifa_recaudado_no_negativo_check" CHECK ("recaudado" >= 0),
  ADD CONSTRAINT "rifa_comision_no_negativa_check" CHECK ("comision_administrativa" >= 0),
  ADD CONSTRAINT "rifa_comision_no_supera_recaudado_check" CHECK ("comision_administrativa" <= "recaudado");

ALTER TABLE "distribucion_rifa"
  ADD CONSTRAINT "distribucion_rifa_rifa_id_fkey"
    FOREIGN KEY ("rifa_id") REFERENCES "rifa"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "distribucion_rifa_socio_id_fkey"
    FOREIGN KEY ("socio_id") REFERENCES "socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "distribucion_rifa_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
