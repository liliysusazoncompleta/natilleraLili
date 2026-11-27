# Manual de usuario

## Ingreso

1. Abra el frontend.
2. Inicie sesión con una cuenta activa.
3. Los administradores pueden crear, modificar y cerrar información.
4. Los socios pueden consultar su información correspondiente.

## Centro de ayuda

- Abra **Ayuda** en el menú lateral. En un celular, primero abra el menú con el botón superior.
- Escriba una pregunta, por ejemplo «¿cómo consulto mis deudas?», y pulse **Buscar respuesta**. Seleccione una de las guías relacionadas para ver los pasos y una pantalla ilustrativa. También puede elegir una pregunta frecuente sin buscar.
- Las respuestas provienen de guías preparadas dentro de la aplicación, no de inteligencia artificial. Si no encuentra una respuesta, pruebe otras palabras o consulte al administrador. No introduzca contraseñas ni información personal en el buscador.
- Las guías y sus enlaces dependen del rol y de los permisos de consulta. Si los permisos no se pueden cargar, se muestran solo las guías generales y puede seleccionar **Reintentar**. Las ilustraciones no son pantallas reales ni contienen datos de socios.

## Usuarios y contraseña

- En **Usuarios > Crear usuario**, el administrador asigna una contraseña temporal de al menos 8 caracteres (máximo 72 bytes). No es obligatorio asociar un perfil de socio al crear la cuenta.
- Para vincular posteriormente un perfil existente, edite el usuario socio y selecciónelo en **Perfil de socio asociado**. Un perfil ya vinculado a otra cuenta no se puede asignar.
- Un socio sin perfil asociado puede iniciar sesión y cambiar su contraseña, pero no puede consultar información financiera hasta que el administrador vincule su perfil.
- En **Mi perfil > Cambiar contraseña**, ingrese la contraseña actual y la nueva dos veces. Después de guardarla, inicie sesión nuevamente con la nueva contraseña. No se obliga a cambiarla en el primer ingreso.
- El cambio revoca los tokens de renovación de la cuenta. Los tokens de acceso ya emitidos pueden seguir siendo válidos hasta su vencimiento (15 minutos por defecto).

## Operación diaria

- Registre aportes desde Ahorros.
- En **Vigencias**, indique el año, la frecuencia de recaudo (cada 15 o cada 30 días), la fecha de inicio y la fecha límite del último pago. Las fechas deben estar dentro del año elegido; la configuración no crea pagos automáticamente. Puede editar una vigencia para cambiar estos datos.
- Al crear un ahorro, seleccione la vigencia y el socio para ver la fecha de su último ahorro registrado en esa vigencia.
- En **Préstamos > Nuevo registro**, seleccione el tipo de deudor y una vigencia abierta. Para un socio, seleccione al socio deudor; para un particular, registre su nombre y elija el socio avalista activo de esa vigencia. Ingrese el monto y la tasa mensual acordada, que puede ser distinta del 5 % o 10 %.
- Indique los días transcurridos desde el desembolso para el primer interés. Por ejemplo, cinco días después del 10 de enero es el 15 de enero; los siguientes intereses se generan mensualmente a partir de esa fecha. Consulte tanto los intereses generados como los pendientes en la lista de préstamos.
- Use **Modificar** para corregir las condiciones antes de que haya pagos o intereses causados. Después solo se pueden cambiar observaciones, mientras la vigencia esté abierta. Los préstamos anteriores mantienen su calendario original si no se modifica expresamente.
- El saldo del préstamo particular aparece como **Préstamo avalado** en las deudas del socio avalista. Los pagos reducen el saldo; si queda pendiente en la liquidación, se aplican los descuentos de préstamos vigentes. Los préstamos históricos se conservan.
- Registre abonos de préstamos desde **Pagos > Nuevo pago**.
- En **Deudas**, el total abonado de cada préstamo es la suma de sus pagos registrados no anulados, incluidos los descuentos contabilizados como pago. Si aparece un aviso de diferencia histórica, solicite revisar los movimientos; el sistema no inventa pagos faltantes.
- Cree una actividad desde **Actividades**, indique el valor individual a pagar y use **Registrar participantes** para seleccionar a los socios activos de la vigencia.
- Registre uno o varios abonos por cada participante. La pantalla informa el valor a pagar, el total abonado, el saldo y el estado de pago; no se puede abonar más que el saldo pendiente.
- Edite la actividad mientras la vigencia esté abierta. No se puede disminuir el costo individual por debajo de un abono recibido ni retirar participantes con abonos registrados.
- Las ganancias netas positivas se asignan solo a quienes participaron, de acuerdo con sus ahorros; si no tienen ahorros, se reparten por partes iguales. El saldo pendiente del costo no elimina el derecho a ganancias.
- En **Actividades > Ventas > Administrar productos**, registre por anticipado cada producto, su costo y precio unitario. Para registrar una venta, seleccione el socio y producto e ingrese la cantidad y el abono inicial; el valor adquirido se calcula automáticamente. Al modificar un producto, las ventas anteriores conservan sus precios.
- En **Ventas** de la actividad registre cada producto vendido, su cantidad, costo y precio unitarios, el socio comprador y, si corresponde, un abono inicial. Un comprador puede no ser participante; registrar participantes no genera compras.
- Las ventas y sus costos se suman automáticamente a los otros ingresos y costos de la actividad para calcular las ganancias, incluso si hay saldo pendiente. No vuelva a incluirlos en los campos generales. Se pueden editar ventas en una vigencia abierta y eliminar únicamente las que no tienen abonos; el comprador no se modifica.
- Registre abonos posteriores desde **Ventas**, incluso después del cierre. Los saldos aparecen en **Deudas y cartera**, por socio y con el producto y la actividad como concepto. Los saldos de ventas no se descuentan automáticamente en la liquidación y permanecen pendientes hasta abonarse.
- Configure el valor y las fechas de Rifas mensuales; marque cada cuota como pagada antes del sorteo. Si un pago se registra por error, anúlelo antes de la fecha del sorteo para que vuelva a quedar pendiente.
- En una vigencia abierta, vuelva a **Configurar valor y calendario** para agregar sorteos o modificar fechas abiertas. Un nuevo valor solo aplica a sorteos agregados; las cuotas existentes no cambian. El administrador puede consultar el recaudo y reparto estimados antes del cierre y los valores reales después.
- Cierre cada sorteo en su fecha programada o después y registre el número ganador, o déjelo vacío si no hubo ganador. Un sorteo cerrado no se puede reabrir.
- Cree una vigencia antes de iniciar el año.

## Liquidación

1. Como administrador, abra **Liquidaciones**, seleccione la vigencia y pulse **Calcular vista previa**. La consulta actualiza los intereses causados, pero no aplica descuentos ni cierra la vigencia.
2. Revise por socio el ahorro, ganancias de actividades, intereses de préstamos, premios y repartos de rifas, comisiones, descuentos, saldos pendientes y valor a entregar. Las ganancias de actividades corresponden a sus participantes. Los intereses se reparten según el ahorro, incluidos los cobrados mediante descuentos en el mismo cierre.
3. El 3 % anual para socios administradores se descuenta de las ganancias de actividades e intereses. Las distribuciones de rifas cerradas se suman al destinatario tal como quedaron registradas, incluida la comisión mensual, sin calcularla de nuevo.
4. Las cuotas de rifa impagas se descuentan primero de las ganancias y luego del ahorro; después se descuentan los préstamos. Si no alcanza, el saldo queda pendiente. Los saldos de actividades y ventas se muestran en la vista previa y no se descuentan automáticamente.
5. Si hay un aviso de sorteos abiertos, decida si desea cerrarlos antes de liquidar: las distribuciones que no existen al cierre no se incluirán. Si hay bloqueos, revise los registros indicados. Una comisión de rifa asignada a un administrador exige que su usuario esté vinculado a un socio activo de la vigencia; puede vincularlo desde **Usuarios > Editar**. En una rifa histórica sin distribuciones ni recaudo registrado, se suma el premio al ganador registrado; otros casos históricos con valor sin distribuciones requieren revisión administrativa. Los préstamos pendientes de otra vigencia deben pagarse por separado antes de liquidar para evitar contabilizar sus intereses dos veces.
6. Pulse **Liquidar y cerrar vigencia** y confirme. Esta operación registra los descuentos y no se puede deshacer desde la aplicación. Si los datos cambian entre la vista previa y la confirmación, calcule una nueva vista previa. Los socios solo consultan sus liquidaciones y campos permitidos.

La API exige primero `GET /api/liquidaciones/:vigenciaId/preview` y después `POST /api/liquidaciones/:vigenciaId` con el `fingerprint` recibido. Las liquidaciones históricas no se modifican.

En el Dashboard, el valor a entregar solo se muestra para una vigencia seleccionada y ya liquidada. Antes del cierre, consulte la estimación detallada en **Liquidaciones**; para el socio, las ganancias y el valor registrado aparecen una vez liquidada la vigencia y según sus permisos.
