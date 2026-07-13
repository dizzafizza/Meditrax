import {
  prnEscalation, doseEscalation, intervalShrink, maxDailyExceeded,
  adherencePattern, toleranceSignal, moodUsageLink,
  isApplicable, analyzeMedication, analyzeAll, SAFETY_COPY,
} from "../behavior";

const NOW = new Date(2026, 6, 12, 12, 0, 0);

function med(overrides = {}) {
  return {
    id: "m1", name: "Oxycodone", strength: 5, unit: "mg",
    times: ["09:00"], days_of_week: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    is_prn: true, dependency_risk_category: "high", risk_level: "high",
    dose_quantity: 1, ...overrides,
  };
}

function ts(age, hour = 9, minute = 0) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - age);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

let seq = 0;
function log(age, { hour = 9, minute = 0, quantity = 1, status = "taken", effectiveness, scheduled_time, dose_taken, medId = "m1" } = {}) {
  return { id: `l${seq++}`, medication_id: medId, status, quantity, effectiveness, scheduled_time, dose_taken, timestamp: ts(age, hour, minute) };
}

describe("prnEscalation", () => {
  test("steady usage does not trigger", () => {
    const logs = [];
    for (let age = 1; age <= 42; age++) logs.push(log(age));
    expect(prnEscalation(logs, med(), { now: NOW }).triggered).toBe(false);
  });

  test("clear weekly escalation triggers", () => {
    const logs = [];
    // week 6 ago: 1/day … most recent week: 4/day
    for (let w = 5; w >= 0; w--) {
      const perDay = 6 - w > 4 ? 4 : 6 - w;
      for (let d = 0; d < 7; d++) {
        for (let i = 0; i < perDay; i++) logs.push(log(w * 7 + d + 1, { hour: 8 + i * 3 }));
      }
    }
    const s = prnEscalation(logs, med(), { now: NOW });
    expect(s.triggered).toBe(true);
    expect(s.detail).toMatch(/grew/);
  });

  test("too little data does not trigger", () => {
    expect(prnEscalation([log(1), log(2)], med(), { now: NOW }).triggered).toBe(false);
  });
});

describe("doseEscalation", () => {
  test("doubling quantity triggers", () => {
    const logs = [];
    for (let age = 40; age > 20; age--) logs.push(log(age, { quantity: 1 }));
    for (let age = 20; age >= 1; age--) logs.push(log(age, { quantity: 2 }));
    const s = doseEscalation(logs, med(), { now: NOW });
    expect(s.triggered).toBe(true);
    expect(s.evidence.ratio).toBeGreaterThanOrEqual(1.3);
  });

  test("stable quantity does not trigger", () => {
    const logs = [];
    for (let age = 30; age >= 1; age--) logs.push(log(age, { quantity: 2 }));
    expect(doseEscalation(logs, med(), { now: NOW }).triggered).toBe(false);
  });

  test("fewer than 8 logs does not trigger", () => {
    const logs = [log(3, { quantity: 1 }), log(2, { quantity: 3 }), log(1, { quantity: 3 })];
    expect(doseEscalation(logs, med(), { now: NOW }).triggered).toBe(false);
  });
});

describe("intervalShrink", () => {
  test("shrinking inter-dose gaps trigger", () => {
    const logs = [];
    // Earlier: one dose/day (24h gaps); recent: three/day (~5h gaps)
    for (let age = 24; age > 12; age--) logs.push(log(age, { hour: 9 }));
    for (let age = 12; age >= 1; age--) {
      logs.push(log(age, { hour: 8 }));
      logs.push(log(age, { hour: 13 }));
      logs.push(log(age, { hour: 18 }));
    }
    const s = intervalShrink(logs, med(), { now: NOW });
    expect(s.triggered).toBe(true);
    expect(s.detail).toMatch(/shrank/);
  });

  test("repeated early dosing triggers", () => {
    const logs = [];
    // scheduled 21:00, taken at 17:00 (4h early) most days
    for (let age = 10; age >= 1; age--) logs.push(log(age, { hour: 17, scheduled_time: "21:00" }));
    const s = intervalShrink(logs, med({ is_prn: false }), { now: NOW });
    expect(s.triggered).toBe(true);
    expect(s.detail).toMatch(/early/);
  });

  test("on-time dosing does not trigger", () => {
    const logs = [];
    for (let age = 10; age >= 1; age--) logs.push(log(age, { hour: 9, scheduled_time: "09:00" }));
    expect(intervalShrink(logs, med({ is_prn: false }), { now: NOW }).triggered).toBe(false);
  });
});

describe("maxDailyExceeded", () => {
  const catalogEntry = { max_daily_dose: 20 };

  test("days over the max trigger with count", () => {
    const logs = [];
    for (let age = 5; age >= 4; age--) {
      // 3 × 10mg = 30mg > 20mg max on two days
      logs.push(log(age, { hour: 8, dose_taken: 10 }));
      logs.push(log(age, { hour: 13, dose_taken: 10 }));
      logs.push(log(age, { hour: 19, dose_taken: 10 }));
    }
    const s = maxDailyExceeded(logs, med(), catalogEntry, { now: NOW });
    expect(s.triggered).toBe(true);
    expect(s.evidence.overDays).toHaveLength(2);
  });

  test("falls back to strength × quantity when dose_taken missing", () => {
    const logs = [
      log(2, { hour: 8, quantity: 3, dose_taken: undefined }),  // 15mg
      log(2, { hour: 14, quantity: 3, dose_taken: undefined }), // 15mg → 30 > 20
    ];
    expect(maxDailyExceeded(logs, med(), catalogEntry, { now: NOW }).triggered).toBe(true);
  });

  test("under the max, or no catalog max → no trigger", () => {
    const logs = [log(2, { dose_taken: 10 })];
    expect(maxDailyExceeded(logs, med(), catalogEntry, { now: NOW }).triggered).toBe(false);
    expect(maxDailyExceeded(logs, med(), null, { now: NOW }).triggered).toBe(false);
  });
});

describe("adherencePattern (missed→binge)", () => {
  test("gaps followed by heavy days trigger", () => {
    const m = med({ is_prn: false });
    const logs = [];
    // Normal 1/day, but three times: a missed day then a 3-unit day
    for (let age = 20; age >= 1; age--) {
      if ([15, 10, 5].includes(age)) continue; // missed
      if ([14, 9, 4].includes(age)) { logs.push(log(age, { quantity: 3 })); continue; } // binge
      logs.push(log(age, { quantity: 1 }));
    }
    const s = adherencePattern(logs, m, { now: NOW });
    expect(s.triggered).toBe(true);
  });

  test("steady schedule does not trigger; PRN meds skipped", () => {
    const m = med({ is_prn: false });
    const logs = [];
    for (let age = 20; age >= 1; age--) logs.push(log(age));
    expect(adherencePattern(logs, m, { now: NOW }).triggered).toBe(false);
    expect(adherencePattern(logs, med({ is_prn: true }), { now: NOW }).triggered).toBe(false);
  });
});

describe("toleranceSignal", () => {
  test("declining effectiveness with steady usage triggers", () => {
    const logs = [];
    for (let age = 30; age >= 1; age--) {
      const eff = Math.max(2, Math.round(9 - (30 - age) * 0.25));
      logs.push(log(age, { effectiveness: eff }));
    }
    const s = toleranceSignal(logs, med(), { now: NOW });
    expect(s.triggered).toBe(true);
    expect(s.detail).toMatch(/drifted/);
  });

  test("stable effectiveness does not trigger", () => {
    const logs = [];
    for (let age = 30; age >= 1; age--) logs.push(log(age, { effectiveness: 8 }));
    expect(toleranceSignal(logs, med(), { now: NOW }).triggered).toBe(false);
  });

  test("declining effectiveness with falling usage does not trigger", () => {
    const logs = [];
    for (let age = 60; age > 30; age--) logs.push(log(age, { effectiveness: 9 }));
    // last 30 days: only 5 doses, lower ratings
    for (const age of [25, 20, 15, 10, 5]) logs.push(log(age, { effectiveness: 5 }));
    expect(toleranceSignal(logs, med(), { now: NOW }).triggered).toBe(false);
  });
});

describe("moodUsageLink", () => {
  test("low-mood-heavy-use pattern triggers", () => {
    const logs = [];
    const checkins = [];
    for (let age = 14; age >= 1; age--) {
      const low = age % 2 === 0;
      checkins.push({ mood: low ? 1 : 5, timestamp: ts(age, 8) });
      const n = low ? 4 : 1;
      for (let i = 0; i < n; i++) logs.push(log(age, { hour: 10 + i * 2 }));
    }
    const s = moodUsageLink(logs, med(), checkins, { now: NOW });
    expect(s.triggered).toBe(true);
  });

  test("no mood data → no trigger", () => {
    const logs = [log(1), log(2)];
    expect(moodUsageLink(logs, med(), [], { now: NOW }).triggered).toBe(false);
  });
});

describe("gating and roll-up", () => {
  test("isApplicable: aspirin-like meds are excluded", () => {
    expect(isApplicable(med({ is_prn: false, dependency_risk_category: "none", risk_level: "low" }))).toBe(false);
    expect(isApplicable(med({ dependency_risk_category: "moderate", is_prn: false, risk_level: "low" }))).toBe(true);
    expect(isApplicable(med({ dependency_risk_category: "none", is_prn: true, risk_level: "low" }))).toBe(true);
    expect(isApplicable(med({ dependency_risk_category: "none", is_prn: false, risk_level: "high" }))).toBe(true);
  });

  test("non-applicable med returns level none without scoring", () => {
    const m = med({ is_prn: false, dependency_risk_category: "none", risk_level: "low" });
    const r = analyzeMedication({ med: m, logs: [], now: NOW });
    expect(r.applicable).toBe(false);
    expect(r.score).toBeNull();
    expect(r.level).toBe("none");
  });

  test("insufficient data suppresses scoring", () => {
    const logs = [log(1), log(2), log(3)];
    const r = analyzeMedication({ med: med(), logs, now: NOW });
    expect(r.data_quality).toBe("insufficient");
    expect(r.score).toBeNull();
  });

  test("escalating high-dependency med scores elevated/high with signals and actions", () => {
    const logs = [];
    // 6 weeks of escalation in both frequency and quantity
    for (let w = 5; w >= 0; w--) {
      const perDay = Math.min(4, 6 - w);
      const qty = w > 2 ? 1 : 2;
      for (let d = 0; d < 7; d++) {
        for (let i = 0; i < perDay; i++) logs.push(log(w * 7 + d + 1, { hour: 8 + i * 3, quantity: qty }));
      }
    }
    const r = analyzeMedication({ med: med(), logs, now: NOW });
    expect(r.data_quality).toBe("good");
    expect(r.score).toBeGreaterThanOrEqual(50);
    expect(["elevated", "high"]).toContain(r.level);
    expect(r.signals.length).toBeGreaterThanOrEqual(2);
    expect(r.suggested_actions.some((a) => a.type === "clinician")).toBe(true);
  });

  test("steady well-behaved usage stays level none/watch", () => {
    const logs = [];
    for (let age = 40; age >= 1; age--) logs.push(log(age, { quantity: 1, effectiveness: 8 }));
    const r = analyzeMedication({ med: med(), logs, now: NOW });
    expect(r.data_quality).toBe("good");
    expect(["none", "watch"]).toContain(r.level);
  });

  test("analyzeAll filters to applicable meds and includes safety copy", () => {
    const meds = [
      med(),
      med({ id: "m2", name: "Lisinopril", is_prn: false, dependency_risk_category: "none", risk_level: "low" }),
    ];
    const logs = [];
    for (let age = 20; age >= 1; age--) logs.push(log(age));
    const r = analyzeAll({ meds, logs, checkins: [], catalog: [], tapers: [], now: NOW });
    expect(r.per_med).toHaveLength(1);
    expect(r.per_med[0].medication_id).toBe("m1");
    expect(r.safety).toBe(SAFETY_COPY);
  });
});
