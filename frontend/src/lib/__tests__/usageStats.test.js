import { usageFrequency } from "../usageStats";

// Fixed "now" so day-window math is deterministic.
const NOW = new Date("2026-07-24T12:00:00");
const daysAgo = (n, h = 9) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};
const log = (medication_id, ts, status = "taken") => ({ medication_id, timestamp: ts, status });

const meds = [
  { id: "a", name: "Xanax", color: "#111", dependency_risk_category: "extreme", risk_level: "high", is_prn: true },
  { id: "b", name: "Vitamin D", color: "#222", dependency_risk_category: "none", risk_level: "minimal", is_prn: false },
  { id: "c", name: "NeverUsed", color: "#333", dependency_risk_category: "none", risk_level: "low" },
];

describe("usageFrequency", () => {
  test("counts consuming logs in the 7- and 30-day windows, most-used first", () => {
    const logs = [
      // Xanax: 3 this week, 2 the prior week → 5 in 30 days
      log("a", daysAgo(0)), log("a", daysAgo(2)), log("a", daysAgo(5)),
      log("a", daysAgo(8)), log("a", daysAgo(12)),
      // Vitamin D: 1 this week only
      log("b", daysAgo(1)),
    ];
    const rows = usageFrequency(logs, meds, { now: NOW });
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]); // NeverUsed excluded (0 in window), Xanax first (more uses)
    const x = rows.find((r) => r.id === "a");
    expect(x.week).toBe(3);
    expect(x.prevWeek).toBe(2);
    expect(x.month).toBe(5);
    expect(x.trend).toBe("up"); // 3 this week > 2 prior
    expect(x.flagged).toBe(true); // extreme dependency
  });

  test("non-consuming logs (skipped/missed) and out-of-window logs don't count", () => {
    const logs = [
      log("b", daysAgo(1), "skipped"),
      log("b", daysAgo(2), "missed"),
      log("b", daysAgo(40)), // outside 30-day window
    ];
    expect(usageFrequency(logs, meds, { now: NOW })).toEqual([]); // nothing counts → no rows
  });

  test("trend is 'down' when this week is quieter than the prior week, 'flat' when equal", () => {
    const down = usageFrequency([log("b", daysAgo(8)), log("b", daysAgo(9)), log("b", daysAgo(1))], meds, { now: NOW });
    expect(down[0].trend).toBe("down"); // 1 this week < 2 prior
    const flat = usageFrequency([log("b", daysAgo(1)), log("b", daysAgo(8))], meds, { now: NOW });
    expect(flat[0].trend).toBe("flat"); // 1 == 1
  });

  test("a day exactly on the 7/30 boundary lands in the right bucket", () => {
    // day index 6 = still 'this week' (0..6); day 7 = prior week; day 29 = still in month; day 30 = out
    const logs = [log("b", daysAgo(6)), log("b", daysAgo(7)), log("b", daysAgo(29)), log("b", daysAgo(30))];
    const r = usageFrequency(logs, meds, { now: NOW })[0];
    expect(r.week).toBe(1);   // day 6
    expect(r.prevWeek).toBe(1); // day 7
    expect(r.month).toBe(3);  // days 6, 7, 29 (not 30)
  });
});
