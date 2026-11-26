-- Migra la base existente del esquema anterior al esquema en español.
-- Ejecutar UNA sola vez desde pgAdmin > Query Tool, conectado a natillera.
-- Renombra objetos; no borra ni copia datos.

DO $$
DECLARE
  cambio RECORD;
BEGIN
  FOR cambio IN
    SELECT * FROM (VALUES
      ('"User"', '"usuario"'),
      ('"RefreshToken"', '"token_actualizacion"'),
      ('"Vigencia"', '"vigencia"'),
      ('"Member"', '"socio"'),
      ('"Saving"', '"ahorro"'),
      ('"Activity"', '"actividad"'),
      ('"ActivityParticipant"', '"actividad_participante"'),
      ('"Loan"', '"prestamo"'),
      ('"LoanPayment"', '"pago_prestamo"'),
      ('"Raffle"', '"rifa"'),
      ('"Debt"', '"deuda"'),
      ('"Liquidation"', '"liquidacion"'),
      ('"AuditLog"', '"auditoria"')
    ) AS tablas(nombre_anterior, nombre_nuevo)
  LOOP
    IF to_regclass('public.' || cambio.nombre_anterior) IS NOT NULL
       AND to_regclass('public.' || cambio.nombre_nuevo) IS NULL THEN
      EXECUTE format('ALTER TABLE public.%s RENAME TO %s', cambio.nombre_anterior, cambio.nombre_nuevo);
    END IF;
  END LOOP;

  FOR cambio IN
    SELECT * FROM (VALUES
      ('usuario','email','correo'),
      ('usuario','passwordHash','clave_hash'),
      ('usuario','role','rol'),
      ('usuario','createdAt','creado_en'),
      ('usuario','updatedAt','actualizado_en'),
      ('usuario','deletedAt','eliminado_en'),
      ('usuario','deletedBy','eliminado_por'),

      ('token_actualizacion','tokenHash','hash_token'),
      ('token_actualizacion','userId','usuario_id'),
      ('token_actualizacion','expiresAt','vence_en'),
      ('token_actualizacion','revokedAt','revocado_en'),
      ('token_actualizacion','createdAt','creado_en'),

      ('vigencia','year','anio'),
      ('vigencia','status','estado'),
      ('vigencia','closedAt','cerrada_en'),
      ('vigencia','createdAt','creado_en'),
      ('vigencia','updatedAt','actualizado_en'),
      ('vigencia','deletedAt','eliminado_en'),
      ('vigencia','deletedBy','eliminado_por'),

      ('socio','document','documento'),
      ('socio','firstName','nombres'),
      ('socio','lastName','apellidos'),
      ('socio','birthDate','fecha_nacimiento'),
      ('socio','phone','telefono'),
      ('socio','email','correo'),
      ('socio','address','direccion'),
      ('socio','joinedAt','fecha_ingreso'),
      ('socio','raffleNumber','numero_rifa'),
      ('socio','role','rol'),
      ('socio','status','estado'),
      ('socio','vigenciaId','vigencia_id'),
      ('socio','userId','usuario_id'),
      ('socio','createdAt','creado_en'),
      ('socio','updatedAt','actualizado_en'),
      ('socio','deletedAt','eliminado_en'),
      ('socio','deletedBy','eliminado_por'),

      ('ahorro','memberId','socio_id'),
      ('ahorro','vigenciaId','vigencia_id'),
      ('ahorro','date','fecha'),
      ('ahorro','amount','valor'),
      ('ahorro','observation','observacion'),
      ('ahorro','createdAt','creado_en'),
      ('ahorro','updatedAt','actualizado_en'),
      ('ahorro','deletedAt','eliminado_en'),
      ('ahorro','deletedBy','eliminado_por'),

      ('actividad','name','nombre'),
      ('actividad','description','descripcion'),
      ('actividad','date','fecha'),
      ('actividad','income','ingresos'),
      ('actividad','costs','costos'),
      ('actividad','vigenciaId','vigencia_id'),
      ('actividad','createdAt','creado_en'),
      ('actividad','deletedAt','eliminado_en'),
      ('actividad','deletedBy','eliminado_por'),

      ('actividad_participante','activityId','actividad_id'),
      ('actividad_participante','memberId','socio_id'),
      ('actividad_participante','gain','ganancia'),

      ('prestamo','borrowerName','nombre_prestatario'),
      ('prestamo','memberId','socio_id'),
      ('prestamo','type','tipo'),
      ('prestamo','principal','monto'),
      ('prestamo','rate','tasa'),
      ('prestamo','date','fecha'),
      ('prestamo','installments','cuotas'),
      ('prestamo','balance','saldo'),
      ('prestamo','status','estado'),
      ('prestamo','vigenciaId','vigencia_id'),
      ('prestamo','createdAt','creado_en'),
      ('prestamo','deletedAt','eliminado_en'),
      ('prestamo','deletedBy','eliminado_por'),

      ('pago_prestamo','loanId','prestamo_id'),
      ('pago_prestamo','date','fecha'),
      ('pago_prestamo','amount','valor'),
      ('pago_prestamo','principal','capital'),
      ('pago_prestamo','interest','interes'),
      ('pago_prestamo','mora','mora'),
      ('pago_prestamo','createdAt','creado_en'),

      ('rifa','date','fecha'),
      ('rifa','winningNumber','numero_ganador'),
      ('rifa','prize','premio'),
      ('rifa','vigenciaId','vigencia_id'),
      ('rifa','winnerId','ganador_id'),
      ('rifa','createdAt','creado_en'),
      ('rifa','deletedAt','eliminado_en'),
      ('rifa','deletedBy','eliminado_por'),

      ('deuda','memberId','socio_id'),
      ('deuda','vigenciaId','vigencia_id'),
      ('deuda','concept','concepto'),
      ('deuda','amount','valor'),
      ('deuda','status','estado'),
      ('deuda','dueDate','fecha_vencimiento'),
      ('deuda','createdAt','creado_en'),
      ('deuda','deletedAt','eliminado_en'),
      ('deuda','deletedBy','eliminado_por'),

      ('liquidacion','vigenciaId','vigencia_id'),
      ('liquidacion','memberId','socio_id'),
      ('liquidacion','savings','ahorros'),
      ('liquidacion','activityGain','ganancia_actividades'),
      ('liquidacion','loanGain','ganancia_prestamos'),
      ('liquidacion','raffleGain','ganancia_rifas'),
      ('liquidacion','adminCommission','comision_administrativa'),
      ('liquidacion','debtsDiscounted','deudas_descontadas'),
      ('liquidacion','finalAmount','valor_final'),
      ('liquidacion','roleSnapshot','rol_al_cierre'),
      ('liquidacion','createdAt','creado_en'),

      ('auditoria','userId','usuario_id'),
      ('auditoria','action','accion'),
      ('auditoria','entity','entidad'),
      ('auditoria','entityId','entidad_id'),
      ('auditoria','metadata','datos'),
      ('auditoria','ipAddress','direccion_ip'),
      ('auditoria','createdAt','creado_en')
    ) AS columnas(tabla, nombre_anterior, nombre_nuevo)
  LOOP
    IF to_regclass('public."' || cambio.tabla || '"') IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = cambio.tabla
           AND column_name = cambio.nombre_anterior
       )
       AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = cambio.tabla
           AND column_name = cambio.nombre_nuevo
       ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I RENAME COLUMN %I TO %I',
        cambio.tabla, cambio.nombre_anterior, cambio.nombre_nuevo
      );
    END IF;
  END LOOP;

  FOR cambio IN
    SELECT * FROM (VALUES
      ('Role','rol'),
      ('VigenciaStatus','estado_vigencia'),
      ('MemberStatus','estado_socio'),
      ('LoanType','tipo_prestamo'),
      ('LoanStatus','estado_prestamo'),
      ('DebtStatus','estado_deuda')
    ) AS tipos(nombre_anterior, nombre_nuevo)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = cambio.nombre_anterior
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = cambio.nombre_nuevo
    ) THEN
      EXECUTE format('ALTER TYPE public.%I RENAME TO %I', cambio.nombre_anterior, cambio.nombre_nuevo);
    END IF;
  END LOOP;
END $$;

-- Asegura que las bases anteriores tengan la opción de eliminación lógica.
ALTER TYPE "estado_socio" ADD VALUE IF NOT EXISTS 'ELIMINADO';

-- Campos de eliminación lógica, incluidos en versiones previas de Prisma.
ALTER TABLE IF EXISTS "usuario" ADD COLUMN IF NOT EXISTS "eliminado_en" TIMESTAMPTZ;
ALTER TABLE IF EXISTS "usuario" ADD COLUMN IF NOT EXISTS "eliminado_por" TEXT;
ALTER TABLE IF EXISTS "vigencia" ADD COLUMN IF NOT EXISTS "eliminado_en" TIMESTAMPTZ;
ALTER TABLE IF EXISTS "vigencia" ADD COLUMN IF NOT EXISTS "eliminado_por" TEXT;
ALTER TABLE IF EXISTS "socio" ADD COLUMN IF NOT EXISTS "eliminado_en" TIMESTAMPTZ;
ALTER TABLE IF EXISTS "socio" ADD COLUMN IF NOT EXISTS "eliminado_por" TEXT;
ALTER TABLE IF EXISTS "ahorro" ADD COLUMN IF NOT EXISTS "eliminado_en" TIMESTAMPTZ;
ALTER TABLE IF EXISTS "ahorro" ADD COLUMN IF NOT EXISTS "eliminado_por" TEXT;
ALTER TABLE IF EXISTS "actividad" ADD COLUMN IF NOT EXISTS "eliminado_en" TIMESTAMPTZ;
ALTER TABLE IF EXISTS "actividad" ADD COLUMN IF NOT EXISTS "eliminado_por" TEXT;
ALTER TABLE IF EXISTS "prestamo" ADD COLUMN IF NOT EXISTS "eliminado_en" TIMESTAMPTZ;
ALTER TABLE IF EXISTS "prestamo" ADD COLUMN IF NOT EXISTS "eliminado_por" TEXT;
ALTER TABLE IF EXISTS "rifa" ADD COLUMN IF NOT EXISTS "eliminado_en" TIMESTAMPTZ;
ALTER TABLE IF EXISTS "rifa" ADD COLUMN IF NOT EXISTS "eliminado_por" TEXT;
ALTER TABLE IF EXISTS "deuda" ADD COLUMN IF NOT EXISTS "eliminado_en" TIMESTAMPTZ;
ALTER TABLE IF EXISTS "deuda" ADD COLUMN IF NOT EXISTS "eliminado_por" TEXT;
