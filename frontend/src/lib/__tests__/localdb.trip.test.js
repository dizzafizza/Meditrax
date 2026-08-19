// Vacation planner — packing quantities simulated through the real schedule
// engine (weekday patterns, tapers) plus usage-based estimates for PRN meds.

jest.mock("localforage", () => {
  const stores = new Map();
  return {
    createInstance: () => ({
      getItem: async (k) => (stores.has(k) ? stores.get(k) : null),
      setItem: async (k, v) => { stores.set(k, v); return v; },
      removeItem: async (k) => { stores.delete(k); },
      keys: async () => [...stores.keys()],
    }),
  };
});

import * as db from "../localdb";
import { localDateStr, addDaysStr } from "../dates";

const today = localDateStr();
const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

async function med(overrides = {}) {
  return db.createMedication({
    name: overrides.name || "TripMed", strength: 10, unit: "mg", form: "tablet",
    times: ["09:00"], days_of_week: ALL_DAYS, is_prn: false, dose_quantity: 1,
    start_date: addDaysStr(today, -30),
    ...overrides,
  });
}

const itemFor = (plan, m) => plan.items.find((x) => x.medication_id === m.id);

describe("planTrip", () => {
  test("a twice-daily med over an inclusive 7-day trip plus buffer, checked against stock", async () => {
    const m = await med({ name: "TwiceDaily", times: ["09:00", "21:00"], dose_quantity: 1, inventory: { current_count: 20, unit: "tablets", units_per_dose: 1 } });
    const plan = await db.planTrip({ start: today, end: addDaysStr(today, 6), buffer_days: 2 });
    const it = itemFor(plan, m);
    expect(plan.days).toBe(7); // inclusive on both ends
    expect(it.trip_units).toBe(14); // 2/day x 7
    expect(it.buffer_units).toBe(4); // 2/day x 2 buffer days
    expect(it.total_units).toBe(18);
    expect(it.enough).toBe(true); // 20 on hand
    expect(it.shortfall).toBeNull();
  });

  test("a weekday-limited schedule only counts its own days", async () => {
    const m = await med({ name: "MondayOnly", days_of_week: ["mon"], dose_quantity: 2 });
    // Any 7 consecutive days contain each weekday exactly once; 14 contain it twice.
    const week = await db.planTrip({ start: today, end: addDaysStr(today, 6), buffer_days: 0 });
    expect(itemFor(week, m).trip_units).toBe(2); // one Monday x 2 pills
    const fortnight = await db.planTrip({ start: today, end: addDaysStr(today, 13), buffer_days: 0 });
    expect(itemFor(fortnight, m).trip_units).toBe(4);
  });

  test("shortfall is reported and sorted to the top when stock can't cover the trip", async () => {
    const m = await med({ name: "ShortStock", times: ["09:00"], dose_quantity: 1, inventory: { current_count: 3, unit: "tablets", units_per_dose: 1 } });
    const plan = await db.planTrip({ start: today, end: addDaysStr(today, 9), buffer_days: 0 });
    const it = itemFor(plan, m);
    expect(it.total_units).toBe(10);
    expect(it.enough).toBe(false);
    expect(it.shortfall).toBe(7);
    expect(plan.shortfalls).toBeGreaterThanOrEqual(1);
    expect(plan.items[0].shortfall).toBe(Math.max(...plan.items.map((x) => x.shortfall || 0)));
  });

  test("an as-needed med uses real average daily usage; with no history it's surfaced as unknown", async () => {
    const used = await med({ name: "PrnUsed", is_prn: true, times: [], inventory: { current_count: 100, unit: "tablets", units_per_dose: 1 } });
    // 2 units every day for the last 10 days -> rate ~2/day.
    for (let i = 1; i <= 10; i++) {
      const ts = new Date(); ts.setDate(ts.getDate() - i); ts.setHours(12, 0, 0, 0);
      await db.createLog({ medication_id: used.id, status: "taken", quantity: 2, dose_taken: 20, timestamp: ts.toISOString() });
    }
    const fresh = await med({ name: "PrnFresh", is_prn: true, times: [] });
    const plan = await db.planTrip({ start: today, end: addDaysStr(today, 4), buffer_days: 0 });
    const u = itemFor(plan, used);
    expect(u.basis).toBe("usage");
    expect(u.total_units).toBeGreaterThanOrEqual(9); // ~2/day x 5 days
    expect(u.total_units).toBeLessThanOrEqual(11);
    const f = itemFor(plan, fresh);
    expect(f.basis).toBe("unknown");
    expect(f.total_units).toBeNull();
    expect(plan.unknowns).toBeGreaterThanOrEqual(1);
  });

  test("a taper declining during the trip packs less than the flat schedule would", async () => {
    const flat = await med({ name: "FlatControl", dose_quantity: 2 });
    const tapered = await med({ name: "TaperingMed", dose_quantity: 2, is_tapering: true });
    await db.createTaper({ medication_id: tapered.id, initial_dose: 20, final_dose: 0, unit: "mg", method: "linear", total_days: 10, step_interval_days: 2, start_date: today });
    const plan = await db.planTrip({ start: today, end: addDaysStr(today, 13), buffer_days: 0 });
    const flatUnits = itemFor(plan, flat).total_units;
    const taperUnits = itemFor(plan, tapered)?.total_units ?? 0;
    expect(flatUnits).toBe(28); // 2/day x 14
    expect(taperUnits).toBeGreaterThan(0);
    expect(taperUnits).toBeLessThan(flatUnits);
    expect(itemFor(plan, tapered).is_tapering).toBe(true);
  });

  test("date validation: garbage, inverted ranges, and absurd lengths are rejected", async () => {
    await expect(db.planTrip({})).rejects.toThrow(/valid start and end/i);
    await expect(db.planTrip({ start: "not-a-date", end: today })).rejects.toThrow(/valid start and end/i);
    await expect(db.planTrip({ start: today, end: addDaysStr(today, -1) })).rejects.toThrow(/end on or after/i);
    await expect(db.planTrip({ start: today, end: addDaysStr(today, 500) })).rejects.toThrow(/longer than a year/i);
  });

  test("a single-day trip counts exactly one day", async () => {
    const m = await med({ name: "OneDayMed", times: ["08:00", "20:00"] });
    const plan = await db.planTrip({ start: today, end: today, buffer_days: 0 });
    expect(plan.days).toBe(1);
    expect(itemFor(plan, m).trip_units).toBe(2);
  });
});
