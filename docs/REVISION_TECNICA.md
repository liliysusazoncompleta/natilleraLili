# Revisión técnica y preparación para producción

## Alcance y límites

Revisión estática del monorepo, manifests, fuentes, scripts SQL, modelo Prisma y configuración de CI. Se ejecutaron pruebas, lint, build, validación Prisma y auditoría de dependencias.

No se inspeccionó ni modificó una base PostgreSQL: `psql` no está instalado y no se proporcionó una conexión de revisión. El directorio no es un repositorio Git, por lo que tampoco se pudo comprobar el historial de secretos ni establecer un diff fiable. No se verificaron navegación del navegador, carga concurrente, backups, monitoreo o un despliegue real.

**Conclusión:** se corrigieron problemas concretos y se reforzó CI/configuración, pero el proyecto **todavía no puede certificarse como listo para producción**. Los bloqueos de base de datos, aprovisionamiento inicial y autenticación descritos abajo requieren resolución y verificación en el entorno destino.

## Cambios realizados

### Código y seguridad

- Se eliminó el CORS permisivo por defecto. En producción el proceso exige `CORS_ORIGIN`, admite una lista separada por comas y solo devuelve cabeceras CORS a esos orígenes.
- Se eliminó el secreto JWT débil como fallback de producción. En `NODE_ENV=production` el servidor ahora requiere `JWT_SECRET` de al menos 32 caracteres y `DATABASE_URL`; también valida el puerto.
- Se agregó `backend/src/config.js` con pruebas unitarias de las reglas de configuración.
- El seed de demostración ahora se niega a ejecutarse con `NODE_ENV=production`; todavía se necesita definir el procedimiento seguro para crear el primer administrador real.
- El cierre de sesión elimina solo las tres claves de sesión de Natillera, en vez de borrar todo `localStorage`.
- Las páginas React se cargan bajo demanda. El build previo generaba un único chunk de 1.080 kB y advertía que superaba 500 kB; el build posterior ya no presenta esa advertencia y el mayor chunk individual medido fue 439,59 kB (125,88 kB gzip).
- El backend build check valida sintaxis JavaScript en vez de comprobar únicamente la existencia de archivos.
- Se retiraron `react-hook-form` y `yup`, que no tenían imports en el frontend. Se quitó también `JWT_REFRESH_SECRET` de `.env.example`, ya que el backend usa tokens de refresco aleatorios opacos, no JWT firmados con ese secreto.
- Se eliminó `database/init.sql`: solo contenía una directiva exclusiva de `psql` y una creación de extensión redundante; no era una inicialización utilizable desde pgAdmin ni estaba referenciada por el proyecto.
- Se generó la migración inicial PostgreSQL para bases vacías. Después se agregó una migración versionada para los pagos de rifas y su tabla de distribución.
- `database/schema.sql` es el esquema completo para pgAdmin, equivalente a aplicar en orden la migración inicial y la incremental; Prisma Migrate sigue siendo la ruta recomendada para conservar historial.
- Se agregó la configuración anual de rifas: valor fijo mensual por socio y fecha/hora de cada sorteo.
- Cada socio activo recibe una cuota mensual visible como pendiente hasta que el administrador registre el pago. Solo se habilita para el sorteo al socio activo que pagó antes de la fecha/hora establecida.
- El cierre calcula la recaudación a partir de cuotas elegibles y registra el 3% para administradores activos; el 97% se asigna al ganador o se distribuye entre los participantes que pagaron a tiempo si no hubo ganador.
- `database/migracion_rifa_por_socio_y_calendario.sql` permite actualizar una base existente y `database/schema.sql` incorpora el esquema completo para una instalación nueva.

### Dependencias y versiones

La auditoría inicial identificó dos vulnerabilidades altas en dependencias transitivas de Prisma:

| Aviso | Dependencia anterior | Versión aplicada | Resultado |
|---|---|---|---|
| GHSA-ggr8-5vv4-36mx | `deepmerge-ts` 7.1.5 | 8.0.2 | Sin hallazgos en el reescaneo |
| GHSA-7589-6fvf-x4pw | `effect` 3.21.0 | 3.22.1 | Sin hallazgos en el reescaneo |

Las versiones corregidas se fijan en los overrides de pnpm y quedaron reflejadas en `pnpm-lock.yaml`. `pnpm audit --prod` y el reescaneo de advisories terminaron sin vulnerabilidades conocidas para las dependencias afectadas.

Se fijó Node.js `>=22.12 <25` en el manifiesto raíz y CI usa Node.js 24. La configuración de Prisma se trasladó a `backend/prisma.config.ts`, eliminando el aviso deprecado de `package.json#prisma`.

### Documentación y CI

- Se reescribió `docs/ARQUITECTURA.md` para describir la arquitectura real, sin presentar el backend como si ya estuviera dividido en módulos de archivos.
- Se actualizaron `README.md` y `docs/CREACION_BASE_DATOS.md` con instrucciones para bases vacías y advertencias para instalaciones existentes.
- CI usa Node 24 y un servicio PostgreSQL 16 para aplicar las migraciones versionadas además de validar, probar y compilar.

## Hallazgos pendientes

### Prioridad alta: base de datos

- La migración inicial y el SQL de pgAdmin están alineados con el modelo y las restricciones conocidas, pero no se ejecutaron contra PostgreSQL localmente. CI aplicará la migración a PostgreSQL 16 cuando se ejecute en GitHub Actions; ese resultado todavía no está disponible en esta revisión.
- La migración inicial está destinada a una base vacía. No la marque como aplicada ni la ejecute sobre una instalación que ya contiene datos sin comparar el esquema real y preparar una línea base de Prisma.
- Los scripts de pgAdmin en `database/` no se ejecutaron contra una base PostgreSQL real en este entorno. La migración de rifas y su esquema Prisma fueron validados, pero no aplicados a una base real.
- No se probaron planes de consulta con datos reales, backups ni restauración. La versión/proveedor de PostgreSQL del despliegue no quedó especificada.

El usuario confirmó que el destino previsto es una base nueva y vacía, con una instancia de backend. No se proporcionó proveedor/version de PostgreSQL.

### Prioridad alta: autenticación y cuentas

- El navegador sigue guardando access y refresh tokens en `localStorage`; un XSS puede exponerlos. Cambiar a cookies `HttpOnly`, `Secure`, `SameSite` requiere acordar el modelo de sesión, CSRF, dominios y despliegue.
- El refresh token almacenado en el servidor vence y puede revocarse administrativamente, pero no se implementó rotación de token en cada refresh ni revocación al cerrar sesión. Una copia robada puede seguir renovando acceso hasta que venza o sea revocada.
- El seed de desarrollo contiene usuarios y contraseñas de demostración conocidos. Ahora está bloqueado en producción, pero el aprovisionamiento inicial seguro del administrador aún no está implementado.
- Swagger está disponible sin autenticación en `/docs`; su publicación en producción debe decidirse explícitamente.

### Prioridad alta: operación y escalabilidad

- `node-cron` ejecuta la acumulación de intereses dentro de cada proceso. Varias réplicas pueden ejecutar el mismo trabajo; antes de escalar se necesita exclusión distribuida o un worker dedicado.
- El backend no tiene cierre controlado de servidor/Prisma ante SIGTERM; tampoco se verificó un endpoint de readiness dependiente de PostgreSQL.
- Los logs usan `console.log/error`; no se verificaron logs estructurados, correlación de solicitudes, métricas ni integración con monitoreo.
- La configuración de proxy/HTTPS y límites de rate limit debe validarse con el proveedor de despliegue real.

### Prioridad media: arquitectura y pruebas

- `backend/src/server.js` reúne 41 declaraciones de rutas y la lógica de varios dominios en 1.157 líneas. Se documentó la arquitectura; no se realizó una reestructuración masiva porque solo hay pruebas unitarias financieras/configuración y faltan pruebas de integración que protejan los límites transaccionales y RBAC.
- Las consultas de socios dependen de reglas por `memberId`; hacen falta pruebas negativas con dos socios distintos para verificar que no haya fugas en todas las rutas y exportaciones.
- No se encontraron pruebas automatizadas del frontend ni pruebas de integración con PostgreSQL. El build y lint no validan por sí solos flujos de navegador o comportamiento bajo carga.
- No se eliminó código fuente por sospecha: los componentes compartidos revisados, incluido `FilterBar`, sí tienen referencias. Se retiraron solo dependencias sin imports comprobables.

## Evidencia de validación local

Resultados observados después de los cambios:

- `pnpm install --frozen-lockfile`: correcto.
- `pnpm lint`: correcto para backend y frontend.
- `pnpm test`: correcto; 9 pruebas, 0 fallidas.
- `pnpm build`: correcto; build de frontend sin advertencia de chunks mayores de 500 kB y verificación de sintaxis del backend correcta.
- `prisma validate`: esquema válido y configuración cargada desde `prisma.config.ts`.
- `prisma migrate diff`: generó la migración inicial desde el modelo validado; se añadieron en SQL las restricciones `CHECK` que el modelo Prisma no expresa.
- `prisma generate`: no terminó localmente; Windows devolvió `EPERM` al reemplazar `query_engine-windows.dll.node`, incluso al reintentar de forma aislada. No se detuvieron procesos desconocidos. La generación deberá repetirse en CI o en un entorno sin el bloqueo del archivo.
- `prisma migrate deploy`: no se ejecutó localmente al no disponer de PostgreSQL; CI quedó configurado para aplicarlo sobre PostgreSQL 16.
- `pnpm audit --prod`: sin vulnerabilidades conocidas después de los overrides.
- Escaneo final de los dos paquetes corregidos: sin vulnerabilidades conocidas.

Estas pruebas son locales y no sustituyen una validación contra PostgreSQL, un navegador real ni el entorno de despliegue.
