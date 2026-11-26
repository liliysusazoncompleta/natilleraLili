ALTER TABLE "actividad"
  ADD COLUMN "valor_por_participante" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "actividad"
  ADD CONSTRAINT "actividad_valor_por_participante_no_negativo_check"
  CHECK ("valor_por_participante" >= 0);

CREATE TABLE "pago_actividad_participante" (
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
    REFERENCES "actividad_participante"("actividad_id", "socio_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pago_actividad_participante_registrado_por_fkey"
    FOREIGN KEY ("registrado_por") REFERENCES "usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "pago_actividad_participante_actividad_id_socio_id_pagado_en_idx"
  ON "pago_actividad_participante"("actividad_id", "socio_id", "pagado_en");
