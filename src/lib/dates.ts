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
