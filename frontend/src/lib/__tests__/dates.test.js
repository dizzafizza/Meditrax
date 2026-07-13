import {
  localDateStr, parseLocalDate, timestampToLocalDate,
  weekdayKeyLocal, addDaysStr, diffDays,
} from "../dates";

describe("dates", () => {
  test("localDateStr formats a Date in local time", () => {
    expect(localDateStr(new Date(2026, 6, 12))).toBe("2026-07-12");
    expect(localDateStr(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  test("parseLocalDate returns local midnight, not UTC midnight", () => {
    const d = parseLocalDate("2026-07-12");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });

  test("round-trips a date string regardless of timezone", () => {
    // The classic bug: new Date("2026-07-12").getDate() is 11 in UTC-n zones.
    expect(localDateStr(parseLocalDate("2026-07-12"))).toBe("2026-07-12");
    expect(localDateStr(parseLocalDate("2026-01-01"))).toBe("2026-01-01");
    expect(localDateStr(parseLocalDate("2026-12-31"))).toBe("2026-12-31");
  });

  test("timestampToLocalDate buckets a UTC instant into the LOCAL day", () => {
    // 2026-07-12T02:00Z: in any zone west of UTC-2 this is still July 11 locally.
    const iso = "2026-07-12T02:00:00.000Z";
    const expected = localDateStr(new Date(iso));
    expect(timestampToLocalDate(iso)).toBe(expected);
    // Consistency: must equal what a local Date of that instant reports.
    const d = new Date(iso);
    expect(timestampToLocalDate(iso)).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
    expect(timestampToLocalDate(null)).toBe("");
  });

  test("weekdayKeyLocal is Monday-first and local", () => {
    expect(weekdayKeyLocal("2026-07-12")).toBe("sun"); // 2026-07-12 is a Sunday
    expect(weekdayKeyLocal("2026-07-13")).toBe("mon");
    expect(weekdayKeyLocal("2026-07-18")).toBe("sat");
    expect(weekdayKeyLocal(new Date(2026, 6, 13))).toBe("mon");
  });

  test("addDaysStr does local-safe arithmetic across month/year bounds", () => {
    expect(addDaysStr("2026-07-12", 1)).toBe("2026-07-13");
    expect(addDaysStr("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDaysStr("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysStr("2026-07-12", -12)).toBe("2026-06-30");
    expect(addDaysStr("2026-03-01", -1)).toBe("2026-02-28");
  });

  test("diffDays counts whole days, DST-safe", () => {
    expect(diffDays("2026-07-12", "2026-07-12")).toBe(0);
    expect(diffDays("2026-07-12", "2026-07-19")).toBe(7);
    expect(diffDays("2026-07-19", "2026-07-12")).toBe(-7);
    // Across US spring-forward (2026-03-08) — naive /86400000 math yields 0.958…
    expect(diffDays("2026-03-07", "2026-03-09")).toBe(2);
    // Across fall-back (2026-11-01)
    expect(diffDays("2026-10-31", "2026-11-02")).toBe(2);
  });
});
