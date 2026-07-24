import { sessionSummaryData, sessionSummaryText } from "../sessionSummary";

const start = "2026-07-24T20:00:00.000Z";
const plus = (min) => new Date(new Date(start).getTime() + min * 60000).toISOString();

const session = {
  medication_id: "m1",
  started_at: start,
  ended_at: plus(240),
  dose: 100,
  unit: "mg",
  redoses: [{ id: "r1", at: plus(90), amount: 50 }],
  events: [
    { id: "e1", kind: "onset", t: plus(30) },
    { id: "e2", kind: "intensity", t: plus(60), intensity: 6 },
    { id: "e3", kind: "peak", t: plus(75) },
    { id: "e4", kind: "intensity", t: plus(110), intensity: 8 },
    { id: "e5", kind: "wearing_off", t: plus(180) },
    { id: "e6", kind: "gone", t: plus(240) },
  ],
};
const med = { id: "m1", name: "MDMA", unit: "mg" };

describe("sessionSummaryData", () => {
  test("collects doses (primary + redose) with offsets and a cumulative total", () => {
    const d = sessionSummaryData(session, med);
    expect(d.name).toBe("MDMA");
    expect(d.doses).toHaveLength(2);
    expect(d.doses[0]).toMatchObject({ label: "Dose 1", amount: 100, offset: 0 });
    expect(d.doses[1]).toMatchObject({ label: "Redose 1", amount: 50, offset: 90 });
    expect(d.total).toBe(150);
    expect(d.redoseCount).toBe(1);
    expect(d.durationMin).toBe(240);
  });

  test("builds the feedback timeline in phase order and picks the max reported intensity", () => {
    const d = sessionSummaryData(session, med);
    expect(d.timeline.map((t) => t.kind)).toEqual(["onset", "peak", "wearing_off", "gone"]);
    expect(d.timeline.find((t) => t.kind === "onset").min).toBe(30);
    expect(d.maxIntensity).toBe(8);
  });

  test("handles a bare session (no redoses, no feedback, unknown dose)", () => {
    const d = sessionSummaryData({ started_at: start, dose: null, unit: "mg" }, null);
    expect(d.doses).toHaveLength(1);
    expect(d.doses[0].amount).toBe(null);
    expect(d.total).toBe(null); // no known amounts
    expect(d.timeline).toEqual([]);
    expect(d.maxIntensity).toBe(null);
    expect(d.durationMin).toBe(null); // not ended
    expect(d.name).toBe("Substance"); // fallback when no med
  });

  test("null session → null", () => {
    expect(sessionSummaryData(null)).toBe(null);
  });
});

describe("sessionSummaryText", () => {
  test("renders a shareable block with doses, timeline and the Meditrax footer", () => {
    const text = sessionSummaryText(session, med, { fmtClock: (iso) => iso });
    expect(text).toContain("MDMA — session summary");
    expect(text).toContain("Dose 1: 100 mg");
    expect(text).toContain("Redose 1: 50 mg (+1 h 30 m)");
    expect(text).toContain("Total: 150 mg");
    expect(text).toContain("Started feeling it: 30 min in");
    expect(text).toContain("Peak intensity reported: 8/10");
    expect(text).toMatch(/harm-reduction record/);
  });

  test("omits total and timeline sections when there's nothing to show", () => {
    const text = sessionSummaryText({ started_at: start, dose: null, unit: "" }, null, { fmtClock: (iso) => iso });
    expect(text).toContain("Dose 1: —");
    expect(text).not.toContain("Total:");
    expect(text).not.toContain("How it felt:");
  });

  test("empty for a null session", () => {
    expect(sessionSummaryText(null)).toBe("");
  });
});
