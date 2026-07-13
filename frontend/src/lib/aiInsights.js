// AI insights — on-demand, cached narrative layer over the deterministic
// engines (predictor / behavior / moodAnalytics). The model NEVER computes
// risk itself; it only narrates numbers we hand it. Results are cached in
// localdb keyed by a hash of the payload, so repeat visits cost nothing and
// a Refresh with unchanged data is a cache hit.
import { completeJSON } from "./ai";
import { SAFETY_COPY } from "./behavior";
import { getInsight, saveInsight } from "./localdb";
import { localDateStr } from "./dates";

// Compact, number-first payload — no free-text notes (they stay on-device).
export function buildInsightsPayload({ analytics = null, inventory = [], behaviorReport = null, moodTrend = null, moodSeries = [], meds = [] }) {
  return {
    date: localDateStr(),
    adherence: analytics ? {
      overall_pct: analytics.overall_adherence,
      streak_days: analytics.current_streak,
      range_days: analytics.range_days,
      taken: analytics.total_taken,
      expected: analytics.total_expected,
      worst_meds: (analytics.per_medication || []).slice(0, 3).map((m) => ({ name: m.name, adherence_pct: m.adherence })),
    } : null,
    refills: inventory
      .filter((i) => i.days_left != null || i.status !== "ok")
      .map((i) => ({ name: i.name, days_left: i.days_left, run_out: i.run_out_date, refill_by: i.refill_by_date, status: i.status, method: i.method, confidence: i.confidence })),
    mood: moodTrend ? {
      avg: moodTrend.avg, direction: moodTrend.direction, entries: moodTrend.n,
      last14: moodSeries.slice(-14).map((p) => p.mood),
    } : null,
    behavior: behaviorReport ? behaviorReport.per_med.map((r) => ({
      name: r.name, level: r.level, score: r.score, data_quality: r.data_quality,
      dependency_risk_category: r.dependency_risk_category,
      signals: (r.signals || []).map((s) => ({ label: s.label, detail: s.detail })),
    })) : null,
    meds: meds.filter((m) => m.is_active !== false).map((m) => ({ name: m.name, prn: !!m.is_prn, tapering: !!m.is_tapering })),
  };
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

export async function hashPayload(payload) {
  const str = stableStringify(payload);
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) { /* fall through */ }
  // FNV-1a fallback (older WebViews / non-secure contexts)
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return "fnv-" + (h >>> 0).toString(16) + "-" + str.length;
}

const SYSTEM_PROMPT = [
  "You are the analytics narrator for Meditrax, a personal medication tracker.",
  "You receive PRE-COMPUTED statistics (adherence, refill predictions, mood trends, behaviour-pattern signals). Narrate them plainly; do not invent numbers, do not recompute, do not speculate beyond the data.",
  "SAFETY RULES (non-negotiable):",
  "- Educational information only, never diagnosis. Behaviour signals are 'patterns worth discussing with a prescriber', never 'addiction' or 'abuse'.",
  "- Never advise starting, stopping, or changing a dose. For concerning patterns, suggest talking to a prescriber or pharmacist.",
  "- Be warm, non-judgmental, and specific. Short sentences. No fear-mongering.",
  `- Keep this framing in mind: ${SAFETY_COPY.framing}`,
  'Respond ONLY with minified JSON: {"summary":string,"adherence":string[],"mood":string[],"refills":string[],"risk_observations":string[],"suggestions":[{"text":string,"link":string|null}]}.',
  'Each array: 0-3 short bullet strings; empty array if no data. "summary" is 1-2 sentences. "link" must be one of "/taper","/inventory","/insights","/effects","/knowledge" or null.',
].join("\n");

async function generate({ config, cacheKey, payload, force = false, signal }) {
  const hash = await hashPayload(payload);
  const cached = await getInsight(cacheKey);
  if (cached && cached.hash === hash && !force) return { ...cached.result, _cached: true, _generated_at: cached.generated_at, _model: cached.model };

  const { parsed, model } = await completeJSON({
    config, tier: "standard",
    system: SYSTEM_PROMPT,
    user: "Here is my current data. Narrate it:\n" + JSON.stringify(payload),
    temperature: 0.4, maxTokens: 1200, signal,
  });
  const result = {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    adherence: Array.isArray(parsed.adherence) ? parsed.adherence : [],
    mood: Array.isArray(parsed.mood) ? parsed.mood : [],
    refills: Array.isArray(parsed.refills) ? parsed.refills : [],
    risk_observations: Array.isArray(parsed.risk_observations) ? parsed.risk_observations : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter((s) => s && typeof s.text === "string") : [],
  };
  const generated_at = new Date().toISOString();
  await saveInsight(cacheKey, { hash, generated_at, model, result });
  return { ...result, _cached: false, _generated_at: generated_at, _model: model };
}

export async function generateOverviewInsights({ config, payload, force = false, signal }) {
  return generate({ config, cacheKey: "overview", payload, force, signal });
}

export async function generateMedicationInsights({ config, medicationId, payload, force = false, signal }) {
  return generate({ config, cacheKey: `med:${medicationId}`, payload, force, signal });
}

export async function getCachedOverview() {
  const cached = await getInsight("overview");
  return cached ? { ...cached.result, _cached: true, _generated_at: cached.generated_at, _model: cached.model } : null;
}
