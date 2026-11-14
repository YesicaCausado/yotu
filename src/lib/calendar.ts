export type CalendarView = "day" | "week" | "month";

export type TimedBlock = {
  date: string;
  start_time: string;
  end_time: string | null;
};

export type FreeSlot = { start: string; end: string };

export const AVAILABILITY_START = 7 * 60;
export const AVAILABILITY_END = 22 * 60;
export const MINIMUM_FREE_SLOT = 60;

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function offsetDate(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function dayLabel(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) {
  return new Intl.DateTimeFormat("es", { ...options, timeZone: "UTC" }).format(parseDate(value));
}

export function getCalendarDays(date: string, mode: CalendarView) {
  if (mode === "day") return [date];
  if (mode === "week") {
    const weekday = (parseDate(date).getUTCDay() + 6) % 7;
    const first = offsetDate(date, -weekday);
    return Array.from({ length: 7 }, (_, index) => offsetDate(first, index));
  }
  const [year, month] = date.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const mondayOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const first = offsetDate(isoDate(firstOfMonth), -mondayOffset);
  return Array.from({ length: 42 }, (_, index) => offsetDate(first, index));
}

function minutesOfDay(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function clockValue(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function findFreeSlots(
  date: string,
  blocks: TimedBlock[],
  minimumMinutes = MINIMUM_FREE_SLOT,
): FreeSlot[] {
  const busy = blocks
    .filter((block) => block.date === date)
    .map((block) => {
      const start = minutesOfDay(block.start_time);
      const end = block.end_time ? minutesOfDay(block.end_time) : start + 60;
      return {
        start: Math.max(AVAILABILITY_START, start),
        end: Math.min(AVAILABILITY_END, end),
      };
    })
    .filter((block) => block.end > block.start)
    .sort((a, b) => a.start - b.start);

  const free: FreeSlot[] = [];
  let cursor = AVAILABILITY_START;
  for (const block of busy) {
    if (block.start > cursor && block.start - cursor >= minimumMinutes) {
      free.push({ start: clockValue(cursor), end: clockValue(block.start) });
    }
    cursor = Math.max(cursor, block.end);
  }
  if (AVAILABILITY_END - cursor >= minimumMinutes) {
    free.push({ start: clockValue(cursor), end: clockValue(AVAILABILITY_END) });
  }
  return free;
}
