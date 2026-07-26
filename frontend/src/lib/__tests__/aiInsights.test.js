jest.mock("localforage", () => {
  const stores = new Map();
  return {
    createInstance: () => ({
      getItem: async (k) => (stores.has(k) ? stores.get(k) : null),
      setItem: async (k, v) => { stores.set(k, v); return v; },
      removeItem: async (k) => { stores.delete(k); },
    }),
  };
});

jest.mock("../ai", () => {
  const actual = jest.requireActual("../ai");
  return { ...actual, completeJSON: jest.fn() };
});

import { buildInsightsPayload, hashPayload, generateChatSuggestions } from "../aiInsights";
import { completeJSON } from "../ai";

describe("hashPayload", () => {
  test("stable across key order", async () => {
    const a = await hashPayload({ x: 1, y: [1, 2], z: { b: 2, a: 1 } });
    const b = await hashPayload({ z: { a: 1, b: 2 }, y: [1, 2], x: 1 });
    expect(a).toBe(b);
  });

  test("changes when data changes", async () => {
    const a = await hashPayload({ x: 1 });
    const b = await hashPayload({ x: 2 });
    expect(a).not.toBe(b);
  });
});

describe("buildInsightsPayload", () => {
  test("compacts inputs and excludes free-text notes", () => {
    const p = buildInsightsPayload({
      analytics: { overall_adherence: 92, current_streak: 4, range_days: 30, total_taken: 55, total_expected: 60, per_medication: [{ name: "A", adherence: 80 }] },
      inventory: [
        { name: "A", days_left: 5, run_out_date: "2026-07-17", refill_by_date: "2026-07-14", status: "low", method: "blended", confidence: "high" },
        { name: "B", days_left: 90, run_out_date: "2026-10-10", refill_by_date: "2026-10-07", status: "ok", method: "scheduled", confidence: "medium" },
      ],
      behaviorReport: { per_med: [{ name: "A", level: "watch", score: 30, data_quality: "good", dependency_risk_category: "high", signals: [{ label: "x", detail: "d", evidence: { secret: true } }] }] },
      moodTrend: { avg: 3.4, direction: "stable", n: 12 },
      moodSeries: Array.from({ length: 20 }, (_, i) => ({ date: `d${i}`, mood: 3 })),
      meds: [{ name: "A", is_prn: true, is_active: true }, { name: "Old", is_active: false }],
    });
    expect(p.adherence.overall_pct).toBe(92);
    expect(p.refills).toHaveLength(2); // B has days_left so it's included
    expect(p.mood.last14).toHaveLength(14);
    expect(p.behavior[0].signals[0]).toEqual({ label: "x", detail: "d" }); // evidence stripped
    expect(p.meds).toHaveLength(1); // inactive excluded
    expect(JSON.stringify(p)).not.toMatch(/notes/i);
  });
});

describe("generateChatSuggestions", () => {
  const config = { apiKeys: { openrouter: "sk-test" } };

  beforeEach(() => {
    completeJSON.mockReset();
    completeJSON.mockResolvedValue({ parsed: { suggestions: ["How's my kratom tolerance?", "Log Sertraline as taken", "Summarize my week", "Any interactions to watch?"] } });
  });

  test("returns up to 4 string suggestions from the model", async () => {
    const result = await generateChatSuggestions({ config, context: { _case: "basic", medications: [{ name: "Kratom" }] } });
    expect(result).toHaveLength(4);
    expect(result[0]).toMatch(/tolerance/i);
  });

  test("filters out non-string entries and caps at 4", async () => {
    completeJSON.mockResolvedValue({ parsed: { suggestions: ["a", 2, "b", "c", "d", "e"] } });
    const result = await generateChatSuggestions({ config, context: { _case: "filters" } });
    expect(result).toEqual(["a", "b", "c", "d"]);
  });

  test("a malformed response (no suggestions array) yields an empty list rather than throwing", async () => {
    completeJSON.mockResolvedValue({ parsed: {} });
    const result = await generateChatSuggestions({ config, context: { _case: "malformed" } });
    expect(result).toEqual([]);
  });

  test("caches by context hash -- an unchanged context doesn't call the model again", async () => {
    const context = { _case: "cache-hit", medications: [{ name: "Kratom" }] };
    await generateChatSuggestions({ config, context });
    completeJSON.mockClear();
    const second = await generateChatSuggestions({ config, context });
    expect(completeJSON).not.toHaveBeenCalled();
    expect(second).toHaveLength(4);
  });

  test("a changed context regenerates", async () => {
    await generateChatSuggestions({ config, context: { _case: "changed", medications: [] } });
    completeJSON.mockClear();
    await generateChatSuggestions({ config, context: { _case: "changed", medications: [{ name: "Oxy" }] } });
    expect(completeJSON).toHaveBeenCalledTimes(1);
  });

  test("force bypasses the cache even for an unchanged context", async () => {
    const context = { _case: "force", medications: [] };
    await generateChatSuggestions({ config, context });
    completeJSON.mockClear();
    await generateChatSuggestions({ config, context, force: true });
    expect(completeJSON).toHaveBeenCalledTimes(1);
  });
});
