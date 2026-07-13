// Behaviour & dependency-risk engine — deterministic, pure, storage-free.
//
// Computes usage-pattern signals per medication and rolls them into an
// educational risk summary. This is NOT a diagnosis: signals are "patterns
// worth discussing with your prescriber", framed via SAFETY_COPY everywhere
// (UI, AI prompts, assistant tool results) so the language can't drift.
import { localDateStr, addDaysStr, diffDays, timestampToLocalDate } from "./dates";
import { logQuantity, doseQuantity } from "./predictor";
import { unifyMoodEntries, moodDailySeries, moodUsageCorrelation } from "./moodAnalytics";

const CONSUMING = ["taken", "partial"];

export const SAFETY_COPY = {
  framing:
    "These are usage patterns computed from your own logs, shown for self-awareness. " +
    "They are not a diagnosis and cannot tell you whether you have a dependency.",
  disclaimer:
    "Meditrax provides educational information only, not medical advice. " +
    "Never stop or change a medication abruptly — talk to your prescriber or pharmacist first.",
  clinician:
    "If any of this resonates with you, mention it at your next appointment. " +
    "Prescribers see these patterns often and can adjust your plan safely.",
  crisis:
    "If you feel unable to control your use, or you're in crisis: contact your doctor, " +
    "call or text 988 (Suicide & Crisis Lifeline, US/Canada), or your local emergency number. " +
    "SAMHSA helpline (US): 1-800-662-4357 — free, confidential, 24/7.",
};

const LEVELS = [
  { min: 75, level: "high" },
  { min: 50, level: "elevated" },
  { min: 25, level: "watch" },
  { min: 0, level: "none" },
];

// ---------- helpers ----------

function consumingLogs(logs, med, { days, now }) {
  const nowStr = localDateStr(now);
  const startStr = addDaysStr(nowStr, -(days - 1));
  return (logs || [])
    .filter((l) => l.medication_id === med.id && CONSUMING.includes(l.status))
    .map((l) => ({ ...l, _date: timestampToLocalDate(l.timestamp), _qty: logQuantity(l, med) }))
    .filter((l) => l._date >= startStr && l._date <= nowStr)
    .sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
}

function usageByDay(cLogs) {
  const byDay = new Map();
  for (const l of cLogs) byDay.set(l._date, (byDay.get(l._date) || 0) + l._qty);
  return byDay;
}

function linearSlope(points) {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  return den > 0 ? num / den : 0;
}

function signal(id, weight, triggered, label, detail, evidence = {}) {
  return { id, weight, triggered: !!triggered, label, detail, evidence };
}

// ---------- individual signals ----------

// Rising weekly usage for PRN meds (units/week slope over recent weeks).
export function prnEscalation(logs, med, { weeks = 6, now = new Date() } = {}) {
  const cLogs = consumingLogs(logs, med, { days: weeks * 7, now });
  const nowStr = localDateStr(now);
  const byDay = usageByDay(cLogs);
  const weekly = [];
  for (let w = weeks - 1; w >= 0; w--) {
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += byDay.get(addDaysStr(nowStr, -(w * 7 + i))) || 0;
    weekly.push(sum);
  }
  const active = weekly.filter((v) => v > 0).length;
  const mean = weekly.reduce((a, b) => a + b, 0) / weekly.length;
  if (active < 3 || mean === 0) return signal("prn_escalation", 20, false, "Usage increasing week over week", "", { weekly });
  const slope = linearSlope(weekly.map((y, x) => ({ x, y })));
  const relSlope = slope / mean; // fraction of mean per week
  const triggered = relSlope > 0.15 && weekly[weekly.length - 1] > weekly[0];
  return signal(
    "prn_escalation", 20, triggered,
    "Usage increasing week over week",
    triggered ? `Weekly use grew from about ${Math.round(weekly[0] * 10) / 10} to ${Math.round(weekly[weekly.length - 1] * 10) / 10} units over ${weeks} weeks.` : "",
    { weekly, relSlopePct: Math.round(relSlope * 100) }
  );
}

// Amount per occasion rising vs the user's own earlier baseline.
export function doseEscalation(logs, med, { days = 60, now = new Date() } = {}) {
  const cLogs = consumingLogs(logs, med, { days, now });
  if (cLogs.length < 8) return signal("dose_escalation", 25, false, "Dose per occasion rising", "");
  const mid = Math.floor(cLogs.length / 2);
  const baseline = cLogs.slice(0, mid);
  const recent = cLogs.slice(mid);
  const avg = (arr) => arr.reduce((a, l) => a + l._qty, 0) / arr.length;
  const bAvg = avg(baseline), rAvg = avg(recent);
  if (bAvg <= 0) return signal("dose_escalation", 25, false, "Dose per occasion rising", "");
  const ratio = rAvg / bAvg;
  const triggered = ratio >= 1.3;
  return signal(
    "dose_escalation", 25, triggered,
    "Dose per occasion rising",
    triggered ? `Recent doses average ${Math.round(rAvg * 100) / 100} units vs ${Math.round(bAvg * 100) / 100} earlier — about ${Math.round((ratio - 1) * 100)}% more.` : "",
    { baselineAvg: bAvg, recentAvg: rAvg, ratio: Math.round(ratio * 100) / 100 }
  );
}

// Shrinking gaps between doses, or repeatedly taking scheduled doses early.
export function intervalShrink(logs, med, { days = 30, now = new Date() } = {}) {
  const cLogs = consumingLogs(logs, med, { days, now });
  // (a) inter-dose gap trend
  const gaps = [];
  for (let i = 1; i < cLogs.length; i++) {
    const h = (new Date(cLogs[i].timestamp) - new Date(cLogs[i - 1].timestamp)) / 3600000;
    if (h > 0.25 && h < 24 * 7) gaps.push(h);
  }
  let gapTriggered = false, gapDetail = "";
  if (gaps.length >= 6) {
    const mid = Math.floor(gaps.length / 2);
    const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const early = median(gaps.slice(0, mid)), late = median(gaps.slice(mid));
    if (early > 0 && late / early <= 0.7) {
      gapTriggered = true;
      gapDetail = `Typical time between doses shrank from ~${Math.round(early)}h to ~${Math.round(late)}h.`;
    }
  }
  // (b) early dosing vs scheduled time (scheduled meds)
  let earlyCount = 0, checked = 0;
  for (const l of cLogs) {
    if (!l.scheduled_time) continue;
    checked++;
    const [hh, mm] = l.scheduled_time.split(":").map(Number);
    const t = new Date(l.timestamp);
    const schedMinutes = hh * 60 + mm;
    const actualMinutes = t.getHours() * 60 + t.getMinutes();
    if (schedMinutes - actualMinutes > 120) earlyCount++;
  }
  const earlyTriggered = checked >= 6 && earlyCount / checked >= 0.4;
  const triggered = gapTriggered || earlyTriggered;
  const detail = [gapDetail, earlyTriggered ? `${earlyCount} of ${checked} scheduled doses were taken more than 2 hours early.` : ""].filter(Boolean).join(" ");
  return signal("interval_shrink", 15, triggered, "Doses getting closer together", detail, { gaps: gaps.length, earlyCount, checked });
}

// Days where total logged amount exceeds the catalog's max daily dose.
export function maxDailyExceeded(logs, med, catalogEntry, { days = 30, now = new Date() } = {}) {
  const max = Number(catalogEntry?.max_daily_dose);
  if (!isFinite(max) || max <= 0) return signal("max_daily_exceeded", 30, false, "Days above the maximum daily dose", "");
  const cLogs = consumingLogs(logs, med, { days, now });
  const mgByDay = new Map();
  for (const l of cLogs) {
    const mg = l.dose_taken != null && isFinite(Number(l.dose_taken))
      ? Number(l.dose_taken)
      : (Number(med.strength) || 0) * l._qty;
    mgByDay.set(l._date, (mgByDay.get(l._date) || 0) + mg);
  }
  const overDays = [...mgByDay.entries()].filter(([, mg]) => mg > max).map(([d]) => d);
  const triggered = overDays.length >= 1;
  return signal(
    "max_daily_exceeded", 30, triggered,
    "Days above the maximum daily dose",
    triggered ? `${overDays.length} day${overDays.length > 1 ? "s" : ""} in the last ${days} exceeded the typical maximum of ${max} ${med.unit || "mg"}/day.` : "",
    { overDays, max }
  );
}

// Missed days followed by unusually heavy days ("missed→binge"), or sustained
// adherence collapse on scheduled meds.
export function adherencePattern(logs, med, { days = 30, now = new Date() } = {}) {
  if (med.is_prn) return signal("adherence_pattern", 10, false, "Irregular pattern after missed days", "");
  const cLogs = consumingLogs(logs, med, { days, now });
  if (!cLogs.length) return signal("adherence_pattern", 10, false, "Irregular pattern after missed days", "");
  const byDay = usageByDay(cLogs);
  const nowStr = localDateStr(now);
  let firstDay = nowStr;
  for (const d of byDay.keys()) if (d < firstDay) firstDay = d;
  const span = Math.max(1, diffDays(firstDay, nowStr));
  const typical = [...byDay.values()].reduce((a, b) => a + b, 0) / Math.max(1, byDay.size);
  let binges = 0;
  for (let i = 1; i <= span; i++) {
    const day = addDaysStr(firstDay, i);
    const prev = addDaysStr(firstDay, i - 1);
    if ((byDay.get(prev) || 0) === 0 && (byDay.get(day) || 0) > typical * 1.5) binges++;
  }
  const triggered = binges >= 2;
  return signal(
    "adherence_pattern", 10, triggered,
    "Irregular pattern after missed days",
    triggered ? `${binges} times a missed day was followed by a much heavier day — doubling up can be risky.` : "",
    { binges, typical: Math.round(typical * 100) / 100 }
  );
}

// PRN effectiveness declining while usage holds or rises → tolerance signal.
export function toleranceSignal(logs, med, { days = 60, now = new Date() } = {}) {
  const cLogs = consumingLogs(logs, med, { days, now });
  const rated = cLogs.filter((l) => l.effectiveness != null && isFinite(Number(l.effectiveness)));
  if (rated.length < 6) return signal("tolerance", 12, false, "Effect fading at the same dose", "");
  const effSlope = linearSlope(rated.map((l, i) => ({ x: i, y: Number(l.effectiveness) })));
  const byDay = usageByDay(cLogs);
  const nowStr = localDateStr(now);
  const half = Math.floor(days / 2);
  let earlySum = 0, lateSum = 0;
  for (let i = 0; i < half; i++) {
    lateSum += byDay.get(addDaysStr(nowStr, -i)) || 0;
    earlySum += byDay.get(addDaysStr(nowStr, -(half + i))) || 0;
  }
  const usageNotFalling = lateSum >= earlySum * 0.9;
  const triggered = effSlope < -0.08 && usageNotFalling;
  const first = rated.slice(0, 3).reduce((a, l) => a + Number(l.effectiveness), 0) / Math.min(3, rated.length);
  const last = rated.slice(-3).reduce((a, l) => a + Number(l.effectiveness), 0) / Math.min(3, rated.length);
  return signal(
    "tolerance", 12, triggered,
    "Effect fading at the same dose",
    triggered ? `Effectiveness ratings drifted from ~${Math.round(first * 10) / 10}/10 to ~${Math.round(last * 10) / 10}/10 while usage didn't decrease.` : "",
    { effSlope: Math.round(effSlope * 1000) / 1000, earlySum, lateSum }
  );
}

// Low-mood days coinciding with / preceding above-average usage.
export function moodUsageLink(logs, med, checkins, { days = 30, now = new Date() } = {}) {
  const cLogs = consumingLogs(logs, med, { days, now });
  const byDay = usageByDay(cLogs);
  const moodSeries = moodDailySeries(unifyMoodEntries(checkins, logs), { days, now });
  const { score, n } = moodUsageCorrelation(moodSeries, byDay);
  const triggered = n >= 7 && score <= -0.3;
  return signal(
    "mood_usage", 8, triggered,
    "Heavier use on low-mood days",
    triggered ? `On days you reported feeling low, you tended to use more of this medication (correlation ${score}).` : "",
    { score, n }
  );
}

// ---------- roll-up ----------

const CATEGORY_MULTIPLIER = { extreme: 1.25, high: 1.15, moderate: 1.0 };

export function isApplicable(med) {
  const dep = med?.dependency_risk_category || "none";
  return ["moderate", "high", "extreme"].includes(dep) || !!med?.is_prn || med?.risk_level === "high";
}

export function analyzeMedication({ med, logs = [], checkins = [], catalogEntry = null, taper = null, now = new Date() }) {
  const base = {
    medication_id: med.id, name: med.name,
    dependency_risk_category: med.dependency_risk_category || "none",
    applicable: isApplicable(med),
    score: null, level: "none", signals: [], data_quality: "insufficient",
    suggested_actions: [],
  };
  if (!base.applicable) return base;

  const cLogs = consumingLogs(logs, med, { days: 90, now });
  const spanDays = cLogs.length ? diffDays(cLogs[0]._date, localDateStr(now)) : 0;
  base.data_quality = cLogs.length >= 10 && spanDays >= 14 ? (cLogs.length >= 25 && spanDays >= 30 ? "good" : "limited") : "insufficient";
  if (base.data_quality === "insufficient") return base;

  const all = [
    prnEscalation(logs, med, { now }),
    doseEscalation(logs, med, { now }),
    intervalShrink(logs, med, { now }),
    maxDailyExceeded(logs, med, catalogEntry, { now }),
    adherencePattern(logs, med, { now }),
    toleranceSignal(logs, med, { now }),
    moodUsageLink(logs, med, checkins, { now }),
  ];
  const triggered = all.filter((s) => s.triggered).sort((a, b) => b.weight - a.weight);
  const rawScore = triggered.reduce((a, s) => a + s.weight, 0);
  const mult = CATEGORY_MULTIPLIER[med.dependency_risk_category] || (med.is_prn ? 0.85 : 0.9);
  const score = Math.min(100, Math.round(rawScore * mult));
  const level = LEVELS.find((l) => score >= l.min).level;

  const actions = [];
  if (level !== "none") actions.push({ type: "clinician", text: SAFETY_COPY.clinician });
  if ((level === "elevated" || level === "high") && !taper && !med.is_prn) {
    actions.push({ type: "taper", text: "A gradual, clinician-supervised taper plan can help — the Taper Planner can model one to discuss with your prescriber.", link: "/taper" });
  }
  if (catalogEntry) actions.push({ type: "knowledge", text: `Read more about ${med.name} in the knowledge base.`, link: `/knowledge/${catalogEntry.id}` });

  return { ...base, score, level, signals: triggered, all_signals: all, suggested_actions: actions };
}

export function analyzeAll({ meds = [], logs = [], checkins = [], catalog = [], tapers = [], now = new Date() }) {
  const catByName = new Map(catalog.map((c) => [c.name_lower || (c.name || "").toLowerCase(), c]));
  const per_med = meds
    .filter((m) => m.is_active !== false)
    .map((med) => analyzeMedication({
      med, logs, checkins,
      catalogEntry: (med.catalog_id && catalog.find((c) => c.id === med.catalog_id)) || catByName.get((med.name || "").toLowerCase()) || null,
      taper: tapers.find((t) => t.medication_id === med.id && t.is_active) || null,
      now,
    }))
    .filter((r) => r.applicable);
  const flagged = per_med.filter((r) => r.level !== "none");
  return { per_med, flagged, generated_at: now.toISOString(), safety: SAFETY_COPY };
}
