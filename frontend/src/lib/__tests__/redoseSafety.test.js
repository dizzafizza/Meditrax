import { redoseWarnings } from "../redoseSafety";

const base = "2026-07-24T12:00:00.000Z";
const plus = (min) => new Date(new Date(base).getTime() + min * 60000).toISOString();
const profile = { onset_min: 30, peak_min: 90, duration_min: 300, intensity_scale: 1 };

describe("redoseWarnings — too-soon check", () => {
  const session = { started_at: base, dose: 10, profile, redoses: [] };

  test("warns when the redose lands before the previous dose has peaked", () => {
    const { warnings } = redoseWarnings(session, { amount: 10, at: plus(45) }, null); // 45 min < 90 peak
    const w = warnings.find((x) => x.type === "too_soon");
    expect(w).toBeTruthy();
    expect(w.minsSinceLast).toBe(45);
    expect(w.peakMin).toBe(90);
    expect(w.severity).toBe("caution");
  });

  test("no too-soon warning once the previous dose has peaked", () => {
    const { warnings } = redoseWarnings(session, { amount: 10, at: plus(120) }, null); // 120 > 90 peak
    expect(warnings.find((x) => x.type === "too_soon")).toBeFalsy();
  });

  test("measures from the most recent dose, not the primary", () => {
    const s = { started_at: base, dose: 10, profile, redoses: [{ id: "r1", at: plus(100), amount: 10 }] };
    // redose at 120 is only 20 min after the last redose (at 100) → too soon
    const { warnings } = redoseWarnings(s, { amount: 10, at: plus(120) }, null);
    expect(warnings.find((x) => x.type === "too_soon")).toBeTruthy();
  });
});

describe("redoseWarnings — max-daily check", () => {
  const session = { started_at: base, dose: 60, profile, redoses: [] };

  test("over_max when the running total exceeds the typical maximum", () => {
    // primary 60 + this 60 = 120 > max 100
    const { warnings, cumulative } = redoseWarnings(session, { amount: 60, at: plus(120) }, 100, "mg");
    expect(cumulative).toBe(120);
    const w = warnings.find((x) => x.type === "over_max");
    expect(w).toBeTruthy();
    expect(w.severity).toBe("severe");
    expect(w.maxDaily).toBe(100);
    expect(warnings.find((x) => x.type === "near_max")).toBeFalsy();
  });

  test("near_max at 80%+ of the maximum (but not over)", () => {
    // primary 60 + this 25 = 85, which is >= 80% of 100 and < 100
    const { warnings } = redoseWarnings(session, { amount: 25, at: plus(120) }, 100, "mg");
    expect(warnings.find((x) => x.type === "near_max")).toBeTruthy();
    expect(warnings.find((x) => x.type === "over_max")).toBeFalsy();
  });

  test("no max warning well under the limit, or when no max is known", () => {
    expect(redoseWarnings(session, { amount: 10, at: plus(120) }, 100).warnings.find((x) => x.type.endsWith("max"))).toBeFalsy();
    expect(redoseWarnings(session, { amount: 10, at: plus(120) }, null).warnings.find((x) => x.type.endsWith("max"))).toBeFalsy();
  });

  test("an unspecified redose amount is assumed equal to the primary dose", () => {
    // primary 60 + redose (defaults to 60) = 120 > 100
    const { cumulative, warnings } = redoseWarnings(session, { amount: "", at: plus(120) }, 100);
    expect(cumulative).toBe(120);
    expect(warnings.find((x) => x.type === "over_max")).toBeTruthy();
  });

  test("counts existing redoses toward the running total", () => {
    const s = { started_at: base, dose: 40, profile, redoses: [{ id: "r1", at: plus(120), amount: 40 }] };
    // 40 primary + 40 existing redose + 40 new = 120 > 100
    const { cumulative, warnings } = redoseWarnings(s, { amount: 40, at: plus(240) }, 100);
    expect(cumulative).toBe(120);
    expect(warnings.find((x) => x.type === "over_max")).toBeTruthy();
  });
});

describe("redoseWarnings — combined / edge cases", () => {
  test("both warnings can fire at once", () => {
    const session = { started_at: base, dose: 60, profile, redoses: [] };
    const { warnings } = redoseWarnings(session, { amount: 60, at: plus(30) }, 100, "mg"); // 30<90 peak AND 120>100
    expect(warnings.find((x) => x.type === "too_soon")).toBeTruthy();
    expect(warnings.find((x) => x.type === "over_max")).toBeTruthy();
  });

  test("no session, or no amount/max, yields no warnings and null cumulative-safe output", () => {
    expect(redoseWarnings(null, {}, 100).warnings).toEqual([]);
    const clean = redoseWarnings({ started_at: base, dose: 5, profile, redoses: [] }, { amount: 5, at: plus(120) }, null);
    expect(clean.warnings).toEqual([]);
  });
});
