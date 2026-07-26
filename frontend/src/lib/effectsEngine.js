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
export const FORM_SPEED = {
  liquid: 0.7, drops: 0.7, spray: 0.5, inhaler: 0.25, injection: 0.15,
  tablet: 1, capsule: 1.1, patch: 3, cream: 2, other: 1,
  "smoked/vaporized": 0.15, insufflated: 0.35, edible: 2.5,
};

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
export function personalizedProfile(med, model = null, dose = null, tolerance = null) {
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
  peak = Math.max(peak, onset + 5);
  duration = Math.max(duration, peak + 15);
  return {
    onset_min: Math.round(onset), peak_min: Math.round(peak), duration_min: Math.round(duration),
    intensity_scale: round1(intensityScale),
    // Carried onto the session snapshot so its curve is shaped by the same
    // receptor-occupancy slope the dose-response uses (see curveModel).
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

// ---- the curve: one-compartment PK, then Emax PD ----
// The shape used to be three splines bolted together, which produced two
// artifacts nothing in real pharmacology has: a dead-flat 100% plateau for a
// third of the post-peak span, and a discontinuous step down into a separate
// "after-effects" block that showed up as a visible notch on every chart.
//
// It's now the textbook structure instead: concentration follows a
// one-compartment model with first-order absorption and elimination (the
// Bateman function, C ∝ e^(-ke·t) - e^(-ka·t)), and effect follows from
// concentration through the same Emax relationship used for dose-response
// above -- because it *is* the same relationship, receptor occupancy against
// available drug. That gives a rounded peak, a genuinely exponential decline,
// and a continuous low tail, all for free.
//
// The three learned parameters are preserved exactly, each pinned to the part
// of the model it actually corresponds to:
//   onset_min     effect crosses the perception threshold (a PD property --
//                 solved for via C50)
//   peak_min      concentration tmax (a PK property -- solved for via ka/ke)
//   duration_min  effect has fallen back to ONSET_FRACTION (PK: elimination)
// so the learner, the phase labels and every caller are untouched.
const ONSET_FRACTION = 0.10; // effect at onset_min, as a fraction of peak
// Effect remaining at duration_min. Not zero: duration_min is where the user
// reported it "gone", and the after-effects window that follows eases the
// remainder out. A one-compartment curve peaking early genuinely cannot fall
// much below this by then -- absorption fast enough to peak at 75 min forces
// a tail -- so aiming lower would just make the fit infeasible for the very
// substances that need it most.
const END_FRACTION = 0.12;
const TAIL_SPAN = 0.25; // after-effects window past duration_min, as a fraction of duration
// The taper starts slightly *before* duration_min rather than at it. A user
// who tapped "Gone" at that moment reported no effect, so the model shouldn't
// still be showing a fifth of peak there -- easing out across the report
// rather than after it keeps the curve agreeing with the feedback that
// produced it, without distorting the fitted peak.
const TAIL_START = 0.82;

const bateman = (t, ka, ke) => Math.exp(-ke * t) - Math.exp(-ka * t);
const emax = (c, c50, h) => (c <= 0 ? 0 : Math.pow(c, h) / (Math.pow(c50, h) + Math.pow(c, h)));

// Bisection on a monotone function — small, dependency-free, and plenty
// precise for curve fitting at minute resolution. Not every profile admits an
// exact fit (a fast-onset, short-duration substance can ask for a decay no
// one-compartment curve peaking that late can deliver), so an unbracketed
// target returns the closest endpoint rather than letting the search run off
// to a nonsense extreme.
function bisect(f, lo, hi, iterations = 40) {
  let a = lo, b = hi;
  const fa = f(a), fb = f(b);
  if (!isFinite(fa) || !isFinite(fb)) return lo;
  if (Math.sign(fa) === Math.sign(fb)) return Math.abs(fa) <= Math.abs(fb) ? lo : hi;
  for (let i = 0; i < iterations; i++) {
    const m = (a + b) / 2;
    if (Math.sign(f(m)) === Math.sign(fa)) a = m; else b = m;
  }
  return (a + b) / 2;
}

const curveCache = new Map();

// Fit ka, ke and C50 to a profile. Memoized: the solve runs once per distinct
// profile, then every sample of that curve is a couple of exponentials.
export function curveModel(profile = {}) {
  const on = Math.max(1, profile.onset_min ?? 30);
  const pk = Math.max(on + 5, profile.peak_min ?? 90);
  const dur = Math.max(pk + 15, profile.duration_min ?? 360);
  const h = Math.max(0.5, profile.hill ?? 1.2);
  const key = `${on}|${pk}|${dur}|${h}|${profile.typicalFraction ?? 0.6}`;
  const cached = curveCache.get(key);
  if (cached) return cached;

  // C50 is not fitted — it follows from where a peak dose sits on the
  // occupancy curve, which is exactly the `typicalFraction` already used for
  // dose-response. Solving 1/(C50^h + 1) = typicalFraction gives it directly.
  const tf = clamp(profile.typicalFraction ?? 0.6, 0.05, 0.95);
  const c50 = Math.pow((1 - tf) / tf, 1 / h);
  const eAtPeak = emax(1, c50, h);

  // Two free parameters for two constraints:
  //   tlag  an absorption lag (real for anything swallowed — gastric
  //         emptying), which is what lets a drug felt within minutes of a
  //         much later peak be represented at all. Without it a Bateman
  //         curve peaking at 75 min is already a quarter of the way up at
  //         8 min, and no PD threshold can pull the onset back.
  //   r     ka/ke, the absorption:elimination ratio, which sets how long the
  //         tail runs.
  // They interact (tlag shifts the peak, which changes the rates), so the two
  // one-dimensional solves are alternated to convergence rather than nested.
  const ratesFor = (r, tlag) => {
    const tmax = Math.max(1, pk - tlag);
    const ke = Math.log(r) / (tmax * (r - 1));
    return { ka: ke * r, ke, tlag };
  };
  const shapeFor = (r, tlag) => {
    const { ka, ke } = ratesFor(r, tlag);
    const cAtPeak = bateman(Math.max(1, pk - tlag), ka, ke);
    if (!(cAtPeak > 1e-12)) return () => 0;
    return (t) => {
      const u = t - tlag;
      if (u <= 0) return 0;
      const c = bateman(u, ka, ke) / cAtPeak; // 0..1, exactly 1 at pk
      return c <= 0 ? 0 : emax(c, c50, h) / eAtPeak;
    };
  };

  let r = 20;
  let tlag = 0;
  for (let i = 0; i < 6; i++) {
    // Longer tail as r grows, so effect-at-duration is increasing in r.
    r = bisect((rr) => shapeFor(rr, tlag)(dur) - END_FRACTION, 1.05, 2000, 44);
    // Later onset as the lag grows. Capped short of onset itself so the curve
    // is never flat-zero at the very moment the user reported feeling it.
    tlag = bisect((tl) => shapeFor(r, tl)(on) - ONSET_FRACTION, 0, on * 0.95, 40);
  }
  const shape = shapeFor(r, tlag);
  const endMin = dur * (1 + TAIL_SPAN);
  const model = { shape, endMin, dur, pk, ...ratesFor(r, tlag), c50, hill: h };
  // Bounded so a long session that edits its dose repeatedly can't grow this
  // without limit; curves are cheap to re-solve if one is evicted.
  if (curveCache.size > 512) curveCache.clear();
  curveCache.set(key, model);
  return model;
}

// Relative intensity 0..100 at t minutes after the dose.
export function intensityAt(tMin, profile) {
  if (!(tMin > 0)) return 0;
  const m = curveModel(profile);
  if (tMin >= m.endMin) return 0;
  let e = m.shape(tMin);
  // Taper the last stretch smoothly to zero. Exponential decline never
  // actually reaches nothing, and a curve that just stops mid-air is the
  // artifact this replaced -- so the after-effects window eases it out.
  // Never before the peak: for a tightly compressed profile (a learned onset
  // sitting just under its peak, say) a fixed fraction of duration can fall
  // on the wrong side of it, and tapering there would flatten the peak the
  // user actually reported.
  const taperFrom = Math.max(m.pk, m.dur * TAIL_START);
  if (tMin > taperFrom) e *= 1 - smooth((tMin - taperFrom) / (m.endMin - taperFrom));
  return round1(clamp(e * 100, 0, 100));
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
export function sessionDoseStack(session) {
  const start = new Date(session.started_at).getTime();
  const baseScale = session.profile?.intensity_scale || 1;
  const primaryAmt = Number(session.dose);
  const stack = [{ tOffset: 0, scale: baseScale }];
  // A redose's strength relative to the primary follows the same saturating
  // dose-response as everything else. It used to scale linearly and without
  // bound, so a redose of four times the primary was modeled as four times
  // the effect -- the same fault fixed in personalizedProfile.
  const dr = { hill: session.profile?.hill ?? 1.2, typicalFraction: session.profile?.typicalFraction ?? 0.6 };
  for (const r of session.redoses || []) {
    const tOffset = Math.max(0, (new Date(r.at).getTime() - start) / 60000);
    let scale = baseScale;
    const ra = Number(r.amount);
    if (isFinite(primaryAmt) && primaryAmt > 0 && isFinite(ra) && ra > 0) {
      scale = baseScale * doseResponse(Math.min(10, Math.max(0.1, ra / primaryAmt)), dr);
    }
    stack.push({ tOffset, scale, id: r.id });
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
