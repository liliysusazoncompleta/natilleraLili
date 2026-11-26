function toCents(amount) {
  const raw = String(amount).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match || match[1].length > 12) {
    throw new RangeError("El valor recaudado debe ser no negativo y tener máximo dos decimales");
  }
  const cents = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new RangeError("El valor recaudado excede el máximo permitido");
  return cents;
}

function fromCents(cents) {
  return (cents / 100).toFixed(2);
}

export function normalizeRaffleAmount(amount) {
  return fromCents(toCents(amount));
}

export function sumRaffleAmounts(amounts) {
  return fromCents(amounts.reduce((total, amount) => total + toCents(amount), 0));
}

export function allocateRaffleFeeDiscount(entries, availableAmount) {
  let remainingCents = toCents(availableAmount);
  const allocations = [];

  for (const entry of entries) {
    const outstandingCents = Math.max(0, toCents(entry.amount) - toCents(entry.discountedAmount || 0));
    const discountedCents = Math.min(remainingCents, outstandingCents);
    if (discountedCents > 0) {
      allocations.push({ id: entry.id, amount: fromCents(discountedCents) });
      remainingCents -= discountedCents;
    }
    if (remainingCents === 0) break;
  }

  return {
    total: fromCents(toCents(availableAmount) - remainingCents),
    remaining: fromCents(remainingCents),
    allocations
  };
}

export function isRaffleDateInVigencia(date, year) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return false;
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric"
  }).formatToParts(date);
  const localYear = Number(dateParts.find(({ type }) => type === "year")?.value);
  return localYear === year;
}

export function planRaffleSchedule(drawDates, months, year, now) {
  const changes = [];
  for (let index = 0; index < 12; index += 1) {
    const value = drawDates[index];
    const existing = months.find((month) => month.month === index + 1);
    if (value === null || value === "") {
      if (existing) { const error = new Error("No se pueden eliminar sorteos existentes desde la configuración"); error.status = 409; throw error; }
      continue;
    }
    const drawAt = new Date(value);
    if (!isRaffleDateInVigencia(drawAt, year)) { const error = new Error("Cada fecha debe estar dentro del año de la vigencia"); error.status = 400; throw error; }
    if (existing && existing.drawAt.getTime() === drawAt.getTime()) continue;
    if (existing?.finalizedAt) { const error = new Error("No se puede modificar un sorteo cerrado"); error.status = 409; throw error; }
    if (drawAt <= now) { const error = new Error("Las fechas nuevas o modificadas deben ser futuras"); error.status = 400; throw error; }
    changes.push({ month: index + 1, drawAt, existingId: existing?.id || null });
  }
  return changes;
}

function splitEvenly(totalCents, recipients, type, recipientKey) {
  if (totalCents > 0 && recipients.length === 0) {
    throw new RangeError("No hay destinatarios activos para distribuir el dinero");
  }
  const baseCents = recipients.length ? Math.floor(totalCents / recipients.length) : 0;
  let remainderCents = recipients.length ? totalCents % recipients.length : 0;

  return recipients.map((recipient) => {
    const amountCents = baseCents + (remainderCents > 0 ? 1 : 0);
    remainderCents = Math.max(0, remainderCents - 1);
    return { [recipientKey]: recipient.id, type, amount: fromCents(amountCents) };
  }).filter((distribution) => Number(distribution.amount) > 0);
}

export function calculateRaffleDistribution({ collectedAmount, winner, members, administrators }) {
  const collectedCents = toCents(collectedAmount);
  const commissionCents = Math.round(collectedCents * 3 / 100);
  const memberCents = collectedCents - commissionCents;
  const adminDistributions = splitEvenly(commissionCents, administrators, "ADMINISTRADOR", "userId");

  if (winner) {
    const distributions = [
      ...adminDistributions,
      ...(memberCents > 0
        ? [{ memberId: winner.id, type: "GANADOR", amount: fromCents(memberCents) }]
        : [])
    ];

    return {
      prize: fromCents(memberCents),
      adminCommission: fromCents(commissionCents),
      distributions
    };
  }

  const distributions = [...adminDistributions, ...splitEvenly(memberCents, members, "SOCIO", "memberId")];
  return {
    prize: "0.00",
    adminCommission: fromCents(commissionCents),
    distributions
  };
}

export function projectRaffleDistribution(entries) {
  const eligible = entries.filter((entry) => entry.eligible);
  const collectedAmount = sumRaffleAmounts(eligible.map((entry) => String(entry.amount)));
  const winnerScenario = calculateRaffleDistribution({
    collectedAmount, winner: { id: "winner" }, members: [], administrators: [{ id: "admin" }]
  });
  const noWinnerScenario = calculateRaffleDistribution({
    collectedAmount, winner: null, members: eligible.map((entry) => ({ id: entry.memberId })), administrators: [{ id: "admin" }]
  });
  return {
    collectedAmount,
    adminCommission: winnerScenario.adminCommission,
    winnerAmount: winnerScenario.prize,
    noWinnerAmount: sumRaffleAmounts(noWinnerScenario.distributions.filter((item) => item.type === "SOCIO").map((item) => item.amount)),
    eligibleCount: eligible.length,
    noWinnerShares: noWinnerScenario.distributions.filter((item) => item.type === "SOCIO")
  };
}
