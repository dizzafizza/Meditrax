// Refill prediction engine — pure, storage-free. localdb passes data in.
//
// Replaces the old fixed scheduled-rate model with a blended predictor:
//  - scheduled meds: schedule rate × exponentially-weighted adherence factor
//  - PRN meds: exponentially-weighted actual daily usage from log history
//  - tapering meds: forward simulation over the declining schedule
// Outputs a run-out date, a refill-by date (lead time) and a confidence level.
import { WEEKDAYS } from "./format";
import { localDateStr, addDaysStr, diffDays, timestampToLocalDate, weekdayKeyLocal } from "./dates";
import { doseOnDate } from "./taperEngine";

const CONSUMING_STATUSES = ["taken", "partial"];

// Pills-per-dose for a med, with fallback for data created before dose_quantity existed.
export function doseQuantity(med) {
  const q = Number(med?.dose_quantity ?? med?.inventory?.units_per_dose ?? 1);
  return q > 0 ? q : 1;
}

// Units consumed by a log. Legacy logs (no quantity) mirror the old decrement
// behavior: full per-dose default, halved for "partial".
export function logQuantity(log, med) {
  if (log?.quantity != null && isFinite(Number(log.quantity))) return Math.max(0, Number(log.quantity));
  const per = doseQuantity(med);
  return log?.status === "partial" ? per / 2 : per;
}

// Theoretical schedule consumption in units/day. 0 for PRN.
export function scheduledDailyQuantity(med) {
  if (!med || med.is_prn) return 0;
  const times = (med.times && med.times.length) ? med.times : ["09:00"];
  const days = med.days_of_week || WEEKDAYS;
  return times.length * (days.length / 7) * doseQuantity(med);
}

function ewStats(dailyValues, halfLifeDays) {
  // dailyValues: [{ age, value }] where age = days before "now" (0 = today)
  const k = Math.log(2) / halfLifeDays;
  let wSum = 0, vSum = 0;
  for (const { age, value } of dailyValues) {
    const w = Math.exp(-k * age);
    wSum += w;
    vSum += w * value;
  }
  return wSum > 0 ? vSum / wSum : 0;
}

// Build a per-local-day map of consumed units within the window.
function dailyUsage(logs, med, { days, now }) {
  const nowStr = localDateStr(now);
  const startStr = addDaysStr(nowStr, -(days - 1));
  const byDay = new Map();
  for (const log of logs || []) {
    if (log.medication_id !== med.id) continue;
    if (!CONSUMING_STATUSES.includes(log.status)) continue;
    const day = timestampToLocalDate(log.timestamp);
    if (!day || day < startStr || day > nowStr) continue;
    byDay.set(day, (byDay.get(day) || 0) + logQuantity(log, med));
  }
  return { byDay, startStr, nowStr };
}

// Exponentially-weighted adherence: taken/expected over recent scheduled days.
// Clamped to [0.3, 1.1]; 1 when there is no history to learn from.
export function adherenceFactor(logs, med, { days = 30, halfLifeDays = 10, now = new Date() } = {}) {
  if (!med || med.is_prn) return 1;
  const medStart = med.start_date || null;
  const times = (med.times && med.times.length) ? med.times : ["09:00"];
  const dows = med.days_of_week || WEEKDAYS;
  const { byDay, nowStr } = dailyUsage(logs, med, { days, now });
  if (byDay.size === 0) return 1; // nothing logged yet — assume the schedule
  const perDose = doseQuantity(med);
  // Only judge days since the user demonstrably started logging this med;
  // earlier silence is absence of data, not missed doses.
  let firstLogged = null;
  for (const day of byDay.keys()) if (!firstLogged || day < firstLogged) firstLogged = day;

  const samples = [];
  for (let age = 1; age < days; age++) { // skip today (partially elapsed)
    const day = addDaysStr(nowStr, -age);
    if (day < firstLogged) break;
    if (medStart && day < medStart) break;
    if (!dows.includes(weekdayKeyLocal(day))) continue;
    const expected = times.length * perDose;
    if (expected <= 0) continue;
    const consumed = byDay.get(day) || 0;
    samples.push({ age, value: Math.min(consumed / expected, 1.5) });
  }
  if (samples.length < 3) return 1;
  const f = ewStats(samples, halfLifeDays);
  return Math.min(1.1, Math.max(0.3, f));
}

// Exponentially-weighted actual units/day for PRN meds (or observed usage generally).
export function prnDailyRate(logs, med, { days = 30, halfLifeDays = 7, now = new Date() } = {}) {
  const { byDay, nowStr } = dailyUsage(logs, med, { days, now });
  if (byDay.size === 0) return 0;
  // Only look back to the first observed usage (or med start) so long-owned,
  // rarely-used meds aren't diluted by empty months.
  let firstDay = null;
  for (const day of byDay.keys()) if (!firstDay || day < firstDay) firstDay = day;
  if (med.start_date && med.start_date > firstDay) firstDay = med.start_date;
  const span = Math.min(days - 1, Math.max(1, diffDays(firstDay, nowStr)));
  const samples = [];
  for (let age = 1; age <= span; age++) {
    const day = addDaysStr(nowStr, -age);
    samples.push({ age, value: byDay.get(day) || 0 });
  }
  if (!samples.length) return 0;
  return ewStats(samples, halfLifeDays);
}

// Variability of weekly usage → confidence.
function usageConfidence(logs, med, { days = 30, now = new Date() } = {}) {
  const { byDay, nowStr } = dailyUsage(logs, med, { days, now });
  const activeDays = byDay.size;
  if (activeDays === 0) return "low";
  let earliest = nowStr;
  for (const d of byDay.keys()) if (d < earliest) earliest = d;
  const historyDays = diffDays(earliest, nowStr) + 1;
  const weeks = [];
  for (let w = 0; w < Math.min(4, Math.ceil(historyDays / 7)); w++) {
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += byDay.get(addDaysStr(nowStr, -(w * 7 + i))) || 0;
    weeks.push(sum);
  }
  const mean = weeks.reduce((a, b) => a + b, 0) / weeks.length;
  if (mean === 0) return "low";
  const variance = weeks.reduce((a, b) => a + (b - mean) ** 2, 0) / weeks.length;
  const cv = Math.sqrt(variance) / mean;
  if (historyDays >= 14 && cv < 0.35) return "high";
  if (historyDays >= 7 && cv < 0.8) return "medium";
  return "low";
}

/**
 * Predict when a medication's inventory runs out.
 * @returns {{
 *   daily_rate: number, days_left: number|null,
 *   run_out_date: string|null, refill_by_date: string|null,
 *   confidence: "high"|"medium"|"low", method: "scheduled"|"blended"|"prn"|"taper"|"none",
 * }}
 */
export function predictRunOut({ med, logs = [], taper = null, settings = {}, now = new Date() }) {
  const none = { daily_rate: 0, days_left: null, run_out_date: null, refill_by_date: null, confidence: "low", method: "none" };
  const inv = med?.inventory;
  if (!inv || inv.current_count == null) return none;
  const count = Math.max(0, Number(inv.current_count) || 0);
  const nowStr = localDateStr(now);
  const leadDays = Math.max(0, Number(settings.refill_lead_days ?? 3));

  const finish = (dailyRate, daysLeft, method, confidence) => {
    const runOut = daysLeft != null ? addDaysStr(nowStr, Math.floor(daysLeft)) : null;
    return {
      daily_rate: Math.round(dailyRate * 100) / 100,
      days_left: daysLeft != null ? Math.round(daysLeft * 10) / 10 : null,
      run_out_date: runOut,
      refill_by_date: runOut ? addDaysStr(runOut, -leadDays) : null,
      confidence, method,
    };
  };

  // Active taper: simulate forward against the declining schedule.
  const activeTaper = taper && taper.is_active !== false && taper.schedule ? taper : null;
  if (activeTaper && !med.is_prn && Number(med.strength) > 0) {
    const adh = adherenceFactor(logs, med, { now });
    const times = (med.times && med.times.length) ? med.times : ["09:00"];
    const dows = med.days_of_week || WEEKDAYS;
    let remaining = count;
    for (let day = 0; day <= 365; day++) {
      const dstr = addDaysStr(nowStr, day);
      if (!dows.includes(weekdayKeyLocal(dstr))) continue;
      const dose = doseOnDate(activeTaper.schedule, dstr, activeTaper.start_date);
      const unitsPerDay = (dose / Number(med.strength)) * times.length * adh;
      if (unitsPerDay <= 0) continue; // taper reached 0 — stock stops draining
      remaining -= unitsPerDay;
      if (remaining <= 0) return finish(unitsPerDay, day, "taper", usageConfidence(logs, med, { now }));
    }
    // Never runs out within a year (taper ends first)
    return finish(0, null, "taper", usageConfidence(logs, med, { now }));
  }

  // PRN: purely usage-based.
  if (med.is_prn) {
    const rate = prnDailyRate(logs, med, { now });
    if (rate <= 0) return { ...none, method: "prn" };
    return finish(rate, count / rate, "prn", usageConfidence(logs, med, { now }));
  }

  // Scheduled: schedule × adherence, blended with observed extra usage.
  const scheduled = scheduledDailyQuantity(med);
  if (scheduled <= 0) return none;
  const adh = adherenceFactor(logs, med, { now });
  const theoretical = scheduled * adh;
  const observed = prnDailyRate(logs, med, { days: 30, halfLifeDays: 10, now });
  // Be conservative: if the user demonstrably consumes more than the adjusted
  // schedule (extra/PRN-style doses), trust the observed rate.
  const hasHistory = observed > 0;
  const rate = hasHistory ? Math.max(theoretical, observed) : scheduled;
  const method = hasHistory ? "blended" : "scheduled";
  const confidence = hasHistory ? usageConfidence(logs, med, { now }) : "medium";
  return finish(rate, count / rate, method, confidence);
}

// Status honoring BOTH thresholds: per-med unit count and app-level days.
export function inventoryStatus({ med, prediction, settings = {} }) {
  const inv = med?.inventory;
  if (!inv || inv.current_count == null) return "ok";
  const count = Number(inv.current_count) || 0;
  if (count <= 0) return "out";
  const unitThreshold = Number(inv.refill_threshold);
  if (isFinite(unitThreshold) && unitThreshold > 0 && count <= unitThreshold) return "low";
  const dayThreshold = Number(settings.refill_threshold_days ?? 7);
  if (prediction?.days_left != null && prediction.days_left <= dayThreshold) return "low";
  return "ok";
}
