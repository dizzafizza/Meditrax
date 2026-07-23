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
