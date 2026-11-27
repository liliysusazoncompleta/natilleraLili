export const helpGuides = [
  {
    id: "navegar", title: "¿Cómo navego por la aplicación?", keywords: "menu navegacion inicio pantalla movil celular opciones permisos acceso",
    category: "Primeros pasos", screen: "Menú principal", example: ["Dashboard", "Mi perfil", "Ayuda"],
    steps: ["Use el menú lateral para abrir un módulo. En un celular, pulse el icono de menú en la parte superior.", "Solo se muestran los módulos disponibles para su cuenta. Algunas acciones y campos pueden estar restringidos.", "Seleccione Ayuda para volver a consultar las guías."],
    note: "Si necesita acceso a un módulo, solicítelo al administrador."
  },
  {
    id: "clave", title: "¿Cómo cambio mi contraseña?", keywords: "clave contrasena temporal cambiar perfil password iniciar sesion",
    category: "Cuenta", path: "/perfil", screen: "Mi perfil", example: ["Mi perfil", "Cambiar contraseña", "Contraseña actual · Nueva contraseña · Confirmar"],
    steps: ["Abra Mi perfil y pulse Cambiar contraseña.", "Escriba su contraseña actual y la nueva contraseña dos veces; debe tener al menos 8 caracteres.", "Guarde e inicie sesión nuevamente con la nueva contraseña."],
    note: "Puede cambiarla en cualquier momento, incluso si su cuenta aún no tiene un perfil de socio asociado."
  },
  {
    id: "vinculo", title: "¿Por qué mi cuenta no tiene un perfil de socio?", keywords: "usuario sin perfil socio asociado vincular cuenta error",
    category: "Cuenta", path: "/perfil", screen: "Mi perfil", example: ["Mi perfil", "Sin perfil de socio asociado", "Cambiar contraseña"],
    steps: ["Pida al administrador que vincule su cuenta con el perfil de socio correspondiente.", "Mientras no esté vinculado, puede cambiar su contraseña, pero no consultar información financiera.", "Una vez vinculado, vuelva a abrir el módulo que necesita."]
  },
  {
    id: "resumen", title: "¿Dónde veo mi resumen y mis rifas pendientes?", keywords: "dashboard inicio resumen ahorros cuota rifa pendiente participacion ganancias liquidacion",
    category: "Consultas", module: "dashboard", path: "/dashboard", screen: "Dashboard", example: ["Mi resumen financiero", "Mi ahorro acumulado", "Mis rifas de la vigencia"],
    steps: ["Abra Dashboard desde el menú.", "Revise los indicadores y la sección de rifas de la vigencia.", "Una cuota pendiente puede impedir su participación; algunos campos dependen de la configuración de permisos."],
    note: "Los datos y campos reales dependen de su cuenta y sus permisos."
  },
  {
    id: "ahorros", title: "¿Cómo consulto mis ahorros?", keywords: "ahorro aportes consignaciones saldo dinero",
    category: "Consultas", module: "ahorros", path: "/ahorros", screen: "Ahorros", example: ["Ahorros", "Buscar · Vigencia", "Fecha · Monto · Observación"],
    steps: ["Abra Ahorros desde el menú.", "Use los filtros disponibles para encontrar los registros.", "Revise los valores y observaciones que tenga autorización para consultar."]
  },
  {
    id: "deudas", title: "¿Dónde consulto mis deudas y saldos pendientes?", keywords: "deuda cartera pendiente actividad venta producto rifa prestamo cuota saldo abono",
    category: "Consultas", module: "deudas", path: "/deudas", screen: "Deudas y cartera", example: ["Deudas y cartera", "Pendientes por socio y concepto", "Actividad · Venta · Rifa · Préstamo"],
    steps: ["Abra Deudas desde el menú.", "Busque la sección Pendientes por socio y concepto.", "Revise el concepto y el saldo. Si necesita registrar un pago, contacte al administrador."],
    note: "Los pendientes por ventas permanecen registrados hasta que se abonen."
  },
  {
    id: "prestamos", title: "¿Cómo consulto préstamos y pagos?", keywords: "prestamo credito deuda interes capital pago abono historial",
    category: "Consultas", module: "prestamos", path: "/prestamos", screen: "Préstamos", example: ["Préstamos", "Buscar prestatario · Estado", "Capital · Saldo · Interés"],
    steps: ["Abra Préstamos para consultar los registros disponibles.", "Utilice los filtros y revise el capital, el saldo y el estado.", "Si tiene acceso a Pagos, allí puede consultar el historial de abonos."]
  },
  {
    id: "participacion", title: "¿Cómo consulto mi participación en una actividad?", keywords: "actividad participante abono observaciones pago ganancias participacion",
    category: "Actividades", module: "actividades", path: "/actividades", screen: "Actividades", example: ["Actividades", "Actividad de ejemplo", "Ver participantes · Ventas"],
    steps: ["Abra Actividades y busque la actividad.", "Pulse Ver participantes para revisar su participación y los datos disponibles.", "Pulse Ver abonos para consultar el historial y sus observaciones. Si tiene un saldo pendiente, solicite al administrador su registro."],
    note: "Las ganancias positivas de una actividad se asignan a quienes participaron, según las reglas de la vigencia."
  },
  {
    id: "rifa-socio", title: "¿Cómo consulto el estado de mi rifa?", keywords: "rifa sorteo mes fecha numero ganador cuota pago pendiente participar",
    category: "Rifas", module: "rifas", path: "/rifas", screen: "Rifas mensuales", example: ["Rifas mensuales", "Mes del sorteo", "Estado de mi pago"],
    steps: ["Abra Rifas y seleccione el mes del sorteo.", "Revise la fecha y el estado de su pago.", "Para participar debe tener la cuota al día; si encuentra un error, contacte al administrador."]
  },
  {
    id: "liquidacion", title: "¿Cómo consulto mi liquidación?", keywords: "liquidacion cierre ano vigencia ahorro descuento ganancias final",
    category: "Consultas", module: "liquidaciones", path: "/liquidaciones", screen: "Liquidaciones", example: ["Liquidaciones", "Buscar · Vigencia", "Ahorros · Descuentos · Valor final"],
    steps: ["Abra Liquidaciones y revise los registros disponibles.", "Consulte los campos visibles para su cuenta, incluidos los premios o repartos mensuales de rifas autorizados.", "Las cuotas de rifa impagas se descuentan primero de las ganancias y luego del ahorro; si el saldo no alcanza, queda pendiente."]
  },
  {
    id: "liquidacion-admin", title: "¿Cómo calculo y cierro una liquidación?", keywords: "liquidacion liquidar vigencia cierre vista previa interes rifa comision descuento",
    category: "Administración", role: "ADMINISTRADOR", module: "liquidaciones", path: "/liquidaciones", screen: "Liquidaciones",
    example: ["Liquidaciones", "Vigencia · Calcular vista previa", "Revisar valores · Liquidar y cerrar vigencia"],
    steps: ["Seleccione la vigencia y pulse Calcular vista previa. Se actualizan los intereses causados, sin aplicar descuentos.", "Revise los valores de cada socio, los avisos y los bloqueos. Los sorteos abiertos no tienen distribuciones incluidas; actividades y ventas pendientes no se descuentan.", "Pulse Liquidar y cerrar vigencia y confirme. Si los datos cambiaron, vuelva a calcular la vista previa."],
    note: "La operación de cierre no se puede deshacer desde la aplicación. Vincule el perfil de socio activo al usuario administrador si tiene una comisión de rifa asignada."
  },
  {
    id: "usuarios", title: "¿Cómo creo un usuario y vinculo un socio?", keywords: "crear usuario cuenta clave temporal socio perfil vincular administrador",
    category: "Administración", role: "ADMINISTRADOR", module: "usuarios", path: "/usuarios", screen: "Administración de usuarios", example: ["Administración de usuarios", "Crear usuario", "Nombres · Usuario · Contraseña temporal · Rol"],
    steps: ["Abra Usuarios y pulse Crear usuario.", "Complete los datos y asigne una contraseña temporal de al menos 8 caracteres. No necesita vincular un socio al crear la cuenta.", "Para asociar un perfil después, pulse Editar en el usuario y seleccione un perfil disponible."],
    note: "Comparta la contraseña por un medio seguro. El usuario podrá cambiarla desde Mi perfil."
  },
  {
    id: "permisos", title: "¿Cómo configuro los permisos de un socio?", keywords: "roles permisos acceso campo visibilidad ganancias configurar socio",
    category: "Administración", role: "ADMINISTRADOR", module: "configuracion", path: "/configuracion/permisos", screen: "Roles y permisos", example: ["Roles y permisos", "Rol: Socio", "Módulos · Acciones · Campos visibles"],
    steps: ["Abra Roles y permisos y seleccione el rol.", "Configure las acciones permitidas y la visibilidad de los campos, por ejemplo ganancias.", "Guarde los cambios. La API verifica los permisos al consultar o modificar datos."],
    note: "La disponibilidad de algunas acciones también depende del rol y del estado del registro."
  },
  {
    id: "actividad-admin", title: "¿Cómo registro una actividad y sus participantes?", keywords: "crear registrar modificar actividad participantes costo valor abono observaciones",
    category: "Actividades", role: "ADMINISTRADOR", module: "actividades", path: "/actividades", screen: "Actividades", example: ["Actividades", "Registrar actividad", "Registrar participantes · Modificar"],
    steps: ["Abra Actividades y pulse Registrar actividad. Indique la vigencia, fecha y valor por participante.", "En la fila de la actividad pulse Registrar participantes, seleccione los socios y guarde.", "En participantes, use Registrar abono para anotar el valor y las observaciones; puede consultar el historial.", "Use Modificar para editar la actividad cuando la vigencia esté abierta."],
    note: "No se puede retirar a participantes con abonos ni bajar el valor por debajo de lo abonado."
  },
  {
    id: "ventas", title: "¿Cómo registro productos y ventas de una actividad?", keywords: "venta producto costo precio cantidad compra actividad abono catalogo",
    category: "Actividades", role: "ADMINISTRADOR", module: "actividades", path: "/actividades", screen: "Ventas de la actividad", example: ["Ventas", "Administrar productos", "Socio · Producto · Cantidad · Abono"],
    steps: ["En Actividades, abra Ventas de la actividad y después Administrar productos.", "Registre cada producto, su costo y precio de venta.", "Regrese a Ventas, seleccione el socio y producto, e ingrese cantidad y abono; el total se calcula automáticamente.", "Registre abonos posteriores desde Ventas y consulte los saldos en Deudas."],
    note: "Un comprador no necesita ser participante. Los cambios de precio no alteran ventas anteriores."
  },
  {
    id: "rifa-admin", title: "¿Cómo configuro y cierro un sorteo mensual?", keywords: "rifa sorteo calendario fecha configurar valor pago anular ganador recaudo administradores",
    category: "Rifas", role: "ADMINISTRADOR", module: "rifas", path: "/rifas", screen: "Rifas mensuales", example: ["Rifas mensuales", "Configurar valor y calendario", "Registrar pago · Modificar fecha · Cerrar sorteo"],
    steps: ["En Rifas, seleccione una vigencia abierta y pulse Configurar valor y calendario.", "Seleccione el mes y registre los pagos. Si se equivocó, anule el pago antes del sorteo.", "Mientras el sorteo esté abierto, puede modificar su fecha. Al llegar la fecha, pulse Cerrar sorteo e indique el número ganador o déjelo vacío si no hubo ganador.", "Consulte el recaudo y la distribución estimada antes del cierre o la definitiva después."],
    note: "El 3 % del recaudo se asigna a administradores; el resto corresponde al ganador o a participantes elegibles si no hay ganador. Un sorteo cerrado no se puede reabrir."
  },
  {
    id: "prestamo-admin", title: "¿Cómo registro un préstamo y un socio avalista?", keywords: "crear registrar prestamo credito deudor socio particular aval avalista porcentaje tasa interes",
    category: "Administración", role: "ADMINISTRADOR", module: "prestamos", path: "/prestamos", screen: "Préstamos", example: ["Préstamos", "Nuevo registro", "Tipo de deudor · Vigencia · Socio avalista · Tasa mensual"],
    steps: ["Abra Préstamos y pulse Nuevo registro. Seleccione el tipo de deudor y la vigencia abierta.", "Para un socio seleccione el socio deudor. Para un particular escriba su nombre y seleccione un socio activo como avalista.", "Ingrese el monto, la tasa mensual y los días desde el desembolso para el primer interés; luego guarde.", "Consulte los intereses generados y pendientes. Use Modificar para corregir las condiciones antes de pagos o intereses causados.", "Registre los abonos en Pagos. El saldo del préstamo particular se muestra como deuda del avalista."],
    note: "El primer interés se genera al cumplirse los días indicados y después cada mes. Una vez haya pagos o intereses causados solo se pueden cambiar observaciones en una vigencia abierta."
  },
  {
    id: "pago-admin", title: "¿Cómo registro un pago de préstamo?", keywords: "nuevo pago prestamo credito capital interes anular editar",
    category: "Administración", role: "ADMINISTRADOR", module: "pagos", path: "/pagos", screen: "Pagos de préstamos", example: ["Pagos de préstamos", "Nuevo pago", "Préstamo · Valor · Fecha · Observaciones"],
    steps: ["Abra Pagos y pulse Nuevo pago.", "Seleccione el préstamo, escriba el valor, la fecha y las observaciones, y guarde.", "El pago cubre primero intereses pendientes y luego capital. Si es necesario, use Editar o Anular en el registro."]
  },
  {
    id: "vigencia", title: "¿Cómo configuro una vigencia y su recaudo?", keywords: "crear vigencia año periodo frecuencia recaudo 15 30 fecha inicio ultimo pago",
    category: "Administración", role: "ADMINISTRADOR", module: "vigencias", path: "/vigencias", screen: "Vigencias", example: ["Vigencias", "Nuevo registro", "Frecuencia de recaudo · Fecha de inicio · Fecha del último pago"],
    steps: ["Abra Vigencias desde el menú y pulse Nuevo registro.", "Indique el año, seleccione recaudo cada 15 o cada 30 días y defina la fecha de inicio y la fecha del último pago.", "Guarde la configuración. Puede usar Modificar para actualizar las fechas o la frecuencia de una vigencia existente.", "Al registrar un ahorro, seleccione socio y vigencia para consultar la fecha de su ahorro más reciente."],
    note: "Las fechas son una configuración informativa; la aplicación no genera pagos automáticamente. Ambas fechas deben estar dentro del año de la vigencia."
  }
];

export function visibleGuides(role, permissions) {
  return helpGuides.filter((guide) => {
    if (guide.role && guide.role !== role) return false;
    if (role === "ADMINISTRADOR" || !guide.module) return true;
    return permissions?.[guide.module]?.consultar === true;
  });
}

const stopWords = new Set("como donde que cual cuales quiero puedo necesito saber para por favor mis mi me de del la el los las un una en y es se al su ver consultar".split(" "));
function words(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+/g) || [];
}

export function searchGuides(guides, question) {
  const terms = [...new Set(words(question).filter((word) => word.length > 2 && !stopWords.has(word)))];
  if (!terms.length) return [];
  return guides.map((guide) => {
    const title = words(guide.title);
    const keywords = words(guide.keywords);
    const match = (word, term) => word === term || (term.length >= 4 && word.startsWith(term)) || (word.length >= 4 && term.startsWith(word));
    const score = terms.reduce((sum, term) => sum + (title.some((word) => match(word, term)) ? 3 : keywords.some((word) => match(word, term)) ? 1 : 0), 0);
    return { guide, score };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).map(({ guide }) => guide);
}
