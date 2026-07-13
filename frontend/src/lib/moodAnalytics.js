// Mood analytics — pure, storage-free. Unifies standalone check-ins with the
// legacy per-dose word moods and computes daily series / trends used by the
// Insights page and the behaviour engine.
import { localDateStr, addDaysStr, timestampToLocalDate } from "./dates";

export const MOOD_WORD_TO_NUM = { great: 5, good: 4, okay: 3, low: 2, bad: 1 };
export const MOOD_NUM_TO_WORD = { 5: "great", 4: "good", 3: "okay", 2: "low", 1: "bad" };
export const MOOD_EMOJI = { 5: "😊", 4: "🙂", 3: "😐", 2: "😕", 1: "😟" };

// Merge check-ins (mood 1-5) and dose logs (mood word) into one entry list.
export function unifyMoodEntries(checkins = [], logs = []) {
  const entries = [];
  for (const c of checkins) {
    const v = Number(c.mood);
    if (v >= 1 && v <= 5) entries.push({ date: timestampToLocalDate(c.timestamp), mood: v, source: "checkin", timestamp: c.timestamp });
  }
  for (const l of logs) {
    const v = MOOD_WORD_TO_NUM[l.mood];
    if (v) entries.push({ date: timestampToLocalDate(l.timestamp), mood: v, source: "log", timestamp: l.timestamp });
  }
  entries.sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
  return entries;
}

// Per-day mood averages over a window; days without entries are null.
export function moodDailySeries(entries, { days = 30, now = new Date() } = {}) {
  const nowStr = localDateStr(now);
  const byDay = new Map();
  for (const e of entries) {
    if (!e.date) continue;
    const cur = byDay.get(e.date) || { sum: 0, n: 0 };
    cur.sum += e.mood; cur.n += 1;
    byDay.set(e.date, cur);
  }
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysStr(nowStr, -i);
    const agg = byDay.get(date);
    series.push({ date, mood: agg ? Math.round((agg.sum / agg.n) * 100) / 100 : null });
  }
  return series;
}

// Least-squares slope over the non-null days of a series.
export function moodTrend(series) {
  const pts = series.map((p, i) => ({ x: i, y: p.mood })).filter((p) => p.y != null);
  const n = pts.length;
  if (n === 0) return { avg: null, slope: 0, direction: "stable", n: 0 };
  const avg = pts.reduce((a, p) => a + p.y, 0) / n;
  if (n < 3) return { avg: Math.round(avg * 100) / 100, slope: 0, direction: "stable", n };
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = avg;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  const slope = den > 0 ? num / den : 0; // mood points per day
  const perWeek = slope * 7;
  const direction = perWeek > 0.15 ? "improving" : perWeek < -0.15 ? "declining" : "stable";
  return { avg: Math.round(avg * 100) / 100, slope: Math.round(slope * 1000) / 1000, direction, n };
}

// Daily series for one optional check-in dimension (energy/sleep/pain/anxiety).
export function dimensionSeries(checkins, dim, { days = 30, now = new Date() } = {}) {
  const entries = (checkins || [])
    .filter((c) => c[dim] != null)
    .map((c) => ({ date: timestampToLocalDate(c.timestamp), mood: Number(c[dim]), timestamp: c.timestamp }));
  return moodDailySeries(entries, { days, now });
}

// Signal for the behaviour engine: do low-mood days coincide with or precede
// above-average usage days? Returns a correlation-ish score in [-1, 1] where
// negative = more usage on/after low-mood days.
export function moodUsageCorrelation(moodSeries, usageByDate) {
  const pairs = [];
  for (let i = 0; i < moodSeries.length; i++) {
    const m = moodSeries[i];
    if (m.mood == null) continue;
    const sameDay = usageByDate.get(m.date) || 0;
    const nextDay = i + 1 < moodSeries.length ? (usageByDate.get(moodSeries[i + 1].date) || 0) : 0;
    // Same-day usage weighted fully, next-day half — captures "low mood day
    // followed by heavier use" without flattening alternating patterns.
    pairs.push({ mood: m.mood, usage: sameDay + 0.5 * nextDay });
  }
  if (pairs.length < 5) return { score: 0, n: pairs.length };
  const mm = pairs.reduce((a, p) => a + p.mood, 0) / pairs.length;
  const mu = pairs.reduce((a, p) => a + p.usage, 0) / pairs.length;
  let num = 0, dm = 0, du = 0;
  for (const p of pairs) {
    num += (p.mood - mm) * (p.usage - mu);
    dm += (p.mood - mm) ** 2; du += (p.usage - mu) ** 2;
  }
  const den = Math.sqrt(dm * du);
  return { score: den > 0 ? Math.round((num / den) * 100) / 100 : 0, n: pairs.length };
}
