// Regression coverage for the "insufficient credits shown despite having
// credits" bug: OpenRouter pre-authorizes a request against max_tokens (or,
// if omitted, the model's maximum possible output) — so every request that
// goes out must carry an explicit, bounded max_tokens.
import { runAssistantLoop, mapOpenRouterError, resolveModelForTask, TASK_TIER_DEFAULTS } from "../ai";

function sseChunks(lines) {
  const body = lines.map((l) => `data: ${typeof l === "string" ? l : JSON.stringify(l)}\n\n`).join("") + "data: [DONE]\n\n";
  const bytes = new TextEncoder().encode(body);
  let sent = false;
  return {
    getReader: () => ({
      read: async () => {
        if (sent) return { done: true, value: undefined };
        sent = true;
        return { done: false, value: bytes };
      },
    }),
  };
}

function mockStreamingFetch(lines) {
  return jest.fn().mockResolvedValue({ ok: true, status: 200, body: sseChunks(lines) });
}

function mockErrorFetch(status, errorBody) {
  return jest.fn().mockResolvedValue({ ok: false, status, body: {}, json: async () => errorBody });
}

const CONFIG = { apiKeys: { openrouter: "sk-test" }, autoRoute: true, personality: {} };

describe("mapOpenRouterError", () => {
  test("402 includes provider detail and points to openrouter.ai", () => {
    const msg = mapOpenRouterError(402, { error: { message: "requires more credits, or fewer max_tokens" } });
    expect(msg).toMatch(/Insufficient OpenRouter credits/);
    expect(msg).toMatch(/requires more credits, or fewer max_tokens/);
    expect(msg).toMatch(/openrouter\.ai/);
  });

  test("429 includes provider detail", () => {
    const msg = mapOpenRouterError(429, { error: { message: "temporarily rate-limited" } });
    expect(msg).toMatch(/Rate limited/);
    expect(msg).toMatch(/temporarily rate-limited/);
  });

  test("401 and unknown codes still map sensibly", () => {
    expect(mapOpenRouterError(401, {})).toMatch(/Invalid API key/);
    expect(mapOpenRouterError(599, { error: { message: "weird" } })).toMatch(/weird/);
  });
});

describe("runAssistantLoop always sends a bounded max_tokens (the actual bug)", () => {
  afterEach(() => { delete global.fetch; });

  test("balanced verbosity (default) sends max_tokens, never omits it", async () => {
    global.fetch = mockStreamingFetch([{ choices: [{ delta: { content: "hi" }, finish_reason: "stop" }] }]);
    await runAssistantLoop({ config: CONFIG, messages: [{ role: "user", content: "hello" }], tools: [], executeTool: async () => ({}) });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.max_tokens).toBe(2048);
  });

  test("brief verbosity requests a smaller cap; detailed requests a larger one", async () => {
    global.fetch = mockStreamingFetch([{ choices: [{ delta: { content: "hi" }, finish_reason: "stop" }] }]);
    await runAssistantLoop({ config: { ...CONFIG, personality: { verbosity: "brief" } }, messages: [{ role: "user", content: "x" }], tools: [], executeTool: async () => ({}) });
    const briefBody = JSON.parse(global.fetch.mock.calls[0][1].body);

    global.fetch = mockStreamingFetch([{ choices: [{ delta: { content: "hi" }, finish_reason: "stop" }] }]);
    await runAssistantLoop({ config: { ...CONFIG, personality: { verbosity: "detailed" } }, messages: [{ role: "user", content: "x" }], tools: [], executeTool: async () => ({}) });
    const detailedBody = JSON.parse(global.fetch.mock.calls[0][1].body);

    expect(briefBody.max_tokens).toBeLessThan(detailedBody.max_tokens);
  });

  test("a genuine 402 (immediate HTTP rejection) still surfaces the friendly credits message", async () => {
    global.fetch = mockErrorFetch(402, { error: { message: "insufficient balance" } });
    await expect(
      runAssistantLoop({ config: CONFIG, messages: [{ role: "user", content: "hi" }], tools: [], executeTool: async () => ({}) })
    ).rejects.toThrow(/Insufficient OpenRouter credits/);
  });

  test("a mid-stream error chunk with a numeric code routes through the same friendly mapping", async () => {
    global.fetch = mockStreamingFetch([{ error: { message: "requires more credits", code: 402 } }]);
    await expect(
      runAssistantLoop({ config: CONFIG, messages: [{ role: "user", content: "hi" }], tools: [], executeTool: async () => ({}) })
    ).rejects.toThrow(/Insufficient OpenRouter credits/);
  });

  test("a mid-stream error chunk without a numeric code falls back to the raw message", async () => {
    global.fetch = mockStreamingFetch([{ error: { message: "some provider hiccup" } }]);
    await expect(
      runAssistantLoop({ config: CONFIG, messages: [{ role: "user", content: "hi" }], tools: [], executeTool: async () => ({}) })
    ).rejects.toThrow(/some provider hiccup/);
  });
});

describe("cost-tiered model routing", () => {
  test("light/standard tiers resolve to their configured defaults", () => {
    expect(resolveModelForTask(CONFIG, "light")).toBe(TASK_TIER_DEFAULTS.light);
    expect(resolveModelForTask(CONFIG, "standard")).toBe(TASK_TIER_DEFAULTS.standard);
  });

  test("chat tier defers to resolveModel (user's chosen/auto model)", () => {
    expect(resolveModelForTask(CONFIG, "chat")).toBe("openrouter/auto");
  });

  test("per-tier override in aiConfig.modelTiers wins over the default", () => {
    const cfg = { ...CONFIG, modelTiers: { light: "custom/model" } };
    expect(resolveModelForTask(cfg, "light")).toBe("custom/model");
  });
});
