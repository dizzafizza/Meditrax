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

import { buildInsightsPayload, hashPayload } from "../aiInsights";

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
