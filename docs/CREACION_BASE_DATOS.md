# Creación de la base de datos

> **Bases existentes:** las instrucciones y scripts históricos de este documento no autorizan su ejecución directa. Antes de cualquier cambio de esquema, seed o registro de migraciones, verifique un respaldo restaurable, compare el esquema y el historial completos y acuerde un plan de preservación probado en una copia aislada. No use `migrate dev`, `migrate deploy`, `migrate resolve` ni `db push` mientras exista drift o se desconozca el historial. No reinicie ni vacíe la base de pruebas.

## Filtros de consulta

Las consultas de la aplicación aceptan parámetros opcionales para buscar y reducir resultados sin modificar el esquema:

- `search`: texto general.
- `memberId`: socio.
- `vigenciaId`: vigencia.
- `status`: estado.
- `date`: fecha exacta en formato `AAAA-MM-DD`.
- `role`: rol de usuario.
- `loanId`: préstamo asociado.

Estos filtros se aplican en vigencias, socios, ahorros, préstamos, pagos, actividades, rifas, deudas, usuarios, liquidaciones y reportes. Las consultas de usuarios con rol `SOCIO` siguen restringidas por su `memberId` autenticado; ningún parámetro permite consultar datos de otros socios.

La base de datos PostgreSQL contiene vigencias, usuarios, socios, ahorros, préstamos, pagos, actividades, participantes, rifas, calendario y cuotas mensuales individuales, distribuciones, deudas, liquidaciones y auditoría.

## Requisitos

- PostgreSQL 14 o superior.
- pgAdmin 4.
- Node.js 22.12 o superior y pnpm 10.

## Crear la base de datos con pgAdmin

1. Abra **pgAdmin 4** y conéctese al servidor PostgreSQL local.
2. En el panel izquierdo, haga clic derecho sobre **Databases**.
3. Seleccione **Create > Database**.
4. En la pestaña **General**, escriba `natillera` en el campo **Database**.
5. Si corresponde, seleccione el propietario PostgreSQL.
6. Pulse **Save**.
7. Abra la base `natillera` creada.
8. Haga clic derecho sobre `natillera` y seleccione **Query Tool**.
9. Abra el script desde **File > Open**.
10. Para crear todo el esquema en una base vacía, seleccione `database/schema.sql`. Este archivo aplica la migración inicial y los cambios incrementales del proyecto.
11. Pulse **Execute/Run** o use `F5`.
12. Confirme que el panel de mensajes indique que la ejecución finalizó sin errores.

También puede copiar manualmente el contenido de `database/schema.sql` y pegarlo en el Query Tool antes de ejecutarlo.

La historia Prisma parte de una migración inicial y aplica cambios posteriores. Está destinada únicamente a una base vacía. Para nuevas instalaciones de producción, se recomienda aplicar y registrar todas las migraciones con `pnpm --filter @natillera/backend exec prisma migrate deploy` en vez de ejecutar el SQL manualmente; así se mantiene sincronizada la tabla de historial de Prisma.

Si se creó una base con `database/schema.sql` y se quiere administrar con Prisma, no marque migraciones como aplicadas por el solo hecho de que el script terminara correctamente. El historial debe reconciliarse únicamente después de comparar el esquema completo y validar un plan específico sin pérdida de datos.

### Comprobar las tablas creadas

En el Query Tool de pgAdmin ejecute:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Las tablas esperadas, con nombres en español, incluyen:

- `usuario`
- `permiso_rol`
- `permiso_campo_rol`
- `historial_acceso`
- `token_actualizacion`
- `vigencia`
- `socio`
- `ahorro`
- `actividad`
- `actividad_participante`
- `prestamo`
- `pago_prestamo`
- `rifa`
- `distribucion_rifa`
- `programa_rifa`
- `rifa_mensual`
- `pago_rifa_mensual`
- `distribucion_rifa_mensual`
- `deuda`
- `liquidacion`
- `auditoria`

## Actualizar una base existente desde pgAdmin 4

Si ya tiene una base creada con los nombres anteriores en inglés (por ejemplo, `"User"`, `"Member"` o `"Saving"`), **no ejecute `database/schema.sql` para actualizarla**. Ese archivo es para crear una base nueva. Para conservar los registros existentes, use el script de migración, que renombra las tablas y columnas en el mismo sitio.

### 1. Hacer una copia de seguridad

1. En pgAdmin, haga clic derecho sobre la base `natillera`.
2. Seleccione **Backup...**.
3. Elija un nombre de archivo y un formato, por ejemplo `natillera_antes_nombres_espanol.backup` con formato **Custom**.
4. Pulse **Backup** y confirme que pgAdmin indique que terminó correctamente.

No continúe si no tiene una copia válida.

### 2. Ejecutar el script de migración

1. Conéctese a la base `natillera` en pgAdmin.
2. Haga clic derecho en la base y abra **Query Tool**.
3. En Query Tool, seleccione **File > Open** y abra `database/migracion_nombres_espanol.sql`.
4. Revise que el Query Tool esté conectado a `natillera`, no a otra base.
5. Pulse **Execute/Run** o `F5`.
6. Revise **Messages**: la ejecución debe terminar sin errores.

La migración renombra tablas, columnas y tipos ENUM. No elimina ni vuelve a insertar los datos. Puede ejecutarse otra vez: los renombres que ya se hicieron se omiten.

### 3. Verificar los nombres y los registros

En Query Tool ejecute:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Confirme que aparecen las tablas `usuario`, `socio`, `ahorro`, `prestamo`, `pago_prestamo`, `actividad`, `rifa`, `deuda`, `liquidacion` y `auditoria`.

Para verificar las columnas de socios:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'socio'
ORDER BY ordinal_position;
```

Para comparar el total de registros con el respaldo o el valor anterior a migrar:

```sql
SELECT
  (SELECT COUNT(*) FROM "socio") AS cantidad_socios,
  (SELECT COUNT(*) FROM "ahorro") AS cantidad_ahorros,
  (SELECT COUNT(*) FROM "prestamo") AS cantidad_prestamos;
```

### 4. Actualizar y reiniciar el backend

En la carpeta del proyecto, regenere el cliente Prisma y reinicie el backend para que use el esquema actualizado:

```powershell
pnpm --filter @natillera/backend prisma:generate
pnpm --filter @natillera/backend dev
```

El backend utiliza los nombres lógicos existentes en el código y Prisma los traduce a los nombres físicos en español mediante `@map` y `@@map`.

## Agregar administración de usuarios y permisos

Si la base ya está creada con las tablas en español, ejecute esta migración para agregar estado de cuenta, nombre de usuario, historial de acceso y permisos dinámicos:

1. Haga un respaldo desde **Backup...** en pgAdmin.
2. Abra **Query Tool** conectado a `natillera`.
3. Abra `database/migracion_usuarios_permisos.sql`.
4. Ejecute con **F5** y confirme que no haya errores en **Messages**.
5. En una terminal en la raíz del proyecto, ejecute:

```powershell
pnpm --filter @natillera/backend prisma:generate
```

6. Reinicie el backend y vuelva a iniciar sesión.

Esta migración no borra los usuarios existentes. Les asigna un nombre de usuario derivado de su correo y un sufijo del ID. Las tablas `permiso_rol` y `permiso_campo_rol` guardan la configuración administrable; si todavía no hay reglas guardadas, la aplicación utiliza los permisos predeterminados.

### Si la base ya tiene algunos nombres en español

El script comprueba la existencia de cada tabla y columna antes de renombrarla. Si un objeto ya tiene el nombre final, no lo vuelve a renombrar. Si pgAdmin reporta que falta un tipo o una tabla, detenga el proceso y verifique el esquema actual antes de modificarlo manualmente.

## Actualizar pagos, intereses y deudas desde pgAdmin 4

Para una base ya existente con las tablas en español:

1. Haga un respaldo de `natillera` desde **Backup...** en pgAdmin.
2. Conéctese a `natillera` y abra **Query Tool**.
3. Use **File > Open** y seleccione `database/migracion_pagos_deudas.sql`.
4. Verifique que está conectado a la base correcta y ejecute con **F5**.
5. Revise **Messages** para confirmar que no hubo errores.
6. Desde PowerShell, en la raíz del proyecto, regenere Prisma:

```powershell
pnpm --filter @natillera/backend prisma:generate
```

7. Reinicie el backend y vuelva a cargar el frontend.

Esta migración agrega saldos e intereses acumulados al préstamo y trazabilidad a los pagos; completa los saldos anterior/nuevo de los pagos existentes. No elimina registros. Los intereses se empiezan a calcular desde la fecha de ejecución de la migración para evitar cargos retroactivos. En una instalación nueva, `database/schema.sql` ya incluye las columnas y estados requeridos y no se debe ejecutar esta migración.

Los registros históricos de la tabla `deuda` se conservan, pero la aplicación deja de utilizarlos porque la cartera se calcula desde los préstamos. No se convierten automáticamente: confirme su origen antes de migrar un saldo manual a un préstamo.

Para comprobar las nuevas columnas, en **Query Tool** ejecute:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('prestamo', 'pago_prestamo')
ORDER BY table_name, ordinal_position;
```

## Correspondencia Prisma

El esquema Prisma mantiene los nombres de modelo utilizados por el backend, pero los relaciona con los nombres físicos españoles mediante `@@map` y `@map`. Así, PostgreSQL usa tablas y columnas en español sin alterar la API del backend.

### Comprobar una tabla y sus restricciones

Para revisar la estructura de una tabla:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'socio'
ORDER BY ordinal_position;
```

Para revisar claves primarias y foráneas:

```sql
SELECT conname, contype
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conname;
```

## Opción 1: Script SQL directo

### 1. Crear la base de datos

```sql
CREATE DATABASE natillera
  WITH ENCODING 'UTF8';
```

Desde PowerShell:

```powershell
psql -U postgres -c "CREATE DATABASE natillera;"
psql -U postgres -d natillera -f "database/schema.sql"
```

El script crea los tipos ENUM, tablas, claves primarias y foráneas, índices y restricciones.

## Opción 2: Prisma Migrate

Configure PostgreSQL en `.env`:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/natillera"
```

Ejecute:

```powershell
pnpm install
pnpm --filter @natillera/backend prisma:generate
pnpm --filter @natillera/backend prisma:migrate
pnpm --filter @natillera/backend prisma:seed
```

Las migraciones y el modelo administrado están en `backend/prisma/schema.prisma`.

## Neon

Use la cadena de conexión SSL proporcionada por Neon:

```dotenv
DATABASE_URL="postgresql://usuario:clave@host.neon.tech/natillera?sslmode=require"
```

Luego ejecute Prisma Generate y la migración o importación del SQL.

## Supabase

Use la cadena de conexión PostgreSQL de Supabase. Para Supabase, también puede importar `database/schema.sql` desde el SQL Editor.

## Datos iniciales

El seed crea:

- Vigencia 2026.
- Usuario `admin@natillera.local`.
- Contraseña `Admin123*`.
- Dos socios de ejemplo.

## Cargar datos iniciales

```powershell
pnpm --filter @natillera/backend prisma:seed
```

## Verificación

Conéctese a PostgreSQL y valide las tablas:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

## Actualizar Rifas por socio y calendario mensual

Para permitir modificar la configuración conservando el valor de sorteos ya creados, haga primero un respaldo y ejecute una vez `database/migracion_valor_rifa_por_sorteo.sql` en pgAdmin, después de las migraciones previas de rifas. El script copia el valor del programa a cada sorteo existente sin modificar pagos ni distribuciones. Detenga el backend, ejecute `pnpm --filter @natillera/backend prisma:generate` y reinícielo. Si usa Prisma Migrate o creó la base con el esquema completo actualizado, no ejecute el script manual. Si registra migraciones manuales en Prisma, verifique el esquema y las migraciones anteriores antes de ejecutar `pnpm --filter @natillera/backend exec prisma migrate resolve --applied 20261125010000_valor_rifa_por_sorteo`.

Para una base ya existente, haga primero un respaldo. Si todavía no cuenta con el calendario mensual, ejecute en pgAdmin 4 > **Query Tool** `database/migracion_rifa_por_socio_y_calendario.sql` una sola vez. Luego ejecute `database/migracion_control_cuotas_rifa.sql`; este segundo script agrega columnas a las tablas existentes `pago_rifa_mensual` y `liquidacion`, sin crear ni eliminar tablas. El archivo `database/migracion_rifa_mensual.sql` es una migración histórica de la tabla de rifas anterior y no prepara el calendario mensual por socio.

Ejecute el contenido completo del archivo en la base `natillera`, no solo la sentencia seleccionada. Si pgAdmin muestra `SQL state: 25P02`, la transacción ya estaba abortada por un error anterior: consulte **Messages** para identificarlo. La migración de cuotas comienza con `ROLLBACK` para limpiar ese estado, comprueba que las tablas requeridas existan y da instrucciones si primero debe ejecutar la migración del calendario.

No ejecute este script en una base vacía creada con el `database/schema.sql` actualizado: el esquema completo ya incorpora estas tablas. Después de migrar una base existente, regenere el cliente Prisma desde PowerShell en la raíz:

```powershell
pnpm --filter @natillera/backend prisma:generate
```

Si administra el historial de la base con Prisma y ejecutó manualmente el nuevo script de cuotas, regístrelo como aplicado antes de usar `prisma migrate deploy`:

```powershell
pnpm --filter @natillera/backend exec prisma migrate resolve --applied 20261124213000_control_cuotas_rifa
```

Hágalo únicamente después de verificar que el script de pgAdmin terminó correctamente y que las migraciones anteriores ya están registradas.

En la interfaz, el administrador configura una sola vez por vigencia el valor por socio y las fechas y horas de los sorteos que se realizarán, interpretadas en la zona horaria de Colombia. Cada fecha puede corresponder a cualquier día del año de la vigencia, aunque no coincida con el mes de su etiqueta. Las fechas son opcionales para cada mes: deje en blanco los meses sin rifa. El sistema crea un sorteo y sus cuotas individuales solo para los meses programados; no genera cuotas en los meses sin rifa. Los miembros activos con rol `SOCIO` reciben cuotas para cada sorteo programado. Un miembro con rol `ADMINISTRADOR` las recibe si registra ahorros en esa vigencia; si comienza a ahorrar cuando ya existe el calendario, solo se crean cuotas para sorteos futuros.

El administrador marca las cuotas como pagadas registrando la recepción estrictamente antes de la fecha/hora del sorteo. Solo participantes activos que pagaron antes de ese límite participan. Si registra un pago por error, puede anularlo antes de la fecha del sorteo; la cuota regresa a pendiente y la operación queda registrada en auditoría. Al cerrar el sorteo, el administrador registra el número ganador; la API verifica que corresponda a un participante habilitado que pagó a tiempo y guarda su identidad junto con el número. También puede cerrar el sorteo indicando que no hubo ganador. En ambos casos el 3% se reparte entre administradores activos; el 97% restante corresponde al ganador o se reparte entre participantes activos que pagaron a tiempo si no hubo ganador. Las distribuciones históricas no se recalculan. El sistema guarda cada asignación y no ejecuta transferencias bancarias. Los socios solo consultan su propia cuota y sus valores individuales.

El sorteo se encuentra abierto hasta su fecha programada; el administrador puede modificar la fecha mientras siga abierto, siempre que la nueva fecha sea futura y pertenezca al año de la vigencia. Puede cerrarlo en la fecha programada o después, y registrar el número ganador o dejarlo vacío si no hubo ganador. Una vez cerrado, el sorteo no se puede reabrir ni modificar.

Al liquidar la vigencia, las cuotas que sigan impagas se descuentan primero de las ganancias del participante y luego de sus ahorros. La migración registra el monto descontado por cuota y añade `rifas_descontadas` a `liquidacion`; un saldo que no pueda cubrirse queda pendiente. El dashboard del socio muestra el estado de cada cuota, incluida la parte cubierta por la liquidación. Desde **Roles y permisos > Dashboard > Campos**, el administrador puede ocultar **Mis ganancias** para el rol SOCIO; si se oculta, el backend omite ese dato de la respuesta y la interfaz no renderiza el indicador.

## Actividades: costo por socio, participantes y abonos

Para registrar ventas de actividades en una base existente, después de respaldarla y aplicar las migraciones anteriores, ejecute una vez `database/migracion_ventas_actividades.sql` en pgAdmin. No lo ejecute si usa `prisma migrate deploy` o si creó la base con el esquema completo actualizado. Si ejecutó el script manualmente y administra el historial con Prisma, verifique su aplicación y marque `20261124233000_ventas_actividades` como aplicada con `prisma migrate resolve --applied`. Regenere el cliente Prisma y reinicie el backend.

### Catálogo previo de productos por actividad

1. Haga un respaldo y abra **Query Tool** conectado a la base correcta en pgAdmin 4.
2. Abra `database/migracion_catalogo_productos_actividad.sql`, ejecute el archivo completo una sola vez con **F5** y compruebe **Messages**. El script crea `producto_actividad` y conserva las ventas existentes.
3. Detenga el backend, regenere el cliente con `pnpm --filter @natillera/backend prisma:generate` y reinicie el backend. En Windows, un backend activo puede bloquear el motor de Prisma.
4. En **Actividades > Ventas > Administrar productos**, registre los productos. Los productos de ventas anteriores no se crean automáticamente en el catálogo.

Si administra la base con Prisma y aplicó manualmente el script, después de verificarlo y registrar las migraciones anteriores, ejecute:

```powershell
pnpm --filter @natillera/backend exec prisma migrate resolve --applied 20261125000000_catalogo_productos_actividad
```

No ejecute este script en una base creada con el esquema completo actualizado ni después de aplicar esta migración con Prisma.

El esquema nuevo (`database/schema.sql`) ya incluye el campo individual `actividad.valor_por_participante` y la tabla `pago_actividad_participante`. Si la base ya existe, respáldela y ejecute en pgAdmin 4 > **Query Tool** el script completo `database/migracion_actividades_participantes.sql`. Este script requiere las tablas `actividad`, `actividad_participante` y `usuario`; conserva los registros y puede repetirse si ya se ejecutó correctamente.

Pasos en pgAdmin:

1. Haga clic derecho en `natillera` y seleccione **Backup...**; confirme que el respaldo finalice correctamente.
2. Abra **Query Tool** conectado a la base `natillera`.
3. Use **File > Open** y abra `database/migracion_actividades_participantes.sql`.
4. Ejecute todo el archivo con **F5** y confirme que no aparezcan errores en **Messages**.
5. En la raíz del proyecto, regenere Prisma y reinicie el backend:

```powershell
pnpm --filter @natillera/backend prisma:generate
pnpm --filter @natillera/backend dev
```

Si Prisma administra el historial de esta base y se aplicó el script manual, registre la migración como aplicada únicamente después de verificar el SQL y confirmar que las migraciones anteriores están registradas:

```powershell
pnpm --filter @natillera/backend exec prisma migrate resolve --applied 20261124223000_activities_participant_payments
```

No ejecute este script en una base vacía creada con `database/schema.sql`, ni en una base donde ya se aplicó esta migración Prisma. La pantalla **Actividades** permite al administrador definir el valor por participante, registrar socios activos, consultar los abonos y saldo, ingresar varios abonos que no superen la deuda, y modificar la actividad mientras la vigencia esté abierta. Las ganancias positivas se asignan solo a participantes; la deuda del costo individual no impide recibirlas.

## Frecuencia y fechas de recaudo por vigencia

En una base existente, haga primero un respaldo y ejecute una vez `database/migracion_fechas_recaudo_vigencia.sql` en pgAdmin. El script agrega a `vigencia` la frecuencia (15 o 30 días), fecha de inicio y fecha límite del último pago; a las vigencias existentes les asigna por defecto cada 30 días y el año calendario completo. No genera pagos ni vencimientos automáticamente. Si usa `prisma migrate deploy` o creó la base con `database/schema.sql` actualizado, no ejecute el script manual.

Después de la migración manual, regenere el cliente Prisma y reinicie el backend. Si administra el historial de migraciones con Prisma, registre `20261126230000_vigencia_recaudo_fechas` como aplicada únicamente después de verificar el SQL y confirmar que las migraciones anteriores están registradas:

```powershell
pnpm --filter @natillera/backend prisma:generate
pnpm --filter @natillera/backend exec prisma migrate resolve --applied 20261126230000_vigencia_recaudo_fechas
```

La configuración se define manualmente al crear o editar una vigencia. Ambas fechas deben pertenecer al año seleccionado y la fecha límite no puede ser anterior a la fecha de inicio.

## Importación del Excel `NATILLERA 2026.xlsm`

La importación completa del libro no está validada y no debe considerarse parte de la creación del esquema. El requisito es insertar datos en las tablas existentes, sin crear tablas adicionales:

- `database/staging_excel_natillera_2026.sql` es un artefacto de análisis anterior que crea tablas temporales de staging. **No lo ejecute** si no desea crear tablas nuevas.
- `database/insert_excel_natillera_2026.sql` no crea tablas, pero solo contiene un préstamo identificado con suficiente certeza; no importa todas las hojas ni todas las cuotas. No representa una migración completa del libro.

Antes de ejecutar cualquier inserción, compare los datos con el Excel original, confirme documentos, fechas, prestatarios y relaciones con socios, y haga un respaldo. Las fechas de algunas cuotas y el significado de ciertos préstamos no quedaron resueltos; insertar los datos sin esa revisión puede asociarlos incorrectamente o duplicarlos. No se debe presentar la carga como completada hasta preparar y verificar los `INSERT` restantes.
