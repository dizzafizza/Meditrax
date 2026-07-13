// Unified taper engine (client-side port of the validated Python engine).
// Single source of truth for plan generation AND daily-dose lookup.
// Guarantees: step[0]==initial, last==final, monotonic non-increasing, no negatives.
import { localDateStr, parseLocalDate, diffDays } from "./dates";

function round4(x) {
  return Math.max(0, Math.round(x * 10000) / 10000);
}

export function generateTaperLevels(initialDose, finalDose, totalDays, stepIntervalDays = 7, method = "hyperbolic", customSteps = null) {
  initialDose = Number(initialDose);
  finalDose = Number(finalDose);
  if (initialDose <= 0) throw new Error("Starting dose must be greater than 0");
  if (finalDose < 0 || finalDose > initialDose) throw new Error("Final dose must be between 0 and the starting dose");
  if (totalDays <= 0 || stepIntervalDays <= 0) throw new Error("Durations must be greater than 0");

  const n = Math.max(1, Math.round(totalDays / stepIntervalDays));
  let levels;

  if (method === "custom" && customSteps && customSteps.length) {
    let doses = customSteps.map((cs) => (cs.dose != null ? Number(cs.dose) : round4(initialDose * Number(cs.multiplier ?? 1))));
    if (!doses.length || Math.abs(doses[0] - initialDose) > 1e-9) doses = [initialDose, ...doses];
    doses[doses.length - 1] = finalDose;
    levels = doses;
  } else {
    levels = new Array(n + 1).fill(0);
    levels[0] = initialDose;
    levels[n] = finalDose;

    if (method === "linear") {
      const dec = (initialDose - finalDose) / n;
      for (let i = 1; i < n; i++) levels[i] = initialDose - dec * i;
    } else if (method === "exponential") {
      if (finalDose > 0) {
        const r = Math.pow(finalDose / initialDose, 1 / n);
        for (let i = 1; i < n; i++) levels[i] = initialDose * Math.pow(r, i);
      } else {
        const floor = Math.max(initialDose * 0.05, 1e-4);
        const r = n > 1 ? Math.pow(floor / initialDose, 1 / (n - 1)) : 0;
        for (let i = 1; i < n; i++) levels[i] = initialDose * Math.pow(r, i);
      }
    } else if (method === "hyperbolic") {
      const Kd = initialDose * 0.25; // O(initial) ~ 0.8
      const occ = (d) => d / (d + Kd);
      const inv = (o) => (o < 1 ? (Kd * o) / (1 - o) : initialDose);
      const oInit = occ(initialDose);
      const oFinal = occ(finalDose);
      for (let i = 1; i < n; i++) {
        const oi = oInit - (oInit - oFinal) * (i / n);
        levels[i] = inv(oi);
      }
    } else {
      throw new Error("Unknown taper method: " + method);
    }
  }

  const out = [];
  let prev = null;
  for (let d of levels) {
    let v = round4(d);
    if (prev != null && v > prev) v = prev;
    out.push(v);
    prev = v;
  }
  return out;
}

function addDays(date, days) {
  const d = date instanceof Date ? new Date(date) : parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return d;
}
// Local calendar date (was UTC toISOString — shifted a day for users east of UTC).
function isoDate(d) {
  return localDateStr(d instanceof Date ? d : parseLocalDate(d));
}

export function generateTaperSchedule({
  initialDose, finalDose = 0, startDate, stepIntervalDays = 7, totalDays, method = "hyperbolic",
  unit = "mg", customSteps = null, maxReductionWarnPct = 25,
}) {
  const start = startDate ? parseLocalDate(startDate) : new Date();
  if (totalDays == null) throw new Error("totalDays required");
  const levels = generateTaperLevels(initialDose, finalDose, totalDays, stepIntervalDays, method, customSteps);

  const steps = [];
  const warnings = [];
  let prev = null;
  levels.forEach((dose, i) => {
    const startDay = i * stepIntervalDays;
    const sdate = addDays(start, startDay);
    const edate = addDays(start, (i + 1) * stepIntervalDays);
    let reductionPct = 0, reductionAmt = 0;
    if (prev != null && prev !== 0) {
      reductionAmt = Math.round((prev - dose) * 10000) / 10000;
      reductionPct = Math.round(((prev - dose) / prev) * 1000) / 10;
    }
    let note = "";
    if (reductionPct > maxReductionWarnPct) {
      note = `Large reduction (${reductionPct}%). Consider extending the duration.`;
      warnings.push(`Step ${i}: ${note}`);
    }
    steps.push({
      step: i, start_day: startDay, date: isoDate(sdate), end_date: isoDate(edate),
      dose, unit, reduction_amount: reductionAmt, reduction_pct: reductionPct,
      note, is_final: i === levels.length - 1,
    });
    prev = dose;
  });

  const summary = {
    method, initial_dose: Number(initialDose), final_dose: Number(finalDose), unit,
    total_days: totalDays, step_interval_days: stepIntervalDays, num_steps: steps.length,
    start_date: isoDate(start), end_date: isoDate(addDays(start, totalDays)),
    total_reduction: Math.round((initialDose - finalDose) * 10000) / 10000,
  };
  return { steps, summary, warnings };
}

export function doseOnDate(schedule, onDate, startDate) {
  const steps = schedule?.steps || [];
  if (!steps.length) return 0;
  const interval = schedule.summary?.step_interval_days || 7;
  const day = diffDays(isoDate(startDate), isoDate(onDate));
  if (day < 0) return steps[0].dose;
  const idx = Math.min(steps.length - 1, Math.floor(day / interval));
  return steps[idx].dose;
}

export function suggestTaperParams(med) {
  const dep = (med || {}).dependency_risk_category || "none";
  const risk = (med || {}).risk_level || "low";
  if (["extreme", "high"].includes(dep) || risk === "high") {
    return { method: "hyperbolic", step_interval_days: 14, suggested_weeks: 16, reduction_per_step_pct: 10,
      rationale: "High dependency risk: a slow hyperbolic taper (~5-10% of current dose every 2 weeks) minimizes withdrawal." };
  }
  if (dep === "moderate" || risk === "moderate") {
    return { method: "hyperbolic", step_interval_days: 7, suggested_weeks: 8, reduction_per_step_pct: 15,
      rationale: "Moderate risk: a gradual hyperbolic taper over about 8 weeks is reasonable." };
  }
  return { method: "linear", step_interval_days: 7, suggested_weeks: 4, reduction_per_step_pct: 25,
    rationale: "Lower risk: a linear taper over a few weeks is usually well tolerated." };
}
