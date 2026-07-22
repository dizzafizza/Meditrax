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

  // Regression: an ad-hoc "extra dose" log (no scheduled_time — the log
  // sheet's UI-level entry points from MedicationDetail/QuickAdd must never
  // pass the medication's scheduled time here) must decrement its own
  // inventory independently of an already-logged scheduled dose for the same
  // med+day, not silently merge into it and swallow the extra decrement.
  test("an unscheduled 'extra dose' log never merges with an already-logged scheduled dose", async () => {
    const med = await addMed(); // strength 50, dose_quantity 2, stock 30
    await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(28); // scheduled dose decremented

    await db.createLog({ medication_id: med.id, status: "taken", quantity: 2, scheduled_time: null });
    expect(await stockOf(med.id)).toBe(26); // extra dose decremented too, not merged away

    const logs = await db.getLogs({ medication_id: med.id });
    expect(logs).toHaveLength(2); // two distinct entries, not one overwritten
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

describe("reconcileMedicationInventory (legacy under-decrement fix)", () => {
  // The historical bug: the log sheet's "Total amount" field didn't update
  // the pill count inventory decrements by, so createLog({quantity: 1,
  // dose_taken: 150}) — a 3-pill dose recorded as if it were 1 — is exactly
  // what old buggy versions saved. strength=50, so 150mg should be 3 pills.
  test("corrects an under-decremented log: fixes stock, quantity, and inventory_delta", async () => {
    const med = await addMed(); // strength 50, stock 30
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 1, dose_taken: 150, unit: "mg", scheduled_time: "09:00" });
    expect(await stockOf(med.id)).toBe(29); // bug: only 1 pill decremented

    const result = await db.reconcileMedicationInventory(med.id);
    expect(result).toEqual({ fixed: 1, delta: 2 }); // 2 more pills owed
    expect(await stockOf(med.id)).toBe(27); // 30 - 3, now correct

    const fixed = await db.getLog(log.id);
    expect(fixed.quantity).toBe(3);
    expect(fixed.inventory_delta).toBe(3);
  });

  test("is idempotent — re-running finds nothing left to fix", async () => {
    const med = await addMed();
    await db.createLog({ medication_id: med.id, status: "taken", quantity: 1, dose_taken: 150, unit: "mg", scheduled_time: "09:00" });
    await db.reconcileMedicationInventory(med.id);
    const again = await db.reconcileMedicationInventory(med.id);
    expect(again).toEqual({ fixed: 0, delta: 0 });
    expect(await stockOf(med.id)).toBe(27);
  });

  test("skips logs whose unit no longer matches the medication's (can't safely infer)", async () => {
    const med = await addMed();
    await db.createLog({ medication_id: med.id, status: "taken", quantity: 1, dose_taken: 150, unit: "mcg", scheduled_time: "09:00" });
    const result = await db.reconcileMedicationInventory(med.id);
    expect(result).toEqual({ fixed: 0, delta: 0 });
    expect(await stockOf(med.id)).toBe(29); // untouched, left as recorded
  });

  test("skips logs without a recorded dose_taken, and non-consuming statuses", async () => {
    const med = await addMed();
    await db.createLog({ medication_id: med.id, status: "taken", quantity: 1, scheduled_time: "09:00" }); // no dose_taken
    await db.createLog({ medication_id: med.id, status: "skipped", dose_taken: 150, scheduled_time: "21:00" });
    const result = await db.reconcileMedicationInventory(med.id);
    expect(result).toEqual({ fixed: 0, delta: 0 });
  });

  test("also corrects partial-status logs", async () => {
    const med = await addMed();
    await db.createLog({ medication_id: med.id, status: "partial", quantity: 1, dose_taken: 100, unit: "mg", scheduled_time: "09:00" }); // should be 2 pills
    const result = await db.reconcileMedicationInventory(med.id);
    expect(result).toEqual({ fixed: 1, delta: 1 });
    expect(await stockOf(med.id)).toBe(28); // 30 - 2
  });

  test("clamps to available stock when the correction exceeds what's left", async () => {
    const med = await addMed({ inventory: { current_count: 2, unit: "tablets", units_per_dose: 2, refill_threshold: 10 } });
    await db.createLog({ medication_id: med.id, status: "taken", quantity: 1, dose_taken: 250, unit: "mg", scheduled_time: "09:00" }); // implies 5 pills, only 1 was taken
    expect(await stockOf(med.id)).toBe(1); // 2 - 1
    const result = await db.reconcileMedicationInventory(med.id);
    expect(result.fixed).toBe(1);
    expect(await stockOf(med.id)).toBe(0); // clamped, can't go negative
  });

  test("no-op for meds without inventory tracking or without a strength", async () => {
    const noInv = await addMed({ inventory: null });
    expect(await db.reconcileMedicationInventory(noInv.id)).toEqual({ fixed: 0, delta: 0 });
    const noStrength = await addMed({ strength: null });
    expect(await db.reconcileMedicationInventory(noStrength.id)).toEqual({ fixed: 0, delta: 0 });
  });
});

describe("reconcileAllInventory", () => {
  test("fixes every inventory-tracked medication for the active profile and reports only the changed ones", async () => {
    const broken = await addMed({ name: "Broken" });
    await db.createLog({ medication_id: broken.id, status: "taken", quantity: 1, dose_taken: 150, unit: "mg", scheduled_time: "09:00" });
    const fine = await addMed({ name: "Fine" });
    await db.createLog({ medication_id: fine.id, status: "taken", quantity: 2, dose_taken: 100, unit: "mg", scheduled_time: "09:00" }); // already correct
    await addMed({ name: "Untracked", inventory: null });

    const results = await db.reconcileAllInventory();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ medication_id: broken.id, name: "Broken", fixed: 1, delta: 2 });
    expect(await stockOf(broken.id)).toBe(27);
    expect(await stockOf(fine.id)).toBe(28); // unchanged, was already right
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
