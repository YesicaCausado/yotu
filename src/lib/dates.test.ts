import { describe, expect, it } from "vitest";
import { daysBetween, formatLongDate, nextAnniversary, todayIn } from "./dates";

describe("todayIn", () => {
  it("usa la zona horaria indicada, no la del servidor", () => {
    const instant = new Date("2026-01-01T03:30:00Z");
    expect(todayIn("UTC", instant)).toBe("2026-01-01");
    expect(todayIn("America/Bogota", instant)).toBe("2025-12-31");
    expect(todayIn("Asia/Tokyo", instant)).toBe("2026-01-01");
  });
});

describe("daysBetween", () => {
  it("cuenta días de calendario, también con cambio de horario", () => {
    expect(daysBetween("2024-02-14", "2024-02-15")).toBe(1);
    expect(daysBetween("2024-03-30", "2024-04-01")).toBe(2);
    expect(daysBetween("2024-01-01", "2025-01-01")).toBe(366);
  });
});

describe("nextAnniversary", () => {
  it("devuelve el de este año si aún no ha pasado", () => {
    expect(nextAnniversary("2020-06-10", "2026-03-01")).toEqual({ date: "2026-06-10", daysUntil: 101, years: 6 });
  });

  it("hoy cuenta como aniversario", () => {
    expect(nextAnniversary("2020-06-10", "2026-06-10")).toEqual({ date: "2026-06-10", daysUntil: 0, years: 6 });
  });

  it("pasa al año siguiente si ya pasó", () => {
    expect(nextAnniversary("2020-06-10", "2026-06-11").date).toBe("2027-06-10");
  });

  it("celebra el 29 de febrero el 28 en años no bisiestos", () => {
    expect(nextAnniversary("2020-02-29", "2026-01-01").date).toBe("2026-02-28");
    expect(nextAnniversary("2020-02-29", "2027-03-01").date).toBe("2028-02-29");
  });
});

describe("formatLongDate", () => {
  it("no se desplaza un día por la zona horaria", () => {
    expect(formatLongDate("2024-02-14")).toBe("14 de febrero de 2024");
  });
});
