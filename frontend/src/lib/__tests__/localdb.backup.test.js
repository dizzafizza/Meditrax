// Export/import (backup & restore) — round-trips, validation, and the
// orphaned-active-profile failure modes an unvalidated import allowed.

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

async function seedMed(name) {
  return db.createMedication({
    name, strength: 10, unit: "mg", form: "tablet",
    times: ["09:00"], days_of_week: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    is_prn: false, dose_quantity: 1,
  });
}

describe("export → import round-trip", () => {
  test("a full backup restores medications, logs, profiles, and the active profile", async () => {
    const med = await seedMed("BackupMed");
    await db.createLog({ medication_id: med.id, status: "taken", scheduled_time: "09:00" });
    const secondProfile = await db.createProfile({ name: "Partner" });
    const backup = await db.exportData();
    expect(backup.version).toBe(2);
    expect(backup.profiles.length).toBeGreaterThanOrEqual(2);
    expect(backup.activeProfileId).toBeTruthy();

    // Damage the live data, then restore.
    await db.deleteMedication(med.id);
    expect((await db.getMedications()).find((m) => m.id === med.id)).toBeUndefined();
    await db.importData(backup);

    const meds = await db.getMedications();
    expect(meds.find((m) => m.id === med.id)?.name).toBe("BackupMed");
    expect(await db.getActiveProfileId()).toBe(backup.activeProfileId);
    expect((await db.listProfiles()).find((p) => p.id === secondProfile.id)).toBeTruthy();
  });

  test("the mealModels collection rides the backup", async () => {
    expect(db.PROFILE_COLLECTIONS).toContain("mealModels");
    const backup = await db.exportData();
    const pid = backup.activeProfileId;
    expect(backup.profileData[pid]).toHaveProperty("mealModels");
  });
});

describe("import validation (previously any JSON 'imported' successfully)", () => {
  test("rejects non-backup payloads outright", async () => {
    await expect(db.importData(null)).rejects.toThrow(/backup/i);
    await expect(db.importData("a string")).rejects.toThrow(/backup/i);
    await expect(db.importData([1, 2, 3])).rejects.toThrow(/backup/i);
    await expect(db.importData({ some: "random", json: true })).rejects.toThrow(/backup/i);
  });

  test("rejects a backup whose profile list is empty or damaged — the exact shape that orphaned all data", async () => {
    await expect(db.importData({ profiles: [], profileData: {} })).rejects.toThrow(/no profiles/i);
    await expect(db.importData({ profiles: [{ name: "no id" }], profileData: {} })).rejects.toThrow(/damaged/i);
    // and nothing was written by the failed attempts
    expect((await db.listProfiles()).length).toBeGreaterThan(0);
  });

  test("a backup without activeProfileId still lands on a live profile, never a dead namespace", async () => {
    const backup = await db.exportData();
    delete backup.activeProfileId;
    // Simulate restoring on a device whose current active profile isn't in
    // the backup at all (the id will not match anything imported).
    const strippedProfiles = backup.profiles.slice(0, 1);
    const stripped = { ...backup, profiles: strippedProfiles, profileData: { [strippedProfiles[0].id]: backup.profileData[strippedProfiles[0].id] } };
    await db.importData(stripped);
    const active = await db.getActiveProfileId();
    expect(strippedProfiles[0].id).toBe(active); // fell back to the imported profile
    expect((await db.listProfiles()).some((p) => p.id === active)).toBe(true);
  });

  test("unknown collections and non-array values are skipped instead of stored", async () => {
    const backup = await db.exportData();
    const pid = backup.activeProfileId || backup.profiles[0].id;
    backup.profileData[pid].not_a_real_collection = ["junk"];
    backup.profileData[pid].medications = { corrupted: "object, not array" };
    await db.importData(backup);
    // corrupt medications skipped -> previous meds survive as a readable array
    const meds = await db.getMedications();
    expect(Array.isArray(meds)).toBe(true);
  });

  test("importing prunes namespaces of profiles the backup doesn't include", async () => {
    const doomed = await db.createProfile({ name: "Doomed" });
    await db.setActiveProfile(doomed.id);
    await seedMed("DoomedMed");
    // Backup *without* the doomed profile:
    const backup = await db.exportData();
    backup.profiles = backup.profiles.filter((p) => p.id !== doomed.id);
    delete backup.profileData[doomed.id];
    backup.activeProfileId = backup.profiles[0].id;
    await db.importData(backup);
    // Doomed profile's data is gone from storage, not lingering as a ghost.
    const localforage = require("localforage");
    const keys = await localforage.createInstance().keys();
    expect(keys.some((k) => k.startsWith(`p:${doomed.id}:`))).toBe(false);
    expect(await db.getActiveProfileId()).toBe(backup.profiles[0].id);
  });
});

describe("legacy v1 import (single-profile, collections at top level)", () => {
  test("v1 arrays land in the active profile; junk fields are ignored", async () => {
    const v1 = {
      medications: [{ id: "v1med", name: "LegacyMed", strength: 5, unit: "mg", is_active: true }],
      logs: [],
      reminders: "not an array — must be skipped",
    };
    await db.importData(v1);
    const meds = await db.getMedications();
    expect(meds.find((m) => m.id === "v1med")?.name).toBe("LegacyMed");
    const reminders = await db.getReminders();
    expect(Array.isArray(reminders)).toBe(true);
  });
});
