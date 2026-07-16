// Effects engine: PK defaults, curve shape, phases, and the EWMA learner.

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

import {
  defaultPkProfile, personalizedProfile, intensityAt, phaseAt, curveSeries,
  observationsFromSession, updateModel, modelConfidence, fmtMins,
} from "../effectsEngine";
import * as db from "../localdb";

describe("defaultPkProfile", () => {
  test("category and form shape the baseline, ordering always sane", () => {
    const stim = defaultPkProfile({ category: "stimulant", form: "tablet" });
    expect(stim).toEqual({ onset_min: 40, peak_min: 120, duration_min: 420 });
    const inhaled = defaultPkProfile({ category: "stimulant", form: "inhaler" });
    expect(inhaled.onset_min).toBeLessThan(stim.onset_min);
    const unknown = defaultPkProfile({});
    expect(unknown.onset_min).toBeLessThan(unknown.peak_min);
    expect(unknown.peak_min).toBeLessThan(unknown.duration_min);
  });
});

describe("intensity curve & phases", () => {
  const p = { onset_min: 30, peak_min: 90, duration_min: 300 };

  test("rises through onset to a 100 plateau then decays to a small tail", () => {
    expect(intensityAt(0, p)).toBe(0);
    expect(intensityAt(15, p)).toBeGreaterThan(0);
    expect(intensityAt(15, p)).toBeLessThanOrEqual(12);
    expect(intensityAt(90, p)).toBe(100);
    expect(intensityAt(120, p)).toBe(100); // plateau
    expect(intensityAt(299, p)).toBeLessThan(5);
    expect(intensityAt(310, p)).toBeLessThanOrEqual(8); // after-effects tail
    expect(intensityAt(400, p)).toBe(0);
  });

  test("phases progress in order", () => {
    expect(phaseAt(10, p).key).toBe("waiting");
    expect(phaseAt(50, p).key).toBe("onset");
    expect(phaseAt(100, p).key).toBe("peak");
    expect(phaseAt(250, p).key).toBe("offset");
    expect(phaseAt(320, p).key).toBe("after");
    expect(phaseAt(400, p).key).toBe("complete");
  });

  test("curveSeries spans the tail and peaks at 100", () => {
    const series = curveSeries(p, 60);
    expect(series[0]).toEqual({ t: 0, intensity: 0 });
    expect(series[series.length - 1].t).toBe(Math.round(300 * 1.25));
    expect(Math.max(...series.map((x) => x.intensity))).toBe(100);
  });
});

describe("learning (updateModel)", () => {
  const med = { category: "stimulant", form: "tablet" };

  test("first observation adopts the value; later ones EWMA toward it", () => {
    let m = updateModel(null, { onset_min: 20, peak_min: 60, end_min: 240 }, 20, med);
    expect(m.onset_min).toBe(20);
    expect(m.samples).toBe(1);
    expect(modelConfidence(m)).toBe("low");
    m = updateModel(m, { onset_min: 40 }, 20, med);
    expect(m.onset_min).toBe(30); // alpha 1/2
    expect(m.samples).toBe(2);
    for (let i = 0; i < 5; i++) m = updateModel(m, { onset_min: 40 }, 20, med);
    expect(m.onset_min).toBeGreaterThan(37); // converges
    expect(modelConfidence(m)).toBe("high");
  });

  test("ordering is enforced and no-signal sessions don't count", () => {
    let m = updateModel(null, { onset_min: 100, peak_min: 20 }, null, med);
    expect(m.peak_min).toBeGreaterThanOrEqual(m.onset_min + 5);
    const same = updateModel(m, {}, null, med);
    expect(same.samples).toBe(m.samples);
  });

  test("personalizedProfile blends learned values and scales by dose ratio", () => {
    const model = { onset_min: 20, peak_min: 60, duration_min: 240, ref_dose: 20, samples: 4 };
    const base = personalizedProfile(med, model, 20);
    expect(base.onset_min).toBe(20);
    expect(base.confidence).toBe("medium");
    const bigger = personalizedProfile(med, model, 40);
    expect(bigger.duration_min).toBeGreaterThan(base.duration_min);
    expect(bigger.intensity_scale).toBeGreaterThan(1);
    const none = personalizedProfile(med, null, 20);
    expect(none.learned).toBe(false);
    expect(none.onset_min).toBe(40); // default stimulant
  });
});

describe("session lifecycle in localdb", () => {
  test("start → feedback events → gone ends the session and trains the model", async () => {
    const med = await db.createMedication({ name: "FxMed", strength: 20, unit: "mg", category: "stimulant", form: "tablet", times: ["09:00"], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 20, unit: "mg" });
    expect(s.status).toBe("active");
    expect(s.profile.onset_min).toBe(40); // default before any learning
    await db.addEffectEvent(s.id, { kind: "onset" });
    await db.addEffectEvent(s.id, { kind: "intensity", intensity: 7 });
    const done = await db.addEffectEvent(s.id, { kind: "gone" });
    expect(done.status).toBe("completed");
    const model = await db.getEffectModel(med.id);
    expect(model.samples).toBe(1);
    expect(model.onset_min).toBeGreaterThanOrEqual(1); // "just now" ≈ 1 min
    // next session uses the learned profile snapshot
    const s2 = await db.startEffectSession({ medication_id: med.id, dose: 20 });
    expect(s2.profile.learned).toBe(true);
    // starting again replaces the still-active session
    const s3 = await db.startEffectSession({ medication_id: med.id, dose: 20 });
    const active = await db.getActiveEffectSessions();
    expect(active.filter((x) => x.medication_id === med.id)).toHaveLength(1);
    expect(active[0].id).toBe(s3.id);
    expect(active[0].medication_name).toBe("FxMed");
    // discard ends without learning
    await db.endEffectSession(s3.id, { discard: true });
    expect((await db.getEffectModel(med.id)).samples).toBe(1);
    expect(await db.getActiveEffectSessions()).toHaveLength(0);
  });

  test("stale active sessions auto-complete without learning", async () => {
    const med = await db.createMedication({ name: "StaleMed", strength: 5, unit: "mg", category: "other", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 5 });
    // Backdate the start far past 2× duration (mock stores by reference).
    const raw = (await db.exportData()).profileData;
    const pid = Object.keys(raw)[0];
    const stored = raw[pid].effectSessions.find((x) => x.id === s.id);
    stored.started_at = new Date(Date.now() - 72 * 3600000).toISOString();
    const active = await db.getActiveEffectSessions();
    expect(active.find((x) => x.id === s.id)).toBeUndefined();
    expect((await db.getEffectSessions({ medication_id: med.id }))[0].status).toBe("completed");
    expect(await db.getEffectModel(med.id)).toBe(null);
  });

  test("fmtMins formats human durations", () => {
    expect(fmtMins(40)).toBe("40 min");
    expect(fmtMins(95)).toBe("1 h 35 m");
    expect(fmtMins(120)).toBe("2 h");
  });

  test("updateEffectSession edits start time and dose, re-deriving the profile", async () => {
    const med = await db.createMedication({ name: "EditFxMed", strength: 10, unit: "mg", category: "stimulant", form: "tablet", times: [], is_prn: true });
    // Seed a model so dose scaling has a reference to work against.
    let m = null;
    m = (await import("../effectsEngine")).updateModel(m, { onset_min: 30, peak_min: 90, end_min: 240 }, 10, med);
    const s0 = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    const earlier = new Date(Date.now() - 2 * 3600000).toISOString();
    const edited = await db.updateEffectSession(s0.id, { started_at: earlier, dose: 20 });
    expect(edited.started_at).toBe(earlier);
    expect(edited.dose).toBe(20);
    // dose changed → profile snapshot re-derived (still a valid ordered profile)
    expect(edited.profile.onset_min).toBeLessThan(edited.profile.peak_min);
    expect(edited.profile.peak_min).toBeLessThan(edited.profile.duration_min);

    await expect(db.updateEffectSession(s0.id, { started_at: "garbage" })).rejects.toThrow(/start time/i);
    await expect(db.updateEffectSession(s0.id, { started_at: new Date(Date.now() + 3600000).toISOString() })).rejects.toThrow(/future/i);
    await expect(db.updateEffectSession(s0.id, { dose: -5 })).rejects.toThrow(/dose/i);
    await expect(db.updateEffectSession("missing", { dose: 5 })).rejects.toThrow(/not found/i);

    await db.endEffectSession(s0.id, { discard: true });
    await expect(db.updateEffectSession(s0.id, { dose: 5 })).rejects.toThrow(/active/i);
  });

  test("resetEffectModel forgets learning and re-derives active session curves", async () => {
    const med = await db.createMedication({ name: "ResetMed", strength: 10, unit: "mg", category: "stimulant", form: "tablet", times: [], is_prn: true });
    // Train a model via one completed session with feedback.
    const s1 = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    await db.addEffectEvent(s1.id, { kind: "onset" });
    await db.addEffectEvent(s1.id, { kind: "gone" });
    expect((await db.getEffectModel(med.id)).samples).toBe(1);
    // A new active session uses the learned profile...
    const s2 = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    expect(s2.profile.learned).toBe(true);
    // ...until the model is reset: model gone, active curve back to defaults.
    await db.resetEffectModel(med.id);
    expect(await db.getEffectModel(med.id)).toBe(null);
    const active = (await db.getActiveEffectSessions()).find((x) => x.id === s2.id);
    expect(active.profile.learned).toBe(false);
    expect(active.profile.onset_min).toBe(40); // stimulant default again
  });
});
