// Usage-frequency stats — pure, storage-free. How often each medication was
// actually taken over recent windows, so frequent use (which changes
// tolerance and dependency risk in ways single doses don't show) is visible
// at a glance on the Insights page.

import { localDateStr, addDaysStr, timestampToLocalDate } from "./dates";

const CONSUMING = new Set(["taken", "partial"]);

// Returns per-medication counts of consuming logs over the last 7 and 30 days
// (plus the prior 7 for a week-over-week trend), most-used first. Only
// medications used at least once in the last 30 days are included.
export function usageFrequency(logs = [], meds = [], { now = new Date() } = {}) {
  const nowStr = localDateStr(now);
  const in7 = new Set(), prev7 = new Set(), in30 = new Set();
  for (let i = 0; i < 7; i++) in7.add(addDaysStr(nowStr, -i));
  for (let i = 7; i < 14; i++) prev7.add(addDaysStr(nowStr, -i));
  for (let i = 0; i < 30; i++) in30.add(addDaysStr(nowStr, -i));

  const rows = meds.map((m) => {
    let week = 0, prevWeek = 0, month = 0, lastUsed = null;
    for (const l of logs) {
      if (l.medication_id !== m.id || !CONSUMING.has(l.status)) continue;
      const d = timestampToLocalDate(l.timestamp);
      if (in30.has(d)) month++;
      if (in7.has(d)) week++;
      else if (prev7.has(d)) prevWeek++;
      if (!lastUsed || l.timestamp > lastUsed) lastUsed = l.timestamp;
    }
    const trend = week > prevWeek ? "up" : week < prevWeek ? "down" : "flat";
    const dep = m.dependency_risk_category || "none";
    const flagged = ["moderate", "high", "extreme"].includes(dep) || m.risk_level === "high";
    return {
      id: m.id, name: m.name, color: m.color, week, prevWeek, month, lastUsed, trend,
      flagged, dependency_risk_category: dep, is_prn: !!m.is_prn,
    };
  }).filter((r) => r.month > 0);

  rows.sort((a, b) => b.month - a.month || b.week - a.week || a.name.localeCompare(b.name));
  return rows;
}
