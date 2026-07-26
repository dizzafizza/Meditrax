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

// The network boundary -- stub it so runDigest/generateDigest exercise real
// payload-building and prompt logic without an actual OpenRouter call.
jest.mock("../ai", () => {
  const actual = jest.requireActual("../ai");
  return { ...actual, completeText: jest.fn() };
});

import * as db from "../localdb";
import { completeText } from "../ai";
import { isDigestDue, runDigest, maybeRunDigest, sendDigestNow } from "../digest";

const DAY = 86400000;

describe("isDigestDue", () => {
  test("disabled is never due", () => {
    expect(isDigestDue({ enabled: false }, new Date())).toBe(false);
  });

  test("daily: due once the scheduled time has passed today and nothing sent since", () => {
    const now = new Date("2026-07-26T10:00:00");
    const digest = { enabled: true, frequency: "daily", time: "09:00" };
    expect(isDigestDue(digest, now)).toBe(true);
    expect(isDigestDue({ ...digest, time: "11:00" }, now)).toBe(false); // not yet today
  });

  test("daily: not due again the same day once sent", () => {
    const now = new Date("2026-07-26T10:00:00");
    const digest = { enabled: true, frequency: "daily", time: "09:00", last_generated_at: new Date("2026-07-26T09:05:00").toISOString() };
    expect(isDigestDue(digest, now)).toBe(false);
  });

  test("daily: due again the next day even if sent late the day before", () => {
    const now = new Date("2026-07-27T09:30:00");
    const digest = { enabled: true, frequency: "daily", time: "09:00", last_generated_at: new Date("2026-07-26T14:00:00").toISOString() }; // sent hours late yesterday
    expect(isDigestDue(digest, now)).toBe(true);
  });

  test("daily: a scheduled time missed entirely (app never opened) is caught up on the next open, however late", () => {
    const now = new Date("2026-07-30T23:00:00");
    const digest = { enabled: true, frequency: "daily", time: "09:00", last_generated_at: new Date("2026-07-26T09:00:00").toISOString() };
    expect(isDigestDue(digest, now)).toBe(true);
  });

  test("weekly: due once the configured weekday's time has arrived", () => {
    // 2026-07-27 is a Monday.
    const monMorning = new Date("2026-07-27T09:30:00");
    const monBeforeTime = new Date("2026-07-27T08:00:00");
    const digest = { enabled: true, frequency: "weekly", time: "09:00", weekday: "mon" };
    expect(isDigestDue(digest, monMorning)).toBe(true);
    expect(isDigestDue(digest, monBeforeTime)).toBe(false); // Monday, but 09:00 hasn't arrived yet
  });

  test("weekly: not due again until the following week's occurrence once sent", () => {
    const monMorning = new Date("2026-07-27T09:30:00");
    const digest = { enabled: true, frequency: "weekly", time: "09:00", weekday: "mon", last_generated_at: monMorning.toISOString() };
    const laterSameWeek = new Date("2026-07-30T09:30:00"); // Thursday, same week
    const nextMonday = new Date("2026-08-03T09:30:00");
    expect(isDigestDue(digest, laterSameWeek)).toBe(false);
    expect(isDigestDue(digest, nextMonday)).toBe(true);
  });

  test("weekly: a missed week is caught up whenever the app is next opened", () => {
    const digest = { enabled: true, frequency: "weekly", time: "09:00", weekday: "mon", last_generated_at: new Date("2026-07-06T09:00:00").toISOString() };
    const threeWeeksLater = new Date("2026-07-29T15:00:00"); // a Wednesday, weeks later
    expect(isDigestDue(digest, threeWeeksLater)).toBe(true);
  });
});

describe("runDigest / maybeRunDigest / sendDigestNow", () => {
  const daysAgoIso = (n) => new Date(Date.now() - n * DAY).toISOString();

  beforeEach(() => {
    completeText.mockReset();
    completeText.mockResolvedValue({ text: "## This week\nYou're doing great.", model: "mock/model" });
  });

  test("maybeRunDigest is a no-op with no API key, even if enabled and due", async () => {
    await db.updateAiConfig({ digest: { enabled: true, frequency: "daily", time: "00:00" } });
    const ran = await maybeRunDigest();
    expect(ran).toBe(false);
    expect(completeText).not.toHaveBeenCalled();
  });

  test("maybeRunDigest generates, delivers into the assistant chat, and stamps last_generated_at", async () => {
    await db.updateAiConfig({ apiKeys: { openrouter: "sk-test" }, digest: { enabled: true, frequency: "daily", time: "00:00" } });
    const ran = await maybeRunDigest();
    expect(ran).toBe(true);
    expect(completeText).toHaveBeenCalledTimes(1);
    const cfg = await db.getAiConfig();
    expect(cfg.digest.last_generated_at).toBeTruthy();

    // Delivered as an assistant message in the shared chat session (see lib/ai.js sessionId()).
    const sid = localStorage.getItem("meditrax-ai-session");
    const chat = await db.getChat(sid);
    expect(chat.some((m) => m.role === "assistant" && m.content.includes("doing great"))).toBe(true);

    // Not due again immediately after.
    completeText.mockClear();
    expect(await maybeRunDigest()).toBe(false);
    expect(completeText).not.toHaveBeenCalled();
  });

  test("a failed generation leaves last_generated_at untouched, so it's retried rather than skipped for the period", async () => {
    await db.updateAiConfig({ apiKeys: { openrouter: "sk-test" }, digest: { enabled: true, frequency: "daily", time: "00:00", last_generated_at: null } });
    completeText.mockRejectedValueOnce(new Error("network down"));
    expect(await maybeRunDigest()).toBe(false);
    const cfg = await db.getAiConfig();
    expect(cfg.digest.last_generated_at).toBeNull();
  });

  test("sendDigestNow bypasses the due-check but still stamps last_generated_at", async () => {
    const config = await db.updateAiConfig({ apiKeys: { openrouter: "sk-test" }, digest: { enabled: false } }); // disabled -- a manual test-send should still work
    const text = await sendDigestNow(config);
    expect(text).toContain("doing great");
    const cfg = await db.getAiConfig();
    expect(cfg.digest.last_generated_at).toBeTruthy();
  });

  test("runDigest's payload folds in active effects and tolerance alongside adherence/refills", async () => {
    const med = await db.createMedication({ name: "DigestMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    for (let i = 10; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 10, timestamp: daysAgoIso(i) });
    await db.startEffectSession({ medication_id: med.id, dose: 10 });

    const config = await db.getAiConfig();
    await runDigest({ config });
    const userMsg = completeText.mock.calls[0][0].user;
    const payload = JSON.parse(userMsg.slice(userMsg.indexOf("{")));
    expect(payload.active_effects.some((e) => e.medication === "DigestMed")).toBe(true);
    expect(payload.tolerance.some((t) => t.medication === "DigestMed" && t.band)).toBe(true);
  });

  test("a custom prompt is passed through to the model as an explicit focus instruction", async () => {
    const config = await db.getAiConfig();
    await runDigest({ config, customPrompt: "only talk about my sleep" });
    const { system, user } = completeText.mock.calls[0][0];
    expect(user).toMatch(/only talk about my sleep/);
    expect(system).toMatch(/never restate the raw tolerance level/i);
  });
});
