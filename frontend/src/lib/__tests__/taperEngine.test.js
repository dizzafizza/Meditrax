import { generateTaperLevels, generateTaperSchedule, doseOnDate, suggestTaperParams } from "../taperEngine";

describe("generateTaperLevels", () => {
  test.each(["linear", "exponential", "hyperbolic"])("%s: starts at initial, ends at final, monotonic non-increasing", (method) => {
    const levels = generateTaperLevels(100, 0, 56, 7, method);
    expect(levels[0]).toBe(100);
    expect(levels[levels.length - 1]).toBe(0);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeLessThanOrEqual(levels[i - 1]);
    for (const l of levels) expect(l).toBeGreaterThanOrEqual(0);
  });

  test("non-zero final dose", () => {
    const levels = generateTaperLevels(50, 10, 28, 7, "exponential");
    expect(levels[0]).toBe(50);
    expect(levels[levels.length - 1]).toBe(10);
  });

  test("custom steps forced to initial and final", () => {
    const levels = generateTaperLevels(40, 0, 28, 7, "custom", [{ dose: 30 }, { dose: 20 }, { dose: 12 }]);
    expect(levels[0]).toBe(40);
    expect(levels[levels.length - 1]).toBe(0);
  });

  test("invalid input throws", () => {
    expect(() => generateTaperLevels(0, 0, 28, 7, "linear")).toThrow();
    expect(() => generateTaperLevels(10, 20, 28, 7, "linear")).toThrow();
    expect(() => generateTaperLevels(10, 0, 0, 7, "linear")).toThrow();
  });
});

describe("generateTaperSchedule dates", () => {
  test("schedule dates stay on the given local calendar day", () => {
    const sched = generateTaperSchedule({ initialDose: 100, finalDose: 0, startDate: "2026-07-12", totalDays: 28, stepIntervalDays: 7, method: "linear" });
    // Was the UTC bug: east of UTC these came out as 2026-07-11.
    expect(sched.steps[0].date).toBe("2026-07-12");
    expect(sched.steps[1].date).toBe("2026-07-19");
    expect(sched.summary.start_date).toBe("2026-07-12");
    expect(sched.summary.end_date).toBe("2026-08-09");
  });
});

describe("doseOnDate", () => {
  const sched = generateTaperSchedule({ initialDose: 100, finalDose: 0, startDate: "2026-07-12", totalDays: 28, stepIntervalDays: 7, method: "linear" });

  test("lookup matches generated steps at boundaries", () => {
    expect(doseOnDate(sched, "2026-07-12", "2026-07-12")).toBe(sched.steps[0].dose);
    expect(doseOnDate(sched, "2026-07-18", "2026-07-12")).toBe(sched.steps[0].dose); // day 6, still step 0
    expect(doseOnDate(sched, "2026-07-19", "2026-07-12")).toBe(sched.steps[1].dose); // day 7 -> step 1
  });

  test("before start returns initial; far future returns final", () => {
    expect(doseOnDate(sched, "2026-07-01", "2026-07-12")).toBe(100);
    expect(doseOnDate(sched, "2027-01-01", "2026-07-12")).toBe(0);
  });

  test("empty schedule returns 0", () => {
    expect(doseOnDate({ steps: [] }, "2026-07-12", "2026-07-12")).toBe(0);
  });
});

describe("suggestTaperParams", () => {
  test("high dependency gets slow hyperbolic taper", () => {
    const s = suggestTaperParams({ dependency_risk_category: "extreme" });
    expect(s.method).toBe("hyperbolic");
    expect(s.step_interval_days).toBe(14);
  });
  test("low risk gets linear", () => {
    expect(suggestTaperParams({ dependency_risk_category: "none", risk_level: "low" }).method).toBe("linear");
  });
});
