# Arquitectura actual

## Tipo y límites de despliegue

El proyecto es un monorepo pequeño con dos aplicaciones desplegables:

- `frontend/`: SPA React 19 compilada con Vite.
- `backend/`: API REST Express 5 sobre Node.js, Prisma y PostgreSQL.

El frontend y el backend pueden publicarse por separado. PostgreSQL es una dependencia externa. No hay contenedores, infraestructura como código ni manifiestos de despliegue en el repositorio.

## Capas y flujo

```text
Navegador
  -> React Router / páginas MUI / Zustand
  -> Axios y API REST
  -> Express: autenticación, permisos, validación y rutas
  -> Prisma Client
  -> PostgreSQL
```

El frontend concentra las pantallas en `frontend/src/pages/`; las rutas se declaran en `frontend/src/App.jsx`. Los módulos CRUD reutilizan `SimpleModule.jsx`, mientras pagos, deudas, socios, usuarios, permisos y dashboard tienen pantallas específicas.

El backend es actualmente un **monolito modular a nivel funcional, pero no a nivel de archivos**: las 41 declaraciones de rutas HTTP y buena parte de la lógica de negocio están concentradas en `backend/src/server.js` (1.157 líneas en la revisión). `backend/src/loan-finance.js` contiene cálculos financieros reutilizables; `backend/src/config.js` valida la configuración de proceso. No se encontraron directorios separados de controladores, servicios o repositorios.

## Dominios funcionales

- Autenticación, cuentas, roles y permisos.
- Socios, vigencias y ahorros.
- Préstamos, intereses, pagos y cartera.
- Actividades, rifas y liquidaciones.
- Reportes, auditoría e historial de acceso.

La API aplica autenticación JWT y permisos por módulo/acción. El rol SOCIO tiene filtros de propiedad en varias consultas; las reglas de aislamiento requieren pruebas de integración contra una base real antes de considerarse verificadas en producción.

## Persistencia

`backend/prisma/schema.prisma` define 21 modelos. Las migraciones crean el esquema operativo en español, incluyendo un programa anual de rifas, 12 sorteos por vigencia, cuotas individuales y registros de distribución. `database/schema.sql` contiene el esquema completo para pgAdmin, equivalente a aplicar en orden la migración inicial y las migraciones incrementales.

Prisma es la fuente del modelo de aplicación y `backend/prisma/migrations/` es la historia versionada. La migración inicial está destinada a una base vacía; las siguientes agregan el registro de reparto de rifas y el calendario/cuotas por socio. No se han aplicado en un PostgreSQL real en este entorno. Los scripts SQL históricos bajo `database/` requieren revisión individual antes de usarse para actualizar instalaciones con datos.

El administrador define el valor mensual por socio y las fechas/horas de cada sorteo en `programa_rifa` y `rifa_mensual`. `pago_rifa_mensual` registra las cuotas individuales; la elegibilidad exige socio activo y pago antes del sorteo. `distribucion_rifa_mensual` registra el 3% para administradores activos y el 97% para el ganador o, si no lo hay, para los socios que pagaron a tiempo. Las distribuciones ya registradas se conservan.

## Ejecución programada

El servidor programa la acumulación diaria de intereses con `node-cron` dentro del proceso API. Esto requiere una única instancia API o un mecanismo distribuido de exclusión antes de escalar a varias réplicas; de otro modo cada instancia puede ejecutar la tarea.

## Configuración y seguridad

- La configuración se entrega mediante variables de entorno; `backend/src/config.js` exige `DATABASE_URL`, `CORS_ORIGIN` y un `JWT_SECRET` de 32 caracteres o más en producción.
- CORS acepta en producción únicamente los orígenes declarados, separados por comas.
- El seed incluye datos y credenciales de demostración y está bloqueado cuando `NODE_ENV=production`.
- Los tokens del navegador aún se guardan en `localStorage`; la protección contra robo mediante XSS requiere una decisión de arquitectura de autenticación.
- Swagger está publicado en `/docs`; su exposición en producción debe definirse en la configuración del entorno.

## Verificación

`pnpm lint`, `pnpm test`, `pnpm build` y `prisma validate` son las comprobaciones automatizadas locales. Estas no prueban conectividad PostgreSQL, migraciones aplicadas, ciclo de vida de producción, navegación visual ni aislamiento RBAC con datos reales.

Los hallazgos, cambios aplicados y bloqueos para desplegar se mantienen en [REVISION_TECNICA.md](./REVISION_TECNICA.md).
