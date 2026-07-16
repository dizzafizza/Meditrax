import { format, parseISO, isToday, isYesterday, differenceInMinutes } from "date-fns";

export const MED_COLORS = [
  "#2A767B", "#3E8E7E", "#E08A3C", "#3E7CB1", "#C2553B",
  "#7A6FB0", "#B0436F", "#5B8C5A", "#C9A227", "#4B6584",
];

export const CATEGORY_LABELS = {
  antidepressant: "Antidepressant", benzodiazepine: "Benzodiazepine", opioid: "Opioid",
  stimulant: "Stimulant", nsaid: "NSAID", antibiotic: "Antibiotic", "sleep-aid": "Sleep aid",
  antihypertensive: "Blood pressure", diabetes: "Diabetes", statin: "Statin", ppi: "Acid reducer",
  antihistamine: "Antihistamine", thyroid: "Thyroid", anticonvulsant: "Anticonvulsant",
  supplement: "Supplement", antipsychotic: "Antipsychotic", "muscle-relaxant": "Muscle relaxant", other: "Other",
};

export const FREQUENCY_LABELS = {
  once_daily: "Once daily", twice_daily: "Twice daily", three_times_daily: "3x daily",
  four_times_daily: "4x daily", every_other_day: "Every other day", weekly: "Weekly",
  as_needed: "As needed", custom: "Custom",
};

export const FREQUENCY_TIMES = {
  once_daily: ["09:00"], twice_daily: ["09:00", "21:00"],
  three_times_daily: ["08:00", "14:00", "20:00"],
  four_times_daily: ["08:00", "12:00", "16:00", "20:00"],
  every_other_day: ["09:00"], weekly: ["09:00"], as_needed: [], custom: ["09:00"],
};

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const WEEKDAY_LABELS = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export function riskTone(level) {
  if (level === "high") return "high";
  if (level === "moderate") return "medium";
  if (level === "minimal" || level === "low") return "low";
  return "low";
}

export function depTone(cat) {
  if (cat === "extreme" || cat === "high") return "high";
  if (cat === "moderate") return "medium";
  if (cat === "low") return "low";
  return null;
}

export function fmtTime12(hhmm, use24 = false) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  if (use24) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function timeOfDay(hhmm) {
  if (!hhmm) return "Anytime";
  const h = Number(hhmm.split(":")[0]);
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  if (h < 21) return "Evening";
  return "Night";
}

export function fmtDate(iso, fmt = "MMM d, yyyy") {
  if (!iso) return "";
  try { return format(typeof iso === "string" ? parseISO(iso) : iso, fmt); } catch { return ""; }
}

export function relativeTime(iso) {
  if (!iso) return "";
  try {
    const d = parseISO(iso);
    if (isToday(d)) return `Today, ${format(d, "h:mm a")}`;
    if (isYesterday(d)) return `Yesterday, ${format(d, "h:mm a")}`;
    return format(d, "MMM d, h:mm a");
  } catch { return ""; }
}

export function doseLabel(strength, unit) {
  if (strength === null || strength === undefined || strength === "") return unit || "";
  return `${strength}${unit ? " " + unit : ""}`;
}

// ISO timestamp (or Date, or nothing = now) -> local "YYYY-MM-DDTHH:mm" for
// <input type="datetime-local">. The reverse is just `new Date(value)` —
// datetime strings (unlike date-only strings) parse in local time.
export function toDatetimeLocal(iso) {
  const d = iso ? (iso instanceof Date ? iso : new Date(iso)) : new Date();
  if (isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
