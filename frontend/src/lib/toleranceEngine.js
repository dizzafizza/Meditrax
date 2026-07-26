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
import { localDateStr } from "./dates";

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

// Same "the category bucket is wrong for this specific substance" escape
// hatch as effectsEngine.js's SUBSTANCE_PK, keyed the same way (lowercased
// name/generic_name). Only for substances whose own tolerance behavior is
// clearly mismatched to their category.
export const SUBSTANCE_TOLERANCE = {
  // Nicotine sits in the "other" category, which models no tolerance at all
  // (correctly, for the chronic-condition medications that bucket otherwise
  // holds) -- yet it's among the most tolerance-forming substances here, with
  // acute tolerance measurable within a single day and overnight abstinence
  // enough to restore a noticeable amount of it.
  nicotine: { formationDays: 2, decayDays: 5, maxDampening: 0.5 },
};

const round2 = (x) => Math.round(x * 100) / 100;
const round1 = (x) => Math.round(x * 10) / 10;
const DAY_MS = 86400000;
const normalizeName = (s) => String(s ?? "").trim().toLowerCase();

// Tolerance constants for a medication: its own substance-specific entry if
// it has one, otherwise its category's. Accepts either a medication object or
// a bare category string.
export function toleranceParamsFor(medOrCategory) {
  if (typeof medOrCategory === "string" || medOrCategory == null) return TOLERANCE_PARAMS[medOrCategory] || null;
  const med = medOrCategory;
  const keys = [normalizeName(med.generic_name), normalizeName(med.name)].filter(Boolean);
  for (const k of keys) if (SUBSTANCE_TOLERANCE[k]) return SUBSTANCE_TOLERANCE[k];
  return TOLERANCE_PARAMS[med.category] || null;
}

// A decaying sum of one "impulse" per dose, each contributing
// exp(-daysAgo/decayDays) at time `at`. This is the same mathematical shape
// as multi-dose accumulation toward a pharmacokinetic steady state — here
// applied to a tolerance "load" instead of a plasma concentration. Unbounded
// (frequent-enough dosing can push it arbitrarily high), which is deliberate:
// the saturation into a 0-1 level happens in toleranceLevel below.
// Doses are aggregated into *days* before this, and each day contributes in
// proportion to how much was taken that day rather than how many times the
// bottle was opened. Counting dose events instead meant someone splitting
// 8 g of kratom across four 2 g doses looked four times as tolerant as
// someone taking it in one go -- backwards, since tolerance follows total
// exposure, not dosing frequency.
function toleranceLoad(days, at, decayDays) {
  let sum = 0;
  const cutoffDays = decayDays * 8; // contributions beyond this are <1% of a day's impulse; skip for sanity
  for (const d of days) {
    if (d.t > at) continue;
    const ago = (at - d.t) / DAY_MS;
    if (ago > cutoffDays) continue;
    sum += d.weight * Math.exp(-ago / decayDays);
  }
  return sum;
}

// Group doses into local calendar days, each weighted by that day's total
// amount relative to a typical day. Median rather than mean for the same
// reason the dose-response reference uses one: a recent escalation shouldn't
// quietly redefine what "typical" means and hide itself.
//
// Accepts either bare timestamps (no amounts recorded, so every day counts
// as one typical day) or {t, amount} entries.
export function dailyExposure(doses = [], now = Date.now()) {
  const byDay = new Map();
  let anyAmount = false;
  for (const entry of doses) {
    const raw = entry && typeof entry === "object" && !(entry instanceof Date) ? entry : { t: entry };
    const t = new Date(raw.t).getTime();
    if (!isFinite(t) || t > now) continue;
    const amount = Number(raw.amount);
    const hasAmount = isFinite(amount) && amount > 0;
    if (hasAmount) anyAmount = true;
    const key = localDateStr(new Date(t));
    const day = byDay.get(key) || { t, total: 0, count: 0 };
    day.t = Math.max(day.t, t); // most recent dose that day anchors its decay
    day.total += hasAmount ? amount : 0;
    day.count += 1;
    byDay.set(key, day);
  }
  const rows = [...byDay.values()].sort((a, b) => a.t - b.t);
  if (!rows.length) return { days: [], typicalDaily: null, lastDoseMs: null };
  // With no amounts anywhere, fall back to counting each day as one typical
  // day -- still an improvement on counting every dose separately.
  const values = anyAmount ? rows.map((r) => r.total).filter((v) => v > 0) : [];
  let typicalDaily = null;
  if (values.length) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    typicalDaily = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  const days = rows.map((r) => ({
    t: r.t,
    weight: typicalDaily > 0 && r.total > 0 ? r.total / typicalDaily : 1,
  }));
  return { days, typicalDaily, lastDoseMs: rows[rows.length - 1].t };
}

// Saturating 0-1 tolerance level at time `at`, from per-day exposure and this
// category's time constants. A single typical day already gives
// 1-exp(-1/formationDays) -- e.g. ~63% for formationDays=1 (psychedelics),
// ~22% for formationDays=4 (opioids) -- and repeated recent days push it
// higher, saturating toward 1. Heavier days weigh proportionally more.
//
// Accepts either the aggregated day list from dailyExposure or, for
// convenience and backward compatibility, a bare array of dose timestamps.
export function toleranceLevel(daysOrTimestamps, at, { formationDays, decayDays }) {
  const days = Array.isArray(daysOrTimestamps) && daysOrTimestamps.every((d) => d && typeof d === "object" && "weight" in d)
    ? daysOrTimestamps
    : dailyExposure(daysOrTimestamps || [], at).days;
  const load = toleranceLoad(days, at, decayDays);
  return 1 - Math.exp(-load / formationDays);
}

// Full tolerance report for one medication at time `now`, from its own
// consuming doses -- either bare timestamps or {t, amount} entries, in any
// order, future doses ignored. Amounts are aggregated per calendar day, so
// what drives tolerance is how much was taken each day rather than how many
// separate times it was taken. Returns `{ applicable, level, maxDampening, daysSinceLast, faded,
// recentPeakLevel }`.
//   - `applicable`: false for categories with no modeled tolerance (the
//     curve/intensity is left completely untouched).
//   - `level` (0-1): current modeled tolerance -- multiply into intensity_scale
//     via `1 - level * maxDampening`.
//   - `faded`: true when tolerance was recently meaningful (>=0.35 as of the
//     last dose) but has since decayed by >=0.2 during the gap since then --
//     the "this may hit harder than your last few doses" signal.
// `medOrCategory` may be a medication object (so substance-specific
// constants can apply) or a bare category string.
export function estimateTolerance(doseTimestamps, medOrCategory, now = Date.now()) {
  const params = toleranceParamsFor(medOrCategory);
  if (!params) return { applicable: false, level: 0, maxDampening: 0, daysSinceLast: null, faded: false, recentPeakLevel: 0 };
  const { days, typicalDaily, lastDoseMs } = dailyExposure(doseTimestamps || [], now);
  const level = toleranceLevel(days, now, params);
  if (!days.length) {
    return { applicable: true, level: 0, maxDampening: params.maxDampening, daysSinceLast: null, faded: false, recentPeakLevel: 0, typicalDaily: null };
  }
  const lastDose = lastDoseMs;
  const daysSinceLast = (now - lastDose) / DAY_MS;
  const recentPeakLevel = toleranceLevel(days, lastDose, params); // level as of the last dose itself (its own freshest impulse included)
  const faded = recentPeakLevel >= 0.35 && recentPeakLevel - level >= 0.2;
  return {
    applicable: true,
    level: round2(level),
    maxDampening: params.maxDampening,
    daysSinceLast: round1(daysSinceLast),
    faded,
    recentPeakLevel: round2(recentPeakLevel),
    typicalDaily,
  };
}
