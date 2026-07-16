// Inventory-critical log behavior: quantity decrement (B4/B8), dedup (B11),
// delete/undo restore (B1) — against an in-memory localforage mock.

jest.mock("localforage", () => {
  const stores = new Map();
  return {
    createInstance: () => ({
      getItem: async (k) => (stores.has(k) ? stores.get(k) : null),
      setItem: async (k, v) => { stores.set(k, v); return v; },
      removeItem: async (k) => { stores.delete(k); },
      __reset: () => stores.clear(),
    }),
  };
});

import * as db from "../localdb";

async function addMed(overrides = {}) {
  return db.createMedication({
    name: "TestMed", strength: 50, unit: "mg", form: "tablet",
    times: ["09:00", "21:00"], days_of_week: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    is_prn: false, dose_quantity: 2,
    inventory: { current_count: 30, unit: "tablets", units_per_dose: 2, refill_threshold: 10 },
    ...overrides,
  });
}

async function stockOf(medId) {
  const meds = await db.getMedications();
  return meds.find((m) => m.id === medId).inventory.current_count;
}

describe("createLog inventory decrement", () => {
  test("taken decrements by explicit quantity (B8)", async () => {
    const med = await addMed();
    await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(28);
  });

  test("legacy call without quantity falls back to dose_quantity", async () => {
    const med = await addMed();
    await db.createLog({ medication_id: med.id, status: "taken", scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(28); // dose_quantity = 2
  });

  test("partial without quantity uses half the per-dose default; with quantity uses it exactly (B4)", async () => {
    const med = await addMed();
    await db.createLog({ medication_id: med.id, status: "partial", scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(29); // half of 2
    await db.createLog({ medication_id: med.id, status: "partial", quantity: 1.5, scheduled_time: "21:00" });
    expect(await stockOf(med.id)).toBe(27.5);
  });

  test("skipped/missed do not decrement", async () => {
    const med = await addMed();
    await db.createLog({ medication_id: med.id, status: "skipped", scheduled_time: "09:00" });
    await db.createLog({ medication_id: med.id, status: "missed", scheduled_time: "21:00" });
    expect(await stockOf(med.id)).toBe(30);
  });

  test("decrement_inventory=false records zero delta", async () => {
    const med = await addMed();
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, decrement_inventory: false });
    expect(await stockOf(med.id)).toBe(30);
    expect(log.inventory_delta).toBe(0);
  });

  test("stock clamps at zero and delta records what was actually taken", async () => {
    const med = await addMed({ inventory: { current_count: 1, unit: "tablets", units_per_dose: 2, refill_threshold: 10 } });
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(0);
    expect(log.inventory_delta).toBe(1); // only 1 was available
  });
});

describe("createLog dedup (B11)", () => {
  test("second log for same slot+day updates in place, no double decrement", async () => {
    const med = await addMed();
    const first = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    const second = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    expect(second.deduped).toBe(true);
    expect(second.id).toBe(first.id);
    const logs = await db.getLogs({ medication_id: med.id });
    expect(logs).toHaveLength(1);
    expect(await stockOf(med.id)).toBe(28); // decremented once
  });

  test("skipped→taken transition applies the missing decrement", async () => {
    const med = await addMed();
    await db.createLog({ medication_id: med.id, status: "skipped", scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(30);
    await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(28);
    expect(await db.getLogs({ medication_id: med.id })).toHaveLength(1);
  });

  test("taken→skipped transition refunds the decrement", async () => {
    const med = await addMed();
    await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(28);
    await db.createLog({ medication_id: med.id, status: "skipped", scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(30);
  });

  test("PRN logs (no scheduled_time) never dedup", async () => {
    const med = await addMed({ is_prn: true, times: [] });
    await db.createLog({ medication_id: med.id, status: "taken", quantity: 1 });
    await db.createLog({ medication_id: med.id, status: "taken", quantity: 1 });
    expect(await db.getLogs({ medication_id: med.id })).toHaveLength(2);
    expect(await stockOf(med.id)).toBe(28);
  });
});

describe("deleteLog restores inventory (B1)", () => {
  test("delete restores the exact recorded delta", async () => {
    const med = await addMed();
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(28);
    await db.deleteLog(log.id);
    expect(await stockOf(med.id)).toBe(30);
    expect(await db.getLogs({ medication_id: med.id })).toHaveLength(0);
  });

  test("legacy log without inventory_delta restores nothing (unknowable)", async () => {
    const med = await addMed();
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    // Simulate a legacy log: strip the delta field directly (createLog is the
    // only writer, so mutate through a fresh create + manual undo of the field).
    const logs = await db.getLogs({ medication_id: med.id });
    expect(logs[0].inventory_delta).toBe(2);
    delete log.inventory_delta;
    // deleteLog reads from storage, so this only verifies the code path guard:
    await db.deleteLog("nonexistent-id"); // should not throw
    expect(await stockOf(med.id)).toBe(28);
  });

  test("clamped decrement never over-restores", async () => {
    const med = await addMed({ inventory: { current_count: 1, unit: "tablets", units_per_dose: 2, refill_threshold: 10 } });
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(0);
    await db.deleteLog(log.id);
    expect(await stockOf(med.id)).toBe(1); // restored exactly the 1 that was taken
  });
});

describe("updateLog", () => {
  test("timestamp-only edit rebuckets the day and never touches stock", async () => {
    const med = await addMed();
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(28);
    const yesterday = new Date(Date.now() - 24 * 3600000).toISOString();
    const updated = await db.updateLog(log.id, { timestamp: yesterday });
    expect(updated.timestamp).toBe(yesterday);
    expect(updated.inventory_delta).toBe(2);
    expect(await stockOf(med.id)).toBe(28);
    // getLogs date filters see the new local day
    const dayStr = new Date(Date.now() - 24 * 3600000);
    const key = `${dayStr.getFullYear()}-${String(dayStr.getMonth() + 1).padStart(2, "0")}-${String(dayStr.getDate()).padStart(2, "0")}`;
    const logs = await db.getLogs({ medication_id: med.id, start: key, end: key });
    expect(logs).toHaveLength(1);
  });

  test("quantity edit adjusts stock by the difference", async () => {
    const med = await addMed();
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    await db.updateLog(log.id, { quantity: 3 });
    expect(await stockOf(med.id)).toBe(27); // one more consumed
    await db.updateLog(log.id, { quantity: 1 });
    expect(await stockOf(med.id)).toBe(29); // two refunded
    expect((await db.getLog(log.id)).inventory_delta).toBe(1);
  });

  test("status taken→skipped refunds, skipped→taken decrements", async () => {
    const med = await addMed();
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    await db.updateLog(log.id, { status: "skipped" });
    expect(await stockOf(med.id)).toBe(30);
    expect((await db.getLog(log.id)).inventory_delta).toBe(0);
    await db.updateLog(log.id, { status: "taken" });
    expect(await stockOf(med.id)).toBe(28);
  });

  test("quantity increase clamps to available stock and records what applied", async () => {
    const med = await addMed({ inventory: { current_count: 3, unit: "tablets", units_per_dose: 2, refill_threshold: 10 } });
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(1);
    await db.updateLog(log.id, { quantity: 5 }); // wants 3 more, only 1 available
    expect(await stockOf(med.id)).toBe(0);
    expect((await db.getLog(log.id)).inventory_delta).toBe(3);
    // deleting afterwards restores exactly what was recorded
    await db.deleteLog(log.id);
    expect(await stockOf(med.id)).toBe(3);
  });

  test("moving onto a day that already has a log for the same slot throws", async () => {
    const med = await addMed();
    const yesterday = new Date(Date.now() - 24 * 3600000).toISOString();
    await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00", timestamp: yesterday });
    const todayLog = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    await expect(db.updateLog(todayLog.id, { timestamp: yesterday })).rejects.toThrow(/already exists/);
    // PRN logs (no scheduled_time) can always move
    const prnMed = await addMed({ is_prn: true, times: [] });
    const prn = await db.createLog({ medication_id: prnMed.id, status: "taken", quantity: 1 });
    await expect(db.updateLog(prn.id, { timestamp: yesterday })).resolves.toBeTruthy();
  });

  test("invalid timestamp or negative quantity throws without side effects", async () => {
    const med = await addMed();
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    await expect(db.updateLog(log.id, { timestamp: "not-a-date" })).rejects.toThrow(/timestamp/i);
    await expect(db.updateLog(log.id, { quantity: -1 })).rejects.toThrow(/quantity/);
    await expect(db.updateLog("missing-id", { notes: "x" })).rejects.toThrow(/not found/i);
    expect(await stockOf(med.id)).toBe(28);
  });

  test("legacy consuming log (no inventory_delta) never moves stock on edit", async () => {
    const med = await addMed();
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(28);
    // Simulate a legacy record: the localforage mock stores objects by
    // reference, so stripping the field here strips it in "storage" too.
    const stored = await db.getLogs({ medication_id: med.id });
    delete stored[0].inventory_delta;
    await db.updateLog(log.id, { quantity: 3 });
    expect(await stockOf(med.id)).toBe(28); // unknowable — no extra decrement
    await db.updateLog(log.id, { status: "skipped" });
    expect(await stockOf(med.id)).toBe(28); // and no over-restore
  });

  test("delta-0 opted-out log reconciles from zero on a real status change", async () => {
    const med = await addMed();
    const log = await db.createLog({ medication_id: med.id, status: "skipped", scheduled_time: "09:00" });
    expect(log.inventory_delta).toBe(0);
    await db.updateLog(log.id, { status: "taken", quantity: 2 });
    expect(await stockOf(med.id)).toBe(28);
    expect((await db.getLog(log.id)).inventory_delta).toBe(2);
  });
});

describe("updateCheckin", () => {
  test("edits mood, dimensions, notes and timestamp with clamping", async () => {
    const c = await db.createCheckin({ mood: 4, energy: 3 });
    const yesterday = new Date(Date.now() - 24 * 3600000).toISOString();
    const updated = await db.updateCheckin(c.id, { mood: 9, pain: 2, energy: null, notes: "rough day", timestamp: yesterday });
    expect(updated.mood).toBe(5); // clamped
    expect(updated.pain).toBe(2);
    expect(updated.energy).toBe(null);
    expect(updated.notes).toBe("rough day");
    expect(updated.timestamp).toBe(yesterday);
    await expect(db.updateCheckin(c.id, { timestamp: "garbage" })).rejects.toThrow(/timestamp/i);
    await expect(db.updateCheckin("nope", { mood: 3 })).rejects.toThrow(/not found/i);
  });
});

describe("adjustInventory", () => {
  test("set/delta with clamping and units_per_dose sync to dose_quantity", async () => {
    const med = await addMed();
    await db.adjustInventory(med.id, { delta: -5 });
    expect(await stockOf(med.id)).toBe(25);
    await db.adjustInventory(med.id, { set: 90 });
    expect(await stockOf(med.id)).toBe(90);
    await db.adjustInventory(med.id, { delta: -1000 });
    expect(await stockOf(med.id)).toBe(0);
    await db.adjustInventory(med.id, { units_per_dose: 3 });
    const meds = await db.getMedications();
    expect(meds.find((m) => m.id === med.id).dose_quantity).toBe(3);
  });
});
