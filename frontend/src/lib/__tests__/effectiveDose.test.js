// Taper/cyclic-aware dose defaulting: cyclicMultiplierOn, effectiveDoseInfo,
// getToday off-day exclusion, taper pause freeze + resume shift.

jest.mock("localforage", () => {
  const stores = new Map();
  return {
    createInstance: () => ({
      getItem: async (k) => (stores.has(k) ? stores.get(k) : null),
      setItem: async (k, v) => { stores.set(k, v); return v; },
      removeItem: async (k) => { stores.delete(k); },
    }),
  };
});

import * as db from "../localdb";
import { taperDoseOnDate, generateTaperSchedule } from "../taperEngine";
import { localDateStr, addDaysStr } from "../dates";

const today = () => localDateStr();
const daysAgo = (n) => addDaysStr(today(), -n);

async function addMed(overrides = {}) {
  return db.createMedication({
    name: "EffMed", strength: 50, unit: "mg", form: "tablet",
    times: ["09:00"], days_of_week: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    is_prn: false, dose_quantity: 2,
    ...overrides,
  });
}

describe("cyclicMultiplierOn", () => {
  const plan = (overrides = {}) => ({
    is_active: true, start_date: "2026-01-01",
    pattern: [
      { phase: "on", duration: 5, dose_multiplier: 1 },
      { phase: "off", duration: 2, dose_multiplier: 0 },
    ],
    ...overrides,
  });

  test("walks the repeating pattern from start_date", () => {
    expect(db.cyclicMultiplierOn(plan(), "2026-01-01")).toEqual({ multiplier: 1, phase: "on" });   // day 0
    expect(db.cyclicMultiplierOn(plan(), "2026-01-05")).toEqual({ multiplier: 1, phase: "on" });   // day 4
    expect(db.cyclicMultiplierOn(plan(), "2026-01-06")).toEqual({ multiplier: 0, phase: "off" });  // day 5
    expect(db.cyclicMultiplierOn(plan(), "2026-01-07")).toEqual({ multiplier: 0, phase: "off" });  // day 6
    expect(db.cyclicMultiplierOn(plan(), "2026-01-08")).toEqual({ multiplier: 1, phase: "on" });   // day 7 wraps
    expect(db.cyclicMultiplierOn(plan(), "2026-01-20")).toEqual({ multiplier: 0, phase: "off" });  // day 19 = 5
  });

  test("fractional multipliers pass through (maintenance phases)", () => {
    const p = plan({ pattern: [{ phase: "on", duration: 4, dose_multiplier: 1 }, { phase: "maintenance", duration: 3, dose_multiplier: 0.5 }] });
    expect(db.cyclicMultiplierOn(p, "2026-01-05")).toEqual({ multiplier: 0.5, phase: "maintenance" }); // day 4
  });

  test("no plan / not started / inactive / empty pattern → multiplier 1", () => {
    expect(db.cyclicMultiplierOn(null, "2026-01-01").multiplier).toBe(1);
    expect(db.cyclicMultiplierOn(plan(), "2025-12-31").multiplier).toBe(1); // before start
    expect(db.cyclicMultiplierOn(plan({ is_active: false }), "2026-01-06").multiplier).toBe(1);
    expect(db.cyclicMultiplierOn(plan({ pattern: [] }), "2026-01-06").multiplier).toBe(1);
    expect(db.cyclicMultiplierOn(plan({ pattern: [{ phase: "on", duration: 0, dose_multiplier: 1 }] }), "2026-01-06").multiplier).toBe(1);
  });
});

describe("effectiveDoseInfo", () => {
  const med = { strength: 50, dose_quantity: 2 };

  test("plain med: strength × pills per dose", () => {
    const e = db.effectiveDoseInfo(med, {}, "2026-01-01");
    expect(e.dose).toBe(100);
    expect(e.quantity).toBe(2);
  });

  test("active taper overrides the base amount and derives pill count", () => {
    const schedule = generateTaperSchedule({ initialDose: 100, finalDose: 0, startDate: "2026-01-01", stepIntervalDays: 7, totalDays: 28, method: "linear" });
    const taper = { is_active: true, schedule, start_date: "2026-01-01" };
    const e = db.effectiveDoseInfo(med, { taper }, "2026-01-08"); // day 7 → step 1 = 75
    expect(e.dose).toBe(75);
    expect(e.quantity).toBe(1.5); // 75 / 50, quarter-rounded
    expect(e.taper_dose).toBe(75);
  });

  test("cyclic multiplier scales the dose; off day zeroes it", () => {
    const cyclic = { is_active: true, start_date: "2026-01-01", pattern: [{ phase: "on", duration: 4, dose_multiplier: 1 }, { phase: "maintenance", duration: 3, dose_multiplier: 0.5 }] };
    const on = db.effectiveDoseInfo(med, { cyclic }, "2026-01-02");
    expect(on.dose).toBe(100);
    const half = db.effectiveDoseInfo(med, { cyclic }, "2026-01-05");
    expect(half.dose).toBe(50);
    expect(half.quantity).toBe(1);
    expect(half.phase).toBe("maintenance");
  });

  test("no strength and no taper → dose unknown, quantity falls back to pills per dose", () => {
    const e = db.effectiveDoseInfo({ strength: null, dose_quantity: 2 }, {}, "2026-01-01");
    expect(e.dose).toBe(null);
    expect(e.quantity).toBe(2);
  });
});

describe("getToday with cyclic plans", () => {
  test("off days drop scheduled doses; maintenance days carry effective_dose", async () => {
    const med = await addMed({ name: "CycMed" });
    await db.createCyclic({
      medication_id: med.id, name: "cycle", type: "on-off-cycle",
      start_date: daysAgo(1),
      pattern: [{ phase: "off", duration: 2, dose_multiplier: 0 }, { phase: "on", duration: 2, dose_multiplier: 1 }],
    });
    // today is day 1 of the pattern → still "off"
    const off = await db.getToday();
    expect(off.doses.filter((d) => d.medication_id === med.id)).toHaveLength(0);
    // two days from now is day 3 → "on"
    const on = await db.getToday(addDaysStr(today(), 2));
    const dose = on.doses.find((d) => d.medication_id === med.id);
    expect(dose).toBeTruthy();
    expect(dose.effective_dose).toBe(100); // 50 mg × 2 pills
    expect(dose.cyclic_multiplier).toBe(1);
  });

  test("active taper flows into effective_dose and pill quantity", async () => {
    const med = await addMed({ name: "TapMed" });
    await db.createTaper({ medication_id: med.id, initial_dose: 100, final_dose: 0, unit: "mg", method: "linear", total_days: 28, step_interval_days: 7, start_date: daysAgo(7) });
    const t = await db.getToday();
    const dose = t.doses.find((d) => d.medication_id === med.id);
    expect(dose.taper_dose).toBe(75); // day 7 → step 1
    expect(dose.effective_dose).toBe(75);
    expect(dose.dose_quantity).toBe(1.5);
  });
});

describe("taper pause / resume", () => {
  test("taperDoseOnDate freezes at paused_on while paused", () => {
    const schedule = generateTaperSchedule({ initialDose: 100, finalDose: 0, startDate: daysAgo(14), stepIntervalDays: 7, totalDays: 28, method: "linear" });
    const base = { schedule, start_date: daysAgo(14) };
    expect(taperDoseOnDate({ ...base }, today())).toBe(50); // day 14 → step 2
    expect(taperDoseOnDate({ ...base, is_paused: true, paused_on: daysAgo(7) }, today())).toBe(75); // frozen at day 7
    expect(taperDoseOnDate({ ...base, is_paused: true }, today())).toBe(50); // legacy pause: falls back to query date
  });

  test("resume shifts the schedule forward by the paused duration", async () => {
    const med = await addMed({ name: "PauseMed" });
    const taper = await db.createTaper({ medication_id: med.id, initial_dose: 100, final_dose: 0, unit: "mg", method: "linear", total_days: 28, step_interval_days: 7, start_date: daysAgo(14) });
    await db.updateTaper(taper.id, { is_paused: true });
    // Backdate the pause by a week (mock stores objects by reference).
    const raw = (await db.exportData()).profileData;
    const pid = Object.keys(raw)[0];
    const stored = raw[pid].tapers.find((t) => t.id === taper.id);
    stored.paused_on = daysAgo(7);
    // While paused, current dose holds at the pause-date step (day 7 → 75).
    const paused = await db.getTaper(taper.id);
    expect(paused.current_dose).toBe(75);
    // Resume: start_date shifts +7 days and the schedule regenerates to match.
    await db.updateTaper(taper.id, { is_paused: false });
    const resumed = await db.getTaper(taper.id);
    expect(resumed.paused_on).toBe(null);
    expect(resumed.start_date).toBe(daysAgo(7));
    expect(resumed.schedule.summary.start_date).toBe(daysAgo(7));
    expect(resumed.current_dose).toBe(75); // picks up where it left off
  });
});

describe("adjustTaper (backs the AI's adjust_taper_plan tool)", () => {
  // Until now the only way to change a taper's core parameters (pace,
  // target, method) was updateTaper, which only ever touched
  // is_active/is_paused/notes -- there was no "reshape the remaining plan"
  // operation at all, for the UI or otherwise.
  test("reshapes the remaining schedule from today's actual dose, keeping the same taper id", async () => {
    const med = await addMed({ name: "AdjustMed" });
    const taper = await db.createTaper({ medication_id: med.id, initial_dose: 100, final_dose: 0, unit: "mg", method: "linear", total_days: 28, step_interval_days: 7, start_date: daysAgo(14) });
    const before = await db.getTaper(taper.id);
    expect(before.current_dose).toBe(50); // day 14 of 28, linear -> halfway
    const updated = await db.adjustTaper(taper.id, { total_days: 42 });
    expect(updated.id).toBe(taper.id); // adjusted in place, not a new plan
    expect(updated.initial_dose).toBe(50); // today's actual dose is the new starting point
    expect(updated.start_date).toBe(today());
    expect(updated.total_days).toBe(42);
    expect(updated.schedule.steps[0].dose).toBe(50);
    expect(updated.schedule.steps[updated.schedule.steps.length - 1].dose).toBe(0); // final_dose unchanged
  });

  test("slowing down produces a shallower per-step reduction than the original pace", async () => {
    const med = await addMed({ name: "SlowMed" });
    const taper = await db.createTaper({ medication_id: med.id, initial_dose: 100, final_dose: 0, unit: "mg", method: "linear", total_days: 28, step_interval_days: 7, start_date: daysAgo(7) });
    const fast = (await db.getTaper(taper.id)).current_dose;
    const slowed = await db.adjustTaper(taper.id, { total_days: 70 }); // stretch the remainder way out
    const firstDrop = slowed.schedule.steps[0].dose - slowed.schedule.steps[1].dose;
    const originalDrop = 100 / 4; // 28 days / 7-day steps = 4 steps, linear
    expect(firstDrop).toBeLessThan(originalDrop);
    expect(fast).toBeGreaterThan(0); // sanity: taper was actually mid-course
  });

  test("changing final_dose retargets the plan's endpoint", async () => {
    const med = await addMed({ name: "RetargetMed" });
    const taper = await db.createTaper({ medication_id: med.id, initial_dose: 100, final_dose: 0, unit: "mg", method: "linear", total_days: 28, step_interval_days: 7, start_date: daysAgo(7) });
    const updated = await db.adjustTaper(taper.id, { final_dose: 25 });
    expect(updated.final_dose).toBe(25);
    expect(updated.schedule.steps[updated.schedule.steps.length - 1].dose).toBe(25);
  });

  test("un-pauses a paused taper, since the adjustment reshapes it from today", async () => {
    const med = await addMed({ name: "UnpauseMed" });
    const taper = await db.createTaper({ medication_id: med.id, initial_dose: 100, final_dose: 0, unit: "mg", method: "linear", total_days: 28, step_interval_days: 7, start_date: daysAgo(7) });
    await db.updateTaper(taper.id, { is_paused: true });
    const updated = await db.adjustTaper(taper.id, { total_days: 21 });
    expect(updated.is_paused).toBe(false);
    expect(updated.paused_on).toBe(null);
  });

  test("rejects a final dose above the current dose, and refuses to adjust a finished/inactive taper", async () => {
    const med = await addMed({ name: "InvalidAdjustMed" });
    const taper = await db.createTaper({ medication_id: med.id, initial_dose: 100, final_dose: 0, unit: "mg", method: "linear", total_days: 28, step_interval_days: 7, start_date: daysAgo(7) });
    await expect(db.adjustTaper(taper.id, { final_dose: 999 })).rejects.toThrow(/final dose/i);
    await db.updateTaper(taper.id, { is_active: false });
    await expect(db.adjustTaper(taper.id, { total_days: 10 })).rejects.toThrow(/active/i);
    await expect(db.adjustTaper("missing-id", {})).rejects.toThrow(/not found/i);
  });
});

describe("logDefaultsForMed", () => {
  test("returns the taper-aware default for today", async () => {
    const med = await addMed({ name: "DefaultsMed" });
    await db.createTaper({ medication_id: med.id, initial_dose: 100, final_dose: 0, unit: "mg", method: "linear", total_days: 28, step_interval_days: 7, start_date: daysAgo(7) });
    const d = await db.logDefaultsForMed(med.id);
    expect(d.dose).toBe(75);
    expect(d.quantity).toBe(1.5);
    await expect(db.logDefaultsForMed("nope")).rejects.toThrow(/not found/i);
  });
});
