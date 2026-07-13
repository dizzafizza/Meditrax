// Local-date helpers. All "day" bucketing in the app happens in the user's
// local timezone; timestamps remain UTC ISO instants.
//
// Rule: never call `new Date("YYYY-MM-DD")` (parses as UTC midnight) and never
// derive a calendar day via `toISOString().slice(0, 10)` (buckets in UTC).

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function pad2(n) { return String(n).padStart(2, "0"); }

// Date object (or now) -> local "YYYY-MM-DD"
export function localDateStr(d = new Date()) {
  const dt = d instanceof Date ? d : parseLocalDate(d);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

// "YYYY-MM-DD" -> Date at LOCAL midnight (never UTC parse).
export function parseLocalDate(dateStr) {
  if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date(dateStr); // last-resort fallback for unexpected input
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// ISO timestamp (UTC instant) -> local "YYYY-MM-DD" day bucket.
export function timestampToLocalDate(iso) {
  if (!iso) return "";
  return localDateStr(new Date(iso));
}

// mon..sun for a local date string or Date, Monday-first.
export function weekdayKeyLocal(date) {
  const d = date instanceof Date ? date : parseLocalDate(date);
  return WEEKDAYS[(d.getDay() + 6) % 7];
}

// Local-safe day arithmetic on "YYYY-MM-DD" strings.
export function addDaysStr(dateStr, n) {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

// Whole days from aStr to bStr (b - a), DST-safe via UTC noon anchoring.
export function diffDays(aStr, bStr) {
  const a = parseLocalDate(aStr);
  const b = parseLocalDate(bStr);
  const aMid = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bMid = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMid - aMid) / 86400000);
}
