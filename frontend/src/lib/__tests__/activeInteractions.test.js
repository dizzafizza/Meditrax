// getActiveSubstances + getInteractionsForMedication: the data-layer glue that
// powers the pre-dose interaction warning and the home-screen med-card boxes.

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

const prn = (name, category) => ({ name, category, strength: 10, unit: "mg", is_prn: true, times: [] });

describe("getActiveSubstances", () => {
  test("includes meds taken within the window and active effect sessions, excludes stale/skipped", async () => {
    const oxy = await db.createMedication(prn("Oxycodone", "opioid"));
    const booze = await db.createMedication(prn("Alcohol", "depressant"));
    const old = await db.createMedication(prn("OldMed", "stimulant"));
    const skip = await db.createMedication(prn("SkipMed", "benzodiazepine"));

    // recent taken dose
    await db.createLog({ medication_id: oxy.id, status: "taken", quantity: 1, scheduled_time: null });
    // a skipped dose shouldn't count
    await db.createLog({ medication_id: skip.id, status: "skipped", quantity: 0, scheduled_time: null });
    // a stale dose (backdate via reference mutation on the mock store)
    const staleLog = await db.createLog({ medication_id: old.id, status: "taken", quantity: 1, scheduled_time: null });
    const raw = (await db.exportData()).profileData;
    const pid = Object.keys(raw)[0];
    raw[pid].logs.find((l) => l.id === staleLog.id).timestamp = new Date(Date.now() - 24 * 3600000).toISOString();
    // an active effect session (no recent log)
    await db.startEffectSession({ medication_id: booze.id, dose: 2 });

    const active = await db.getActiveSubstances();
    const names = active.map((m) => m.name).sort();
    expect(names).toEqual(["Alcohol", "Oxycodone"]);
    expect(active.every((m) => m.category)).toBe(true); // category carried through for the checker
  });
});

describe("getInteractionsForMedication", () => {
  test("flags a candidate med against active substances, resolving its category by id", async () => {
    const oxy = await db.createMedication(prn("Oxycodone2", "opioid"));
    const benzo = await db.createMedication(prn("Alprazolam2", "benzodiazepine"));
    await db.createLog({ medication_id: oxy.id, status: "taken", quantity: 1, scheduled_time: null });

    // logging the benzo now should warn (opioid + benzo, severe). The mock
    // store is shared across this file's tests, so other active depressants
    // may also surface — assert the specific expected pairing is present and
    // that every finding is a severe depressant-stacking one.
    const findings = await db.getInteractionsForMedication(benzo.id);
    const oxyHit = findings.find((f) => f.otherName === "Oxycodone2");
    expect(oxyHit).toBeTruthy();
    expect(oxyHit.reason).toMatch(/depress/i);
    expect(findings.every((f) => f.severity === "severe")).toBe(true);

    // a thyroid med never interacts with these categories, regardless of what's active
    const clean = await db.createMedication(prn("Levothyroxine2", "thyroid"));
    expect(await db.getInteractionsForMedication(clean.id)).toEqual([]);
    // unknown id → empty, not a throw
    expect(await db.getInteractionsForMedication("nope")).toEqual([]);
  });
});

// Regression: the active-substance window used to be a flat 12 h for every
// medication, so a short-acting substance kept flashing a red interaction
// warning for most of a day after its effects were plainly over.
describe("the active window follows each substance's own effect duration", () => {
  const backdateLog = async (logId, minutesAgo) => {
    const raw = (await db.exportData()).profileData;
    const pid = Object.keys(raw)[0];
    raw[pid].logs.find((l) => l.id === logId).timestamp = new Date(Date.now() - minutesAgo * 60000).toISOString();
  };

  test("a short-acting substance drops out once its curve is over, while a long-acting one is still counted", async () => {
    // stimulant-fast (cocaine-like): 60 min duration -> 75 min curve, floored
    // to the 2 h minimum window. antidepressant: 720 min -> capped at 12 h.
    const fast = await db.createMedication({ name: "FastSubstance", strength: 1, unit: "mg", category: "stimulant-fast", form: "tablet", is_prn: true, times: [] });
    const slow = await db.createMedication({ name: "SlowSubstance", strength: 1, unit: "mg", category: "antidepressant", form: "tablet", is_prn: true, times: [] });
    const fastLog = await db.createLog({ medication_id: fast.id, status: "taken", quantity: 1, scheduled_time: null });
    const slowLog = await db.createLog({ medication_id: slow.id, status: "taken", quantity: 1, scheduled_time: null });

    // 4 hours ago: the fast substance's curve (and its 2 h floor) is long
    // over; the antidepressant's 12 h curve is still running.
    await backdateLog(fastLog.id, 240);
    await backdateLog(slowLog.id, 240);
    const names = (await db.getActiveSubstances()).map((m) => m.name);
    expect(names).not.toContain("FastSubstance");
    expect(names).toContain("SlowSubstance");
  });

  test("a substance taken just now is always active, whatever its duration", async () => {
    const fast = await db.createMedication({ name: "JustTakenFast", strength: 1, unit: "mg", category: "stimulant-fast", form: "tablet", is_prn: true, times: [] });
    await db.createLog({ medication_id: fast.id, status: "taken", quantity: 1, scheduled_time: null });
    expect((await db.getActiveSubstances()).map((m) => m.name)).toContain("JustTakenFast");
  });

  test("an active effect session keeps a substance active regardless of the log window", async () => {
    const med = await db.createMedication({ name: "SessionKeepsActive", strength: 1, unit: "mg", category: "stimulant-fast", form: "tablet", is_prn: true, times: [] });
    const log = await db.createLog({ medication_id: med.id, status: "taken", quantity: 1, scheduled_time: null });
    await db.startEffectSession({ medication_id: med.id, dose: 1 });
    await backdateLog(log.id, 600); // log far outside any window
    expect((await db.getActiveSubstances()).map((m) => m.name)).toContain("SessionKeepsActive");
  });
});

describe("getMedicationMaxDaily", () => {
  test("resolves the catalog max_daily_dose for a medication created from the catalog", async () => {
    // Oxycodone's curated entry has no max (null); Ibuprofen's is 3200.
    const ibu = (await db.searchCatalog("Ibuprofen", 1))[0];
    const med = await db.createMedication({ name: ibu.name, strength: 200, unit: "mg", category: ibu.category, catalog_id: ibu.id, is_prn: true, times: [] });
    expect(await db.getMedicationMaxDaily(med.id)).toBe(3200);
  });

  test("falls back to name match when no catalog_id, and returns null for unknown/none", async () => {
    const med = await db.createMedication({ name: "Alprazolam", strength: 1, unit: "mg", category: "benzodiazepine", is_prn: true, times: [] });
    expect(await db.getMedicationMaxDaily(med.id)).toBe(4); // Alprazolam curated max
    const custom = await db.createMedication({ name: "TotallyMadeUpDrug", strength: 1, unit: "mg", category: "other", is_prn: true, times: [] });
    expect(await db.getMedicationMaxDaily(custom.id)).toBe(null);
    expect(await db.getMedicationMaxDaily("nope")).toBe(null);
  });
});
