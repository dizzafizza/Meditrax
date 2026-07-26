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
  kratom: { onset: 8, peak: 75, duration: 330, form: "other" },
  // Very slow mu-receptor dissociation -- effects long outlast plasma levels,
  // and the generic 4.5 h opioid bucket was badly wrong here.
  buprenorphine: { onset: 30, peak: 120, duration: 1440, form: "tablet" },
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

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round1 = (x) => Math.round(x * 10) / 10;
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
    const ratio = clamp(dv / ref, 0.25, 4);
    duration = duration * clamp(Math.pow(ratio, 0.3), 0.75, 1.5);
    intensityScale = clamp(ratio, 0.5, 1.5);
  }
  if (tolerance?.applicable) intensityScale *= 1 - tolerance.level * tolerance.maxDampening;
  peak = Math.max(peak, onset + 5);
  duration = Math.max(duration, peak + 15);
  return {
    onset_min: Math.round(onset), peak_min: Math.round(peak), duration_min: Math.round(duration),
    intensity_scale: round1(intensityScale),
    learned: !!model && (model.samples || 0) > 0,
    samples: model?.samples || 0,
    confidence: modelConfidence(model),
    ...(tolerance?.applicable ? { tolerance: { level: tolerance.level, faded: tolerance.faded, daysSinceLast: tolerance.daysSinceLast, recentPeakLevel: tolerance.recentPeakLevel } } : {}),
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
export function sessionDoseStack(session) {
  const start = new Date(session.started_at).getTime();
  const baseScale = session.profile?.intensity_scale || 1;
  const primaryAmt = Number(session.dose);
  const stack = [{ tOffset: 0, scale: baseScale }];
  for (const r of session.redoses || []) {
    const tOffset = Math.max(0, (new Date(r.at).getTime() - start) / 60000);
    let scale = baseScale;
    const ra = Number(r.amount);
    if (isFinite(primaryAmt) && primaryAmt > 0 && isFinite(ra) && ra > 0) scale = baseScale * (ra / primaryAmt);
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
