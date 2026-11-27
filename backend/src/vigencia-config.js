function parseDateOnly(value, label) {
  let raw;
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new RangeError(`${label} no es una fecha válida`);
    raw = value.toISOString().slice(0, 10);
  } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
    raw = value.slice(0, 10);
  } else {
    throw new RangeError(`Debe indicar ${label}`);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) throw new RangeError(`Debe indicar ${label}`);

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    throw new RangeError(`${label} no es una fecha válida`);
  }
  return date;
}

export function validateVigenciaConfiguration({ year, collectionFrequencyDays, startDate, lastPaymentDate }) {
  const numericYear = Number(year);
  const frequencyDays = Number(collectionFrequencyDays);
  if (!Number.isInteger(numericYear) || numericYear < 2000 || numericYear > 2100) {
    throw new RangeError("Debe indicar un año de vigencia válido");
  }
  if (![15, 30].includes(frequencyDays)) {
    throw new RangeError("La frecuencia de recaudo debe ser cada 15 o cada 30 días");
  }

  const start = parseDateOnly(startDate, "la fecha de inicio de la vigencia");
  const lastPayment = parseDateOnly(lastPaymentDate, "la fecha del último pago");
  if (start.getUTCFullYear() !== numericYear || lastPayment.getUTCFullYear() !== numericYear) {
    throw new RangeError("Las fechas de la vigencia deben pertenecer al año seleccionado");
  }
  if (start > lastPayment) {
    throw new RangeError("La fecha del último pago debe ser igual o posterior al inicio de la vigencia");
  }

  return {
    collectionFrequencyDays: frequencyDays,
    startDate: start,
    lastPaymentDate: lastPayment
  };
}
