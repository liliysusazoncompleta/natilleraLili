-- Ejecutar desde pgAdmin 4 > Query Tool, conectado a la base natillera.
-- Recomendación: haga un Backup antes de ejecutar.
-- Requiere que la base ya tenga nombres de tablas españoles.

DO $$ BEGIN
  CREATE TYPE "estado_usuario" AS ENUM ('ACTIVO', 'INACTIVO', 'BLOQUEADO', 'ELIMINADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "nombres" TEXT NOT NULL DEFAULT '';
ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "apellidos" TEXT NOT NULL DEFAULT '';
ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "documento" TEXT;
ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "nombre_usuario" TEXT;
ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "estado" "estado_usuario" NOT NULL DEFAULT 'ACTIVO';
ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "ultimo_acceso" TIMESTAMPTZ;
ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "intentos_fallidos" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "bloqueado_hasta" TIMESTAMPTZ;

UPDATE "usuario"
SET "nombre_usuario" = COALESCE(NULLIF("nombre_usuario", ''), split_part("correo", '@', 1) || '_' || left("id", 8))
WHERE "nombre_usuario" IS NULL OR "nombre_usuario" = '';

ALTER TABLE "usuario" ALTER COLUMN "nombre_usuario" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "usuario_nombre_usuario_key" ON "usuario"("nombre_usuario");
CREATE UNIQUE INDEX IF NOT EXISTS "usuario_documento_key" ON "usuario"("documento");

CREATE TABLE IF NOT EXISTS "permiso_rol" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "rol" "rol" NOT NULL,
  "modulo" TEXT NOT NULL,
  "accion" TEXT NOT NULL,
  "permitido" BOOLEAN NOT NULL DEFAULT FALSE,
  "actualizado_por" TEXT,
  "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("rol", "modulo", "accion")
);

CREATE TABLE IF NOT EXISTS "permiso_campo_rol" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "rol" "rol" NOT NULL,
  "modulo" TEXT NOT NULL,
  "campo" TEXT NOT NULL,
  "visible" BOOLEAN NOT NULL DEFAULT FALSE,
  "actualizado_por" TEXT,
  "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("rol", "modulo", "campo")
);

CREATE TABLE IF NOT EXISTS "historial_acceso" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "usuario_id" TEXT REFERENCES "usuario"("id") ON DELETE SET NULL,
  "evento" TEXT NOT NULL,
  "exitoso" BOOLEAN NOT NULL,
  "direccion_ip" TEXT,
  "agente_usuario" TEXT,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "idx_historial_acceso_usuario_fecha"
  ON "historial_acceso"("usuario_id", "creado_en");
