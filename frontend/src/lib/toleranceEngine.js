// Usage-based tolerance modeling for the effects tracker — pure, storage-free
// (same convention as redoseSafety.js/usageStats.js/behavior.js: recompute
// fresh from a medication's own recent dose history every time, no stored
// mutable "tolerance state").
//
// Two real, distinct pharmacological effects are modeled here, and it matters
// that they're kept separate from each other and from `dependency_risk_category`
// (a static, hand-curated *addiction-potential* rating used elsewhere in the
// app for taper/behavior-risk purposes):
//
//   1. Tolerance FORMS with frequent/recent use, blunting the subjective
//      effect of the same dose (receptor downregulation / desensitization —
//      pharmacodynamic tolerance). This is what dampens the modeled curve.
//   2. Tolerance FADES during a gap in use. If someone who'd built real
//      tolerance takes their usual dose again after a notable gap, it can hit
//      much harder than they're used to — this is the mechanism behind a lot
//      of real-world overdoses (classically opioids after a break, but the
//      same principle applies to any of the categories below).
//
// Formation speed and addiction/dependence potential are NOT the same axis:
// psychedelics build near-total tolerance after a single dose (fastest of any
// class here) yet have low physical dependence potential; benzodiazepines
// build tolerance slowly over weeks yet have high dependence potential. So
// this table is keyed by the effects-engine's own pharmacological `category`
// (the same key CATEGORY_PK in effectsEngine.js uses), not by
// `dependency_risk_category`. It intentionally only covers categories where
// "how strongly does this hit" is the relevant, felt axis — chronic-condition
// categories (antidepressant, antipsychotic, anticonvulsant, nsaid, "other",
// etc.) are left out entirely (see DEFAULT below): modeling acute tolerance
// for e.g. an SSRI would misrepresent pharmacology that actually works the
// opposite way (delayed therapeutic onset, discontinuation syndrome), not
// tachyphylaxis. Cross-substance/cross-tolerance (e.g. one opioid raising
// tolerance to another) is also out of scope — each medication's history is
// considered on its own.
//
// formationDays / decayDays are rough time constants (population-typical UX
// priors, not medicine, same caveat as effectsEngine.js's CATEGORY_PK) for
// how many days of daily use it takes to reach ~63% of this category's
// modeled maximum tolerance, and how many days of abstinence undo that same
// fraction. maxDampening caps how much the modeled peak intensity can be
// reduced at full tolerance — tolerance is essentially never total, so this
// never implies "you won't feel it at all."
export const TOLERANCE_PARAMS = {
  psychedelic: { formationDays: 1, decayDays: 6, maxDampening: 0.7 }, // near-total tachyphylaxis after one dose; classic ~3-7 day reset
  empathogen: { formationDays: 3, decayDays: 30, maxDampening: 0.6 }, // MDMA's well-documented fast-diminishing "magic"; harm-reduction guidance typically recommends months (not weeks) between sessions for fuller recovery, so this errs toward the longer/more conservative end rather than implying a quick reset
  "stimulant-fast": { formationDays: 1, decayDays: 3, maxDampening: 0.5 }, // acute within-binge tachyphylaxis (cocaine)
  stimulant: { formationDays: 4, decayDays: 10, maxDampening: 0.45 },
  opioid: { formationDays: 4, decayDays: 10, maxDampening: 0.6 }, // fast-forming and fast-fading -- the classic post-break-overdose mechanism
  benzodiazepine: { formationDays: 10, decayDays: 21, maxDampening: 0.5 }, // slow to form and slow to resolve
  depressant: { formationDays: 7, decayDays: 14, maxDampening: 0.45 }, // alcohol/GHB
  cannabis: { formationDays: 5, decayDays: 10, maxDampening: 0.5 }, // well-documented CB1 downregulation; "T-breaks"
  dissociative: { formationDays: 3, decayDays: 7, maxDampening: 0.4 },
  "sleep-aid": { formationDays: 7, decayDays: 14, maxDampening: 0.4 },
  antihistamine: { formationDays: 10, decayDays: 14, maxDampening: 0.3 },
  "muscle-relaxant": { formationDays: 7, decayDays: 14, maxDampening: 0.35 },
};

const round2 = (x) => Math.round(x * 100) / 100;
const round1 = (x) => Math.round(x * 10) / 10;
const DAY_MS = 86400000;

// A decaying sum of one "impulse" per dose, each contributing
// exp(-daysAgo/decayDays) at time `at`. This is the same mathematical shape
// as multi-dose accumulation toward a pharmacokinetic steady state — here
// applied to a tolerance "load" instead of a plasma concentration. Unbounded
// (frequent-enough dosing can push it arbitrarily high), which is deliberate:
// the saturation into a 0-1 level happens in toleranceLevel below.
function toleranceLoad(doseTimesMs, at, decayDays) {
  let sum = 0;
  const cutoffDays = decayDays * 8; // contributions beyond this are <1% of an impulse; skip for sanity
  for (const t of doseTimesMs) {
    if (t > at) continue;
    const days = (at - t) / DAY_MS;
    if (days > cutoffDays) continue;
    sum += Math.exp(-days / decayDays);
  }
  return sum;
}

// Saturating 0-1 tolerance level at time `at`, given every prior dose
// timestamp (ms) and this category's time constants. A single dose today
// already gives 1-exp(-1/formationDays) -- e.g. ~63% for a formationDays=1
// category (psychedelics), ~22% for formationDays=4 (opioids) -- and repeated
// recent doses push it higher, saturating toward 1.
export function toleranceLevel(doseTimesMs, at, { formationDays, decayDays }) {
  const load = toleranceLoad(doseTimesMs, at, decayDays);
  return 1 - Math.exp(-load / formationDays);
}

// Full tolerance report for one medication at time `now`, from its own
// consuming-dose timestamps (ms since epoch; any order, future doses
// ignored). Returns `{ applicable, level, maxDampening, daysSinceLast, faded,
// recentPeakLevel }`.
//   - `applicable`: false for categories with no modeled tolerance (the
//     curve/intensity is left completely untouched).
//   - `level` (0-1): current modeled tolerance -- multiply into intensity_scale
//     via `1 - level * maxDampening`.
//   - `faded`: true when tolerance was recently meaningful (>=0.35 as of the
//     last dose) but has since decayed by >=0.2 during the gap since then --
//     the "this may hit harder than your last few doses" signal.
export function estimateTolerance(doseTimestamps, category, now = Date.now()) {
  const params = TOLERANCE_PARAMS[category];
  if (!params) return { applicable: false, level: 0, maxDampening: 0, daysSinceLast: null, faded: false, recentPeakLevel: 0 };
  const past = (doseTimestamps || [])
    .map((t) => new Date(t).getTime())
    .filter((t) => isFinite(t) && t <= now)
    .sort((a, b) => a - b);
  const level = toleranceLevel(past, now, params);
  if (!past.length) {
    return { applicable: true, level: 0, maxDampening: params.maxDampening, daysSinceLast: null, faded: false, recentPeakLevel: 0 };
  }
  const lastDose = past[past.length - 1];
  const daysSinceLast = (now - lastDose) / DAY_MS;
  const recentPeakLevel = toleranceLevel(past, lastDose, params); // level as of the last dose itself (its own freshest impulse included)
  const faded = recentPeakLevel >= 0.35 && recentPeakLevel - level >= 0.2;
  return {
    applicable: true,
    level: round2(level),
    maxDampening: params.maxDampening,
    daysSinceLast: round1(daysSinceLast),
    faded,
    recentPeakLevel: round2(recentPeakLevel),
  };
}
