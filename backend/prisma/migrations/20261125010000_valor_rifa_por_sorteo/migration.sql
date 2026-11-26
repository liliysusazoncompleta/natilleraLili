ALTER TABLE "rifa_mensual" ADD COLUMN "valor_por_socio" DECIMAL(14,2);
UPDATE "rifa_mensual" AS m SET "valor_por_socio" = p."valor_mensual"
FROM "programa_rifa" AS p WHERE p."id" = m."programa_id";
ALTER TABLE "rifa_mensual" ALTER COLUMN "valor_por_socio" SET NOT NULL;
ALTER TABLE "rifa_mensual" ADD CONSTRAINT "rifa_mensual_valor_por_socio_check" CHECK ("valor_por_socio" > 0);
