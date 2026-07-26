import { estimateTolerance, toleranceLevel, TOLERANCE_PARAMS } from "../toleranceEngine";

const DAY = 86400000;
const now = new Date("2026-07-24T12:00:00.000Z").getTime();
const daysAgo = (n) => now - n * DAY;

describe("TOLERANCE_PARAMS", () => {
  test("every category has sane, boundable parameters", () => {
    Object.entries(TOLERANCE_PARAMS).forEach(([category, p]) => {
      expect(p.formationDays).toBeGreaterThan(0);
      expect(p.decayDays).toBeGreaterThan(0);
      expect(p.maxDampening).toBeGreaterThan(0);
      expect(p.maxDampening).toBeLessThanOrEqual(1);
    });
  });

  test("chronic-condition / non-recreational categories are not modeled at all", () => {
    ["antidepressant", "antipsychotic", "anticonvulsant", "nsaid", "other", "antihypertensive", "statin", "diabetes", "thyroid", "ppi"].forEach((c) => {
      expect(TOLERANCE_PARAMS[c]).toBeUndefined();
    });
  });

  test("psychedelics form tolerance fastest (lowest formationDays) of any modeled category", () => {
    const fastest = Math.min(...Object.values(TOLERANCE_PARAMS).map((p) => p.formationDays));
    expect(TOLERANCE_PARAMS.psychedelic.formationDays).toBe(fastest);
  });
});

describe("toleranceLevel — raw math", () => {
  test("a single dose right now gives 1 - exp(-1/formationDays)", () => {
    const level = toleranceLevel([now], now, { formationDays: 1, decayDays: 6 });
    expect(level).toBeCloseTo(1 - Math.exp(-1), 6);
  });

  test("no doses at all gives level 0", () => {
    expect(toleranceLevel([], now, { formationDays: 4, decayDays: 10 })).toBe(0);
  });

  test("a dose long enough ago (many decay constants back) contributes negligibly", () => {
    const level = toleranceLevel([daysAgo(200)], now, { formationDays: 4, decayDays: 10 });
    expect(level).toBeLessThan(0.001);
  });

  test("more frequent recent doses produce higher tolerance than one dose alone", () => {
    const params = { formationDays: 4, decayDays: 10 };
    const oneDose = toleranceLevel([now], now, params);
    const fiveDailyDoses = toleranceLevel([daysAgo(4), daysAgo(3), daysAgo(2), daysAgo(1), now], now, params);
    expect(fiveDailyDoses).toBeGreaterThan(oneDose);
  });

  test("doses after `now` are not counted by estimateTolerance (future doses ignored)", () => {
    const r = estimateTolerance([now + 10 * DAY], "opioid", now);
    expect(r.level).toBe(0);
  });
});

describe("estimateTolerance — categories with no modeled tolerance", () => {
  test("returns applicable:false and leaves level at 0 regardless of history", () => {
    const r = estimateTolerance([now, daysAgo(1), daysAgo(2)], "antidepressant", now);
    expect(r.applicable).toBe(false);
    expect(r.level).toBe(0);
    expect(r.maxDampening).toBe(0);
  });

  test("an unknown/undefined category is also not applicable", () => {
    expect(estimateTolerance([now], "not-a-real-category", now).applicable).toBe(false);
  });
});

describe("estimateTolerance — applicable categories", () => {
  test("no dose history at all -> level 0, no daysSinceLast, not faded", () => {
    const r = estimateTolerance([], "opioid", now);
    expect(r.applicable).toBe(true);
    expect(r.level).toBe(0);
    expect(r.daysSinceLast).toBeNull();
    expect(r.faded).toBe(false);
    expect(r.maxDampening).toBe(TOLERANCE_PARAMS.opioid.maxDampening);
  });

  test("a first-ever dose taken right now (excluded by the caller) still lets a fresh single-prior-dose case compute a sensible level", () => {
    // Simulates: this is the *second* dose ever, taken now; the history passed
    // in is just the first dose from a few days ago (the caller is
    // responsible for excluding the dose currently being scored -- see
    // localdb.js's toleranceForMedication).
    const r = estimateTolerance([daysAgo(2)], "opioid", now);
    expect(r.level).toBeGreaterThan(0);
    expect(r.level).toBeLessThan(1);
  });

  test("psychedelic: a single recent dose already shows strong (~63% of max) tolerance", () => {
    const r = estimateTolerance([now], "psychedelic", now);
    expect(r.level).toBeCloseTo(1 - Math.exp(-1), 2);
  });

  test("frequent recent use pushes level higher and toward saturation", () => {
    const doses = [daysAgo(4), daysAgo(3), daysAgo(2), daysAgo(1), daysAgo(0.1)];
    const r = estimateTolerance(doses, "opioid", now);
    expect(r.level).toBeGreaterThan(0.3);
    expect(r.level).toBeLessThanOrEqual(1);
  });
});

describe("estimateTolerance — faded tolerance after a gap", () => {
  test("flags faded when a substantial recent-use tolerance has since decayed away", () => {
    // Heavy recent-ish use built real tolerance, then a gap much longer than
    // the category's decay constant (opioid: decayDays 10) before "now".
    const doses = [daysAgo(35), daysAgo(34), daysAgo(33), daysAgo(32), daysAgo(31), daysAgo(30)];
    const r = estimateTolerance(doses, "opioid", now);
    expect(r.recentPeakLevel).toBeGreaterThanOrEqual(0.35);
    expect(r.faded).toBe(true);
    expect(r.daysSinceLast).toBeCloseTo(30, 0);
  });

  test("does not flag faded when tolerance was never significant to begin with", () => {
    // A single light dose long ago never built meaningful tolerance, so
    // there's nothing to have "faded" from.
    const r = estimateTolerance([daysAgo(60)], "opioid", now);
    expect(r.recentPeakLevel).toBeLessThan(0.35);
    expect(r.faded).toBe(false);
  });

  test("does not flag faded for ongoing regular use with no real gap", () => {
    const doses = [daysAgo(4), daysAgo(3), daysAgo(2), daysAgo(1), daysAgo(0.05)];
    const r = estimateTolerance(doses, "opioid", now);
    expect(r.faded).toBe(false);
  });
});
