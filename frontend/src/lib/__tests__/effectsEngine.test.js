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
  observationsFromSession, updateModel, modelConfidence, fmtMins, modeledEffectiveness,
  CATEGORY_PK, FORM_SPEED, SUBSTANCE_PK, substancePkFor, DOSE_RESPONSE, doseResponse,
  sessionDoseStack, stackedIntensityAt, stackChartEnd, stackedCurveSeries, doseWeightAt, doseIntensityAt,
  mealFactorsFor, isOralForm, MEAL_STATES,
  observedMealFactors, updateMealModel, baselineObservations, MEAL_FACTOR_BOUNDS,
} from "../effectsEngine";
import * as db from "../localdb";

describe("per-substance PK overrides", () => {
  test("every entry is internally ordered and survives the engine's clamps intact", () => {
    Object.entries(SUBSTANCE_PK).forEach(([name, s]) => {
      expect(s.onset).toBeGreaterThan(0);
      expect(s.onset).toBeLessThan(s.peak);
      expect(s.peak).toBeLessThan(s.duration);
      expect(FORM_SPEED[s.form]).toBeDefined(); // reference route must be a real form
      // Fed back through the engine at its own reference route, an entry
      // should come out as exactly the numbers it declares -- if a clamp is
      // silently rewriting one, the table is lying about what it models.
      const p = defaultPkProfile({ name, form: s.form });
      expect(p).toEqual({ onset_min: s.onset, peak_min: s.peak, duration_min: s.duration });
    });
  });

  test("resolves by name, generic_name and brand/street alias", () => {
    expect(substancePkFor({ name: "Kratom" })).toBe(SUBSTANCE_PK.kratom);
    expect(substancePkFor({ name: "Something Custom", generic_name: "buprenorphine" })).toBe(SUBSTANCE_PK.buprenorphine);
    expect(substancePkFor({ name: "Suboxone" })).toBe(SUBSTANCE_PK.buprenorphine);
    expect(substancePkFor({ name: "  vYvAnSe " })).toBe(SUBSTANCE_PK.lisdexamfetamine);
    expect(substancePkFor({ name: "Totally Unknown Drug" })).toBeNull();
    expect(substancePkFor({})).toBeNull();
  });

  test("a substance with no entry still falls back to its category, unchanged", () => {
    const viaCategory = defaultPkProfile({ name: "Totally Unknown Drug", category: "opioid", form: "tablet" });
    expect(viaCategory).toEqual(defaultPkProfile({ category: "opioid", form: "tablet" }));
  });

  test("buprenorphine's effects far outlast the generic oral-opioid bucket", () => {
    const bupe = defaultPkProfile({ name: "Buprenorphine", category: "opioid", form: "tablet" });
    const generic = defaultPkProfile({ category: "opioid", form: "tablet" });
    expect(bupe.duration_min).toBeGreaterThan(generic.duration_min * 4);
    expect(bupe.duration_min).toBe(1440); // ~24 h, vs the bucket's 4.5
  });

  test("LSD runs roughly twice as long as psilocybin, which one bucket could not express", () => {
    const lsd = defaultPkProfile({ name: "LSD", category: "psychedelic", form: "other" });
    const shrooms = defaultPkProfile({ name: "Psilocybin mushrooms", category: "psychedelic", form: "other" });
    expect(lsd.duration_min).toBeGreaterThan(shrooms.duration_min * 1.5);
    // The old shared bucket over-ran psilocybin badly.
    expect(shrooms.duration_min).toBeLessThan(CATEGORY_PK.psychedelic.duration);
  });

  test("nicotine is over in under an hour, not the six its category implies", () => {
    const nic = defaultPkProfile({ name: "Nicotine", category: "other", form: "smoked/vaporized" });
    expect(nic.onset_min).toBeLessThanOrEqual(5);
    expect(nic.duration_min).toBeLessThan(90);
    expect(nic.duration_min).toBeLessThan(CATEGORY_PK.other.duration / 3);
  });

  test("kratom absorbs far faster than a typical oral opioid", () => {
    const kratom = defaultPkProfile({ name: "Kratom", category: "opioid", form: "other" });
    expect(kratom.onset_min).toBeLessThan(CATEGORY_PK.opioid.onset / 2);
    expect(kratom.duration_min).toBeGreaterThan(CATEGORY_PK.opioid.duration);
  });

  test("a route-specific profile is not sped up a second time by its own route", () => {
    // Regression: the cannabis baseline was already measured for smoked
    // material, but FORM_SPEED then applied the 0.15 smoked multiplier on top
    // of it, collapsing an 8-minute onset to ~1. Reference-route handling
    // means declaring the same route is now a no-op.
    const smoked = defaultPkProfile({ name: "Cannabis (THC)", category: "cannabis", form: "smoked/vaporized" });
    expect(smoked.onset_min).toBe(SUBSTANCE_PK["cannabis (thc)"].onset);
    // A genuinely slower route still slows it down, and by a lot.
    const edible = defaultPkProfile({ name: "Cannabis (THC)", category: "cannabis", form: "edible" });
    expect(edible.onset_min).toBeGreaterThan(smoked.onset_min * 5);
    expect(edible.duration_min).toBeGreaterThan(smoked.duration_min);
  });

  test("an unspecified form uses the substance's own reference route as-is", () => {
    const noForm = defaultPkProfile({ name: "Kratom" });
    expect(noForm.onset_min).toBe(SUBSTANCE_PK.kratom.onset);
  });

  test("a large route change shifts the curve without crushing the come-up", () => {
    // Regression: onset scales linearly with route speed but the come-up only
    // by its square root, so a big enough ratio (here nicotine's smoked
    // baseline read through a transdermal patch, ~20x) used to drive onset
    // past peak and leave the ordering clamp to flatten the come-up to its
    // 5-minute floor -- a curve that spikes the moment it begins.
    const patch = defaultPkProfile({ name: "Nicotine", category: "other", form: "patch" });
    expect(patch.onset_min).toBeGreaterThan(SUBSTANCE_PK.nicotine.onset * 5); // route really is much slower
    expect(patch.peak_min - patch.onset_min).toBeGreaterThan(5); // and the come-up survived
    expect(patch.duration_min).toBeGreaterThan(patch.peak_min);
  });

  test("no category/form/substance combination can produce a degenerate curve", () => {
    const names = [...Object.keys(SUBSTANCE_PK), "Totally Unknown Drug"];
    for (const name of names) {
      for (const category of Object.keys(CATEGORY_PK)) {
        for (const form of [...Object.keys(FORM_SPEED), undefined]) {
          const p = defaultPkProfile({ name, category, form });
          expect(p.onset_min).toBeGreaterThanOrEqual(2);
          expect(p.peak_min).toBeGreaterThan(p.onset_min);
          expect(p.duration_min).toBeGreaterThan(p.peak_min);
          expect(Number.isFinite(p.onset_min + p.peak_min + p.duration_min)).toBe(true);
        }
      }
    }
  });
});

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

  test("honours the three learned parameters it is fitted to", () => {
    expect(intensityAt(0, p)).toBe(0);
    expect(intensityAt(p.peak_min, p)).toBe(100); // peak lands exactly where learned
    expect(intensityAt(p.onset_min, p)).toBeGreaterThan(4); // perceptible at onset
    expect(intensityAt(p.onset_min, p)).toBeLessThan(20); // but only just
    expect(intensityAt(p.duration_min, p)).toBeLessThan(25); // largely worn off by duration_min
    expect(intensityAt(p.duration_min, p)).toBeLessThan(intensityAt(p.peak_min, p) / 3);
    expect(intensityAt(p.duration_min * 1.25, p)).toBe(0); // and fully out by the tail's end
  });

  test("holds a 100% plateau for the first stretch after the peak", () => {
    // The restored spline deliberately holds full intensity across the first
    // ~third of the post-peak span (plateauEnd = pk + (dur - pk) * 0.35 =
    // 163.5 here) before easing down -- the shape the user reported matching
    // their actual experience.
    expect(intensityAt(p.peak_min, p)).toBe(100);
    expect(intensityAt(120, p)).toBe(100);
    expect(intensityAt(160, p)).toBe(100);
    expect(intensityAt(170, p)).toBeLessThan(100);
  });

  test("fades out by duration_min, then shows the fixed after-effects tail", () => {
    // The spline's decline reaches ~0 at the reported "gone" moment, and the
    // after-effects window is a separate small (8%) block that fades over the
    // next 25% of the duration -- the step at duration_min is by design.
    expect(intensityAt(p.duration_min - 1, p)).toBeLessThan(1);
    expect(intensityAt(p.duration_min, p)).toBe(8);
    expect(intensityAt(p.duration_min * 1.25, p)).toBe(0);
  });

  test("rises monotonically from zero to the peak", () => {
    let prev = -1;
    for (let t = 0; t <= p.peak_min; t++) {
      const v = intensityAt(t, p);
      expect(v).toBeGreaterThanOrEqual(prev - 0.15);
      prev = v;
    }
  });

  test("stays well-formed across every profile the engine can produce", () => {
    for (const category of Object.keys(CATEGORY_PK)) {
      for (const form of ["tablet", "smoked/vaporized", "edible", "patch", undefined]) {
        const prof = defaultPkProfile({ category, form });
        expect(intensityAt(prof.peak_min, prof)).toBe(100);
        expect(intensityAt(0, prof)).toBe(0);
        expect(intensityAt(prof.duration_min * 1.25, prof)).toBe(0);
        for (const t of [1, prof.onset_min, prof.peak_min, prof.duration_min]) {
          const v = intensityAt(t, prof);
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
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
    // Half the primary amount, but on a saturating dose-response curve rather
    // than a linear one -- so noticeably more than half the effect, the same
    // way half a normal dose isn't half as strong.
    expect(stack[1].scale).toBeGreaterThan(0.5);
    expect(stack[1].scale).toBeLessThan(1);
    // At t=120 the primary is well past peak but still contributing; the
    // redose has only just been taken (its own t=0 → 0), so the stacked value
    // equals the primary's own value at 120.
    expect(stackedIntensityAt(120, profile, stack)).toBeCloseTo(intensityAt(120, profile), 5);
    // While the redose is coming up (its onset is 120+30=150) both still
    // contribute in full, so the total exceeds either dose alone.
    const at150 = stackedIntensityAt(150, profile, stack);
    expect(at150).toBeGreaterThan(intensityAt(150, profile));
    expect(at150).toBeCloseTo(intensityAt(150, profile) + intensityAt(30, profile) * stack[1].scale, 1);
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
  });

  test("doses that genuinely overlap on the way up still stack above 100%", () => {
    // A redose taken at t=30, while the primary is still coming up: both are
    // rising together, so the combined curve legitimately exceeds one dose's
    // peak. (A redose taken long after the primary peaked instead hands over,
    // which is what keeps the curve from ballooning — covered below.)
    const early = sessionDoseStack({ started_at: base, dose: 10, profile, redoses: [{ id: "r1", at: plus(30), amount: 10 }] });
    const peakOfEarly = Math.max(...stackedCurveSeries(profile, early, 200).map((pt) => pt.intensity));
    expect(peakOfEarly).toBeGreaterThan(100);

    // The same two doses spaced far apart hand over instead of piling up.
    const late = sessionDoseStack({ started_at: base, dose: 10, profile, redoses: [{ id: "r1", at: plus(180), amount: 10 }] });
    const peakOfLate = Math.max(...stackedCurveSeries(profile, late, 200).map((pt) => pt.intensity));
    expect(peakOfLate).toBeLessThan(peakOfEarly);
  });

  describe("a superseded dose collapses once the next redose peaks", () => {
    // Redose at t=180 (full amount); its own peak is at 180+90=270.
    const session = { started_at: base, dose: 10, profile, redoses: [{ id: "r1", at: plus(180), amount: 10 }] };
    const stack = sessionDoseStack(session);

    // The hand-off runs across the redose's come-up: full weight until the
    // redose's onset (180+30=210), fully collapsed by its peak (180+90=270).
    test("until the redose starts being felt, the primary contributes its own value in full", () => {
      const combined = stackedIntensityAt(200, profile, stack); // before onset at 210
      const primaryOnly = intensityAt(200, profile);
      const redoseOnly = intensityAt(200 - 180, profile);
      expect(combined).toBeCloseTo(primaryOnly + redoseOnly, 1);
      expect(doseWeightAt(200, profile, stack, 0)).toBe(1);
    });

    test("the primary is fully collapsed by the moment the redose peaks", () => {
      expect(doseWeightAt(270, profile, stack, 0)).toBe(0);
      const atPeak = stackedIntensityAt(270, profile, stack);
      const redoseAtPeak = intensityAt(90, profile); // = 100, the redose alone
      expect(atPeak).toBeCloseTo(redoseAtPeak, 1); // nothing left of the primary
      // ...which is strictly less than a naive sum would have given.
      expect(atPeak).toBeLessThan(redoseAtPeak + intensityAt(270, profile));
    });

    test("the hand-off is gradual across the come-up, with no jump at either end", () => {
      expect(doseWeightAt(210, profile, stack, 0)).toBe(1); // starts at full
      const mid = doseWeightAt(240, profile, stack, 0);
      expect(mid).toBeGreaterThan(0);
      expect(mid).toBeLessThan(1); // partway through
      expect(doseWeightAt(269, profile, stack, 0)).toBeLessThan(0.05); // nearly gone right before the peak
      expect(doseWeightAt(271, profile, stack, 0)).toBe(0); // and stays gone after
    });

    // The session chart plots the newest dose alone (earlier doses are kept
    // out of the filled curve entirely and only re-appear as dotted lines),
    // so its curve must be empty before that dose was actually taken.
    test("the newest dose's own curve is zero before it was taken and peaks on its own clock", () => {
      const newest = stack.length - 1;
      expect(doseIntensityAt(0, profile, stack, newest)).toBe(0);
      expect(doseIntensityAt(179, profile, stack, newest)).toBe(0); // taken at 180
      expect(doseIntensityAt(270, profile, stack, newest)).toBeCloseTo(100, 1); // its own peak
      // ...while the superseded dose still has its own separate curve to plot.
      expect(doseIntensityAt(90, profile, stack, 0)).toBeCloseTo(100, 1);
      expect(doseIntensityAt(90, profile, stack, newest)).toBe(0);
    });

    test("collapse: false gives back the raw sum, for the 'show previous dose' view", () => {
      const collapsed = stackedIntensityAt(270, profile, stack);
      const raw = stackedIntensityAt(270, profile, stack, { collapse: false });
      expect(raw).toBeCloseTo(intensityAt(270, profile) + intensityAt(90, profile), 1);
      expect(raw).toBeGreaterThan(collapsed);
      // doseIntensityAt exposes one dose's own uncollapsed curve for plotting
      expect(doseIntensityAt(270, profile, stack, 0)).toBeCloseTo(intensityAt(270, profile), 1);
      expect(doseIntensityAt(270, profile, stack, 1)).toBeCloseTo(intensityAt(90, profile), 1);
    });

    test("the most recent dose in the stack never collapses — it plays out its own full tail", () => {
      // Far past everything (redose's own duration+tail), intensity should
      // simply be the redose's own tail value, not zero and not primary's.
      const farOut = 180 + 300 * 1.1; // inside the redose's after-effects tail
      const combined = stackedIntensityAt(farOut, profile, stack);
      const redoseOwn = intensityAt(farOut - 180, profile);
      expect(combined).toBeCloseTo(redoseOwn, 1);
      expect(combined).toBeGreaterThan(0); // still fading through its own tail, not cut off
    });

    test("with three stacked doses, each collapses in turn — no unbounded stacking", () => {
      const threeStack = sessionDoseStack({
        started_at: base, dose: 10, profile,
        redoses: [{ id: "r1", at: plus(60), amount: 10 }, { id: "r2", at: plus(150), amount: 10 }],
      });
      const series = stackedCurveSeries(profile, threeStack, 200);
      // Even with three full-strength doses, the collapsing hand-off keeps the
      // total well under a literal 300% triple-stack.
      expect(Math.max(...series.map((pt) => pt.intensity))).toBeLessThan(250);
    });
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

  test("omitting tolerance (or a non-applicable one) leaves intensity_scale exactly as before", () => {
    const withoutArg = personalizedProfile(med, null, 20);
    const withNull = personalizedProfile(med, null, 20, null);
    const withInapplicable = personalizedProfile(med, null, 20, { applicable: false });
    expect(withoutArg.intensity_scale).toBe(1);
    expect(withNull.intensity_scale).toBe(1);
    expect(withInapplicable.intensity_scale).toBe(1);
    expect(withoutArg.tolerance).toBeUndefined();
    expect(withInapplicable.tolerance).toBeUndefined();
  });

  test("steady tolerance leaves a usual dose at full height, and is still reported", () => {
    // Tolerance is measured against this person's own recent baseline, so
    // when it hasn't moved, their usual dose is exactly their usual
    // experience -- 100%. Scaling it down would describe a drug-naive
    // stranger and would disagree with the log sheet's own comparison.
    const tolerance = { applicable: true, level: 0.5, maxDampening: 0.6, faded: false, daysSinceLast: 1, recentPeakLevel: 0.5 };
    const p = personalizedProfile(med, null, 20, tolerance);
    expect(p.intensity_scale).toBeCloseTo(1, 5);
    expect(p.tolerance.level).toBe(0.5);
    expect(p.tolerance.faded).toBe(false);
  });

  test("carries maxDampening through so the UI can state how much weaker doses land", () => {
    // The level alone is ambiguous: it's progress along this substance's own
    // tolerance range, not the drop in effect. The UI reports the drop
    // (level * maxDampening), so the ceiling has to travel with the level --
    // otherwise the meter can only show a number nobody can interpret.
    const tolerance = { applicable: true, level: 0.9, maxDampening: 0.6, faded: false, daysSinceLast: 0.5, recentPeakLevel: 0.9 };
    const p = personalizedProfile(med, null, 20, tolerance);
    expect(p.tolerance.maxDampening).toBe(0.6);
    // 90% of an opioid's range is ~54% weaker, not 90% weaker.
    expect(p.tolerance.level * p.tolerance.maxDampening).toBeCloseTo(0.54, 5);
  });

  test("tolerance that has faded since the baseline pushes the curve above full height", () => {
    // The dose genuinely will land harder than the ones it's being compared
    // against, and the curve should show that rather than hide it.
    const faded = { applicable: true, level: 0.2, maxDampening: 0.6, faded: true, daysSinceLast: 30, recentPeakLevel: 0.8 };
    const p = personalizedProfile(med, null, 20, faded);
    expect(p.intensity_scale).toBeGreaterThan(1);
  });

  test("dose-ratio scaling survives tolerance being folded in", () => {
    const model = { onset_min: 20, peak_min: 60, duration_min: 240, ref_dose: 20, samples: 4 };
    const steady = { applicable: true, level: 1, maxDampening: 0.5, faded: false, daysSinceLast: 0, recentPeakLevel: 1 };
    const undamped = personalizedProfile(med, model, 40).intensity_scale;
    // Steady tolerance cancels against its own baseline, so a double dose is
    // still a double dose's worth of curve.
    expect(personalizedProfile(med, model, 40, steady).intensity_scale).toBeCloseTo(undamped, 5);
    // A faded baseline lifts it further still.
    const faded = { applicable: true, level: 0.3, maxDampening: 0.5, faded: true, daysSinceLast: 21, recentPeakLevel: 0.9 };
    expect(personalizedProfile(med, model, 40, faded).intensity_scale).toBeGreaterThan(undamped);
  });
});

describe("dose-response (Emax/Hill)", () => {
  test("a typical dose is exactly the reference point, for any parameters", () => {
    for (const params of [...Object.values(DOSE_RESPONSE), { hill: 3, typicalFraction: 0.1 }]) {
      expect(doseResponse(1, params)).toBeCloseTo(1, 10);
    }
  });

  test("is monotonic and saturating -- more always helps, but less and less", () => {
    const params = { hill: 1.3, typicalFraction: 0.5 };
    const at = [0.5, 1, 2, 4, 8, 100].map((r) => doseResponse(r, params));
    for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThan(at[i - 1]);
    // Each doubling buys strictly less than the previous doubling did.
    const gain1 = at[2] - at[1]; // 1x -> 2x
    const gain2 = at[3] - at[2]; // 2x -> 4x
    const gain3 = at[4] - at[3]; // 4x -> 8x
    expect(gain2).toBeLessThan(gain1);
    expect(gain3).toBeLessThan(gain2);
  });

  test("saturates at the ceiling its typicalFraction implies, never beyond", () => {
    const params = { hill: 1.3, typicalFraction: 0.5 };
    const ceiling = 1 + (1 - params.typicalFraction) / params.typicalFraction; // 1 + 1/a
    expect(doseResponse(1e6, params)).toBeLessThanOrEqual(ceiling);
    expect(doseResponse(1e6, params)).toBeCloseTo(ceiling, 4);
  });

  test("a drug typically taken near its plateau has little left to gain", () => {
    const nearPlateau = doseResponse(2, { hill: 1, typicalFraction: 0.88 }); // buprenorphine-like
    const wellBelow = doseResponse(2, { hill: 1.4, typicalFraction: 0.45 }); // kratom-like
    expect(nearPlateau).toBeLessThan(1.15);
    expect(wellBelow).toBeGreaterThan(1.4);
  });

  test("doubling a real dose moves the curve meaningfully (the old linear cap did not)", () => {
    const med = { name: "Kratom", category: "opioid" };
    const model = { ref_dose: 2, samples: 4 };
    const usual = personalizedProfile(med, model, 2).intensity_scale;
    const doubled = personalizedProfile(med, model, 4).intensity_scale;
    const quadrupled = personalizedProfile(med, model, 8).intensity_scale;
    expect(doubled).toBeGreaterThan(usual * 1.3);
    // The old model clamped at 1.5, making 2x and 4x indistinguishable.
    expect(quadrupled).toBeGreaterThan(doubled);
  });

  test("buprenorphine's ceiling effect means doubling barely moves it", () => {
    const med = { name: "Buprenorphine", category: "opioid" };
    const model = { ref_dose: 8, samples: 4 };
    const usual = personalizedProfile(med, model, 8).intensity_scale;
    const doubled = personalizedProfile(med, model, 16).intensity_scale;
    expect(doubled / usual).toBeLessThan(1.15);
  });

  test("an NSAID's analgesic ceiling behaves the same way", () => {
    const med = { category: "nsaid", form: "tablet" };
    const model = { ref_dose: 400, samples: 4 };
    const ratio = personalizedProfile(med, model, 800).intensity_scale / personalizedProfile(med, model, 400).intensity_scale;
    expect(ratio).toBeLessThan(1.3);
  });
});

describe("modeledEffectiveness", () => {
  test("an untouched intensity_scale (1) maps back to the app's long-standing default of 7", () => {
    expect(modeledEffectiveness(1)).toBe(7);
  });

  test("a dampened curve (tolerance/smaller dose) suggests a lower rating", () => {
    expect(modeledEffectiveness(0.5)).toBeLessThan(7);
  });

  test("a stronger curve (bigger dose) suggests a higher rating", () => {
    expect(modeledEffectiveness(1.5)).toBeGreaterThan(7);
  });

  test("always clamped to the slider's 1-10 range even at extremes", () => {
    expect(modeledEffectiveness(0)).toBe(1);
    expect(modeledEffectiveness(10)).toBe(10);
  });

  test("a non-finite input falls back to the neutral default rather than NaN", () => {
    expect(modeledEffectiveness(NaN)).toBe(7);
    expect(modeledEffectiveness(undefined)).toBe(7);
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

  // Regression: a finished session used to linger as a dead "Effects
  // complete · 0% intensity" card until 2x its duration had elapsed, hours
  // after the curve was visibly over.
  test("a session clears as soon as its curve is over, not at 2x duration", async () => {
    const med = await db.createMedication({ name: "ClearMed", strength: 5, unit: "mg", category: "stimulant-fast", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 5 });
    const endsAfter = db.sessionEndsAfterMin(s); // duration * 1.25, well under 2x

    // Just before the curve ends the session is still active...
    const raw = (await db.exportData()).profileData;
    const pid = Object.keys(raw)[0];
    const stored = raw[pid].effectSessions.find((x) => x.id === s.id);
    stored.started_at = new Date(Date.now() - (endsAfter - 5) * 60000).toISOString();
    expect((await db.getActiveEffectSessions()).some((x) => x.id === s.id)).toBe(true);

    // ...and clears the moment it's past, long before 2x duration.
    stored.started_at = new Date(Date.now() - (endsAfter + 5) * 60000).toISOString();
    expect((await db.getActiveEffectSessions()).some((x) => x.id === s.id)).toBe(false);
    expect((await db.getEffectSessions({ medication_id: med.id }))[0].status).toBe("completed");
    expect(await db.getEffectModel(med.id)).toBe(null); // auto-complete never trains
  });

  test("a redose keeps the session alive until the extended curve is over", async () => {
    const med = await db.createMedication({ name: "RedoseClearMed", strength: 5, unit: "mg", category: "stimulant-fast", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 5 });
    const soloEnd = db.sessionEndsAfterMin(s);
    const withRedose = await db.addEffectDose(s.id, { amount: 5 });
    // The redose pushes the end out by its own offset.
    expect(db.sessionEndsAfterMin(withRedose)).toBeGreaterThanOrEqual(soloEnd);

    const raw = (await db.exportData()).profileData;
    const pid = Object.keys(raw)[0];
    const stored = raw[pid].effectSessions.find((x) => x.id === s.id);
    // Backdate the start past where a lone dose would have ended. The redose
    // keeps its own (recent) timestamp, so its curve is still running.
    stored.started_at = new Date(Date.now() - (soloEnd + 5) * 60000).toISOString();
    expect(db.sessionEndsAfterMin(stored)).toBeGreaterThan(soloEnd + 5);
    expect((await db.getActiveEffectSessions()).some((x) => x.id === s.id)).toBe(true);
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

describe("tolerance wired into real sessions (localdb)", () => {
  const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString();

  test("frequent recent use is reported on a new session's profile", async () => {
    const med = await db.createMedication({ name: "TolMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    // Five daily doses leading up to just now, all logged as real (backdated) logs.
    for (let i = 5; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", timestamp: daysAgoIso(i) });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    expect(s.profile.tolerance.level).toBeGreaterThan(0);
    expect(s.profile.tolerance.faded).toBe(false);
    // Real tolerance, but it hasn't moved relative to the doses this one
    // follows -- so this is an ordinary dose, and the curve says so.
    expect(s.profile.intensity_scale).toBeCloseTo(1, 1);
  });

  test("a fresh medication with no dose history at all shows no tolerance effect", async () => {
    const med = await db.createMedication({ name: "FreshMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    expect(s.profile.intensity_scale).toBe(1);
    expect(s.profile.tolerance.level).toBe(0);
  });

  test("a non-recreational category is never dampened even with heavy logged history", async () => {
    const med = await db.createMedication({ name: "SsriMed", strength: 10, unit: "mg", category: "antidepressant", form: "tablet", times: [], is_prn: true });
    for (let i = 5; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", timestamp: daysAgoIso(i) });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    expect(s.profile.intensity_scale).toBe(1);
    // Not an applicable category at all -- no tolerance field, not just a zero one.
    expect(s.profile.tolerance).toBeUndefined();
  });

  test("the dose that starts this very session doesn't count toward its own tolerance", async () => {
    const med = await db.createMedication({ name: "FirstDoseMed", strength: 10, unit: "mg", category: "psychedelic", form: "tablet", times: [], is_prn: true });
    const log = await db.createLog({ medication_id: med.id, status: "taken" });
    // If the log for *this* dose were counted, even a first-ever psychedelic
    // dose would show heavy self-inflicted "tolerance" -- it must not.
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10, log_id: log.id });
    expect(s.profile.intensity_scale).toBe(1);
    expect(s.profile.tolerance.level).toBe(0);
  });

  test("a long gap after building real tolerance flags as faded on the next session", async () => {
    const med = await db.createMedication({ name: "FadedMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    for (let i = 35; i >= 30; i--) await db.createLog({ medication_id: med.id, status: "taken", timestamp: daysAgoIso(i) });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    expect(s.profile.tolerance.faded).toBe(true);
    expect(s.profile.tolerance.daysSinceLast).toBeCloseTo(30, 0);
  });

  test("resetEffectModel keeps tolerance applied even though the learned onset/peak/duration model is cleared", async () => {
    const med = await db.createMedication({ name: "ResetTolMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    for (let i = 5; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", timestamp: daysAgoIso(i) });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    const dampedBefore = s.profile.intensity_scale;
    await db.resetEffectModel(med.id);
    const active = (await db.getActiveEffectSessions()).find((x) => x.id === s.id);
    expect(active.profile.learned).toBe(false);
    expect(active.profile.intensity_scale).toBe(dampedBefore);
  });

  test("getMedicationTolerance reads the same live value without needing an active session", async () => {
    const med = await db.createMedication({ name: "ReadTolMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    expect(await db.getMedicationTolerance(med.id)).toBeNull(); // no history yet -> nothing worth showing
    for (let i = 5; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", timestamp: daysAgoIso(i) });
    const t = await db.getMedicationTolerance(med.id);
    expect(t.level).toBeGreaterThan(0);
  });

  test("getMedicationTolerance is null for a non-recreational category regardless of history", async () => {
    const med = await db.createMedication({ name: "ReadTolSsri", strength: 10, unit: "mg", category: "antidepressant", form: "tablet", times: [], is_prn: true });
    for (let i = 5; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", timestamp: daysAgoIso(i) });
    expect(await db.getMedicationTolerance(med.id)).toBeNull();
  });

  test("estimateDoseEffectiveness reads relative to the user's own usual, so tolerance alone doesn't pin it low", async () => {
    const med = await db.createMedication({ name: "EffSuggestMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    const fresh = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 10 });
    expect(fresh.suggested).toBe(7); // no history at all -> neutral default

    for (let i = 5; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 10, timestamp: daysAgoIso(i) });
    const usualDose = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 10 });
    // Real tolerance has built -- and is still reported -- but taking the
    // same amount they always take is, for them, a completely ordinary dose.
    // Reporting that as "40% of typical" described an opioid-naive stranger,
    // not this person, and left the number unable to respond to dose changes.
    expect(usualDose.tolerance.level).toBeGreaterThan(0);
    expect(usualDose.relativeToUsual).toBeCloseTo(1, 1);
    expect(usualDose.suggested).toBe(7);

    // Establish a reference dose via a trained model, then ask about a much bigger dose.
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    await db.addEffectEvent(s.id, { kind: "onset" });
    await db.addEffectEvent(s.id, { kind: "gone" });
    const biggerDose = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 40 });
    expect(biggerDose.suggested).toBeGreaterThan(usualDose.suggested);
  });

  test("doubling a dose visibly moves the preview, and quadrupling moves it further still", async () => {
    // The reported bug: a daily kratom user doubled their dose and the
    // preview stayed in the 30-60% band. Two causes -- the old linear scale
    // clamped at 1.5x so 2x and 4x were indistinguishable, and the headline
    // was an absolute number dominated by saturated tolerance.
    const med = await db.createMedication({ name: "Kratom", strength: 1, unit: "g", category: "opioid", form: "other", times: [], is_prn: true });
    for (let i = 30; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 2, timestamp: daysAgoIso(i) });

    const usual = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 2 });
    const doubled = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 4 });
    const quadrupled = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 8 });

    expect(usual.tolerance.level).toBeGreaterThan(0.5); // a month of daily use really is tolerant
    expect(usual.relativeToUsual).toBeCloseTo(1, 1);
    expect(doubled.relativeToUsual).toBeGreaterThan(1.3);
    expect(quadrupled.relativeToUsual).toBeGreaterThan(doubled.relativeToUsual);
    expect(doubled.suggested).toBeGreaterThan(usual.suggested);
  });

  test("a dose landing while an earlier one is still active is predicted stronger", async () => {
    // Until now this was only modeled *within* one effects session, so a dose
    // logged a couple of hours after another was treated as landing on
    // nothing -- the single biggest short-term factor after the dose itself.
    const med = await db.createMedication({ name: "ResidualMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    for (let i = 10; i >= 2; i--) await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 10, timestamp: daysAgoIso(i) });

    const settled = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 10 });
    expect(settled.factors.residual).toBeLessThan(0.05);

    // One taken an hour ago -- around its peak for this profile, so a good
    // chunk of it is still on board.
    await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 10, timestamp: new Date(Date.now() - 60 * 60000).toISOString() });
    const onTop = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 10 });
    expect(onTop.factors.residual).toBeGreaterThan(0.2);
    expect(onTop.relativeToUsual).toBeGreaterThan(settled.relativeToUsual);
  });

  test("a dose long past its curve contributes no residual", async () => {
    const med = await db.createMedication({ name: "NoResidualMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    for (let i = 10; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 10, timestamp: daysAgoIso(i) });
    const r = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 10 });
    expect(r.factors.residual).toBeLessThan(0.05);
  });

  test("the reported factors add up to the headline", async () => {
    const med = await db.createMedication({ name: "FactorsMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    for (let i = 8; i >= 2; i--) await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 10, timestamp: daysAgoIso(i) });
    await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 10, timestamp: new Date(Date.now() - 90 * 60000).toISOString() });
    const r = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 20 });
    expect(r.factors.dose + r.factors.residual).toBeCloseTo(r.relativeToUsual, 1);
    // And tolerance is genuinely part of the picture, reported on its own.
    expect(r.factors.toleranceDampening).toBeGreaterThan(0);
    expect(r.tolerance.level).toBeGreaterThan(0);
    // The preview's "blunting effect by about X%" and the tolerance meter's
    // "doses land ~X% weaker" have to be the same number -- they sit inches
    // apart in the log sheet, and the meter derives it from level *
    // maxDampening while the preview derives it from 1 - curFactor.
    expect(r.tolerance.maxDampening).toBeGreaterThan(0);
    expect(r.tolerance.level * r.tolerance.maxDampening).toBeCloseTo(r.factors.toleranceDampening, 2);
  });

  test("a median reference dose is not dragged upward by the escalation being measured", async () => {
    // Long history at 2, then a short recent run at 6. The mean would be
    // pulled well above 2 by that tail, shrinking the very ratio the preview
    // is meant to surface; the median stays at the established dose.
    const med = await db.createMedication({ name: "EscalationMed", strength: 1, unit: "g", category: "opioid", form: "other", times: [], is_prn: true });
    for (let i = 20; i >= 6; i--) await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 2, timestamp: daysAgoIso(i) });
    for (let i = 5; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 6, timestamp: daysAgoIso(i) });

    const atEstablished = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 2 });
    const atEscalated = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 6 });
    expect(atEstablished.relativeToUsual).toBeCloseTo(1, 1);
    expect(atEscalated.relativeToUsual).toBeGreaterThan(1.4);
  });

  test("estimateDoseEffectiveness only trusts learned onset/peak/duration once modelConfidence reaches medium (>=3 sessions)", async () => {
    const med = await db.createMedication({ name: "ConfidenceMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    // Train the model with a single wildly atypical session -- with only one
    // sample, updateModel adopts it outright (no averaging), so this is
    // exactly the kind of noisy single data point that shouldn't yet be
    // trusted over the researched category default.
    const s1 = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    await db.updateEffectSession(s1.id, { started_at: new Date(Date.now() - 500 * 60000).toISOString() });
    await db.addEffectEvent(s1.id, { kind: "onset" }); // ~500 min in -- absurdly slow onset for an opioid
    await db.addEffectEvent(s1.id, { kind: "gone" });
    expect((await db.getEffectModel(med.id)).samples).toBe(1);

    const lowConfidence = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 10 });
    expect(lowConfidence.calibrated).toBe(false);
    // ref_dose (10, matching this one session) is still trusted even at low
    // confidence, so a same-size dose shouldn't show any dose-ratio scaling.
    // Only tolerance (near-zero here) affects intensityScale.
    expect(lowConfidence.intensityScale).toBeCloseTo(1, 1);

    // Two more sessions with the same reported (atypical) onset push samples to 3 -> medium confidence.
    for (let i = 0; i < 2; i++) {
      const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
      await db.updateEffectSession(s.id, { started_at: new Date(Date.now() - 500 * 60000).toISOString() });
      await db.addEffectEvent(s.id, { kind: "onset" });
      await db.addEffectEvent(s.id, { kind: "gone" });
    }
    expect((await db.getEffectModel(med.id)).samples).toBe(3);
    const highConfidence = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 10 });
    expect(highConfidence.calibrated).toBe(true);
  });

  test("estimateDoseEffectiveness reflects dose amount for a medication that's never used the effects tracker (older/scheduled meds)", async () => {
    // A plain scheduled medication, logged the ordinary way for months --
    // is_prn is false and startEffectSession has never been called, so
    // there is no learned ref_dose from the effects tracker at all.
    const med = await db.createMedication({ name: "OldScheduleMed", strength: 20, unit: "mg", category: "opioid", form: "tablet", times: ["09:00", "21:00"], is_prn: false });
    for (let i = 10; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 20, scheduled_time: i % 2 ? "09:00" : "21:00", timestamp: daysAgoIso(i) });

    const typical = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 20 });
    const double = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 40 });
    const half = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 10 });
    expect(double.intensityScale).toBeGreaterThan(typical.intensityScale);
    expect(half.intensityScale).toBeLessThan(typical.intensityScale);
    // Ten days of a twice-daily schedule is plenty of tolerance-relevant history too.
    expect(typical.tolerance.level).toBeGreaterThan(0);
  });

  test("estimateDoseEffectiveness ignores logs with no recorded dose amount when building the historical-average fallback", async () => {
    const med = await db.createMedication({ name: "NoAmountMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    for (let i = 3; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", timestamp: daysAgoIso(i) }); // no dose_taken
    // With no valid historical amount to infer a reference dose from, the
    // dose-ratio block never activates -- intensityScale should be identical
    // regardless of the dose asked about (tolerance alone may still apply).
    const small = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 5 });
    const huge = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 100 });
    expect(huge.intensityScale).toBe(small.intensityScale);
  });
});

describe("describeActiveSession (feeds the AI assistant's get_active_effects tool)", () => {
  const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString();

  test("a redose is read as its own current dose, matching the Effects page rather than the session's original one", async () => {
    const med = await db.createMedication({ name: "AiRedoseMed", strength: 10, unit: "mg", category: "stimulant-fast", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    // Backdate the start so the redose (added "now") lands a real 30 minutes
    // into the session rather than at a near-zero real-clock gap, which in a
    // fast test run can round to the same millisecond as the start itself.
    const raw = (await db.exportData()).profileData;
    const pid = Object.keys(raw)[0];
    const stored = raw[pid].effectSessions.find((x) => x.id === s.id);
    stored.started_at = new Date(Date.now() - 30 * 60000).toISOString();
    const soloDescribe = db.describeActiveSession(stored, Date.now());
    expect(soloDescribe.redose_count).toBe(0);

    const withRedose = await db.addEffectDose(s.id, { amount: 10 });
    const afterRedose = db.describeActiveSession(withRedose, Date.now());
    expect(afterRedose.redose_count).toBe(1);
    // Right after a same-size redose, the newest dose is at its own t=0 (not
    // yet felt) -- if this were still reading the original dose's curve, or
    // summing both, it would report a nonzero/plateaued intensity instead.
    expect(afterRedose.phase).toBe("Not yet felt");
    expect(afterRedose.intensity_pct).toBe(0);
    // "Ends at" stretches to cover the redose's own tail, not the original
    // dose's now-superseded end.
    expect(new Date(afterRedose.predicted.ends_at).getTime()).toBeGreaterThan(new Date(soloDescribe.predicted.ends_at).getTime());
  });

  test("carries tolerance in the same plain terms as the tolerance meter, not a bare level", async () => {
    const med = await db.createMedication({ name: "AiTolMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    for (let i = 10; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 10, timestamp: daysAgoIso(i) });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    const d = db.describeActiveSession(s, Date.now());
    expect(d.tolerance).not.toBeNull();
    expect(["low", "moderate", "high", "very high"]).toContain(d.tolerance.band);
    expect(d.tolerance.weaker_pct).toBeGreaterThan(0);
    expect(d.tolerance.faded).toBe(false);
  });

  test("tolerance is null (not a zeroed object) for a non-recreational category", async () => {
    const med = await db.createMedication({ name: "AiNoTolMed", strength: 10, unit: "mg", category: "antidepressant", form: "tablet", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    expect(db.describeActiveSession(s, Date.now()).tolerance).toBeNull();
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

// The curve was reverted to the pre-PK/PD spline on user feedback. This block
// pins the restored shape to an independent verbatim copy of that spline, so
// any future "improvement" that quietly changes what a user's own feedback
// plots back as will fail here instead of drifting unnoticed.
describe("the reverted curve matches the pre-PK/PD spline exactly", () => {
  const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
  // The spline, reproduced verbatim (unrounded) as the reference.
  function previousCurve(tMin, { onset_min: on, peak_min: pk, duration_min: dur }) {
    const plateauEnd = pk + (dur - pk) * 0.35;
    if (tMin <= 0) return 0;
    if (tMin < on) return 12 * smooth(tMin / on);
    if (tMin < pk) return 12 + 88 * smooth((tMin - on) / (pk - on));
    if (tMin < plateauEnd) return 100;
    if (tMin < dur) return 100 * (1 - smooth((tMin - plateauEnd) / (dur - plateauEnd)));
    const tail = dur * 0.25;
    if (tMin < dur + tail) return 8 * (1 - smooth((tMin - dur) / tail));
    return 0;
  }

  const profiles = Object.keys(CATEGORY_PK).map((category) => defaultPkProfile({ category, form: "tablet" }));

  test("pointwise identical (to display rounding) across every category profile", () => {
    for (const p of profiles) {
      for (let t = 0; t <= p.duration_min * 1.25 + 10; t++) {
        expect(intensityAt(t, p)).toBe(Math.round(previousCurve(t, p) * 10) / 10);
      }
    }
  });

  test("a model trained from feedback still round-trips into the same timings", async () => {
    const med = await db.createMedication({ name: "RoundTripMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    // Feedback taps are stamped when they happen and measured against the
    // session's start, so the clock is advanced between them to place them
    // where a real session would: "feeling it" 40 min in, "gone" 300 min in.
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date("2026-07-01T08:00:00.000Z"));
      const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
      jest.setSystemTime(new Date("2026-07-01T08:40:00.000Z"));
      await db.addEffectEvent(s.id, { kind: "onset" });
      jest.setSystemTime(new Date("2026-07-01T13:00:00.000Z"));
      await db.addEffectEvent(s.id, { kind: "gone" });
    } finally {
      jest.useRealTimers();
    }
    const model = await db.getEffectModel(med.id);
    const next = await db.startEffectSession({ medication_id: med.id, dose: 10 });
    // The reported onset carries into the next session's curve verbatim, and
    // the curve is anchored to that session's own peak -- so the feedback
    // that produced the model is exactly what the user sees plotted back.
    // (duration is subject to the engine's ordering rule, since only onset
    // and "gone" were reported here and peak has to sit between them.)
    expect(next.profile.onset_min).toBe(Math.round(model.onset_min));
    expect(next.profile.duration_min).toBeGreaterThanOrEqual(Math.round(model.duration_min));
    expect(next.profile.peak_min).toBeGreaterThan(next.profile.onset_min);
    expect(intensityAt(next.profile.peak_min, next.profile)).toBe(100);
    expect(intensityAt(next.profile.onset_min, next.profile)).toBeLessThan(20);
  });
});

describe("a session already in flight is not left on a stale intensity scale", () => {
  const daysAgoIso2 = (n) => new Date(Date.now() - n * 86400000).toISOString();

  test("a running session's height and tolerance track reality; its timing stays snapshotted", async () => {
    // A session begins with no history behind it, so nothing to dampen.
    const med = await db.createMedication({ name: "InFlightMed", strength: 1, unit: "g", category: "opioid", form: "other", times: [], is_prn: true });
    const s = await db.startEffectSession({ medication_id: med.id, dose: 2 });
    expect(s.profile.tolerance.level).toBe(0);
    const snapshot = { onset: s.profile.onset_min, peak: s.profile.peak_min, duration: s.profile.duration_min };

    // Then a month of daily use lands in the log -- the session is still
    // running, and its stored profile still says "no tolerance".
    for (let i = 30; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 2, timestamp: daysAgoIso2(i) });

    const live = (await db.getActiveEffectSessions()).find((x) => x.id === s.id);
    // Reading the session reflects where things actually stand now, rather
    // than serving whatever was frozen in at the moment it started.
    expect(live.profile.tolerance.level).toBeGreaterThan(0.5);
    // Timing is deliberately *not* re-derived -- a curve that shifted
    // underneath you mid-session would be worse than useless.
    expect(live.profile.onset_min).toBe(snapshot.onset);
    expect(live.profile.peak_min).toBe(snapshot.peak);
    expect(live.profile.duration_min).toBe(snapshot.duration);
    // And a usual dose still reads as a usual dose, not scaled down by
    // tolerance measured against a drug-naive baseline.
    expect(live.profile.intensity_scale).toBeCloseTo(1, 1);
  });
});

// "How long ago did you eat" -- stomach fullness shifts an oral dose's
// predicted timing and peak; every other route, and an unanswered picker,
// changes nothing at all.
describe("meal-state adjustment (stomach fullness, oral routes only)", () => {
  const oralMed = { category: "opioid", form: "tablet" };
  const base = personalizedProfile(oralMed);

  test("null and 'light' are both exactly the unadjusted profile", () => {
    expect(personalizedProfile(oralMed, null, null, null, { lastMeal: null })).toEqual(base);
    expect(personalizedProfile(oralMed, null, null, null, { lastMeal: "light" })).toEqual(base);
    expect(personalizedProfile(oralMed)).toEqual(base); // no options arg at all
  });

  test("empty stomach: faster onset and peak, slightly stronger", () => {
    const p = personalizedProfile(oralMed, null, null, null, { lastMeal: "empty" });
    expect(p.onset_min).toBeLessThan(base.onset_min);
    expect(p.peak_min).toBeLessThan(base.peak_min);
    // intensity_scale carries the profile's 1-decimal display rounding, so
    // x1.05 on a baseline of 1 surfaces as 1.1 (the unrounded value drives
    // estimateDoseEffectiveness, tested below).
    expect(p.intensity_scale).toBe(Math.round(base.intensity_scale * 1.05 * 10) / 10);
  });

  test("full meal: slower onset and peak, blunted intensity, slightly longer", () => {
    const p = personalizedProfile(oralMed, null, null, null, { lastMeal: "full" });
    expect(p.onset_min).toBeGreaterThan(base.onset_min);
    expect(p.peak_min).toBeGreaterThan(base.peak_min);
    expect(p.duration_min).toBeGreaterThan(base.duration_min);
    expect(p.intensity_scale).toBe(Math.round(base.intensity_scale * 0.85 * 10) / 10);
  });

  test("non-oral routes are never adjusted, whatever the answer", () => {
    for (const form of ["smoked/vaporized", "insufflated", "injection", "patch"]) {
      const med = { category: "opioid", form };
      const unadjusted = personalizedProfile(med);
      expect(personalizedProfile(med, null, null, null, { lastMeal: "full" })).toEqual(unadjusted);
      expect(personalizedProfile(med, null, null, null, { lastMeal: "empty" })).toEqual(unadjusted);
    }
  });

  test("unknown form counts as oral (category baselines are oral values); junk meal values are identity", () => {
    expect(isOralForm(undefined)).toBe(true);
    expect(isOralForm("tablet")).toBe(true);
    expect(isOralForm("smoked/vaporized")).toBe(false);
    expect(mealFactorsFor("banana", "tablet")).toEqual({ onset: 1, comeUp: 1, intensity: 1, duration: 1 });
    expect(MEAL_STATES).toEqual(["empty", "light", "full"]);
  });

  test("ordering survives a full-meal shift even for a learned profile with onset right under its peak", () => {
    const model = { onset_min: 100, peak_min: 110, duration_min: 200, samples: 4 };
    const p = personalizedProfile(oralMed, model, null, null, { lastMeal: "full" });
    expect(p.onset_min).toBeLessThan(p.peak_min);
    expect(p.peak_min).toBeLessThan(p.duration_min);
  });

  describe("threaded through the data layer", () => {
    test("startEffectSession persists last_meal and the shifted profile; junk normalizes to null", async () => {
      const med = await db.createMedication({ name: "MealOralMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
      const sFull = await db.startEffectSession({ medication_id: med.id, dose: 10, last_meal: "full" });
      expect(sFull.last_meal).toBe("full");
      const sNone = await db.startEffectSession({ medication_id: med.id, dose: 10 });
      expect(sNone.last_meal).toBe(null);
      expect(sFull.profile.onset_min).toBeGreaterThan(sNone.profile.onset_min);
      expect(sFull.profile.intensity_scale).toBeLessThan(sNone.profile.intensity_scale);
      const sJunk = await db.startEffectSession({ medication_id: med.id, dose: 10, last_meal: "brunch" });
      expect(sJunk.last_meal).toBe(null);
    });

    test("a smoked med stores the answer but its profile is untouched by it", async () => {
      const med = await db.createMedication({ name: "MealSmokedMed", strength: 10, unit: "mg", category: "cannabis", form: "smoked/vaporized", times: [], is_prn: true });
      const sFull = await db.startEffectSession({ medication_id: med.id, dose: 10, last_meal: "full" });
      const sNone = await db.startEffectSession({ medication_id: med.id, dose: 10 });
      expect(sFull.profile.onset_min).toBe(sNone.profile.onset_min);
      expect(sFull.profile.intensity_scale).toBe(sNone.profile.intensity_scale);
    });

    test("updateEffectSession({ last_meal }) recomputes the snapshot in place", async () => {
      const med = await db.createMedication({ name: "MealEditMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
      const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
      const before = s.profile.onset_min;
      const updated = await db.updateEffectSession(s.id, { last_meal: "full" });
      expect(updated.last_meal).toBe("full");
      expect(updated.profile.onset_min).toBeGreaterThan(before);
      const cleared = await db.updateEffectSession(s.id, { last_meal: "not-a-state" });
      expect(cleared.last_meal).toBe(null);
      expect(cleared.profile.onset_min).toBe(before);
    });

    test("the live intensity recompute keeps the meal factor instead of clobbering it", async () => {
      const med = await db.createMedication({ name: "MealClobberMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
      await db.startEffectSession({ medication_id: med.id, dose: 10, last_meal: "full" });
      const live = (await db.getActiveEffectSessions()).find((x) => x.medication_id === med.id);
      // Read path recomputes intensity_scale fresh -- it must still carry the
      // x0.85 full-stomach factor (as 1-dp-rounded by the profile), and
      // surface the med's form for UI gating.
      const expected = Math.round(0.85 * personalizedProfile({ category: "opioid", form: "tablet" }).intensity_scale * 10) / 10;
      expect(live.profile.intensity_scale).toBe(expected);
      expect(live.medication_form).toBe("tablet");
    });

    test("resetEffectModel re-applies the session's stored meal state", async () => {
      const med = await db.createMedication({ name: "MealResetMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
      const s = await db.startEffectSession({ medication_id: med.id, dose: 10, last_meal: "full" });
      const shiftedOnset = s.profile.onset_min;
      await db.resetEffectModel(med.id);
      const after = (await db.getEffectSessions({ medication_id: med.id })).find((x) => x.id === s.id);
      expect(after.profile.onset_min).toBe(shiftedOnset);
    });

    test("the dose-effect preview reads lower on a full stomach, against an unchanged usual", async () => {
      const med = await db.createMedication({ name: "MealPreviewMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
      await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 10, timestamp: new Date(Date.now() - 5 * 86400000).toISOString() });
      const plain = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 10 });
      const fed = await db.estimateDoseEffectiveness({ medication_id: med.id, dose: 10, last_meal: "full" });
      expect(fed.relativeToUsual).toBeCloseTo(plain.relativeToUsual * 0.85, 1);
    });
  });
});

// The meal factors calibrate to the person, the same way the timing model
// does: each completed session with a meal answer yields an observed
// factor sample, EWMA'd from the population prior toward this person's own
// gastric response.
describe("meal-factor calibration (learned per-person model)", () => {
  const prior = mealFactorsFor("full", "tablet"); // population prior

  test("a learned model with samples overrides the prior's timing factors; intensity is never learned", () => {
    const model = { full: { onset: 2.2, comeUp: 1.5, duration: 1.3, samples: 4 } };
    const f = mealFactorsFor("full", "tablet", model);
    expect(f.onset).toBe(2.2);
    expect(f.comeUp).toBe(1.5);
    expect(f.duration).toBe(1.3);
    expect(f.intensity).toBe(prior.intensity); // stays the prior
    // zero-sample or absent entries fall back to the prior wholesale
    expect(mealFactorsFor("full", "tablet", { full: { onset: 3, samples: 0 } })).toEqual(prior);
    expect(mealFactorsFor("empty", "tablet", model)).toEqual(mealFactorsFor("empty", "tablet"));
    // learned values are clamped into sane bounds
    const wild = { full: { onset: 99, comeUp: 0.01, duration: 99, samples: 2 } };
    const g = mealFactorsFor("full", "tablet", wild);
    expect(g.onset).toBe(MEAL_FACTOR_BOUNDS.onset[1]);
    expect(g.comeUp).toBe(MEAL_FACTOR_BOUNDS.comeUp[0]);
    expect(g.duration).toBe(MEAL_FACTOR_BOUNDS.duration[1]);
  });

  test("updateMealModel walks from the prior toward observations, halving first", () => {
    // First sample: alpha = 1/2, so the value lands midway between prior and sample.
    const m1 = updateMealModel(null, "full", { onset: 2.4 });
    expect(m1.full.samples).toBe(1);
    expect(m1.full.onset).toBeCloseTo((prior.onset + 2.4) / 2, 3);
    // Second sample: alpha = 1/3.
    const m2 = updateMealModel(m1, "full", { onset: 2.4 });
    expect(m2.full.samples).toBe(2);
    expect(m2.full.onset).toBeCloseTo(m1.full.onset + (2.4 - m1.full.onset) / 3, 3);
    // Repeated agreement converges on the person's real factor.
    let m = null;
    for (let i = 0; i < 12; i++) m = updateMealModel(m, "full", { onset: 2.4, comeUp: 1.6, duration: 1.4 });
    expect(m.full.onset).toBeCloseTo(2.4, 1);
    expect(m.full.comeUp).toBeCloseTo(1.6, 1);
    expect(m.full.duration).toBeCloseTo(1.4, 1);
  });

  test("updateMealModel ignores the baseline state, junk states, and empty observations", () => {
    expect(updateMealModel({ a: 1 }, "light", { onset: 2 })).toEqual({ a: 1 });
    expect(updateMealModel({ a: 1 }, "brunch", { onset: 2 })).toEqual({ a: 1 });
    expect(updateMealModel({ a: 1 }, "full", {})).toEqual({ a: 1 });
    expect(updateMealModel({ a: 1 }, "full", { onset: NaN })).toEqual({ a: 1 });
  });

  test("observedMealFactors recovers the person's real factor from a session's timings", () => {
    // Baseline onset 20, snapshot applied fOnset 1.6 -> predicted onset 32.
    // The person actually felt it at 44 -> their real factor is 44/20 = 2.2.
    const profile = { onset_min: 32, peak_min: 94, duration_min: 297 }; // base 20/70/270 shifted by full-meal priors
    const applied = { onset: 1.6, comeUp: 1.25, intensity: 0.85, duration: 1.1 };
    const obs = { onset_min: 44, peak_min: 104, end_min: 324 };
    const f = observedMealFactors(obs, profile, applied);
    expect(f.onset).toBeCloseTo(44 / 20, 2);
    // come-up: observed span 104-44 = 60 vs baseline span (94-32)/1.25 = 49.6
    expect(f.comeUp).toBeCloseTo(60 / 49.6, 2);
    expect(f.duration).toBeCloseTo(324 / 270, 2);
    // samples clamp instead of running wild
    const crazy = observedMealFactors({ onset_min: 900 }, profile, applied);
    expect(crazy.onset).toBe(MEAL_FACTOR_BOUNDS.onset[1]);
  });

  test("baselineObservations divides the meal shift back out before the base model trains", () => {
    const profile = { onset_min: 32, peak_min: 94, duration_min: 297 };
    const applied = { onset: 1.6, comeUp: 1.25, intensity: 0.85, duration: 1.1 };
    const obs = { onset_min: 48, peak_min: 110, end_min: 330 };
    const base = baselineObservations(obs, profile, applied);
    expect(base.onset_min).toBeCloseTo(30, 5); // 48/1.6
    expect(base.peak_min).toBeCloseTo(30 + (110 - 48) / 1.25, 5);
    expect(base.end_min).toBeCloseTo(300, 5); // 330/1.1
    // identity factors pass observations through untouched
    expect(baselineObservations(obs, profile, { onset: 1, comeUp: 1, intensity: 1, duration: 1 })).toEqual(obs);
  });

  test("personalizedProfile uses the learned factors once they have samples", () => {
    const med = { category: "opioid", form: "tablet" };
    const withPrior = personalizedProfile(med, null, null, null, { lastMeal: "full" });
    const learned = { full: { onset: 2.6, comeUp: 1.8, duration: 1.5, samples: 5 } };
    const withLearned = personalizedProfile(med, null, null, null, { lastMeal: "full", mealModel: learned });
    expect(withLearned.onset_min).toBeGreaterThan(withPrior.onset_min);
    expect(withLearned.peak_min).toBeGreaterThan(withPrior.peak_min);
    expect(withLearned.duration_min).toBeGreaterThan(withPrior.duration_min);
  });

  describe("the full loop through the data layer", () => {
    // Build a medication whose base model is already trustworthy (3 trained
    // no-meal sessions -> medium confidence), which is the gate for meal
    // learning: until the person's own baseline is known, a slow session
    // can't be attributed to the meal rather than to a wrong baseline.
    async function calibratedMed(name) {
      const med = await db.createMedication({ name, strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
      jest.useFakeTimers();
      try {
        for (let i = 0; i < 3; i++) {
          jest.setSystemTime(new Date(Date.UTC(2026, 6, 1 + i, 8, 0, 0)));
          const s = await db.startEffectSession({ medication_id: med.id, dose: 10 });
          jest.setSystemTime(new Date(Date.UTC(2026, 6, 1 + i, 8, 30, 0)));
          await db.addEffectEvent(s.id, { kind: "onset" });
          jest.setSystemTime(new Date(Date.UTC(2026, 6, 1 + i, 13, 0, 0)));
          await db.addEffectEvent(s.id, { kind: "gone" });
        }
      } finally { jest.useRealTimers(); }
      return med;
    }

    test("a full-stomach session teaches the meal model, and the base model stays clean", async () => {
      const med = await calibratedMed("MealLearnMed");
      const baseBefore = await db.getEffectModel(med.id);
      expect(modelConfidence(baseBefore)).toBe("medium");

      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date(Date.UTC(2026, 6, 10, 8, 0, 0)));
        const s = await db.startEffectSession({ medication_id: med.id, dose: 10, last_meal: "full" });
        // The person feels onset exactly when their *baseline* model says
        // (30 min) times a personal full-stomach factor of 2 -> 60 min.
        jest.setSystemTime(new Date(Date.UTC(2026, 6, 10, 9, 0, 0)));
        await db.addEffectEvent(s.id, { kind: "onset" });
        jest.setSystemTime(new Date(Date.UTC(2026, 6, 10, 14, 0, 0)));
        await db.addEffectEvent(s.id, { kind: "gone" });
      } finally { jest.useRealTimers(); }

      // Meal model learned: first sample moves halfway from the prior (1.6)
      // toward the observed personal factor (60/30 = 2).
      const mealModel = await db.getMealModel();
      expect(mealModel.full.samples).toBe(1);
      expect(mealModel.full.onset).toBeCloseTo((1.6 + 2) / 2, 2);

      // Base model de-confounded: the 60-min onset was divided back by the
      // applied 1.6 factor (-> 37.5) before training, so the baseline moved
      // only mildly -- not dragged toward the fed-state 60.
      const baseAfter = await db.getEffectModel(med.id);
      expect(baseAfter.onset_min).toBeLessThan(40);
    });

    test("without a trustworthy baseline the meal model refuses to learn", async () => {
      const med = await db.createMedication({ name: "MealGateMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
      const before = JSON.stringify(await db.getMealModel());
      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date(Date.UTC(2026, 6, 20, 8, 0, 0)));
        const s = await db.startEffectSession({ medication_id: med.id, dose: 10, last_meal: "full" });
        jest.setSystemTime(new Date(Date.UTC(2026, 6, 20, 9, 0, 0)));
        await db.addEffectEvent(s.id, { kind: "onset" });
        jest.setSystemTime(new Date(Date.UTC(2026, 6, 20, 14, 0, 0)));
        await db.addEffectEvent(s.id, { kind: "gone" });
      } finally { jest.useRealTimers(); }
      expect(JSON.stringify(await db.getMealModel())).toBe(before);
    });

    test("undoing the session's completion rolls the meal model back too", async () => {
      const med = await calibratedMed("MealUndoMed");
      const before = JSON.stringify(await db.getMealModel());
      let sessionId;
      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date(Date.UTC(2026, 6, 12, 8, 0, 0)));
        const s = await db.startEffectSession({ medication_id: med.id, dose: 10, last_meal: "full" });
        sessionId = s.id;
        jest.setSystemTime(new Date(Date.UTC(2026, 6, 12, 9, 0, 0)));
        await db.addEffectEvent(s.id, { kind: "onset" });
        jest.setSystemTime(new Date(Date.UTC(2026, 6, 12, 14, 0, 0)));
        await db.addEffectEvent(s.id, { kind: "gone" });
      } finally { jest.useRealTimers(); }
      expect(JSON.stringify(await db.getMealModel())).not.toBe(before);
      await db.reopenEffectSession(sessionId);
      expect(JSON.stringify(await db.getMealModel())).toBe(before);
    });

    test("the next fed session predicts with the learned factor, not the prior", async () => {
      const med = await calibratedMed("MealNextMed");
      // Teach a strong personal factor with several consistent fed sessions.
      jest.useFakeTimers();
      try {
        for (let i = 0; i < 4; i++) {
          jest.setSystemTime(new Date(Date.UTC(2026, 6, 14 + i, 8, 0, 0)));
          const s = await db.startEffectSession({ medication_id: med.id, dose: 10, last_meal: "full" });
          jest.setSystemTime(new Date(Date.UTC(2026, 6, 14 + i, 9, 30, 0))); // 90 min onset every time
          await db.addEffectEvent(s.id, { kind: "onset" });
          jest.setSystemTime(new Date(Date.UTC(2026, 6, 14 + i, 15, 0, 0)));
          await db.addEffectEvent(s.id, { kind: "gone" });
        }
      } finally { jest.useRealTimers(); }
      const mealModel = await db.getMealModel();
      expect(mealModel.full.samples).toBeGreaterThanOrEqual(4);
      expect(mealModel.full.onset).toBeGreaterThan(1.6); // moved beyond the prior
      const fed = await db.startEffectSession({ medication_id: med.id, dose: 10, last_meal: "full" });
      const fasted = await db.startEffectSession({ medication_id: med.id, dose: 10 });
      expect(fed.profile.onset_min / fasted.profile.onset_min).toBeGreaterThan(1.6);
    });
  });
});
