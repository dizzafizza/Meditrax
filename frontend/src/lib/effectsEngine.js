// Active-effects engine — pure, storage-free. Models the intensity curve of a
// dose over time (onset → coming up → peak → wearing off → after-effects) and
// personalizes the curve per medication from the user's own feedback.
//
// "Learning" here is deliberately simple, transparent and fully on-device: an
// exponentially-weighted moving average of the user's reported onset / peak /
// wear-off times, clamped to sane bounds. No network, no black box — the model
// is a handful of minutes-numbers the UI can show and explain.

// ---- baseline pharmacokinetic profiles (minutes) ----
// Rough population-typical oral values per category; the personal model takes
// over as the user reports real timings. These are UX priors, not medicine.
export const CATEGORY_PK = {
  stimulant: { onset: 40, peak: 120, duration: 420 },
  benzodiazepine: { onset: 25, peak: 75, duration: 360 },
  opioid: { onset: 25, peak: 70, duration: 270 },
  nsaid: { onset: 35, peak: 120, duration: 360 },
  "sleep-aid": { onset: 25, peak: 70, duration: 360 },
  antihistamine: { onset: 40, peak: 130, duration: 420 },
  "muscle-relaxant": { onset: 30, peak: 90, duration: 300 },
  antipsychotic: { onset: 40, peak: 120, duration: 480 },
  anticonvulsant: { onset: 40, peak: 120, duration: 480 },
  antidepressant: { onset: 60, peak: 240, duration: 720 },
  // Recreational / psychoactive baselines — population-typical oral (or, for
  // cannabis, smoked/vaporized) values from harm-reduction literature. Same
  // "UX prior, not medicine" caveat as above: wildly different substances can
  // share a bucket (e.g. LSD vs. psilocybin) and personalization narrows it
  // to the specific substance from the user's own reported timings.
  psychedelic: { onset: 35, peak: 150, duration: 480 }, // LSD, psilocybin, mescaline
  empathogen: { onset: 45, peak: 105, duration: 300 }, // MDMA and analogues
  dissociative: { onset: 10, peak: 30, duration: 90 }, // ketamine
  cannabis: { onset: 8, peak: 25, duration: 180 }, // smoked/vaporized baseline; edibles are much slower (see form)
  depressant: { onset: 20, peak: 60, duration: 240 }, // alcohol, GHB/GBL
  "stimulant-fast": { onset: 5, peak: 20, duration: 60 }, // cocaine
  other: { onset: 30, peak: 90, duration: 360 },
};

// Form modifies absorption speed relative to the category baseline.
//
// Caveat worth knowing before adding a `default_form` to a catalog entry:
// this is a model of absorption *rate*, which is the right description for
// swallowed / smoked / insufflated / injected routes — the drug still rises
// and falls, just faster or slower. It is NOT a good description of a
// controlled-release depot. A transdermal patch holds a deliberately flat
// level for 16-24 h regardless of how short-acting the drug itself is, and no
// single speed multiplier applied to a short-acting profile reproduces that.
// `patch` (and `cream`, to a lesser extent) is therefore a rough stand-in
// rather than a real model, and a substance whose researched profile is
// short-acting should not *default* to one — see the depot-form check in
// catalogSeed.test.js.
export const FORM_SPEED = {
  liquid: 0.7, drops: 0.7, spray: 0.5, inhaler: 0.25, injection: 0.15,
  tablet: 1, capsule: 1.1, patch: 3, cream: 2, other: 1,
  "smoked/vaporized": 0.15, insufflated: 0.35, edible: 2.5,
};

// ---- stomach fullness (oral routes only) ----
// Gastric emptying is the rate-limiting step for a swallowed immediate-release
// dose, and it's hugely state-dependent: fasted emptying half-time is roughly
// 15-30 min, versus 1.5-3+ hours after a full solid meal. Food-effect PK
// studies routinely show Tmax pushed back 30 min-2 h and Cmax cut 20-40% by a
// substantial meal while total exposure (AUC) stays roughly the same -- food
// blunts and spreads the curve rather than shrinking it. Alcohol's peak-BAC
// sensitivity to food is the everyday example.
//
// Same UX-prior-not-medicine framing as everything above. The category
// baselines are population-typical oral values -- an average over real-world
// conditions -- so the middle state ("light") maps to exactly 1.0 and the two
// edges are deviations from typical. Skipping the question (null) also means
// no adjustment, so the feature is invisible unless answered.
//
// The come-up is scaled as a span (peak = onset + comeUp x factor) rather
// than peak getting its own absolute multiplier, mirroring defaultPkProfile's
// derivation -- an independent peak multiplier could invert onset/peak
// ordering for a learned profile whose onset sits just under its peak.
const NON_ORAL_FORMS = new Set(["smoked/vaporized", "insufflated", "injection", "inhaler", "spray", "patch", "cream"]);
// Unknown/absent form counts as oral: the category baselines are oral values.
export const isOralForm = (form) => !NON_ORAL_FORMS.has(form);
export const MEAL_STATES = ["empty", "light", "full"];
const MEAL_IDENTITY = { onset: 1, comeUp: 1, intensity: 1, duration: 1 };
const MEAL_FACTORS = {
  empty: { onset: 0.75, comeUp: 0.9, intensity: 1.05, duration: 1 },
  light: MEAL_IDENTITY,
  full: { onset: 1.6, comeUp: 1.25, intensity: 0.85, duration: 1.1 },
};

// The population table above is only the starting point: the same meal
// shifts different people's absorption by very different amounts (gastric
// emptying rate varies several-fold between individuals), so the factors
// calibrate to the person the same way the timing model calibrates to them.
// Every completed session that carried a meal answer yields one *observed*
// factor sample -- how much later/earlier the person actually felt onset,
// come-up and wear-off than their own no-meal baseline predicted -- and an
// EWMA walks each factor from the population prior toward those samples.
//
// Two deliberate asymmetries versus the timing model's learner:
//   - Seeded at the prior with a first step of one half (alpha = 1/(n+2))
//     rather than adopting the first observation outright: a factor is a
//     *ratio* of two noisy quantities, so single samples are far noisier
//     than a raw timing tap.
//   - `intensity` is never learned. Timing has a real observation channel
//     (the feedback taps); peak intensity does not -- the strength slider is
//     a 1-10 subjective rating dominated by dose and tolerance -- so the
//     intensity factor stays a population prior instead of pretending to
//     calibrate from a signal that isn't there.
// Bounds keep one wild tap (a forgotten phone, a redose-adjacent guess) from
// writing an absurd personal factor.
export const MEAL_FACTOR_BOUNDS = {
  onset: [0.3, 3.5],
  comeUp: [0.4, 3.0],
  duration: [0.6, 2.0],
};
const LEARNED_MEAL_KEYS = ["onset", "comeUp", "duration"];

// Multipliers for a meal state on a given route. Identity for non-oral routes
// (nothing swallowed passes through the stomach), for an unanswered question,
// and for any unrecognized value. `mealModel` (optional) is the per-person
// learned model -- `{ empty: { onset, comeUp, duration, samples }, full: {...} }`
// -- whose learned timing factors take precedence over the priors once they
// have at least one sample.
export function mealFactorsFor(lastMeal, form, mealModel = null) {
  if (!isOralForm(form)) return MEAL_IDENTITY;
  const prior = MEAL_FACTORS[lastMeal] || MEAL_IDENTITY;
  const learned = mealModel?.[lastMeal];
  if (!learned || !(learned.samples > 0)) return prior;
  const out = { ...prior };
  for (const k of LEARNED_MEAL_KEYS) {
    const v = Number(learned[k]);
    if (isFinite(v) && v > 0) out[k] = clamp(v, MEAL_FACTOR_BOUNDS[k][0], MEAL_FACTOR_BOUNDS[k][1]);
  }
  return out;
}

// One observed factor sample from a completed session: what the person's
// actual reported timings imply this meal state did to them, relative to
// their own no-meal baseline. `obs` is observationsFromSession's output,
// `profile` the session's (meal-adjusted) snapshot, `applied` the factors
// that were baked into that snapshot at start. Undoing the applied factor
// recovers the baseline expectation, so observed/expected is the person's
// real factor for this session. Peak uses the profile's own onset:come-up
// proportions rather than decomposing against a possibly-absent onset tap.
export function observedMealFactors(obs = {}, profile = {}, applied = MEAL_IDENTITY) {
  const out = {};
  const on = Number(profile.onset_min), pk = Number(profile.peak_min), dur = Number(profile.duration_min);
  if (obs.onset_min != null && isFinite(on) && on > 0 && applied.onset > 0) {
    const expectedBase = on / applied.onset;
    out.onset = clamp(obs.onset_min / expectedBase, MEAL_FACTOR_BOUNDS.onset[0], MEAL_FACTOR_BOUNDS.onset[1]);
  }
  if (obs.peak_min != null && isFinite(on) && isFinite(pk) && pk > on && applied.comeUp > 0) {
    // Come-up sample: observed span from onset to peak against the baseline
    // span the snapshot encoded ((pk - on) is the *meal-shifted* come-up, so
    // dividing by the applied factor recovers the baseline one). Uses the
    // real onset tap when there was one, the snapshot's onset otherwise.
    const observedComeUp = obs.peak_min - (obs.onset_min != null ? obs.onset_min : on);
    const baseComeUp = (pk - on) / applied.comeUp;
    if (observedComeUp > 0 && baseComeUp > 0) {
      out.comeUp = clamp(observedComeUp / baseComeUp, MEAL_FACTOR_BOUNDS.comeUp[0], MEAL_FACTOR_BOUNDS.comeUp[1]);
    }
  }
  if (obs.end_min != null && isFinite(dur) && dur > 0 && applied.duration > 0) {
    const expectedBase = dur / applied.duration;
    out.duration = clamp(obs.end_min / expectedBase, MEAL_FACTOR_BOUNDS.duration[0], MEAL_FACTOR_BOUNDS.duration[1]);
  }
  return out;
}

// EWMA update of the per-person meal model from one session's observed
// factors. Seeded at the population prior; alpha = 1/min(n+2, 6) so the
// first sample moves halfway and the model keeps adapting forever after.
export function updateMealModel(mealModel, state, observed = {}) {
  if (!MEAL_STATES.includes(state) || state === "light") return mealModel || {};
  const model = { ...(mealModel || {}) };
  const prior = MEAL_FACTORS[state];
  const entry = { ...(model[state] || {}) };
  const n = entry.samples || 0;
  const alpha = 1 / Math.min(n + 2, 6);
  let any = false;
  for (const k of LEARNED_MEAL_KEYS) {
    const v = Number(observed[k]);
    if (!isFinite(v) || v <= 0) continue;
    const sample = clamp(v, MEAL_FACTOR_BOUNDS[k][0], MEAL_FACTOR_BOUNDS[k][1]);
    const cur = isFinite(Number(entry[k])) && entry[k] > 0 ? entry[k] : prior[k];
    entry[k] = Math.round((cur + (sample - cur) * alpha) * 1000) / 1000;
    any = true;
  }
  if (!any) return mealModel || {};
  entry.samples = n + 1;
  entry.updated_at = new Date().toISOString();
  model[state] = entry;
  return model;
}

// ---- per-substance profiles ----
// A category is a coarse bucket, and for a meaningful number of real
// substances it is simply wrong -- buprenorphine's effects outlast a generic
// oral opioid's by roughly 5x, psilocybin's fall short of a generic
// psychedelic's by nearly half, nicotine's are over in under an hour where
// its "other" bucket says six. Where a substance has well-characterized
// timings of its own, they're recorded here and take precedence over
// CATEGORY_PK; the categories stay as the prior for substances we have no
// specific data on (a user-added custom drug, say).
//
// Keyed by lowercased name/generic_name, so an existing medication picks its
// profile up automatically with no migration or catalog re-seed.
//
// `form` names the route these numbers actually describe. That matters:
// FORM_SPEED is applied *relative* to it, so a profile already measured for
// smoked material isn't sped up a second time when the medication is (also)
// marked smoked. Same UX-prior-not-medicine caveat as CATEGORY_PK -- these
// are population-typical values to make a first curve plausible, and the
// personal model takes over from the user's own reported timings.
export const SUBSTANCE_PK = {
  // Opioids / opioid-like
  // Kratom's alkaloids absorb far faster than a typical oral opioid, and its
  // effects are famously dose-dependent (stimulant-leaning low, sedative and
  // opioid-like high). The curve models the timing, which is similar across
  // that range; the *character* change with dose isn't something a single
  // intensity curve can express, so it's documented rather than faked.
  // Effect keeps climbing well past a typical dose as the opioid-like side
  // takes over from the stimulant-like one, so it has more headroom than a
  // conventional oral opioid rather than less.
  kratom: { onset: 8, peak: 75, duration: 330, form: "other", doseResponse: { hill: 1.4, typicalFraction: 0.45 } },
  // Very slow mu-receptor dissociation -- effects long outlast plasma levels,
  // and the generic 4.5 h opioid bucket was badly wrong here. As a partial
  // agonist it also has a genuine ceiling: past a moderate dose the curve
  // flattens and more buys essentially nothing, which is precisely why it's
  // used for maintenance. Modeled as sitting high on its own curve already.
  buprenorphine: { onset: 30, peak: 120, duration: 1440, form: "tablet", doseResponse: { hill: 1, typicalFraction: 0.88 } },
  tramadol: { onset: 60, peak: 150, duration: 360, form: "tablet" }, // prodrug; slower than most oral opioids
  oxycodone: { onset: 15, peak: 60, duration: 270, form: "tablet" }, // immediate-release
  codeine: { onset: 40, peak: 75, duration: 300, form: "tablet" },

  // Psychedelics -- LSD runs roughly twice as long as psilocybin, so one
  // bucket can't serve both.
  lsd: { onset: 45, peak: 150, duration: 540, form: "other" },
  "psilocybin mushrooms": { onset: 30, peak: 105, duration: 300, form: "other" },

  // Stimulants -- the spread here is enormous (nicotine minutes,
  // lisdexamfetamine most of a day), so nearly all get their own numbers.
  caffeine: { onset: 20, peak: 45, duration: 240, form: "tablet" },
  modafinil: { onset: 45, peak: 180, duration: 660, form: "tablet" },
  methamphetamine: { onset: 20, peak: 120, duration: 600, form: "tablet" },
  lisdexamfetamine: { onset: 90, peak: 210, duration: 780, form: "capsule" }, // prodrug: slow, deliberately blunted onset
  "amphetamine/dextroamphetamine": { onset: 40, peak: 150, duration: 300, form: "tablet" },
  methylphenidate: { onset: 25, peak: 90, duration: 240, form: "tablet" }, // immediate-release
  // Effects are over in well under an hour even though plasma nicotine takes
  // hours to clear -- the "other" category's 6 h was one of the worst misses.
  nicotine: { onset: 2, peak: 8, duration: 45, form: "smoked/vaporized" },

  // Sedatives / depressants
  clonazepam: { onset: 40, peak: 150, duration: 720, form: "tablet" }, // much longer-acting than the benzo bucket
  lorazepam: { onset: 30, peak: 120, duration: 480, form: "tablet" },
  zolpidem: { onset: 20, peak: 75, duration: 420, form: "tablet" },
  cyclobenzaprine: { onset: 60, peak: 240, duration: 900, form: "tablet" }, // ~18 h half-life; the 5 h bucket was far short
  "ghb / gbl": { onset: 15, peak: 45, duration: 150, form: "liquid" },
  // Alcohol is deliberately left on the category default: it follows
  // zero-order kinetics (a roughly fixed amount cleared per hour regardless
  // of how much was drunk), so its duration scales with amount far more
  // steeply than personalizedProfile's sub-linear dose scaling models. The
  // category value is a reasonable few-drinks prior; anything more precise
  // would overstate what this curve can represent.

  // Dissociatives / cannabis -- both already route-specific, which is
  // exactly why they need an explicit reference form (see above).
  ketamine: { onset: 7, peak: 25, duration: 60, form: "insufflated" },
  "cannabis (thc)": { onset: 8, peak: 25, duration: 180, form: "smoked/vaporized" },
};

// Alternate names that should resolve to a SUBSTANCE_PK entry above.
const SUBSTANCE_ALIASES = {
  suboxone: "buprenorphine", subutex: "buprenorphine", "buprenorphine/naloxone": "buprenorphine",
  psilocybin: "psilocybin mushrooms", shrooms: "psilocybin mushrooms", mushrooms: "psilocybin mushrooms",
  acid: "lsd", "lysergic acid diethylamide": "lsd",
  thc: "cannabis (thc)", cannabis: "cannabis (thc)", marijuana: "cannabis (thc)", weed: "cannabis (thc)",
  ghb: "ghb / gbl", gbl: "ghb / gbl",
  adderall: "amphetamine/dextroamphetamine", vyvanse: "lisdexamfetamine",
  ritalin: "methylphenidate", concerta: "methylphenidate",
  ambien: "zolpidem", klonopin: "clonazepam", ativan: "lorazepam",
  flexeril: "cyclobenzaprine", provigil: "modafinil",
};

// ---- dose-response ----
// Real dose-response is saturating, not linear: receptors are finite, so
// each additional unit buys less than the one before it. The standard
// description is the Hill/Emax equation, E = Emax·D^h / (ED50^h + D^h).
//
//   hill            slope of the curve. ~1 is classic hyperbolic; higher is
//                   steeper/more threshold-like (psychedelics and
//                   dissociatives are famously steep -- the gap between "a
//                   bit more" and "far too much" is narrow).
//   typicalFraction where a *typical* dose already sits on that curve, as a
//                   fraction of maximal effect. This is what sets the
//                   headroom: a drug typically taken near its plateau
//                   (an NSAID, buprenorphine) has almost nothing left to
//                   gain from more, while one typically taken well below
//                   plateau still climbs meaningfully.
export const DOSE_RESPONSE = {
  // Recreational / acute -- typically taken below plateau, so real headroom.
  opioid: { hill: 1.3, typicalFraction: 0.5 },
  "stimulant-fast": { hill: 1.5, typicalFraction: 0.5 },
  stimulant: { hill: 1.4, typicalFraction: 0.5 },
  psychedelic: { hill: 1.6, typicalFraction: 0.45 },
  empathogen: { hill: 1.5, typicalFraction: 0.55 },
  dissociative: { hill: 1.8, typicalFraction: 0.45 },
  depressant: { hill: 1.5, typicalFraction: 0.5 },
  cannabis: { hill: 1.2, typicalFraction: 0.55 },
  benzodiazepine: { hill: 1.2, typicalFraction: 0.6 },
  // Therapeutic -- usually dosed at or near the plateau on purpose, so more
  // mostly buys side effects rather than effect. NSAIDs in particular have a
  // well-known analgesic ceiling.
  nsaid: { hill: 1.0, typicalFraction: 0.8 },
  antihistamine: { hill: 1.0, typicalFraction: 0.75 },
  "sleep-aid": { hill: 1.2, typicalFraction: 0.7 },
  "muscle-relaxant": { hill: 1.0, typicalFraction: 0.7 },
  antidepressant: { hill: 1.0, typicalFraction: 0.85 },
  antipsychotic: { hill: 1.0, typicalFraction: 0.8 },
  anticonvulsant: { hill: 1.0, typicalFraction: 0.8 },
  other: { hill: 1.2, typicalFraction: 0.6 },
};
const DOSE_RESPONSE_DEFAULT = { hill: 1.2, typicalFraction: 0.6 };

export function doseResponseFor(med = {}) {
  const substance = substancePkFor(med);
  if (substance?.doseResponse) return substance.doseResponse;
  return DOSE_RESPONSE[med.category] || DOSE_RESPONSE_DEFAULT;
}

// Effect at `ratio` times a typical dose, relative to that typical dose
// (so doseResponse(1) === 1 exactly, whatever the parameters).
//
// Deriving it: with a typical dose sitting at fraction f of Emax, that dose
// is a = f/(1-f) in units of ED50^hill. Substituting into the Hill equation
// and normalizing by the typical dose's own effect gives the form below.
// It saturates at 1 + 1/a as the dose grows without bound -- so the ceiling
// falls out of the pharmacology rather than being an arbitrary clamp.
export function doseResponse(ratio, { hill = 1.2, typicalFraction = 0.6 } = {}) {
  if (!(ratio > 0)) return 0;
  const a = typicalFraction / (1 - typicalFraction);
  const x = Math.pow(ratio, hill);
  return (x * (a + 1)) / (x * a + 1);
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round1 = (x) => Math.round(x * 10) / 10;
const round2 = (x) => Math.round(x * 100) / 100;
const normalizeName = (s) => String(s ?? "").trim().toLowerCase();

// The substance-specific profile for a medication, or null to fall back to
// its category. Matches generic_name first (the more canonical of the two),
// then the display name, then a small alias list of brand/street names.
export function substancePkFor(med = {}) {
  const keys = [normalizeName(med.generic_name), normalizeName(med.name)].filter(Boolean);
  for (const k of keys) if (SUBSTANCE_PK[k]) return SUBSTANCE_PK[k];
  for (const k of keys) if (SUBSTANCE_ALIASES[k]) return SUBSTANCE_PK[SUBSTANCE_ALIASES[k]];
  return null;
}

export function defaultPkProfile(med = {}) {
  const substance = substancePkFor(med);
  const base = substance || CATEGORY_PK[med.category] || CATEGORY_PK.other;
  // For a substance profile, only the difference between the route it was
  // measured for and the route actually being used should apply -- otherwise
  // e.g. smoked-referenced numbers get sped up again by the smoked form
  // multiplier. With no substance match this reduces to the plain category
  // behavior (refSpeed 1).
  const refSpeed = substance ? (FORM_SPEED[substance.form] ?? 1) : 1;
  const speed = (FORM_SPEED[med.form] ?? refSpeed) / refSpeed;
  const onset = clamp(Math.round(base.onset * speed), 2, 360);
  // Peak is derived as onset plus a scaled come-up, rather than scaled from
  // zero independently. Scaling both from zero let onset (linear in speed)
  // outrun peak (sqrt) once a route change was large enough -- a swallowed
  // profile compared against a smoked one, say -- and the ordering clamp
  // below would then silently crush the come-up to its 5-minute floor,
  // yielding a curve that spikes the instant it starts. Shifting the whole
  // curve back by the absorption delay keeps its shape intact and keeps
  // onset < peak true by construction for any ratio.
  const comeUp = Math.max(0, base.peak - base.onset);
  const peak = clamp(Math.round(onset + comeUp * Math.sqrt(speed)), onset + 5, 720);
  // Only slower routes stretch the tail: a faster route front-loads the
  // curve, but elimination still takes as long as it takes.
  const duration = clamp(Math.round(base.duration * (speed > 1 ? Math.sqrt(speed) : 1)), peak + 15, 2880);
  return { onset_min: onset, peak_min: peak, duration_min: duration };
}

// ---- personal model ----
// model: { medication_id, onset_min, peak_min, duration_min, ref_dose, samples }
// Missing fields fall back to the medication's default profile.
export function modelConfidence(model) {
  const n = model?.samples || 0;
  if (n >= 6) return "high";
  if (n >= 3) return "medium";
  if (n >= 1) return "low";
  return "none";
}

// The profile to use for a session: learned values where available, defaults
// otherwise, with mild dose scaling against the model's reference dose
// (higher dose ≈ somewhat longer and stronger, sub-linearly), and an optional
// tolerance dampening (see toleranceEngine.js) from recent real-world use of
// this same medication -- a session snapshot with `tolerance.applicable`
// simply omits `tolerance` here entirely, leaving intensity untouched.
// `lastMeal` ("empty" | "light" | "full" | null) shifts timing and peak for
// oral routes per MEAL_FACTORS above -- personalized by `mealModel` (the
// learned per-person factors) where that has samples; null means unanswered
// and changes nothing.
export function personalizedProfile(med, model = null, dose = null, tolerance = null, { lastMeal = null, mealModel = null } = {}) {
  const d = defaultPkProfile(med);
  let onset = model?.onset_min ?? d.onset_min;
  let peak = model?.peak_min ?? d.peak_min;
  let duration = model?.duration_min ?? d.duration_min;
  let intensityScale = 1;
  const ref = Number(model?.ref_dose);
  const dv = Number(dose);
  if (isFinite(ref) && ref > 0 && isFinite(dv) && dv > 0) {
    // A wide guard rail only, not the shape of the response -- the Hill
    // curve below saturates on its own, so this exists purely to keep a
    // typo'd dose from producing an absurd curve.
    const ratio = clamp(dv / ref, 0.1, 10);
    duration = duration * clamp(Math.pow(ratio, 0.3), 0.75, 1.5);
    intensityScale = doseResponse(ratio, doseResponseFor(med));
  }
  // Tolerance is applied *relative to this person's own recent baseline*,
  // not against a drug-naive one. Scaling by absolute tolerance meant a
  // long-term user's curve topped out around 40% of a full-height axis and
  // the chip read "Peak · 40% intensity" at the very moment the dose was
  // peaking -- while the log sheet, which compares against their usual, called
  // the same dose 100%. Two different baselines for the same dose. Now a
  // usual dose peaks at 100% for everyone, and the axis is spent on what
  // actually varies: a larger dose, or tolerance that has faded since the
  // doses this one is being compared against (where the curve rises above
  // 100%, matching the warning that it will land harder). Absolute tolerance
  // is still reported in full by the meter beside the chart.
  if (tolerance?.applicable) {
    const baselineLevel = tolerance.faded ? (tolerance.recentPeakLevel ?? tolerance.level) : tolerance.level;
    const current = 1 - tolerance.level * tolerance.maxDampening;
    const usual = 1 - baselineLevel * tolerance.maxDampening;
    if (usual > 0) intensityScale *= current / usual;
  }
  // Stomach fullness. Applied after the tolerance-relative block because it
  // is a per-dose condition, not part of the usual baseline the tolerance
  // math normalizes against -- this dose was taken on this stomach, whatever
  // the person's usual is.
  const meal = mealFactorsFor(lastMeal, med.form, mealModel);
  if (meal !== MEAL_IDENTITY) {
    const comeUp = Math.max(0, peak - onset);
    onset *= meal.onset;
    peak = onset + comeUp * meal.comeUp;
    duration *= meal.duration;
    intensityScale *= meal.intensity;
  }
  peak = Math.max(peak, onset + 5);
  duration = Math.max(duration, peak + 15);
  return {
    onset_min: Math.round(onset), peak_min: Math.round(peak), duration_min: Math.round(duration),
    intensity_scale: round1(intensityScale),
    // Carried onto the session snapshot for the Emax redose scaling in
    // sessionDoseStack -- a redose's relative strength follows the same
    // saturating dose-response as everything else.
    hill: doseResponseFor(med).hill,
    typicalFraction: doseResponseFor(med).typicalFraction,
    learned: !!model && (model.samples || 0) > 0,
    samples: model?.samples || 0,
    confidence: modelConfidence(model),
    ...(tolerance?.applicable ? { tolerance: { level: tolerance.level, faded: tolerance.faded, daysSinceLast: tolerance.daysSinceLast, recentPeakLevel: tolerance.recentPeakLevel, maxDampening: tolerance.maxDampening } } : {}),
  };
}

// A 1-10 starting point for the user's own effectiveness rating (QuickLogSheet),
// derived purely from this dose's modeled intensity_scale -- i.e. from the
// same dose-ratio and tolerance adjustments the curve itself uses, nothing
// else. 7 (the app's long-standing fixed default) maps back exactly when
// intensity_scale is untouched (1), so a medication with no model/tolerance
// history behaves exactly as before. This is a *suggested* value, not a
// replacement for the user's own report -- see QuickLogSheet.jsx.
export function modeledEffectiveness(intensityScale) {
  return clamp(Math.round(7 * (isFinite(intensityScale) ? intensityScale : 1)), 1, 10);
}

// ---- curve & phases ----
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); }; // smoothstep

// Restored pre-PK/PD spline, per user feedback that it tracked their real
// experience better than the one-compartment Bateman + Emax model that briefly
// replaced it: rise to the reported peak, hold a full-intensity plateau for
// the first ~third of the post-peak span, ease down to the reported end, then
// a small fixed after-effects tail. The three learned parameters mean exactly
// what the tracker's buttons ask for -- felt it (onset), peaking (peak),
// gone (duration).

// Relative intensity 0..100 at t minutes after the dose.
export function intensityAt(tMin, profile) {
  const { onset_min: on, peak_min: pk, duration_min: dur } = profile;
  const plateauEnd = pk + (dur - pk) * 0.35;
  if (tMin <= 0) return 0;
  if (tMin < on) return round1(12 * smooth(tMin / on)); // pre-onset trickle
  if (tMin < pk) return round1(12 + 88 * smooth((tMin - on) / (pk - on)));
  if (tMin < plateauEnd) return 100;
  if (tMin < dur) return round1(100 * (1 - smooth((tMin - plateauEnd) / (dur - plateauEnd))));
  // after-effects tail fades over 25% of the duration
  const tail = dur * 0.25;
  if (tMin < dur + tail) return round1(8 * (1 - smooth((tMin - dur) / tail)));
  return 0;
}

export const PHASES = [
  { key: "waiting", label: "Not yet felt" },
  { key: "onset", label: "Coming up" },
  { key: "peak", label: "Peak" },
  { key: "offset", label: "Wearing off" },
  { key: "after", label: "After-effects" },
  { key: "complete", label: "Complete" },
];

export function phaseAt(tMin, profile) {
  const { onset_min: on, peak_min: pk, duration_min: dur } = profile;
  const plateauEnd = pk + (dur - pk) * 0.35;
  if (tMin < on) return PHASES[0];
  if (tMin < pk * 0.9) return PHASES[1];
  if (tMin < plateauEnd) return PHASES[2];
  if (tMin < dur) return PHASES[3];
  if (tMin < dur * 1.25) return PHASES[4];
  return PHASES[5];
}

// Series for the detail chart: [{ t, intensity }] over the curve incl. tail.
export function curveSeries(profile, points = 72) {
  const end = profile.duration_min * 1.25;
  const out = [];
  for (let i = 0; i <= points; i++) {
    const t = (end * i) / points;
    out.push({ t: Math.round(t), intensity: intensityAt(t, profile) });
  }
  return out;
}

// ---- redosing (stacked doses within one session) ----
// A session's effect is the sum of its primary dose plus any redoses, each a
// copy of the same curve shifted to when it was taken and scaled by its
// amount relative to the primary dose. Returns the doses normalized to
// [{ tOffset (min from session start), scale }]; the primary dose is always
// first with tOffset 0.
//
// Doses this close together are one dose, not a hand-off. The collapse model
// below (doseWeightAt) exists for a redose taken meaningfully later -- the
// new peak takes over from the old one's tail. A redose logged at (or within
// minutes of) an earlier dose is the same swallowing event split into two
// entries, and treating it as a successor was a real, visible bug: the tiny
// "newer" dose faded the huge primary out across the primary's own come-up,
// so an 8000 mg session with a 1000 mg same-time redose collapsed to the
// redose's ~15% curve at the very moment it should have been peaking.
// Near-simultaneous doses therefore merge into one entry whose amount is the
// sum, scaled through the same saturating dose-response -- exactly what one
// combined swallow of that total would get.
export const REDOSE_MERGE_WINDOW_MIN = 5;

// Total amount actually taken across the whole session -- primary plus every
// redose with a recorded amount. This is what the UI's headline dose should
// show once a session holds more than one dose (a session that opened at
// 8000 mg and gained a 1000 mg redose IS a 9000 mg session), and it's
// intentionally computed from session.redoses rather than the dose stack:
// the stack merges near-simultaneous doses for curve purposes, but the
// amount swallowed doesn't merge away. Null when no amount was recorded at
// all; doses without amounts contribute nothing rather than guessing.
export function sessionTotalDose(session) {
  const amounts = [Number(session?.dose), ...(session?.redoses || []).map((r) => Number(r.amount))].filter((a) => isFinite(a) && a > 0);
  if (!amounts.length) return null;
  return Math.round(amounts.reduce((s, a) => s + a, 0) * 100) / 100;
}

export function sessionDoseStack(session) {
  const start = new Date(session.started_at).getTime();
  const baseScale = session.profile?.intensity_scale || 1;
  const primaryAmt = Number(session.dose);
  // A redose's strength relative to the primary follows the same saturating
  // dose-response as everything else. It used to scale linearly and without
  // bound, so a redose of four times the primary was modeled as four times
  // the effect -- the same fault fixed in personalizedProfile.
  const dr = { hill: session.profile?.hill ?? 1.2, typicalFraction: session.profile?.typicalFraction ?? 0.6 };
  // With no recorded primary amount there is nothing to relate amounts to,
  // so every dose counts as one reference dose (a merged same-time pair then
  // reads as a genuine double dose rather than being ignored).
  const ref = isFinite(primaryAmt) && primaryAmt > 0 ? primaryAmt : 1;
  const hasAmounts = isFinite(primaryAmt) && primaryAmt > 0;

  const events = [{ tOffset: 0, amount: ref }];
  for (const r of session.redoses || []) {
    const tOffset = Math.max(0, (new Date(r.at).getTime() - start) / 60000);
    const ra = Number(r.amount);
    events.push({ tOffset, amount: hasAmounts && isFinite(ra) && ra > 0 ? ra : ref, id: r.id });
  }

  const stack = [];
  for (const e of events) {
    const last = stack[stack.length - 1];
    if (last && e.tOffset - last.tOffset <= REDOSE_MERGE_WINDOW_MIN) {
      last.amount += e.amount;
      if (e.id && !last.id) last.id = e.id;
    } else {
      stack.push({ ...e });
    }
  }
  for (const s of stack) {
    s.scale = baseScale * doseResponse(Math.min(10, Math.max(0.1, s.amount / ref)), dr);
    delete s.amount;
  }
  return stack;
}

// How much an earlier dose still contributes at minute t, given the next
// dose in the stack. The hand-off runs across the newer dose's come-up: the
// older dose holds full weight until the newer one starts being felt (its
// onset), then fades out so that it has *fully* collapsed by the moment the
// newer dose peaks. That matches how a redose is actually experienced — the
// new peak takes over rather than piling on top of the old one — and keeps
// the curve from spiking to an implausible literal sum of every dose taken.
// Returns 1 for the newest dose (nothing supersedes it).
export function doseWeightAt(tMin, profile, stack, i) {
  const next = stack[i + 1];
  if (!next) return 1;
  const fadeFrom = next.tOffset + profile.onset_min;
  const fadeTo = next.tOffset + profile.peak_min;
  if (tMin <= fadeFrom) return 1;
  if (tMin >= fadeTo) return 0;
  return 1 - smooth((tMin - fadeFrom) / (fadeTo - fadeFrom));
}

// Summed intensity at minute t (from session start) across the dose stack,
// with superseded doses collapsing as above. Pass { collapse: false } for the
// raw arithmetic sum (what the UI's "show previous dose" toggle reveals).
// A dose whose tOffset is still in the future contributes 0 (intensityAt of a
// negative time), so this is correct for any t, past or present.
export function stackedIntensityAt(tMin, profile, stack, { collapse = true } = {}) {
  let sum = 0;
  for (let i = 0; i < stack.length; i++) {
    const d = stack[i];
    const w = collapse ? doseWeightAt(tMin, profile, stack, i) : 1;
    if (w <= 0) continue;
    sum += intensityAt(tMin - d.tOffset, profile) * (d.scale ?? 1) * w;
  }
  return round1(sum);
}

// One dose's own curve on the session timeline, ignoring the hand-off — used
// to plot a superseded dose again when the user asks to see it.
export function doseIntensityAt(tMin, profile, stack, i) {
  const d = stack[i];
  if (!d) return 0;
  return round1(intensityAt(tMin - d.tOffset, profile) * (d.scale ?? 1));
}

// Where the plotted curve should end: after the last dose's own tail.
export function stackChartEnd(profile, stack) {
  const lastOffset = stack.length ? stack[stack.length - 1].tOffset : 0;
  return lastOffset + profile.duration_min * 1.25;
}

// Stacked series for the chart, sampled evenly across the (possibly extended)
// timeline. Peaks can exceed 100% when doses overlap.
export function stackedCurveSeries(profile, stack, points = 96, opts) {
  const end = stackChartEnd(profile, stack);
  const out = [];
  for (let i = 0; i <= points; i++) {
    const t = (end * i) / points;
    out.push({ t: Math.round(t), intensity: stackedIntensityAt(t, profile, stack, opts) });
  }
  return out;
}

// ---- learning ----
// Extract observed minutes-from-start out of a session's feedback events.
export function observationsFromSession(session) {
  const start = new Date(session.started_at).getTime();
  const minsAt = (iso) => Math.max(1, Math.round((new Date(iso).getTime() - start) / 60000));
  const first = (kind) => session.events?.find((e) => e.kind === kind);
  const obs = {};
  const onset = first("onset");
  if (onset) obs.onset_min = minsAt(onset.t);
  const peak = first("peak");
  if (peak) obs.peak_min = minsAt(peak.t);
  const gone = first("gone");
  if (gone) obs.end_min = minsAt(gone.t);
  return obs;
}

// Undo a session's meal shift from its observed timings, so the base timing
// model trains on baseline-equivalent numbers. Without this, every session
// answered "full meal" would teach the model that this drug is just slow --
// the meal's delay would leak into the meal-agnostic baseline and then be
// applied *again* on top of itself next time. Identity `applied` (no meal
// answer, non-oral route, old sessions) passes observations through
// untouched. The onset split for a missing onset tap mirrors
// observedMealFactors: the snapshot's own onset stands in.
export function baselineObservations(obs = {}, profile = {}, applied = MEAL_IDENTITY) {
  if (applied === MEAL_IDENTITY || (applied.onset === 1 && applied.comeUp === 1 && applied.duration === 1)) return obs;
  const out = { ...obs };
  const on = Number(profile.onset_min);
  if (obs.onset_min != null && applied.onset > 0) out.onset_min = obs.onset_min / applied.onset;
  if (obs.peak_min != null && applied.onset > 0 && applied.comeUp > 0) {
    const onsetObs = obs.onset_min != null ? obs.onset_min : (isFinite(on) ? on : null);
    if (onsetObs != null && obs.peak_min > onsetObs) {
      out.peak_min = onsetObs / applied.onset + (obs.peak_min - onsetObs) / applied.comeUp;
    } else {
      out.peak_min = obs.peak_min / applied.comeUp;
    }
  }
  if (obs.end_min != null && applied.duration > 0) out.end_min = obs.end_min / applied.duration;
  return out;
}

// EWMA update of the per-med model from one completed session. alpha shrinks
// as samples accumulate but stays ≥ 1/6 so the model keeps adapting.
export function updateModel(model, obs, dose, med = {}) {
  const m = { ...(model || {}) };
  const n = m.samples || 0;
  const alpha = 1 / Math.min(n + 1, 6);
  const learn = (key, value, lo, hi) => {
    if (value == null || !isFinite(value)) return;
    const v = clamp(value, lo, hi);
    m[key] = m[key] == null ? v : m[key] + (v - m[key]) * alpha;
  };
  const d = defaultPkProfile(med);
  learn("onset_min", obs.onset_min, 1, 360);
  learn("peak_min", obs.peak_min, 2, 720);
  learn("duration_min", obs.end_min, 10, 2880);
  const dv = Number(dose);
  if (isFinite(dv) && dv > 0) m.ref_dose = m.ref_dose == null ? dv : m.ref_dose + (dv - m.ref_dose) * alpha;
  // keep ordering sane relative to whatever is known
  if (m.onset_min != null && m.peak_min != null && m.peak_min < m.onset_min + 5) m.peak_min = m.onset_min + 5;
  if (m.peak_min != null && m.duration_min != null && m.duration_min < m.peak_min + 15) m.duration_min = m.peak_min + 15;
  if (m.duration_min != null && m.duration_min < (d.onset_min || 0) * 0.5) m.duration_min = d.onset_min * 0.5;
  const hasSignal = obs.onset_min != null || obs.peak_min != null || obs.end_min != null;
  m.samples = hasSignal ? n + 1 : n;
  m.updated_at = new Date().toISOString();
  return m;
}

// Convenience formatting for UI copy: 95 → "1 h 35 m", 40 → "40 m".
export function fmtMins(mins) {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r} min`;
  return r ? `${h} h ${r} m` : `${h} h`;
}
