// Regression coverage for the "insufficient credits shown despite having
// credits" bug: OpenRouter pre-authorizes a request against max_tokens (or,
// if omitted, the model's maximum possible output) — so every request that
// goes out must carry an explicit, bounded max_tokens.
import { runAssistantLoop, mapOpenRouterError, resolveModelForTask, TASK_TIER_DEFAULTS, completeText, buildSystemPrompt, sessionId, ASK_USER_TOOL, ASK_USER_TOOL_SCHEMA } from "../ai";

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

describe("web access", () => {
  afterEach(() => { delete global.fetch; });

  test("the 'web' plugin is only sent when the user's webAccess toggle is on", async () => {
    global.fetch = mockStreamingFetch([{ choices: [{ delta: { content: "hi" }, finish_reason: "stop" }] }]);
    await runAssistantLoop({ config: CONFIG, messages: [{ role: "user", content: "x" }], tools: [], executeTool: async () => ({}) });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).plugins).toBeUndefined();

    global.fetch = mockStreamingFetch([{ choices: [{ delta: { content: "hi" }, finish_reason: "stop" }] }]);
    await runAssistantLoop({ config: { ...CONFIG, webAccess: true }, messages: [{ role: "user", content: "x" }], tools: [], executeTool: async () => ({}) });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).plugins).toEqual([{ id: "web", max_results: 3 }]);
  });

  test("buildSystemPrompt only mentions web search when webAccess is passed", () => {
    expect(buildSystemPrompt({ toolsEnabled: true, webAccess: false })).not.toMatch(/web search/i);
    expect(buildSystemPrompt({ toolsEnabled: true, webAccess: true })).toMatch(/web search/i);
  });
});

describe("completeText (plain-text completion, e.g. the periodic digest)", () => {
  afterEach(() => { delete global.fetch; });

  test("returns the model's raw text, non-streamed", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ model: "mock/model", choices: [{ message: { content: "Here is your summary." } }] }) });
    const { text, model } = await completeText({ config: CONFIG, system: "sys", user: "user" });
    expect(text).toBe("Here is your summary.");
    expect(model).toBe("mock/model");
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.stream).toBeUndefined(); // non-streaming, unlike the chat loop
    expect(body.max_tokens).toBeGreaterThan(0);
  });

  test("an empty completion is treated as a failure worth retrying, not a blank result", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: "" } }] }) });
    await expect(completeText({ config: CONFIG, system: "sys", user: "user" })).rejects.toThrow(/empty/i);
  });

  test("requires an API key, same as the rest of the client", async () => {
    await expect(completeText({ config: {}, system: "sys", user: "user" })).rejects.toThrow(/API key/);
  });
});

describe("MAX_TOOL_ITERS headroom for chained tool calls", () => {
  afterEach(() => { delete global.fetch; });

  test("a model that keeps calling tools runs well past the old 5-iteration cap before stopping", async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, body: sseChunks([{ choices: [{ delta: { tool_calls: [{ index: 0, id: "c", function: { name: "noop", arguments: "{}" } }] }, finish_reason: "tool_calls" }] }]) })
    );
    await runAssistantLoop({
      config: CONFIG, messages: [{ role: "user", content: "keep going" }],
      tools: [{ type: "function", function: { name: "noop", parameters: { type: "object", properties: {} } } }],
      executeTool: async () => ({ ok: true }),
    });
    expect(global.fetch.mock.calls.length).toBeGreaterThan(5);
  });
});

describe("ask_user (interactive quick-reply questions)", () => {
  afterEach(() => { delete global.fetch; });

  const toolCallResponse = (calls) => ({
    choices: [{ delta: { tool_calls: calls.map((c, i) => ({ index: i, id: c.id, function: { name: c.name, arguments: JSON.stringify(c.args) } })) }, finish_reason: "tool_calls" }],
  });

  test("ends the turn, returns quickReplies, and never calls executeTool for it", async () => {
    global.fetch = mockStreamingFetch([toolCallResponse([{ id: "c1", name: ASK_USER_TOOL, args: { question: "Which medication?", options: ["Kratom", "Oxy"] } }])]);
    const executeTool = jest.fn().mockResolvedValue({ ok: true });
    const events = [];
    const result = await runAssistantLoop({
      config: CONFIG, messages: [{ role: "user", content: "log a dose" }],
      tools: [ASK_USER_TOOL_SCHEMA], executeTool,
      onEvent: (e) => events.push(e),
    });
    expect(executeTool).not.toHaveBeenCalled();
    expect(result.content).toBe("Which medication?");
    expect(result.quickReplies).toEqual(["Kratom", "Oxy"]);
    expect(global.fetch).toHaveBeenCalledTimes(1); // one round only -- the turn ends here
    expect(events.find((e) => e.type === "ask_user")).toEqual({ type: "ask_user", question: "Which medication?", options: ["Kratom", "Oxy"] });

    // Every tool_call needs a matching tool-role result before the next
    // assistant turn, per the API's own contract -- even though there's
    // nothing real to report back yet.
    const toolMsg = result.messages.find((m) => m.role === "tool" && m.tool_call_id === "c1");
    expect(toolMsg).toBeTruthy();
  });

  test("options are capped at 6 and non-string entries are dropped", async () => {
    global.fetch = mockStreamingFetch([toolCallResponse([{ id: "c1", name: ASK_USER_TOOL, args: { question: "Pick one", options: ["a", "b", 3, "c", "d", "e", "f", "g"] } }])]);
    const result = await runAssistantLoop({ config: CONFIG, messages: [{ role: "user", content: "x" }], tools: [ASK_USER_TOOL_SCHEMA], executeTool: jest.fn() });
    expect(result.quickReplies).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  test("a real tool called alongside ask_user in the same batch still executes normally", async () => {
    global.fetch = mockStreamingFetch([toolCallResponse([
      { id: "c1", name: "get_today", args: {} },
      { id: "c2", name: ASK_USER_TOOL, args: { question: "Log it now?", options: ["Yes", "No"] } },
    ])]);
    const executeTool = jest.fn().mockResolvedValue({ summary: { taken: 1 } });
    const result = await runAssistantLoop({
      config: CONFIG, messages: [{ role: "user", content: "x" }],
      tools: [ASK_USER_TOOL_SCHEMA], executeTool,
    });
    expect(executeTool).toHaveBeenCalledWith("get_today", {});
    expect(result.messages.find((m) => m.tool_call_id === "c1").content).toContain("taken");
    expect(result.quickReplies).toEqual(["Yes", "No"]);
  });
});

describe("sessionId", () => {
  test("persists the same id across calls, works without a global crypto (e.g. non-secure/test contexts)", () => {
    localStorage.removeItem("meditrax-ai-session");
    const realCrypto = global.crypto;
    // eslint-disable-next-line no-global-assign
    delete global.crypto;
    const a = sessionId();
    const b = sessionId();
    expect(a).toBe(b);
    expect(a).toBeTruthy();
    global.crypto = realCrypto;
  });
});
