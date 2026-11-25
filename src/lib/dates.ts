// Utilidades de fechas de calendario (AAAA-MM-DD) independientes de la zona
// horaria del servidor: siempre se calcula "hoy" en la zona de la pareja.

const DAY_MS = 86_400_000;

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria indicada. */
export function todayIn(timeZone: string, now: Date = new Date()) {
  // en-CA formatea como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUtc(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Días completos entre dos fechas de calendario (b - a). */
export function daysBetween(a: string, b: string) {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/**
 * Próximo aniversario a partir de hoy (incluido). Un 29 de febrero se celebra
 * el 28 en los años no bisiestos.
 */
export function nextAnniversary(anniversary: string, today: string) {
  const [, month, day] = anniversary.split("-").map(Number);
  const startYear = Number(anniversary.slice(0, 4));
  let year = Number(today.slice(0, 4));

  const dateFor = (y: number) => {
    const d = month === 2 && day === 29 && !isLeapYear(y) ? 28 : day;
    return `${y}-${pad(month)}-${pad(d)}`;
  };

  let date = dateFor(year);
  if (date < today) {
    year += 1;
    date = dateFor(year);
  }
  return { date, daysUntil: daysBetween(today, date), years: year - startYear };
}

/** "14 de febrero de 2024" (la fecha se interpreta como fecha de calendario, sin desfase horario). */
export function formatLongDate(isoDate: string) {
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(toUtc(isoDate)),
  );
}

/** Fecha y hora legible en la zona horaria indicada. */
export function formatDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("es", { dateStyle: "long", timeStyle: "short", timeZone }).format(new Date(iso));
}

/** Convierte un valor datetime-local en un instante de la zona de la pareja. */
export function dateTimeLocalToIso(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new RangeError("Fecha y hora no válidas.");
  const [, year, month, day, hour, minute] = match.map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = target;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    const difference = target - represented;
    if (difference === 0) break;
    timestamp += difference;
  }

  const finalParts = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  if (
    Number(finalParts.year) !== year
    || Number(finalParts.month) !== month
    || Number(finalParts.day) !== day
    || Number(finalParts.hour) !== hour
    || Number(finalParts.minute) !== minute
  ) {
    throw new RangeError("Esa hora no existe en la zona horaria de la pareja.");
  }
  return new Date(timestamp).toISOString();
}

/** Da formato a un instante para un input datetime-local en la zona indicada. */
export function isoToDateTimeLocal(value: string, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
