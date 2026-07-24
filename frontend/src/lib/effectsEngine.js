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

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const round1 = (x) => Math.round(x * 10) / 10;

export function defaultPkProfile(med = {}) {
  const base = CATEGORY_PK[med.category] || CATEGORY_PK.other;
  const speed = FORM_SPEED[med.form] ?? 1;
  const onset = clamp(Math.round(base.onset * speed), 2, 360);
  const peak = clamp(Math.round(base.peak * Math.sqrt(speed)), onset + 5, 720);
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
// (higher dose ≈ somewhat longer and stronger, sub-linearly).
export function personalizedProfile(med, model = null, dose = null) {
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
  peak = Math.max(peak, onset + 5);
  duration = Math.max(duration, peak + 15);
  return {
    onset_min: Math.round(onset), peak_min: Math.round(peak), duration_min: Math.round(duration),
    intensity_scale: round1(intensityScale),
    learned: !!model && (model.samples || 0) > 0,
    samples: model?.samples || 0,
    confidence: modelConfidence(model),
  };
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

// Summed intensity at minute t (from session start) across the dose stack —
// but once a later dose reaches its own predicted peak, the dose(s) before
// it collapse toward zero over a short window rather than continuing to add
// their full tail on top forever. This models a redose's peak taking over as
// the dominant felt effect (and matches the "Peaking" feedback language)
// instead of an ever-taller, less-plausible literal sum of every dose taken.
// A dose whose tOffset is still in the future contributes 0 (intensityAt of a
// negative time), so this is correct for any t, past or present.
const COLLAPSE_MIN_MIN = 8, COLLAPSE_MAX_MIN = 45, COLLAPSE_FRACTION = 0.08;
export function stackedIntensityAt(tMin, profile, stack) {
  let sum = 0;
  const fadeWindow = clamp(profile.duration_min * COLLAPSE_FRACTION, COLLAPSE_MIN_MIN, COLLAPSE_MAX_MIN);
  for (let i = 0; i < stack.length; i++) {
    const d = stack[i];
    const next = stack[i + 1];
    let mult = 1;
    if (next) {
      const collapseAt = next.tOffset + profile.peak_min; // when the next dose peaks, this one starts handing off
      if (tMin >= collapseAt + fadeWindow) continue; // fully collapsed — skip its contribution entirely
      if (tMin >= collapseAt) mult = 1 - smooth((tMin - collapseAt) / fadeWindow);
    }
    sum += intensityAt(tMin - d.tOffset, profile) * (d.scale ?? 1) * mult;
  }
  return round1(sum);
}

// Where the plotted curve should end: after the last dose's own tail.
export function stackChartEnd(profile, stack) {
  const lastOffset = stack.length ? stack[stack.length - 1].tOffset : 0;
  return lastOffset + profile.duration_min * 1.25;
}

// Stacked series for the chart, sampled evenly across the (possibly extended)
// timeline. Peaks can exceed 100% when doses overlap.
export function stackedCurveSeries(profile, stack, points = 96) {
  const end = stackChartEnd(profile, stack);
  const out = [];
  for (let i = 0; i <= points; i++) {
    const t = (end * i) / points;
    out.push({ t: Math.round(t), intensity: stackedIntensityAt(t, profile, stack) });
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
