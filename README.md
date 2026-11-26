# La Natillera de Lili

Plataforma web empresarial para administrar socios, ahorros, préstamos, pagos, actividades, rifas, deudas, vigencias y liquidaciones anuales de una natillera comunitaria.

## Stack

- Frontend: React 19, Vite 7, MUI, Recharts, Zustand
- Backend: Node.js, Express 5, JWT, Prisma
- Base de datos: PostgreSQL
- Documentación: Swagger/OpenAPI
- CI: GitHub Actions

## Inicio rápido

### Requisitos

- Node.js 22.12 o superior; CI ejecuta Node.js 24
- pnpm 10
- PostgreSQL 14 o superior
- Una terminal de PowerShell para cada proceso que se vaya a ejecutar

### 1. Instalar dependencias

Desde la raíz del proyecto:

```powershell
corepack enable
pnpm install --frozen-lockfile
```

### 2. Crear y configurar la base de datos

Cree una base de datos PostgreSQL vacía llamada `natillera`. Después, configure el archivo de variables del backend:

```powershell
Copy-Item .env.example backend\.env
```

Edite `backend\.env` y reemplaza los valores de ejemplo. Como mínimo, configure:

```dotenv
DATABASE_URL="postgresql://USUARIO:PASSWORD@localhost:5432/natillera"
PORT=4000
JWT_SECRET="un-secreto-largo-y-unico"
JWT_EXPIRES_IN="15m"
CORS_ORIGIN="http://localhost:5173"
```

Si ya tiene configurada `backend\.env`, omita la copia y confirme que `DATABASE_URL` apunta a la base local.

### 3. Preparar Prisma

Los siguientes comandos de migración y seed son **solo para una base local nueva y vacía**, después de validar la cadena de migraciones en una base desechable. El seed modifica datos. Si la base ya contiene tablas o datos, no ejecute migraciones ni seed: consulte primero la sección de bases existentes. Ejecute desde la raíz:

```powershell
pnpm --filter @natillera/backend prisma:generate
pnpm --filter @natillera/backend prisma:migrate
pnpm --filter @natillera/backend prisma:seed
```

El seed crea usuarios y datos de demostración con credenciales conocidas; está destinado exclusivamente a desarrollo local. El backend lo rechaza cuando `NODE_ENV=production`. No use esas credenciales ni datos en un entorno real.

### 4. Ejecutar el backend

En una terminal:

```powershell
pnpm --filter @natillera/backend dev
```

### 5. Ejecutar el frontend

En una segunda terminal, desde la raíz:

```powershell
pnpm --filter @natillera/frontend dev
```

Si el frontend y el backend están en puertos diferentes, cree `frontend\.env.local`:

```dotenv
VITE_API_URL="http://localhost:4000/api"
```

URLs locales:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Swagger: http://localhost:4000/docs

### 6. Verificación local

```powershell
pnpm lint
pnpm test
pnpm build
```

## Scripts

```bash
pnpm build
pnpm test
pnpm lint
```

## Ejecución en producción

### 1. Configurar el servidor

Instale Node.js 24, pnpm 10 y PostgreSQL en el servidor o utilice PostgreSQL administrado. Cree una base de datos separada para producción y un usuario con permisos limitados a esa base.

Configure como variables de entorno del proceso del backend:

```dotenv
DATABASE_URL="postgresql://USUARIO:PASSWORD@HOST:5432/natillera"
PORT=4000
NODE_ENV="production"
JWT_SECRET="secreto-real-aleatorio-de-al-menos-32-caracteres"
JWT_EXPIRES_IN="15m"
CORS_ORIGIN="https://dominio-de-produccion"
```

No reutilice la contraseña de desarrollo ni confirme secretos en el repositorio.
En producción, el backend no inicia si faltan `DATABASE_URL`, `CORS_ORIGIN` o un `JWT_SECRET` de al menos 32 caracteres. `CORS_ORIGIN` admite varios orígenes separados por comas.

### 2. Preparar Prisma y la base de datos

La migración inicial se aplica solo a una base de datos vacía. Antes de usarla en producción, valide la cadena completa de migraciones sobre una base desechable independiente y confirme que la base de producción está vacía. Solo entonces, desde la raíz y con `DATABASE_URL` apuntando a esa base nueva:

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @natillera/backend prisma:generate
pnpm --filter @natillera/backend exec prisma migrate deploy
```

`backend/prisma/migrations/` contiene la migración inicial y los cambios incrementales. `database/schema.sql` contiene el esquema completo para pgAdmin; no combine ambos flujos. Para una base existente, no ejecute `migrate dev`, `migrate deploy`, `migrate resolve`, `db push`, seed ni scripts de esquema hasta revisar el historial y el esquema completo, verificar un respaldo restaurable y acordar un plan de preservación probado en una copia aislada. Que una migración figure como pendiente no significa que sea seguro aplicarla. El primer usuario administrador requiere un procedimiento de aprovisionamiento seguro; el seed de demostración está bloqueado en producción.

#### Crear el primer administrador y entrar por primera vez

El seed (`prisma:seed`) contiene datos y contraseñas de demostración: no lo ejecute en producción. Para crear el primer administrador, primero confirme que Railway está conectado a la base de producción correcta, que el backend ya se desplegó con este script y que `NODE_ENV=production`. Desde PowerShell local, abra una shell del servicio backend:

```powershell
railway ssh --service natilleraLili --environment production
```

En la shell remota, desde `/app`, ejecute el aprovisionamiento interactivo:

```bash
node backend/scripts/create-initial-admin.js
```

Si `node` no se reconoce en la shell, encuentre la ruta de Node incluida en el proceso del backend:

```bash
for f in /proc/[0-9]*/exe; do target=$(readlink "$f" 2>/dev/null) || continue; case "$target" in */bin/node) echo "$target"; break;; esac; done
```

Ejecute el script usando la ruta que imprimió el comando, seguida de `backend/scripts/create-initial-admin.js`. Por ejemplo, si imprimió `/mise/installs/node/22.23.5/bin/node`:

```bash
/mise/installs/node/22.23.5/bin/node backend/scripts/create-initial-admin.js
```

El programa solicita nombres, apellidos, correo, nombre de usuario y contraseña; la contraseña no se muestra al escribirla. Escriba `CREAR ADMINISTRADOR` cuando lo solicite. La contraseña debe tener al menos 8 caracteres y no superar 72 bytes. El comando solo funciona con `NODE_ENV=production` y se niega a crear otra cuenta si ya existe un administrador. No copie contraseñas en SQL, comandos, capturas ni chats.

Al finalizar, abra la página publicada <https://liliysusazoncompleta.github.io/natilleraLili/#/login> e inicie sesión con el nombre de usuario o el correo recién creado y su contraseña. Después de verificar el acceso, use el menú **Socios** para registrar perfiles y **Usuarios** para crear cuentas de acceso adicionales. Guarde la contraseña en un gestor seguro.

Para recuperar la contraseña de una cuenta existente y activa, use desde una terminal interactiva segura `pnpm --filter @natillera/backend user:reset-password` con `DATABASE_URL` apuntando a la base correcta. El comando pide el correo exacto, exige escribir `RESTABLECER`, solicita la nueva contraseña sin mostrarla, guarda únicamente su hash bcrypt y revoca los tokens de sesión existentes. Si la base de producción solo es accesible desde Railway, ejecute el procedimiento desde una shell autorizada de ese servicio, usando la ruta de Node si no está en `PATH`.

### Despliegue del backend en Railway

1. **Antes de desplegar, rote las credenciales de PostgreSQL expuestas en la captura.** Considérelas comprometidas, revoque las anteriores y coordine la rotación con los servicios que las usan; cambiar solo una variable no cambia necesariamente la contraseña del rol en PostgreSQL. No publique la URL ni la captura en logs, código o frontend.
2. Mantenga la base local de pruebas y sus datos sin cambios. En Railway use servicios PostgreSQL independientes para producción y pruebas, en entornos aislados; no referencie la base de producción desde pruebas ni copie datos sin autorización. Habilite respaldos y verifique su restauración en una base aislada.
3. En el mismo proyecto y entorno de Railway, conecte el repositorio a un servicio backend. Deje el directorio raíz del servicio en la raíz del monorepositorio para que estén disponibles el workspace y el lockfile. Use Railpack con Node.js 24 y pnpm 10. En **Settings**, configure:

   - Build command: `pnpm install --frozen-lockfile --prod=false && pnpm run build:railway`
   - Start command: `pnpm --filter @natillera/backend start`
   - Healthcheck path: `/api/health`

   El build genera el cliente Prisma y verifica la sintaxis; ni el build ni el arranque aplican migraciones o seed. No configure un pre-deploy que los ejecute. El healthcheck solo verifica que el proceso responde, no comprueba PostgreSQL.
4. En **Variables** del backend, agregue `DATABASE_URL` como referencia a la variable interna `DATABASE_URL` del servicio PostgreSQL del mismo entorno. Si el servicio se llama `Postgres`, el valor de referencia es `${{Postgres.DATABASE_URL}}`; sustituya `Postgres` por el nombre real del servicio usando el selector de Railway. No use `DATABASE_PUBLIC_URL` para esta conexión ni exponga PostgreSQL públicamente. La red privada de Railway funciona entre servicios del mismo entorno, no desde el equipo local; confirme conectividad y TLS según la configuración efectiva del servicio.
5. Configure también `NODE_ENV=production`, `JWT_SECRET` como secreto aleatorio único de al menos 32 caracteres y `CORS_ORIGIN` con los orígenes HTTPS de los frontends adicionales, separados por comas. El backend agrega automáticamente `https://liliysusazoncompleta.github.io` a la lista permitida en producción. Railway proporciona `PORT`; no lo fije a 4000. Defina `JWT_EXPIRES_IN` y `JWT_REFRESH_EXPIRES_IN` solo si desea cambiar sus valores predeterminados.
6. Configure el frontend por separado: antes de compilar, defina `VITE_API_URL` como la URL HTTPS pública del backend terminada en `/api`. Esta variable es pública en el navegador; nunca ponga credenciales ni `DATABASE_URL` en variables `VITE_`. Configure fallback SPA y CORS para el dominio real.
7. Antes de habilitar tráfico, resuelva por separado el estado de la base de destino. Una base existente sin historial Prisma o con drift requiere una decisión y un plan de reconciliación no destructivo; una base nueva requiere validar primero las migraciones en otra base desechable. Después de desplegar, verifique `/api/health` y una consulta autenticada de solo lectura; el healthcheck por sí solo no demuestra que la base funcione. Cree el administrador inicial con el procedimiento interactivo descrito arriba; nunca ejecute el seed en producción.

Referencias: [variables entre servicios](https://docs.railway.com/variables#referencing-another-services-variable), [PostgreSQL](https://docs.railway.com/databases/postgresql) y [red privada](https://docs.railway.com/networking/private-networking).

El script histórico `database/migracion_ventas_actividades.sql` no debe ejecutarse sin la revisión y el plan anteriores. Registre los ingresos y costos generales sin incluir las ventas detalladas, pues estas se suman automáticamente; sus saldos se consultan en Deudas y no se descuentan en la liquidación.

Las ventas y sus abonos solo se pueden registrar o modificar mientras la vigencia esté abierta. Un socio puede comprar productos aunque no figure entre los participantes de la actividad.

En **Actividades > Ventas > Administrar productos**, registre previamente el nombre, costo y precio unitario de cada producto de la actividad. Para vender, seleccione comprador y producto, ingrese cantidad y abono; el valor adquirido se calcula automáticamente. Al modificar un producto, los precios nuevos se aplican solo a ventas futuras. Las ventas anteriores conservan sus datos y pueden editarse en cantidad, siempre que el valor no quede por debajo de lo abonado.

El script histórico `database/migracion_catalogo_productos_actividad.sql` también requiere esa revisión previa. Los productos deben registrarse en el catálogo para nuevas ventas.

### 3. Compilar la aplicación

Configure la URL pública del backend antes de compilar el frontend:

```dotenv
VITE_API_URL="https://api.dominio.com/api"
```

También puede definir `VITE_API_URL` como variable de entorno en el sistema de CI antes de ejecutar el build:

```powershell
pnpm build
```

El resultado del frontend queda en `frontend\dist`. El resultado puede desplegarse en un servidor estático, CDN o servicio de hosting compatible con aplicaciones SPA.

### 4. Ejecutar el backend

Sirva la API con un administrador de procesos como PM2:

```powershell
pnpm add --global pm2
Set-Location backend
pm2 start src\server.js --name natillera-api
pm2 save
```

Debe colocar el backend detrás de HTTPS y configurar `CORS_ORIGIN` exactamente con el dominio público del frontend. Configure el balanceador, proxy o servidor web para reenviar las rutas `/api` y `/docs` al puerto configurado por `PORT`.

### 5. Publicar el frontend

Sirva todo el contenido de `frontend\dist` desde el dominio del frontend y configure el fallback de la SPA a `index.html` para las rutas internas de React.

#### GitHub Pages

El flujo `.github/workflows/pages.yml` compila y publica el frontend al actualizar la rama `desarrollo` o al ejecutarlo manualmente. En GitHub, vaya a **Settings > Pages > Build and deployment** y cambie **Source** de **Deploy from a branch** a **GitHub Actions**. Publicar una rama que solo contiene el README no publica la aplicación compilada. Los cambios deben estar en la rama remota antes de que el flujo pueda ejecutarse.

El flujo usa `https://natilleralili-production.up.railway.app/api` como URL pública predeterminada del backend. Para otro backend, en **Settings > Secrets and variables > Actions > Variables**, configure `VITE_API_URL` con la URL HTTPS pública terminada en `/api` (sin credenciales); esa variable reemplaza el valor predeterminado. Vuelva a ejecutar el flujo después de cambiarla, pues Vite incorpora la variable durante la compilación. Si la URL no es válida, se mostrará un aviso y el inicio de sesión estará deshabilitado. GitHub Pages solo aloja el frontend: el backend debe estar desplegado y accesible por HTTPS, con `CORS_ORIGIN=https://liliysusazoncompleta.github.io` en Railway. No use la URL privada de PostgreSQL ni la del backend interno de Railway en el navegador.

En Pages las rutas usan `#` para que funcionen la recarga y los enlaces directos sin una regla de fallback del servidor; los demás despliegues conservan sus rutas habituales.

Ejemplo de destinos:

- Frontend: `https://dominio.com`
- API: `https://api.dominio.com/api`
- Documentación: `https://api.dominio.com/docs`

### 6. Validación posterior al despliegue

Verifique, al menos, estos puntos:

```text
GET /api/health
GET /docs
Inicio de sesión con el usuario administrador
Carga del dashboard
Operaciones principales con un usuario SOCIO
```

Revise los registros del backend y confirme que HTTPS, CORS, secretos y permisos de la base de datos están configurados antes de habilitar usuarios finales.

## Seguridad

El backend aplica Helmet, CORS con lista explícita de orígenes en producción, límite de tasa, JWT, refresh tokens, bcrypt, validaciones de parámetros y auditoría de operaciones administrativas. Los tokens siguen almacenándose en `localStorage`; consulte [la revisión técnica](./docs/REVISION_TECNICA.md) para las decisiones de seguridad pendientes antes del despliegue.

## Operaciones CRUD

## Filtros de consulta

Los módulos incluyen filtros visibles en español para facilitar las búsquedas:

- **Socios:** nombre, apellido, documento, vigencia y estado.
- **Usuarios:** nombre, apellido, documento, correo, nombre de usuario, rol y estado.
- **Ahorros:** socio, vigencia y texto de búsqueda.
- **Préstamos:** prestatario, socio, vigencia y estado.
- **Pagos:** prestatario, estado del pago y fecha.
- **Actividades y rifas:** texto, vigencia y fecha.
- **Deudas:** prestatario, vigencia y estado calculado.
- **Vigencias, liquidaciones y reportes:** vigencia, estado o texto según corresponda.
- **Dashboard:** vigencia seleccionada.
- **Auditoría de permisos:** rol, módulo, campo o acción.

Los filtros se envían al backend y también respetan las restricciones por rol y `memberId`. El administrador puede limpiar los filtros con **Limpiar filtros** para volver a consultar el conjunto completo autorizado.

Los usuarios con rol `ADMINISTRADOR` pueden consultar, crear, editar y eliminar mediante borrado lógico los siguientes registros:

- Socios
- Ahorros
- Préstamos
- Actividades
- Rifas
- Vigencias

Las deudas se consultan como cartera calculada desde los préstamos y no admiten creación independiente. En Pagos, el administrador puede registrar, editar y anular movimientos según las reglas de trazabilidad descritas arriba.

Los formularios utilizan selecciones de socios y vigencias existentes en la base de datos; no es necesario introducir IDs manualmente.

Las eliminaciones no borran físicamente la información: registran `deletedAt` y `deletedBy`. Los registros eliminados dejan de aparecer en las consultas normales.

El usuario con rol `SOCIO` mantiene acceso de consulta a su información propia y no puede ver los botones ni ejecutar las acciones administrativas.

## Actividades y participantes

El administrador registra la actividad, su fecha, ingresos y costos generales, además del valor que debe aportar cada participante. Desde **Registrar participantes** selecciona los socios activos de la vigencia; la pantalla carga todas las páginas de socios disponibles. Cada socio puede tener varios abonos, y la aplicación muestra el total pagado, el saldo pendiente y el estado **PENDIENTE**, **ABONADO** o **PAGADO**. Los abonos no pueden superar el valor individual definido.

Las ganancias netas positivas de una actividad se asignan únicamente a sus participantes, ponderadas por sus ahorros de la vigencia; si ninguno tiene ahorros, se reparten equitativamente. Tener saldo pendiente por el costo de participación no excluye al socio de las ganancias. El administrador puede editar la actividad y el valor por participante mientras la vigencia esté abierta; no puede reducir dicho valor por debajo de lo ya abonado ni retirar participantes con abonos registrados.

El script histórico `database/migracion_actividades_participantes.sql` agrega campos y tablas para participantes. No lo ejecute en una base existente sin el plan de preservación descrito en la sección de producción. Para regenerar el cliente sin modificar el esquema:

```powershell
pnpm --filter @natillera/backend prisma:generate
```

La guía detallada de base de datos está en [docs/CREACION_BASE_DATOS.md](docs/CREACION_BASE_DATOS.md).

## Módulo de préstamos

Los préstamos pueden otorgarse a socios o particulares, sin fecha obligatoria de vencimiento ni cuotas exigibles. El administrador ingresa la tasa mensual de cada préstamo (de 0 a 999,99 %, con hasta dos decimales). En préstamos a particulares selecciona obligatoriamente un socio avalista activo de la vigencia; el saldo de capital e intereses aparece como deuda del avalista y disminuye con cada pago. Si queda pendiente al liquidar, se aplica el descuento de la liquidación según las reglas existentes. El administrador puede consultar el historial y registrar, editar o anular pagos; los socios consultan sus propios préstamos y los avalados.

Al crear un préstamo indique cuántos días después del desembolso se genera el primer interés mensual. Por ejemplo, con 5 días y desembolso el 10 de enero, el primer interés se genera el 15 de enero y los siguientes en el aniversario mensual. La lista muestra intereses generados acumulados e intereses aún pendientes, y la tasa con el símbolo %. La acción **Modificar** permite corregir las condiciones solo antes de cualquier pago o periodo de interés causado; después únicamente permite editar observaciones mientras la vigencia esté abierta. Los préstamos anteriores conservan su calendario mensual original salvo que se modifique expresamente antes de tener movimientos.

Para registrar nuevos préstamos la API requiere `type` (`SOCIO` o `PARTICULAR`), `memberId` (socio deudor o avalista), `rate`, `interestStartDays` (entero de 1 a 36500), monto y vigencia; para particulares también requiere `borrowerName`. El socio seleccionado debe estar activo en una vigencia abierta. Se reutilizan las columnas existentes, sin migración; los préstamos históricos no se modifican.

Los intereses se acumulan por periodos mensuales desde la fecha de cálculo del préstamo y exclusivamente sobre el capital pendiente. La tarea diaria del backend registra los periodos vencidos; las consultas y operaciones de cartera también actualizan los intereses que ya vencieron. Al llegar a capital cero no se generan intereses adicionales.

Cada pago se aplica primero a los intereses acumulados y luego al capital. No se permite pagar más que el saldo total adeudado. Se conserva el valor abonado, los valores aplicados a intereses y capital, el saldo anterior y nuevo, la fecha, las observaciones y el usuario administrador que registró el pago. Los pagos anulados permanecen en el historial y no cuentan en los indicadores.

Para evitar reescribir la historia financiera, un pago solo se puede editar o anular mientras no existan pagos posteriores ni periodos de interés posteriores; la API devuelve un conflicto con el motivo si el movimiento ya tiene actividad posterior.

### Cartera, deudas y liquidación

- **Deudas** no es un registro independiente: se calcula desde el saldo de capital, los intereses pendientes y los pagos vigentes de cada préstamo.
- Los registros de deudas manuales de versiones anteriores permanecen respaldados en la tabla `deuda`, pero ya no se usan en la consulta de cartera ni se convierten automáticamente en préstamos; conviértalos con revisión administrativa si todavía deben cobrarse.
- El estado de la deuda es `PENDIENTE` mientras quede capital o interés por pagar y `CANCELADA` al quedar ambos en cero.
- Los dashboards presentan capital prestado/recuperado/pendiente, intereses generados/recaudados/pendientes, préstamos activos/finalizados y ganancias distribuibles. Solo los intereses efectivamente cobrados cuentan como ganancia del préstamo; el capital recuperado no es utilidad.
- En **Liquidaciones**, el administrador selecciona una vigencia y calcula una vista previa por socio antes de confirmar el cierre irreversible. Se muestran ahorros, ganancias por concepto, comisiones, descuentos, saldos pendientes y valor final. La vista previa actualiza los intereses causados, pero no aplica descuentos ni cierra la vigencia; si cambian los datos, debe calcularse nuevamente.
- Las ganancias de actividades se mantienen asignadas a sus participantes; los intereses cobrados, incluso los descontados al liquidar, se distribuyen según el ahorro. El 3 % anual para los socios administradores se descuenta de esas ganancias antes de repartirlas. Los premios, repartos sin ganador y comisiones de los sorteos mensuales cerrados se suman a sus destinatarios por los importes ya registrados, sin repetir la comisión del 3 % mensual.
- Las cuotas de rifa impagas se descuentan primero de las ganancias y después del ahorro; con el saldo restante se cubren préstamos e intereses. Los saldos de actividades y ventas se muestran, pero no se descuentan automáticamente. Lo que no alcance a cubrirse permanece pendiente.
- Se advierte si hay sorteos abiertos: sus distribuciones futuras no se incluyen en el cierre. En rifas históricas sin distribuciones ni recaudo registrado, se suma el premio al ganador registrado; los demás casos históricos con valor sin distribuciones requieren revisión. También se bloquea el cierre si hay ganancias, ahorros o distribuciones sin socio activo destinatario, o préstamos pendientes de otra vigencia. El administrador puede vincular su propio perfil de socio al editar su usuario.
- La liquidación no puede ejecutarse dos veces para la misma vigencia.

### API

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/prestamos` | Lista préstamos; las consultas de socios se filtran por su socio vinculado. |
| `GET` | `/api/prestamos/resumen` | Indicadores de capital, intereses y estado de la cartera. |
| `POST` | `/api/prestamos` | Crea un préstamo como administrador. |
| `GET` | `/api/pagos` | Historial de pagos, incluidos los anulados. |
| `POST` | `/api/pagos` | Registra un pago y actualiza el préstamo en una transacción. |
| `PATCH` | `/api/pagos/:id` | Edita un movimiento aún no afectado por actividad posterior. |
| `DELETE` | `/api/pagos/:id` | Anula lógicamente un pago, conserva su historial y revierte sus saldos. |
| `GET` | `/api/actividades` | Lista actividades y devuelve para cada participante el total abonado y el saldo. |
| `POST` | `/api/actividades` | Registra actividad y valor individual; opcionalmente registra participantes iniciales. |
| `PATCH` | `/api/actividades/:id` | Modifica la actividad y recalcula sus ganancias. |
| `PUT` | `/api/actividades/:id/participantes` | Actualiza los participantes de una actividad. |
| `POST` | `/api/actividades/:id/participantes/:memberId/abonos` | Registra un abono parcial o total del participante. |
| `GET` | `/api/rifas-mensuales` | Consulta calendario y cuotas; los socios reciben solo su propia información. |
| `POST` | `/api/rifas-mensuales/configuracion` | Configura el valor por socio y las fechas opcionales de los sorteos de la vigencia. |
| `POST` | `/api/rifas-mensuales/:id/pagos/:memberId` | Registra el pago individual antes del sorteo. |
| `PATCH` | `/api/rifas-mensuales/:id/pagos/:memberId/anular` | Anula el pago y deja la cuota pendiente; disponible antes del sorteo y del cierre de la vigencia. |
| `PATCH` | `/api/rifas-mensuales/:id/fecha` | Modifica la fecha de un sorteo no cerrado, dentro del año de su vigencia. |
| `POST` | `/api/rifas-mensuales/:id/sortear` | Registra el número ganador de un participante al día, o permite cerrar sin ganador; distribuye lo recaudado. |
| `GET` | `/api/deudas` | Consulta deudas calculadas a partir de préstamos activos. |

### Actualizar una base existente desde pgAdmin 4

Los siguientes son scripts históricos, no instrucciones para ejecutarlos directamente. Antes de cambiar una base existente, siga el procedimiento de revisión y preservación de la sección de producción:

```text
database/migracion_pagos_deudas.sql
```

El script agrega campos de intereses, saldos y trazabilidad, y comienza a acumular intereses mensuales desde su fecha de ejecución. Existe también `database/migracion_actividades_participantes.sql` para participantes y abonos. No ejecute ninguno sin evaluar el esquema, historial y efectos sobre los datos. Para regenerar el cliente sin modificar el esquema:

```powershell
pnpm --filter @natillera/backend prisma:generate
```

Reinicie el backend y frontend. Los detalles paso a paso están en [docs/CREACION_BASE_DATOS.md](docs/CREACION_BASE_DATOS.md).

## Rifas mensuales, cuotas y elegibilidad

En una vigencia abierta el administrador puede volver a **Configurar valor y calendario**. El nuevo valor aplica solo a sorteos agregados después; los sorteos ya creados conservan su valor, incluso para socios incorporados posteriormente. Se pueden agregar sorteos y modificar fechas abiertas a fechas futuras de la vigencia, sin eliminar sorteos existentes ni modificar cerrados. La pantalla muestra el recaudo elegible actual y las proyecciones con y sin ganador; al cerrar muestra las distribuciones registradas. Estos valores globales son visibles solo para administradores.

El script histórico `database/migracion_valor_rifa_por_sorteo.sql` requiere la revisión y el plan de preservación de la sección de producción antes de aplicarlo a una base existente.

Al inicio de cada vigencia, el administrador configura el valor por socio y las fechas y horas de los sorteos que sí se realizarán. Cada fecha puede ser cualquier día del año de la vigencia, sin necesidad de coincidir con el mes de la etiqueta, y se interpreta en la zona horaria de Colombia. Las fechas son opcionales mes a mes: se deja en blanco un mes sin rifa, y en ese mes no se crea sorteo ni cuota. Se crea una cuota individual pendiente por socio activo únicamente para cada sorteo programado. Un miembro con rol `ADMINISTRADOR` también participa si tiene ahorros vigentes; al registrar su primer ahorro, se generan cuotas para los sorteos futuros. Los pagos pendientes impiden participar. No se crean cuotas retroactivas para sorteos pasados.

El administrador registra la recepción de cada cuota individual. Solo participa quien figure como socio activo y haya pagado estrictamente antes de la fecha y hora del sorteo; las cuotas pendientes se muestran por separado y no se incluyen en el recaudo ni en el sorteo. Si se registra un pago por error, se puede anular antes del sorteo: el registro vuelve a pendiente y la acción queda en auditoría. El pago es una anotación de recepción del aporte, no una integración con banco ni pasarela.

Antes de cerrar el sorteo, el administrador puede modificar la fecha mientras siga abierto; la nueva fecha debe ser futura y pertenecer al año de la vigencia. El sorteo permanece abierto hasta su fecha programada, y puede cerrarse en esa fecha o después. Al cerrar, registra el número ganador, que debe pertenecer a un participante activo que pagó a tiempo; su identidad y número quedan guardados. También puede indicar que no hubo ganador. En ambos casos el 3% se reparte en partes iguales entre las cuentas activas con rol `ADMINISTRADOR`. El 97% restante se asigna al ganador o, si no lo hay, se reparte entre los participantes que pagaron a tiempo. Los centavos sobrantes se asignan de manera determinista. Las distribuciones ya guardadas no se recalculan; un sorteo cerrado no puede reabrirse ni cerrarse dos veces.

Al liquidar la vigencia, las cuotas de rifa que sigan impagas se descuentan primero de las ganancias del participante y luego de sus ahorros. Cada descuento se guarda en la cuota y en la liquidación (`rifas_descontadas`); si el saldo disponible no alcanza, el valor no cubierto permanece como pendiente para control administrativo.

El dashboard del socio muestra las cuotas de rifa de su vigencia, indicando si están pendientes y que no participa hasta pagar antes del sorteo. El administrador puede controlar la visibilidad de estos datos y de las ganancias propias desde **Roles y permisos > Dashboard > Campos**. Cuando el campo **Mis ganancias** esté desactivado para SOCIO, la API lo omite y el dashboard no lo muestra. Los socios solo pueden consultar sus propias cuotas, su elegibilidad y cualquier valor asignado; no ven pagos ni distribuciones individuales de otros socios ni los totales financieros administrativos.

Los scripts históricos `database/migracion_rifa_por_socio_y_calendario.sql` y `database/migracion_control_cuotas_rifa.sql` requieren la revisión y el plan de preservación de la sección de producción antes de aplicarlos a una base existente. Para regenerar el cliente sin modificar el esquema:

```powershell
pnpm --filter @natillera/backend prisma:generate
```

## Datos de muestra

La seed incluye datos representativos para todas las áreas principales:

- Vigencias 2025 y 2026
- Usuarios administrador y socio
- Socios Lili, Ana y Carlos
- Ahorros de ejemplo
- Préstamos y pagos asociados
- Actividades y participantes
- Rifa con ganador
- Deuda pendiente
- Liquidación de ejemplo

Solo para una base local de demostración aislada, cuyo contenido pueda modificarse, cargue los datos desde la raíz del proyecto. No ejecute el seed sobre la base de pruebas que debe conservarse ni sobre producción:

```powershell
pnpm --filter @natillera/backend prisma:seed
```

### Credenciales de muestra:

- Administrador: `admin@natillera.local` / `Admin123*`
- Socio: `ana@socios.local` / `Socio123*`

## Control de acceso por rol

- `ADMINISTRADOR`: CRUD completo de socios, usuarios, ahorros, préstamos, pagos, actividades, rifas, deudas, liquidaciones, vigencias y reportes.
- `SOCIO`: solo consulta de su perfil, ahorros, préstamos, pagos, rifas, participaciones, deudas, ganancias y liquidaciones.
- Las consultas REST filtran por `memberId` cuando el usuario autenticado tiene rol `SOCIO`.
- Las rutas administrativas están protegidas en frontend y backend.
- Las eliminaciones son lógicas mediante `deletedAt` y `deletedBy`; no se realizan borrados físicos.
- Todas las operaciones administrativas quedan registradas en la tabla `auditoria`.

### Matriz resumida

| Módulo | Administrador | Socio |
|---|---|---|
| Socios | CRUD completo | Solo perfil propio |
| Ahorros | CRUD completo | Solo lectura propia |
| Préstamos y pagos | CRUD completo | Solo lectura propia |
| Actividades | CRUD completo | Solo participaciones propias |
| Rifas | CRUD completo | Solo número propio y resultados propios |
| Deudas | Consulta calculada | Solo lectura propia |
| Liquidaciones | Ejecutar y consultar | Solo lectura propia |
| Reportes | Todos | Solo personales |
| Usuarios y vigencias | CRUD completo | Sin acceso |

## Administración de usuarios, roles y permisos

### Administración de usuarios

La sección **Usuarios** está disponible para administradores desde el menú lateral. Permite:

- Crear cuentas con nombres, apellidos, documento, correo, nombre de usuario, contraseña y rol.
- Vincular una cuenta `SOCIO` a un perfil existente para aplicar el aislamiento de datos.
- Editar datos de cuenta y asignar/cambiar el rol.
- Desactivar, reactivar, bloquear y desbloquear cuentas.
- Restablecer la contraseña; al hacerlo se revocan los refresh tokens vigentes.
- Consultar fecha de creación y último acceso, además del historial de intentos de inicio de sesión.

El inicio de sesión acepta correo electrónico o nombre de usuario. Cinco intentos fallidos bloquean temporalmente la cuenta durante 15 minutos. El administrador también puede bloquearla hasta reactivarla. La contraseña nunca se devuelve por la API; solo se almacena como hash bcrypt.

### Permisos dinámicos

La sección **Roles y permisos** permite seleccionar `ADMINISTRADOR` o `SOCIO`, copiar una matriz desde el otro rol y configurar por módulo las acciones **Ver, Consultar, Crear, Editar, Eliminar, Aprobar, Exportar e Imprimir**. También permite controlar la visibilidad de campos disponibles por módulo.

Las reglas se almacenan en `permiso_rol` y `permiso_campo_rol`. Cada cambio genera una entrada en `auditoria` con el rol, módulo/campo, acción y valores anterior/nuevo. El historial puede consultarse desde la misma pantalla.

La navegación consulta los permisos configurados y oculta los módulos no autorizados. Además, el backend valida el permiso antes de procesar las rutas REST, por lo que ocultar un menú no es la única medida de seguridad. Las consultas de socios filtran por el `memberId` obtenido de la cuenta autenticada; campos restringidos se omiten de las respuestas de la API. Los roles `SOCIO` solo tienen lectura predeterminada en sus módulos personales.

### Migrar una base existente desde pgAdmin 4

El siguiente script es histórico. No lo ejecute sobre una base existente sin la revisión y el plan de preservación descritos en la sección de producción:

```text
database/migracion_usuarios_permisos.sql
```

Para regenerar el cliente sin modificar el esquema y arrancar el backend local:

```powershell
pnpm --filter @natillera/backend prisma:generate
pnpm --filter @natillera/backend dev
```

Si la base todavía conserva nombres de tablas en inglés, `database/migracion_nombres_espanol.sql` también requiere revisión previa. Consulte [docs/CREACION_BASE_DATOS.md](docs/CREACION_BASE_DATOS.md).

La matriz de permisos actualmente se configura por rol; todavía no hay excepciones individuales por usuario ni administración de grupos arbitrarios. Los permisos Exportar e Imprimir se almacenan en la matriz; las funciones de generación/impresión de archivos deben implementarse en los módulos que las requieran.

## Git Flow

Use `main` para producción, `develop` para integración y ramas `feature/*`, `release/*` y `hotfix/*`.

## Notas:
## Iniciar Backend
- Abre una terminal y ejecuta: cd backend
- luego: pnpm dev

## Iniciar Frontend
Abre otra terminal.

- Ve al frontend: cd frontend
- Instala dependencias si es la primera vez: pnpm install
- Luego ejecuta: pnpm dev
- Vite mostrará algo parecido a:
Plain Text
Local:
http://localhost:5173
