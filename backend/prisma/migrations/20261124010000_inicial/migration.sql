-- Initial PostgreSQL schema generated from backend/prisma/schema.prisma.
-- Apply only to an empty database; this migration is not a data-preserving baseline.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "rol" AS ENUM ('SOCIO', 'ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "estado_vigencia" AS ENUM ('ABIERTA', 'CERRADA', 'LIQUIDADA');

-- CreateEnum
CREATE TYPE "estado_socio" AS ENUM ('ACTIVO', 'INACTIVO', 'ELIMINADO');

-- CreateEnum
CREATE TYPE "tipo_prestamo" AS ENUM ('SOCIO', 'PARTICULAR');

-- CreateEnum
CREATE TYPE "estado_prestamo" AS ENUM ('ACTIVO', 'PAGADO', 'FINALIZADO', 'VENCIDO', 'CASTIGADO');

-- CreateEnum
CREATE TYPE "estado_deuda" AS ENUM ('PENDIENTE', 'PAGADA', 'DESCONTADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "estado_usuario" AS ENUM ('ACTIVO', 'INACTIVO', 'BLOQUEADO', 'ELIMINADO');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "clave_hash" TEXT NOT NULL,
    "rol" "rol" NOT NULL DEFAULT 'ADMINISTRADOR',
    "nombres" TEXT NOT NULL DEFAULT '',
    "apellidos" TEXT NOT NULL DEFAULT '',
    "documento" TEXT,
    "nombre_usuario" TEXT NOT NULL,
    "estado" "estado_usuario" NOT NULL DEFAULT 'ACTIVO',
    "ultimo_acceso" TIMESTAMPTZ(3),
    "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" TIMESTAMPTZ(3),
    "eliminado_por" TEXT,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permiso_rol" (
    "id" TEXT NOT NULL,
    "rol" "rol" NOT NULL,
    "modulo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "permitido" BOOLEAN NOT NULL DEFAULT false,
    "actualizado_por" TEXT,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permiso_rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permiso_campo_rol" (
    "id" TEXT NOT NULL,
    "rol" "rol" NOT NULL,
    "modulo" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "actualizado_por" TEXT,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permiso_campo_rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_acceso" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "evento" TEXT NOT NULL,
    "exitoso" BOOLEAN NOT NULL,
    "direccion_ip" TEXT,
    "agente_usuario" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_acceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_actualizacion" (
    "id" TEXT NOT NULL,
    "hash_token" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "vence_en" TIMESTAMPTZ(3) NOT NULL,
    "revocado_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_actualizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vigencia" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "estado" "estado_vigencia" NOT NULL DEFAULT 'ABIERTA',
    "cerrada_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" TIMESTAMPTZ(3),
    "eliminado_por" TEXT,

    CONSTRAINT "vigencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socio" (
    "id" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "fecha_nacimiento" TIMESTAMPTZ(3),
    "telefono" TEXT,
    "correo" TEXT,
    "direccion" TEXT,
    "fecha_ingreso" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "numero_rifa" TEXT,
    "rol" "rol" NOT NULL DEFAULT 'SOCIO',
    "estado" "estado_socio" NOT NULL DEFAULT 'ACTIVO',
    "vigencia_id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" TIMESTAMPTZ(3),
    "eliminado_por" TEXT,

    CONSTRAINT "socio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ahorro" (
    "id" TEXT NOT NULL,
    "socio_id" TEXT NOT NULL,
    "vigencia_id" TEXT NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valor" DECIMAL(14,2) NOT NULL,
    "observacion" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" TIMESTAMPTZ(3),
    "eliminado_por" TEXT,

    CONSTRAINT "ahorro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingresos" DECIMAL(14,2) NOT NULL,
    "costos" DECIMAL(14,2) NOT NULL,
    "vigencia_id" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" TIMESTAMPTZ(3),
    "eliminado_por" TEXT,

    CONSTRAINT "actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividad_participante" (
    "actividad_id" TEXT NOT NULL,
    "socio_id" TEXT NOT NULL,
    "ganancia" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "actividad_participante_pkey" PRIMARY KEY ("actividad_id","socio_id")
);

-- CreateTable
CREATE TABLE "prestamo" (
    "id" TEXT NOT NULL,
    "nombre_prestatario" TEXT NOT NULL,
    "socio_id" TEXT,
    "tipo" "tipo_prestamo" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "tasa" DECIMAL(5,2) NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cuotas" INTEGER NOT NULL DEFAULT 1,
    "saldo" DECIMAL(14,2) NOT NULL,
    "intereses_pendientes" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "intereses_generados" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "fecha_ancla_interes" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_calculo_interes" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "estado" "estado_prestamo" NOT NULL DEFAULT 'ACTIVO',
    "vigencia_id" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" TIMESTAMPTZ(3),
    "eliminado_por" TEXT,

    CONSTRAINT "prestamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago_prestamo" (
    "id" TEXT NOT NULL,
    "prestamo_id" TEXT NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valor" DECIMAL(14,2) NOT NULL,
    "capital" DECIMAL(14,2) NOT NULL,
    "interes" DECIMAL(14,2) NOT NULL,
    "mora" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "saldo_anterior" DECIMAL(14,2) NOT NULL,
    "nuevo_saldo" DECIMAL(14,2) NOT NULL,
    "observaciones" TEXT,
    "registrado_por" TEXT,
    "anulado_en" TIMESTAMPTZ(3),
    "anulado_por" TEXT,
    "motivo_anulacion" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_prestamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rifa" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "numero_ganador" TEXT NOT NULL,
    "premio" DECIMAL(14,2) NOT NULL,
    "vigencia_id" TEXT NOT NULL,
    "ganador_id" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" TIMESTAMPTZ(3),
    "eliminado_por" TEXT,

    CONSTRAINT "rifa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deuda" (
    "id" TEXT NOT NULL,
    "socio_id" TEXT NOT NULL,
    "vigencia_id" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "estado" "estado_deuda" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_vencimiento" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminado_en" TIMESTAMPTZ(3),
    "eliminado_por" TEXT,

    CONSTRAINT "deuda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion" (
    "id" TEXT NOT NULL,
    "vigencia_id" TEXT NOT NULL,
    "socio_id" TEXT NOT NULL,
    "ahorros" DECIMAL(14,2) NOT NULL,
    "ganancia_actividades" DECIMAL(14,2) NOT NULL,
    "ganancia_prestamos" DECIMAL(14,2) NOT NULL,
    "ganancia_rifas" DECIMAL(14,2) NOT NULL,
    "comision_administrativa" DECIMAL(14,2) NOT NULL,
    "deudas_descontadas" DECIMAL(14,2) NOT NULL,
    "valor_final" DECIMAL(14,2) NOT NULL,
    "rol_al_cierre" "rol" NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT,
    "datos" JSONB,
    "direccion_ip" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_documento_key" ON "usuario"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_nombre_usuario_key" ON "usuario"("nombre_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_rol_rol_modulo_accion_key" ON "permiso_rol"("rol", "modulo", "accion");

-- CreateIndex
CREATE UNIQUE INDEX "permiso_campo_rol_rol_modulo_campo_key" ON "permiso_campo_rol"("rol", "modulo", "campo");

-- CreateIndex
CREATE INDEX "historial_acceso_usuario_id_creado_en_idx" ON "historial_acceso"("usuario_id", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "token_actualizacion_hash_token_key" ON "token_actualizacion"("hash_token");

-- CreateIndex
CREATE INDEX "token_actualizacion_usuario_id_idx" ON "token_actualizacion"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "vigencia_anio_key" ON "vigencia"("anio");

-- CreateIndex
CREATE UNIQUE INDEX "socio_documento_key" ON "socio"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "socio_correo_key" ON "socio"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "socio_usuario_id_key" ON "socio"("usuario_id");

-- CreateIndex
CREATE INDEX "socio_vigencia_id_estado_idx" ON "socio"("vigencia_id", "estado");

-- CreateIndex
CREATE INDEX "socio_documento_idx" ON "socio"("documento");

-- CreateIndex
CREATE UNIQUE INDEX "socio_vigencia_id_numero_rifa_key" ON "socio"("vigencia_id", "numero_rifa");

-- CreateIndex
CREATE INDEX "ahorro_socio_id_vigencia_id_idx" ON "ahorro"("socio_id", "vigencia_id");

-- CreateIndex
CREATE INDEX "actividad_vigencia_id_fecha_idx" ON "actividad"("vigencia_id", "fecha");

-- CreateIndex
CREATE INDEX "prestamo_vigencia_id_estado_idx" ON "prestamo"("vigencia_id", "estado");

-- CreateIndex
CREATE INDEX "prestamo_socio_id_idx" ON "prestamo"("socio_id");

-- CreateIndex
CREATE INDEX "rifa_vigencia_id_numero_ganador_idx" ON "rifa"("vigencia_id", "numero_ganador");

-- CreateIndex
CREATE UNIQUE INDEX "rifa_vigencia_id_fecha_key" ON "rifa"("vigencia_id", "fecha");

-- CreateIndex
CREATE INDEX "deuda_vigencia_id_socio_id_estado_idx" ON "deuda"("vigencia_id", "socio_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "liquidacion_vigencia_id_socio_id_key" ON "liquidacion"("vigencia_id", "socio_id");

-- CreateIndex
CREATE INDEX "auditoria_entidad_entidad_id_idx" ON "auditoria"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "auditoria_creado_en_idx" ON "auditoria"("creado_en");

-- AddForeignKey
ALTER TABLE "historial_acceso" ADD CONSTRAINT "historial_acceso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_actualizacion" ADD CONSTRAINT "token_actualizacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socio" ADD CONSTRAINT "socio_vigencia_id_fkey" FOREIGN KEY ("vigencia_id") REFERENCES "vigencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "socio" ADD CONSTRAINT "socio_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahorro" ADD CONSTRAINT "ahorro_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahorro" ADD CONSTRAINT "ahorro_vigencia_id_fkey" FOREIGN KEY ("vigencia_id") REFERENCES "vigencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad" ADD CONSTRAINT "actividad_vigencia_id_fkey" FOREIGN KEY ("vigencia_id") REFERENCES "vigencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad_participante" ADD CONSTRAINT "actividad_participante_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad_participante" ADD CONSTRAINT "actividad_participante_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamo" ADD CONSTRAINT "prestamo_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamo" ADD CONSTRAINT "prestamo_vigencia_id_fkey" FOREIGN KEY ("vigencia_id") REFERENCES "vigencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_prestamo" ADD CONSTRAINT "pago_prestamo_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "prestamo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago_prestamo" ADD CONSTRAINT "pago_prestamo_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rifa" ADD CONSTRAINT "rifa_vigencia_id_fkey" FOREIGN KEY ("vigencia_id") REFERENCES "vigencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rifa" ADD CONSTRAINT "rifa_ganador_id_fkey" FOREIGN KEY ("ganador_id") REFERENCES "socio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deuda" ADD CONSTRAINT "deuda_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deuda" ADD CONSTRAINT "deuda_vigencia_id_fkey" FOREIGN KEY ("vigencia_id") REFERENCES "vigencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_vigencia_id_fkey" FOREIGN KEY ("vigencia_id") REFERENCES "vigencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business constraints retained from the PostgreSQL creation script.
ALTER TABLE "socio" ADD CONSTRAINT "socio_numero_rifa_formato_check"
  CHECK ("numero_rifa" IS NULL OR "numero_rifa" ~ '^(0[0-9]|[1-9][0-9])$');
ALTER TABLE "ahorro" ADD CONSTRAINT "ahorro_valor_no_negativo_check"
  CHECK ("valor" >= 0);
ALTER TABLE "actividad" ADD CONSTRAINT "actividad_ingresos_no_negativos_check"
  CHECK ("ingresos" >= 0);
ALTER TABLE "actividad" ADD CONSTRAINT "actividad_costos_no_negativos_check"
  CHECK ("costos" >= 0);
ALTER TABLE "actividad_participante" ADD CONSTRAINT "actividad_participante_ganancia_no_negativa_check"
  CHECK ("ganancia" >= 0);
ALTER TABLE "prestamo" ADD CONSTRAINT "prestamo_monto_positivo_check"
  CHECK ("monto" > 0);
ALTER TABLE "prestamo" ADD CONSTRAINT "prestamo_tasa_no_negativa_check"
  CHECK ("tasa" >= 0);
ALTER TABLE "prestamo" ADD CONSTRAINT "prestamo_cuotas_positivas_check"
  CHECK ("cuotas" > 0);
ALTER TABLE "prestamo" ADD CONSTRAINT "prestamo_saldo_no_negativo_check"
  CHECK ("saldo" >= 0);
ALTER TABLE "prestamo" ADD CONSTRAINT "prestamo_intereses_pendientes_no_negativos_check"
  CHECK ("intereses_pendientes" >= 0);
ALTER TABLE "prestamo" ADD CONSTRAINT "prestamo_intereses_generados_no_negativos_check"
  CHECK ("intereses_generados" >= 0);
ALTER TABLE "pago_prestamo" ADD CONSTRAINT "pago_prestamo_valor_positivo_check"
  CHECK ("valor" > 0);
ALTER TABLE "pago_prestamo" ADD CONSTRAINT "pago_prestamo_capital_no_negativo_check"
  CHECK ("capital" >= 0);
ALTER TABLE "pago_prestamo" ADD CONSTRAINT "pago_prestamo_interes_no_negativo_check"
  CHECK ("interes" >= 0);
ALTER TABLE "pago_prestamo" ADD CONSTRAINT "pago_prestamo_mora_no_negativa_check"
  CHECK ("mora" >= 0);
ALTER TABLE "rifa" ADD CONSTRAINT "rifa_numero_ganador_formato_check"
  CHECK ("numero_ganador" ~ '^[0-9]{2}$');
ALTER TABLE "rifa" ADD CONSTRAINT "rifa_premio_no_negativo_check"
  CHECK ("premio" >= 0);
ALTER TABLE "deuda" ADD CONSTRAINT "deuda_valor_positivo_check"
  CHECK ("valor" > 0);
