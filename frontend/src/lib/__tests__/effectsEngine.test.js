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
  CATEGORY_PK, FORM_SPEED, sessionDoseStack, stackedIntensityAt, stackChartEnd, stackedCurveSeries,
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

  test("every category (incl. recreational/psychoactive ones) yields a sanely ordered profile in every form", () => {
    for (const category of Object.keys(CATEGORY_PK)) {
      for (const form of [...Object.keys(FORM_SPEED), undefined]) {
        const p = defaultPkProfile({ category, form });
        expect(p.onset_min).toBeGreaterThanOrEqual(2);
        expect(p.onset_min).toBeLessThan(p.peak_min);
        expect(p.peak_min).toBeLessThan(p.duration_min);
      }
    }
  });

  test("recreational categories cover fast (stimulant-fast, dissociative, cannabis) through slow (psychedelic) baselines", () => {
    const fast = defaultPkProfile({ category: "stimulant-fast", form: "tablet" });
    const slow = defaultPkProfile({ category: "psychedelic", form: "tablet" });
    expect(fast.duration_min).toBeLessThan(slow.duration_min);
    // Smoked/vaporized route should be meaningfully faster onset than an oral default for the same substance.
    const smokedCannabis = defaultPkProfile({ category: "cannabis", form: "smoked/vaporized" });
    const edibleCannabis = defaultPkProfile({ category: "cannabis", form: "edible" });
    expect(smokedCannabis.onset_min).toBeLessThan(edibleCannabis.onset_min);
    expect(smokedCannabis.duration_min).toBeLessThan(edibleCannabis.duration_min);
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

describe("redosing (stacked dose curves)", () => {
  const profile = { onset_min: 30, peak_min: 90, duration_min: 300, intensity_scale: 1 };
  const base = "2026-07-23T12:00:00.000Z";
  const plus = (min) => new Date(new Date(base).getTime() + min * 60000).toISOString();

  test("a session with no redoses is a single primary dose at offset 0", () => {
    const stack = sessionDoseStack({ started_at: base, dose: 10, profile });
    expect(stack).toHaveLength(1);
    expect(stack[0]).toEqual({ tOffset: 0, scale: 1 });
    // stacked value equals the plain single-dose curve
    expect(stackedIntensityAt(90, profile, stack)).toBe(intensityAt(90, profile));
  });

  test("a redose adds a shifted, dose-scaled copy of the curve", () => {
    const session = {
      started_at: base, dose: 10, profile,
      redoses: [{ id: "r1", at: plus(120), amount: 5 }], // half dose, 2h later
    };
    const stack = sessionDoseStack(session);
    expect(stack).toHaveLength(2);
    expect(stack[1].tOffset).toBe(120);
    expect(stack[1].scale).toBeCloseTo(0.5, 5); // half the primary amount
    // At t=120 the primary is well past peak but still contributing; the
    // redose has only just been taken (its own t=0 → 0), so the stacked value
    // equals the primary's own value at 120.
    expect(stackedIntensityAt(120, profile, stack)).toBeCloseTo(intensityAt(120, profile), 5);
    // Later, both contribute and the sum exceeds either alone.
    const at210 = stackedIntensityAt(210, profile, stack);
    expect(at210).toBeGreaterThan(intensityAt(210, profile));
    expect(at210).toBeCloseTo(intensityAt(210, profile) + intensityAt(90, profile) * 0.5, 1);
  });

  test("a redose of an unknown amount is assumed equal to the primary (same scale)", () => {
    const stack = sessionDoseStack({ started_at: base, dose: null, profile, redoses: [{ id: "r1", at: plus(60), amount: null }] });
    expect(stack[1].scale).toBe(1);
  });

  test("stackChartEnd and stackedCurveSeries extend past the last dose's tail", () => {
    const session = { started_at: base, dose: 10, profile, redoses: [{ id: "r1", at: plus(180), amount: 10 }] };
    const stack = sessionDoseStack(session);
    expect(stackChartEnd(profile, stack)).toBe(180 + 300 * 1.25);
    const series = stackedCurveSeries(profile, stack, 48);
    expect(series[series.length - 1].t).toBe(Math.round(180 + 300 * 1.25));
    // Two overlapping full doses can push the peak above 100%.
    expect(Math.max(...series.map((pt) => pt.intensity))).toBeGreaterThan(100);
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

  test("addEffectDose stacks a redose; validation and removal work; redosed sessions don't train the model", async () => {
    const med = await db.createMedication({ name: "RedoseMed", strength: 10, unit: "mg", category: "stimulant", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });

    const withRedose = await db.addEffectDose(s.id, { amount: 5 });
    expect(withRedose.redoses).toHaveLength(1);
    expect(withRedose.redoses[0].amount).toBe(5);
    expect(sessionDoseStack(withRedose)).toHaveLength(2);

    // validation
    await expect(db.addEffectDose(s.id, { amount: -1 })).rejects.toThrow(/dose/i);
    await expect(db.addEffectDose(s.id, { at: new Date(Date.now() + 3600000).toISOString() })).rejects.toThrow(/future/i);
    await expect(db.addEffectDose(s.id, { at: new Date(new Date(s.started_at).getTime() - 3600000).toISOString() })).rejects.toThrow(/before the session/i);
    await expect(db.addEffectDose("missing", { amount: 5 })).rejects.toThrow(/not found/i);

    // completing a redosed session must NOT train the model (stacked timing)
    await db.addEffectEvent(s.id, { kind: "onset" });
    await db.addEffectEvent(s.id, { kind: "gone" });
    expect(await db.getEffectModel(med.id)).toBe(null);

    // removal only allowed while active
    const s2 = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    const r = await db.addEffectDose(s2.id, { amount: 10 });
    const doseId = r.redoses[0].id;
    const removed = await db.removeEffectDose(s2.id, doseId);
    expect(removed.redoses).toHaveLength(0);
    await expect(db.removeEffectDose(s2.id, "nope")).rejects.toThrow(/not found/i);
    await db.endEffectSession(s2.id, { discard: true });
    await expect(db.addEffectDose(s2.id, { amount: 5 })).rejects.toThrow(/active/i);
  });

  test("addEffectDose decrements inventory and journals the redose; removeEffectDose restores stock and removes the log", async () => {
    const med = await db.createMedication({
      name: "RedoseInvMed", strength: 50, unit: "mg", category: "stimulant", form: "tablet", times: [], is_prn: true,
      dose_quantity: 1, inventory: { current_count: 30, unit: "tablets", units_per_dose: 1, refill_threshold: 10 },
    });
    const stockOf = async () => (await db.getMedications()).find((m) => m.id === med.id).inventory.current_count;

    const s = await db.startEffectSession({ medication_id: med.id, dose: 50 });
    expect(await stockOf()).toBe(30); // starting a session doesn't itself log/decrement

    // Redose an amount matching the medication's strength → 1 pill decremented.
    const withRedose = await db.addEffectDose(s.id, { amount: 50 });
    expect(await stockOf()).toBe(29);
    expect(withRedose.redoses[0].log_id).toBeTruthy();

    // The redose shows up as a real log entry (journal/history), not just
    // internal session state — no scheduled_time, so it's its own entry.
    const logs = await db.getLogs({ medication_id: med.id });
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(withRedose.redoses[0].log_id);
    expect(logs[0].status).toBe("taken");
    expect(logs[0].dose_taken).toBe(50);
    expect(logs[0].scheduled_time).toBeFalsy();

    // A second redose with no specified amount falls back to the medication's
    // standard per-dose pill count (1), same as any other ad-hoc log.
    const withSecond = await db.addEffectDose(s.id, {});
    expect(await stockOf()).toBe(28);
    expect((await db.getLogs({ medication_id: med.id }))).toHaveLength(2);

    // Removing a redose restores exactly what it took and deletes its log.
    const doseId = withRedose.redoses[0].id;
    const afterRemove = await db.removeEffectDose(s.id, doseId);
    expect(await stockOf()).toBe(29); // 28 + 1 restored
    expect(afterRemove.redoses.find((r) => r.id === doseId)).toBeUndefined();
    expect(await db.getLogs({ medication_id: med.id })).toHaveLength(1);
  });

  test("a non-redosed session still trains the model as before", async () => {
    const med = await db.createMedication({ name: "PlainTrainMed", strength: 10, unit: "mg", category: "stimulant", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    await db.addEffectEvent(s.id, { kind: "onset" });
    await db.addEffectEvent(s.id, { kind: "gone" });
    expect((await db.getEffectModel(med.id)).samples).toBe(1);
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

describe("deleteEffectEvent (editing a session's feedback)", () => {
  test("removes a specific event without disturbing the others", async () => {
    const med = await db.createMedication({ name: "EditEvMed", strength: 10, unit: "mg", category: "stimulant", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    await db.addEffectEvent(s.id, { kind: "onset" });
    const withIntensity = await db.addEffectEvent(s.id, { kind: "intensity", intensity: 9 }); // fat-fingered value
    await db.addEffectEvent(s.id, { kind: "wearing_off" });
    expect(withIntensity.events.map((e) => e.kind)).toEqual(["onset", "intensity", "wearing_off"]);
    const badEvent = withIntensity.events.find((e) => e.kind === "intensity");

    const fixed = await db.deleteEffectEvent(s.id, badEvent.id);
    expect(fixed.events.map((e) => e.kind)).toEqual(["onset", "wearing_off"]);
    // the freed-up phase button can be tapped again with the right value
    const corrected = await db.addEffectEvent(s.id, { kind: "intensity", intensity: 4 });
    expect(corrected.events.map((e) => `${e.kind}:${e.intensity ?? ""}`)).toEqual(["onset:", "wearing_off:", "intensity:4"]);
  });

  test("every event gets a stable id", async () => {
    const med = await db.createMedication({ name: "IdMed", strength: 10, unit: "mg", category: "other", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    const updated = await db.addEffectEvent(s.id, { kind: "onset" });
    expect(typeof updated.events[0].id).toBe("string");
    expect(updated.events[0].id.length).toBeGreaterThan(0);
  });

  test("errors: unknown event, unknown session, editing a non-active session", async () => {
    const med = await db.createMedication({ name: "ErrMed", strength: 10, unit: "mg", category: "other", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    const withOnset = await db.addEffectEvent(s.id, { kind: "onset" });
    await expect(db.deleteEffectEvent(s.id, "nope")).rejects.toThrow(/event not found/i);
    await expect(db.deleteEffectEvent("missing-session", withOnset.events[0].id)).rejects.toThrow(/session not found/i);
    await db.endEffectSession(s.id, { discard: true });
    await expect(db.deleteEffectEvent(s.id, withOnset.events[0].id)).rejects.toThrow(/active/i);
  });
});

describe("reopenEffectSession (undo a completion)", () => {
  test("undoing 'Gone' restores the exact prior model and reactivates the session", async () => {
    const med = await db.createMedication({ name: "UndoMed", strength: 10, unit: "mg", category: "stimulant", form: "tablet", times: [], is_prn: true });
    // First session trains a real baseline model.
    const s1 = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    await db.addEffectEvent(s1.id, { kind: "onset" });
    await db.addEffectEvent(s1.id, { kind: "gone" });
    const baseline = await db.getEffectModel(med.id);
    expect(baseline.samples).toBe(1);

    // Second session gets bad feedback (fat-fingered "gone" way too early), completes, mis-trains.
    const s2 = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    const afterGone = await db.addEffectEvent(s2.id, { kind: "gone" });
    expect(afterGone.status).toBe("completed");
    const trained = await db.getEffectModel(med.id);
    expect(trained.samples).toBe(2); // wrongly counted

    // Undo: reactivates s2 and rolls the model back to exactly the pre-s2 baseline.
    const reopened = await db.reopenEffectSession(s2.id);
    expect(reopened.status).toBe("active");
    expect(reopened.ended_at).toBe(null);
    expect(reopened.events.some((e) => e.kind === "gone")).toBe(false); // terminal event stripped
    const restored = await db.getEffectModel(med.id);
    expect(restored).toEqual(baseline);

    // The reopened session can now be completed correctly.
    const redone = await db.addEffectEvent(s2.id, { kind: "gone" });
    expect(redone.status).toBe("completed");
    expect((await db.getEffectModel(med.id)).samples).toBe(2);
  });

  test("undo is refused once something newer has touched the model", async () => {
    const med = await db.createMedication({ name: "StaleUndoMed", strength: 10, unit: "mg", category: "stimulant", form: "tablet", times: [], is_prn: true });
    const s1 = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    await db.addEffectEvent(s1.id, { kind: "gone" }); // trains v1

    const s2 = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    await db.addEffectEvent(s2.id, { kind: "gone" }); // trains v2 — supersedes s1's snapshot window

    await expect(db.reopenEffectSession(s1.id)).rejects.toThrow(/model has changed/i);
    // s2 is still the latest, so undoing IT works fine.
    const reopened = await db.reopenEffectSession(s2.id);
    expect(reopened.status).toBe("active");
  });

  test("undo is refused after a Reset, since Reset is a deliberate permanent forget", async () => {
    const med = await db.createMedication({ name: "ResetUndoMed", strength: 10, unit: "mg", category: "stimulant", form: "tablet", times: [], is_prn: true });
    const s1 = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    await db.addEffectEvent(s1.id, { kind: "gone" });
    await db.resetEffectModel(med.id);
    await expect(db.reopenEffectSession(s1.id)).rejects.toThrow(/model has changed/i);
  });

  test("undoing a discarded session just reactivates it (no model to revert)", async () => {
    const med = await db.createMedication({ name: "DiscardUndoMed", strength: 10, unit: "mg", category: "other", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    await db.endEffectSession(s.id, { discard: true });
    const reopened = await db.reopenEffectSession(s.id);
    expect(reopened.status).toBe("active");
  });

  test("reopening discards any other currently-active session for the same medication", async () => {
    const med = await db.createMedication({ name: "OneActiveMed", strength: 10, unit: "mg", category: "other", form: "tablet", times: [], is_prn: true });
    const s1 = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    await db.endEffectSession(s1.id, { discard: true });
    const s2 = await db.startEffectSession({ medication_id: med.id, dose: 10 }); // now the active one

    const reopened = await db.reopenEffectSession(s1.id);
    expect(reopened.status).toBe("active");
    // Filter before indexing — other tests in this file leave their own
    // active sessions lying around in the shared mock store.
    const activeForMed = (await db.getActiveEffectSessions()).filter((x) => x.medication_id === med.id);
    expect(activeForMed).toHaveLength(1);
    expect(activeForMed[0].id).toBe(s1.id);
    const s2Fresh = (await db.getEffectSessions({ medication_id: med.id })).find((x) => x.id === s2.id);
    expect(s2Fresh.status).toBe("discarded");
  });

  test("reopening an already-active session is a harmless no-op; unknown/never-ended sessions error clearly", async () => {
    const med = await db.createMedication({ name: "NoopMed", strength: 10, unit: "mg", category: "other", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    const same = await db.reopenEffectSession(s.id);
    expect(same.id).toBe(s.id);
    expect(same.status).toBe("active");
    await expect(db.reopenEffectSession("nonexistent")).rejects.toThrow(/not found/i);
  });
});

describe("deleteMedication cleans up effect-tracker data (no orphaned models/sessions)", () => {
  test("removes sessions, models and the version counter for the deleted medication", async () => {
    const med = await db.createMedication({ name: "DoomedMed", strength: 10, unit: "mg", category: "stimulant", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    await db.addEffectEvent(s.id, { kind: "gone" });
    expect(await db.getEffectModel(med.id)).not.toBe(null);
    expect(await db.getEffectSessions({ medication_id: med.id })).not.toHaveLength(0);

    await db.deleteMedication(med.id);
    expect(await db.getEffectModel(med.id)).toBe(null);
    expect(await db.getEffectSessions({ medication_id: med.id })).toHaveLength(0);

    // A medication reusing the same id space starts with a clean version
    // counter too (no orphaned effectVersions row blocking future undos).
    const med2 = await db.createMedication({ name: "FreshMed", strength: 10, unit: "mg", category: "stimulant", form: "tablet", times: [], is_prn: true });
    const s2 = await db.startEffectSession({ medication_id: med2.id, dose: 10 });
    const after = await db.addEffectEvent(s2.id, { kind: "gone" });
    expect(after.status).toBe("completed");
    expect((await db.getEffectModel(med2.id)).samples).toBe(1);
  });
});
