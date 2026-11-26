BEGIN;

CREATE TABLE "programa_rifa" (
  "id" TEXT NOT NULL,
  "vigencia_id" TEXT NOT NULL,
  "valor_mensual" DECIMAL(14,2) NOT NULL,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "programa_rifa_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "programa_rifa_valor_mensual_positivo_check" CHECK ("valor_mensual" > 0),
  CONSTRAINT "programa_rifa_vigencia_id_fkey"
    FOREIGN KEY ("vigencia_id") REFERENCES "vigencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "programa_rifa_vigencia_id_key" ON "programa_rifa"("vigencia_id");

CREATE TABLE "rifa_mensual" (
  "id" TEXT NOT NULL,
  "programa_id" TEXT NOT NULL,
  "mes" SMALLINT NOT NULL,
  "fecha_sorteo" TIMESTAMPTZ(3) NOT NULL,
  "recaudado" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "numero_ganador" TEXT,
  "ganador_id" TEXT,
  "premio" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "comision_administrativa" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "finalizado_en" TIMESTAMPTZ(3),
  CONSTRAINT "rifa_mensual_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rifa_mensual_mes_check" CHECK ("mes" BETWEEN 1 AND 12),
  CONSTRAINT "rifa_mensual_recaudado_no_negativo_check" CHECK ("recaudado" >= 0),
  CONSTRAINT "rifa_mensual_premio_no_negativo_check" CHECK ("premio" >= 0),
  CONSTRAINT "rifa_mensual_comision_no_negativa_check" CHECK ("comision_administrativa" >= 0),
  CONSTRAINT "rifa_mensual_programa_id_fkey"
    FOREIGN KEY ("programa_id") REFERENCES "programa_rifa"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rifa_mensual_ganador_id_fkey"
    FOREIGN KEY ("ganador_id") REFERENCES "socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "rifa_mensual_programa_id_mes_key" ON "rifa_mensual"("programa_id", "mes");
CREATE INDEX "rifa_mensual_fecha_sorteo_idx" ON "rifa_mensual"("fecha_sorteo");

CREATE TABLE "pago_rifa_mensual" (
  "id" TEXT NOT NULL,
  "rifa_mensual_id" TEXT NOT NULL,
  "socio_id" TEXT NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,
  "pagado_en" TIMESTAMPTZ(3),
  "registrado_por" TEXT,
  CONSTRAINT "pago_rifa_mensual_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pago_rifa_mensual_valor_positivo_check" CHECK ("valor" > 0),
  CONSTRAINT "pago_rifa_mensual_rifa_mensual_id_fkey"
    FOREIGN KEY ("rifa_mensual_id") REFERENCES "rifa_mensual"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pago_rifa_mensual_socio_id_fkey"
    FOREIGN KEY ("socio_id") REFERENCES "socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pago_rifa_mensual_registrado_por_fkey"
    FOREIGN KEY ("registrado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "pago_rifa_mensual_rifa_mensual_id_socio_id_key"
  ON "pago_rifa_mensual"("rifa_mensual_id", "socio_id");
CREATE INDEX "pago_rifa_mensual_socio_id_pagado_en_idx"
  ON "pago_rifa_mensual"("socio_id", "pagado_en");

CREATE TABLE "distribucion_rifa_mensual" (
  "id" TEXT NOT NULL,
  "rifa_mensual_id" TEXT NOT NULL,
  "socio_id" TEXT,
  "usuario_id" TEXT,
  "tipo" TEXT NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL,
  "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "distribucion_rifa_mensual_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "distribucion_rifa_mensual_destinatario_check" CHECK (
    ("tipo" IN ('SOCIO', 'GANADOR') AND "socio_id" IS NOT NULL AND "usuario_id" IS NULL)
    OR ("tipo" = 'ADMINISTRADOR' AND "socio_id" IS NULL AND "usuario_id" IS NOT NULL)
  ),
  CONSTRAINT "distribucion_rifa_mensual_valor_positivo_check" CHECK ("valor" > 0),
  CONSTRAINT "distribucion_rifa_mensual_rifa_mensual_id_fkey"
    FOREIGN KEY ("rifa_mensual_id") REFERENCES "rifa_mensual"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "distribucion_rifa_mensual_socio_id_fkey"
    FOREIGN KEY ("socio_id") REFERENCES "socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "distribucion_rifa_mensual_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "distribucion_rifa_mensual_rifa_mensual_id_socio_id_key"
  ON "distribucion_rifa_mensual"("rifa_mensual_id", "socio_id");
CREATE UNIQUE INDEX "distribucion_rifa_mensual_rifa_mensual_id_usuario_id_key"
  ON "distribucion_rifa_mensual"("rifa_mensual_id", "usuario_id");
CREATE INDEX "distribucion_rifa_mensual_socio_id_idx" ON "distribucion_rifa_mensual"("socio_id");
CREATE INDEX "distribucion_rifa_mensual_usuario_id_idx" ON "distribucion_rifa_mensual"("usuario_id");

COMMIT;
