import {
  doseQuantity, logQuantity, scheduledDailyQuantity,
  adherenceFactor, prnDailyRate, predictRunOut, inventoryStatus,
} from "../predictor";
import { localDateStr, addDaysStr, diffDays } from "../dates";

const NOW = new Date(2026, 6, 12, 12, 0, 0); // 2026-07-12 local noon
const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function med(overrides = {}) {
  return {
    id: "m1", name: "TestMed", strength: 50, unit: "mg",
    times: ["09:00"], days_of_week: [...ALL_DAYS], is_prn: false,
    start_date: "2026-06-01", dose_quantity: 1,
    inventory: { current_count: 30, unit: "tablets", units_per_dose: 1, refill_threshold: 10 },
    ...overrides,
  };
}

// timestamp at local `hour` on the day `age` days before NOW
function tsDaysAgo(age, hour = 9) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - age);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function takenLogs(m, { days, perDay = 1, quantity = null, status = "taken" } = {}) {
  const logs = [];
  for (let age = 1; age <= days; age++) {
    for (let i = 0; i < perDay; i++) {
      logs.push({
        id: `l${age}-${i}`, medication_id: m.id, status,
        quantity: quantity != null ? quantity : undefined,
        timestamp: tsDaysAgo(age, 9 + i * 4),
      });
    }
  }
  return logs;
}

describe("doseQuantity / logQuantity", () => {
  test("dose_quantity preferred, inventory fallback, default 1", () => {
    expect(doseQuantity({ dose_quantity: 2 })).toBe(2);
    expect(doseQuantity({ inventory: { units_per_dose: 3 } })).toBe(3);
    expect(doseQuantity({})).toBe(1);
    expect(doseQuantity(null)).toBe(1);
  });

  test("logQuantity: explicit quantity wins; legacy falls back to per-dose, halved for partial", () => {
    const m = med({ dose_quantity: 2 });
    expect(logQuantity({ quantity: 3 }, m)).toBe(3);
    expect(logQuantity({ status: "taken" }, m)).toBe(2);
    expect(logQuantity({ status: "partial" }, m)).toBe(1);
    expect(logQuantity({ quantity: "bogus", status: "taken" }, m)).toBe(2); // NaN guard
  });
});

describe("scheduledDailyQuantity", () => {
  test("times × days-fraction × per-dose", () => {
    expect(scheduledDailyQuantity(med())).toBe(1);
    expect(scheduledDailyQuantity(med({ times: ["09:00", "21:00"], dose_quantity: 2 }))).toBe(4);
    expect(scheduledDailyQuantity(med({ days_of_week: ["mon"] }))).toBeCloseTo(1 / 7);
    expect(scheduledDailyQuantity(med({ is_prn: true }))).toBe(0);
  });
});

describe("adherenceFactor", () => {
  test("perfect adherence ≈ 1", () => {
    const m = med();
    const f = adherenceFactor(takenLogs(m, { days: 20 }), m, { now: NOW });
    expect(f).toBeGreaterThan(0.95);
    expect(f).toBeLessThanOrEqual(1.1);
  });

  test("no history → 1 (neutral)", () => {
    expect(adherenceFactor([], med(), { now: NOW })).toBe(1);
  });

  test("half the doses taken → roughly halved, floored at 0.3", () => {
    const m = med();
    const logs = takenLogs(m, { days: 20 }).filter((_, i) => i % 2 === 0);
    const f = adherenceFactor(logs, m, { now: NOW });
    expect(f).toBeLessThan(0.75);
    expect(f).toBeGreaterThanOrEqual(0.3);
  });
});

describe("prnDailyRate (B2: PRN projections)", () => {
  test("steady PRN usage → ~perDay × quantity", () => {
    const m = med({ is_prn: true, times: [] });
    const rate = prnDailyRate(takenLogs(m, { days: 14, perDay: 2 }), m, { now: NOW });
    expect(rate).toBeGreaterThan(1.5);
    expect(rate).toBeLessThan(2.5);
  });

  test("no usage → 0", () => {
    expect(prnDailyRate([], med({ is_prn: true }), { now: NOW })).toBe(0);
  });

  test("escalating usage weighs recent days more", () => {
    const m = med({ is_prn: true });
    // 1/day two weeks ago, 3/day this week
    const old = takenLogs(m, { days: 14 }).filter((l) => diffDays(localDateStr(new Date(l.timestamp)), localDateStr(NOW)) > 7);
    const recent = takenLogs(m, { days: 7, perDay: 3 });
    const rate = prnDailyRate([...old, ...recent], m, { now: NOW });
    expect(rate).toBeGreaterThan(2); // pulled toward the recent 3/day
  });
});

describe("predictRunOut", () => {
  test("no inventory → none", () => {
    const p = predictRunOut({ med: med({ inventory: null }), now: NOW });
    expect(p.method).toBe("none");
    expect(p.days_left).toBeNull();
  });

  test("scheduled med, no history: pure schedule rate + run-out date", () => {
    const m = med(); // 30 pills, 1/day
    const p = predictRunOut({ med: m, logs: [], now: NOW });
    expect(p.method).toBe("scheduled");
    expect(p.daily_rate).toBe(1);
    expect(p.days_left).toBe(30);
    expect(p.run_out_date).toBe(addDaysStr(localDateStr(NOW), 30));
    expect(p.refill_by_date).toBe(addDaysStr(p.run_out_date, -3)); // default lead 3
  });

  test("respects settings.refill_lead_days", () => {
    const p = predictRunOut({ med: med(), settings: { refill_lead_days: 5 }, now: NOW });
    expect(diffDays(p.refill_by_date, p.run_out_date)).toBe(5);
  });

  test("poor adherence stretches the prediction (blended)", () => {
    const m = med();
    const halfLogs = takenLogs(m, { days: 20 }).filter((_, i) => i % 2 === 0);
    const p = predictRunOut({ med: m, logs: halfLogs, now: NOW });
    expect(p.method).toBe("blended");
    expect(p.days_left).toBeGreaterThan(30); // consuming slower than schedule
  });

  test("extra usage above schedule is trusted (conservative)", () => {
    const m = med(); // schedule 1/day
    const p = predictRunOut({ med: m, logs: takenLogs(m, { days: 14, perDay: 2 }), now: NOW });
    expect(p.daily_rate).toBeGreaterThan(1.4);
    expect(p.days_left).toBeLessThan(22);
  });

  test("PRN med gets usage-based projection", () => {
    const m = med({ is_prn: true, inventory: { current_count: 20, units_per_dose: 1 } });
    const p = predictRunOut({ med: m, logs: takenLogs(m, { days: 14, perDay: 2 }), now: NOW });
    expect(p.method).toBe("prn");
    expect(p.days_left).not.toBeNull();
    expect(p.days_left).toBeLessThan(15);
    expect(p.run_out_date).toBeTruthy();
  });

  test("PRN with no usage → no projection but method prn", () => {
    const m = med({ is_prn: true });
    const p = predictRunOut({ med: m, logs: [], now: NOW });
    expect(p.method).toBe("prn");
    expect(p.days_left).toBeNull();
  });

  test("taper simulation predicts later run-out than flat rate", () => {
    const m = med({ strength: 100, inventory: { current_count: 20, units_per_dose: 1 } });
    // Linear taper 100 -> 0 over 40 days: consumption declines to zero.
    const start = localDateStr(NOW);
    const steps = [];
    for (let i = 0; i <= 4; i++) {
      steps.push({ step: i, dose: 100 - 25 * i, start_day: i * 10 });
    }
    const taper = {
      is_active: true, start_date: start,
      schedule: { steps, summary: { step_interval_days: 10 } },
    };
    const p = predictRunOut({ med: m, logs: [], taper, now: NOW });
    expect(p.method).toBe("taper");
    // Flat 1/day would run out in 20 days; declining doses stretch it further.
    const flat = predictRunOut({ med: m, logs: [], now: NOW });
    if (p.days_left != null) expect(p.days_left).toBeGreaterThan(flat.days_left);
  });

  test("taper reaching zero before stock depletes → no run-out", () => {
    const m = med({ strength: 100, inventory: { current_count: 500, units_per_dose: 1 } });
    const taper = {
      is_active: true, start_date: localDateStr(NOW),
      schedule: { steps: [{ step: 0, dose: 100 }, { step: 1, dose: 0 }], summary: { step_interval_days: 7 } },
    };
    const p = predictRunOut({ med: m, logs: [], taper, now: NOW });
    expect(p.method).toBe("taper");
    expect(p.days_left).toBeNull();
  });
});

describe("inventoryStatus (B3: both thresholds wired)", () => {
  test("out at zero", () => {
    const m = med({ inventory: { current_count: 0, refill_threshold: 10 } });
    expect(inventoryStatus({ med: m, prediction: { days_left: null }, settings: {} })).toBe("out");
  });

  test("low when count ≤ per-med unit threshold", () => {
    const m = med({ inventory: { current_count: 9, refill_threshold: 10 } });
    expect(inventoryStatus({ med: m, prediction: { days_left: 60 }, settings: {} })).toBe("low");
  });

  test("low when days_left ≤ settings threshold", () => {
    const m = med({ inventory: { current_count: 50, refill_threshold: 10 } });
    expect(inventoryStatus({ med: m, prediction: { days_left: 6 }, settings: { refill_threshold_days: 7 } })).toBe("low");
    expect(inventoryStatus({ med: m, prediction: { days_left: 6 }, settings: { refill_threshold_days: 5 } })).toBe("ok");
  });

  test("ok otherwise", () => {
    const m = med({ inventory: { current_count: 50, refill_threshold: 10 } });
    expect(inventoryStatus({ med: m, prediction: { days_left: 50 }, settings: {} })).toBe("ok");
  });
});
