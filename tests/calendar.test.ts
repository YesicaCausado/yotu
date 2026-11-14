import { describe, expect, it } from "vitest";
import { findFreeSlots, getCalendarDays } from "../src/lib/calendar";

describe("calendar dates and free slots", () => {
  it("finds common availability from visible overlapping commitments", () => {
    const slots = findFreeSlots("2026-12-24", [
      { date: "2026-12-24", start_time: "08:00:00", end_time: "12:00:00" },
      { date: "2026-12-24", start_time: "09:00:00", end_time: "14:00:00" },
    ]);

    expect(slots).toEqual([
      { start: "07:00", end: "08:00" },
      { start: "14:00", end: "22:00" },
    ]);
  });

  it("clips blocks to the daily window, assumes one hour without an end, and drops short gaps", () => {
    const slots = findFreeSlots("2026-12-24", [
      { date: "2026-12-24", start_time: "06:00:00", end_time: "08:15:00" },
      { date: "2026-12-24", start_time: "08:30:00", end_time: "09:00:00" },
      { date: "2026-12-24", start_time: "21:30:00", end_time: null },
    ]);

    expect(slots).toEqual([{ start: "09:00", end: "21:30" }]);
  });

  it("builds Monday-first day, week, and month grids", () => {
    expect(getCalendarDays("2026-11-11", "day")).toEqual(["2026-11-11"]);
    expect(getCalendarDays("2026-11-11", "week")).toEqual([
      "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15",
    ]);
    expect(getCalendarDays("2026-11-11", "month")).toHaveLength(42);
  });
});
