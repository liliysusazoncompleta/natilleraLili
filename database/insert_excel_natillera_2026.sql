-- Insercion directa desde los datos extraidos de NATILLERA 2026.xlsm.
-- No crea tablas. Ejecutar en pgAdmin 4 sobre la base de datos de la aplicacion.
--
-- Este primer lote incluye solo el prestamo activo de KARINA (fila 5 de PRESTAMOS):
-- documento disponible, fecha Excel interpretable dentro de 2026, sin abonos registrados.
-- Se omiten las cuotas de ahorro porque sus fechas del Excel se interpretan como
-- 1930, 2015 o 2028; se omiten los pagos sin fecha individual y los prestamos
-- cuyo saldo o relacion entre socio avalista y prestatario particular requiere revision.

BEGIN;

DO $$
DECLARE
  socio_id_encontrado TEXT;
  vigencia_id_encontrada TEXT;
  fecha_prestamo TIMESTAMPTZ;
BEGIN
  SELECT s.id
    INTO socio_id_encontrado
  FROM public.socio AS s
  WHERE regexp_replace(s.documento, '[^0-9]', '', 'g') = '1036613847'
    AND s.eliminado_en IS NULL
    AND s.estado = 'ACTIVO'
    AND s.vigencia_id IN (
      SELECT v.id
      FROM public.vigencia AS v
      WHERE v.anio = 2026
        AND v.estado = 'ABIERTA'
        AND v.eliminado_en IS NULL
    );

  IF socio_id_encontrado IS NULL THEN
    RAISE EXCEPTION 'No se encontro un socio activo y unico para el documento 1036613847 en la vigencia abierta 2026.';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM public.socio AS s
    WHERE regexp_replace(s.documento, '[^0-9]', '', 'g') = '1036613847'
      AND s.eliminado_en IS NULL
      AND s.estado = 'ACTIVO'
      AND s.vigencia_id IN (
        SELECT v.id
        FROM public.vigencia AS v
        WHERE v.anio = 2026
          AND v.estado = 'ABIERTA'
          AND v.eliminado_en IS NULL
      )
  ) <> 1 THEN
    RAISE EXCEPTION 'El documento 1036613847 no identifica exactamente un socio activo en la vigencia abierta 2026.';
  END IF;

  SELECT v.id
    INTO vigencia_id_encontrada
  FROM public.vigencia AS v
  WHERE v.anio = 2026
    AND v.estado = 'ABIERTA'
    AND v.eliminado_en IS NULL;

  IF vigencia_id_encontrada IS NULL OR (
    SELECT COUNT(*)
    FROM public.vigencia AS v
    WHERE v.anio = 2026
      AND v.estado = 'ABIERTA'
      AND v.eliminado_en IS NULL
  ) <> 1 THEN
    RAISE EXCEPTION 'Debe existir exactamente una vigencia 2026 abierta y no eliminada.';
  END IF;

  fecha_prestamo := ((DATE '1899-12-30' + 46099)::TIMESTAMP AT TIME ZONE 'America/Bogota');

  IF EXISTS (
    SELECT 1
    FROM public.prestamo AS p
    WHERE p.socio_id = socio_id_encontrado
      AND p.vigencia_id = vigencia_id_encontrada
      AND p.tipo = 'SOCIO'
      AND p.monto = 300000
      AND p.fecha = fecha_prestamo
      AND p.eliminado_en IS NULL
  ) THEN
    RAISE EXCEPTION 'Ya existe un prestamo equivalente de KARINA; no se insertaron datos.';
  END IF;
END $$;

INSERT INTO public.prestamo (
  id,
  nombre_prestatario,
  socio_id,
  tipo,
  monto,
  tasa,
  fecha,
  cuotas,
  saldo,
  intereses_pendientes,
  intereses_generados,
  fecha_ancla_interes,
  ultimo_calculo_interes,
  observaciones,
  estado,
  vigencia_id
)
SELECT
  gen_random_uuid()::TEXT,
  'KARINA',
  s.id,
  'SOCIO',
  300000,
  5,
  ((DATE '1899-12-30' + 46099)::TIMESTAMP AT TIME ZONE 'America/Bogota'),
  1,
  300000,
  0,
  0,
  ((DATE '1899-12-30' + 46099)::TIMESTAMP AT TIME ZONE 'America/Bogota'),
  ((DATE '1899-12-30' + 46099)::TIMESTAMP AT TIME ZONE 'America/Bogota'),
  'Importado de NATILLERA 2026.xlsm. El archivo no registra abonos para este prestamo; el sistema calculara los intereses desde la fecha de origen.',
  'ACTIVO',
  v.id
FROM public.socio AS s
JOIN public.vigencia AS v
  ON v.id = s.vigencia_id
WHERE regexp_replace(s.documento, '[^0-9]', '', 'g') = '1036613847'
  AND s.estado = 'ACTIVO'
  AND s.eliminado_en IS NULL
  AND v.anio = 2026
  AND v.estado = 'ABIERTA'
  AND v.eliminado_en IS NULL;

COMMIT;
