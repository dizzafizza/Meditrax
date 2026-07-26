// OpenRouter client — browser-only. User-provided API key, no backend.
// Verified per OpenRouter docs: OpenAI-compatible /chat/completions, SSE streaming,
// tools/tool_choice with streamed delta.tool_calls, openrouter/auto routing.

import { localDateStr } from "./dates";

const OR_URL = "https://openrouter.ai/api/v1/chat/completions";
const OR_MODELS_URL = "https://openrouter.ai/api/v1/models";
// The tool surface has grown well past a single lookup-then-answer turn
// (resolve a medication, then check tolerance, then interactions, then
// preview a dose, then act) -- 5 iterations was tight enough that a
// multi-medication request could get cut off mid-chain with tool calls
// still pending. This only bounds a runaway loop; a normal exchange ends
// in 1-3 turns long before it matters.
const MAX_TOOL_ITERS = 10;

// A UI-only "tool" the model can call to ask the user something with a
// small set of tappable quick replies instead of free text. Unlike every
// other tool it isn't executed against app data at all: runAssistantLoop
// intercepts it by name below and ends the turn right there, since there's
// nothing to feed back yet -- the "result" is whatever the user taps next,
// which arrives as an ordinary new message on the *next* call to this
// function, not within this one.
export const ASK_USER_TOOL = "ask_user";
export const ASK_USER_TOOL_SCHEMA = {
  type: "function",
  function: {
    name: ASK_USER_TOOL,
    description: "Ask the user a question with a small set of quick-reply options they can tap instead of typing. Use this instead of asking in plain text whenever the question has a short, enumerable set of likely answers — confirming which medication or dose, a status (taken/skipped/partial), yes/no, picking among a few choices. Ends your turn; the user's tap (or their own typed answer) comes back as their next message. Don't use it for open-ended questions.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question to show" },
        options: { type: "array", items: { type: "string" }, description: "2-6 short tappable replies" },
      },
      required: ["question", "options"],
    },
  },
};

// The single chat thread the assistant reads/writes to, on this device --
// shared by the interactive Assistant page and the background digest (see
// digest.js) so a proactively-generated digest shows up as a message
// waiting in the same conversation, not a separate silo.
export function sessionId() {
  let s = localStorage.getItem("meditrax-ai-session");
  if (!s) {
    s = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    localStorage.setItem("meditrax-ai-session", s);
  }
  return s;
}

export const CURATED_MODELS = [
  { id: "openrouter/auto", label: "Auto — let OpenRouter choose" },
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5 · Anthropic" },
  { id: "anthropic/claude-opus-4.5", label: "Claude Opus 4.5 · Anthropic" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5 · Anthropic" },
  { id: "openai/gpt-5.1", label: "GPT-5.1 · OpenAI" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini · OpenAI" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro · Google" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash · Google" },
  { id: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B · Meta" },
];

function headers(apiKey) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://meditrax.ca",
    "X-Title": "Meditrax",
  };
}

export function mapOpenRouterError(status, body) {
  const detail = body?.error?.message || body?.message || "";
  switch (status) {
    case 400: return `Bad request${detail ? ": " + detail : ""}.`;
    case 401: return "Invalid API key. Check your OpenRouter key in Settings.";
    case 402: return `Insufficient OpenRouter credits${detail ? ": " + detail : ""}. Add credits at openrouter.ai.`;
    case 403: return "Request blocked (moderation or permissions).";
    case 408: return "Request timed out. Please try again.";
    case 429: return `Rate limited${detail ? ": " + detail : ""}. Slow down or try again shortly.`;
    case 502: return "Model provider error. Try a different model.";
    case 503: return "No available provider right now. Try again shortly.";
    default: return detail || `Request failed (HTTP ${status}).`;
  }
}

export function hasKey(config) {
  return !!(config?.apiKeys?.openrouter || "").trim();
}

export function resolveModel(config) {
  if (config?.autoRoute) return "openrouter/auto";
  return config?.model || "openrouter/auto";
}

// ---- cost-tiered model routing ----
// Cheap models handle structured extraction/classification; a mid-tier model
// writes insight narratives; chat uses whatever the user picked. Users can
// override each tier in Settings (aiConfig.modelTiers).
export const TASK_TIER_DEFAULTS = {
  light: "anthropic/claude-haiku-4.5",     // structured JSON, classification, short summaries
  standard: "anthropic/claude-sonnet-4.5", // insight narratives, nuanced analysis
  chat: null,                              // null → resolveModel(config)
};

export const TIER_LABELS = {
  light: "Light tasks (drug lookups, quick analysis)",
  standard: "Insight reports (mood, behaviour, refills)",
};

export function resolveModelForTask(config, tier = "chat") {
  if (tier === "chat" || !TASK_TIER_DEFAULTS[tier]) return resolveModel(config);
  return config?.modelTiers?.[tier] || TASK_TIER_DEFAULTS[tier];
}

// One-shot JSON completion for non-chat tasks. Non-streaming, cheap-by-default.
export async function completeJSON({ config, tier = "light", system, user, temperature = 0.3, maxTokens = 1500, signal }) {
  const apiKey = (config?.apiKeys?.openrouter || "").trim();
  if (!apiKey) throw new Error("No OpenRouter API key set. Add one in Settings.");
  const model = resolveModelForTask(config, tier);
  let resp;
  try {
    resp = await fetch(OR_URL, {
      method: "POST", headers: headers(apiKey), signal,
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature, max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new Error("Network error reaching OpenRouter. Check your connection.");
  }
  if (!resp.ok) { let j = null; try { j = await resp.json(); } catch (e) { /* ignore */ } throw new Error(mapOpenRouterError(resp.status, j)); }
  const data = await resp.json();
  let text = data?.choices?.[0]?.message?.content || "";
  text = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { throw new Error("AI returned an unreadable response. Please try again."); }
  return { parsed, model: data?.model || model };
}

// One-shot plain-text completion — same shape as completeJSON but for
// prose (the periodic digest; anything that isn't structured extraction).
// Non-streaming: this runs in the background with no UI to stream into.
export async function completeText({ config, tier = "standard", system, user, temperature = 0.5, maxTokens = 1200, signal }) {
  const apiKey = (config?.apiKeys?.openrouter || "").trim();
  if (!apiKey) throw new Error("No OpenRouter API key set. Add one in Settings.");
  const model = resolveModelForTask(config, tier);
  let resp;
  try {
    resp = await fetch(OR_URL, {
      method: "POST", headers: headers(apiKey), signal,
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature, max_tokens: maxTokens }),
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new Error("Network error reaching OpenRouter. Check your connection.");
  }
  if (!resp.ok) { let j = null; try { j = await resp.json(); } catch (e) { /* ignore */ } throw new Error(mapOpenRouterError(resp.status, j)); }
  const data = await resp.json();
  const text = (data?.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("AI returned an empty response. Please try again.");
  return { text, model: data?.model || model };
}

// ---- one streaming round-trip ----
async function streamOnce({ apiKey, model, messages, tools, toolChoice, temperature = 0.5, maxTokens = 2048, signal, onDelta, webAccess = false }) {
  // IMPORTANT: always send an explicit max_tokens. When omitted, OpenRouter
  // pre-authorizes the request against the model's maximum possible output
  // length (which can be 60k-200k+ tokens for some models) rather than what
  // the reply will actually use — so it can reject with "insufficient
  // credits" even when the account has plenty of balance for a normal-length
  // reply. Bounding max_tokens keeps that pre-flight cost estimate realistic.
  const body = { model, messages, stream: true, temperature, max_tokens: maxTokens };
  if (tools && tools.length) { body.tools = tools; body.tool_choice = toolChoice || "auto"; }
  // OpenRouter's web plugin: a real internet search the model can draw on
  // (e.g. a recent recall, current guidance) alongside the app's own tools,
  // gated by the user's own toggle in Settings since it costs extra per call.
  if (webAccess) body.plugins = [{ id: "web", max_results: 3 }];

  let resp;
  try {
    resp = await fetch(OR_URL, { method: "POST", headers: headers(apiKey), body: JSON.stringify(body), signal });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new Error("Network error reaching OpenRouter. Check your connection.");
  }
  if (!resp.ok || !resp.body) {
    let j = null; try { j = await resp.json(); } catch (e) { /* ignore */ }
    throw new Error(mapOpenRouterError(resp.status, j));
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let content = "";
  let modelUsed = null;
  let finishReason = null;
  const toolAcc = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith(":")) continue; // keepalive / comment
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") { finishReason = finishReason || "stop"; continue; }
      let chunk;
      try { chunk = JSON.parse(data); } catch (e) { continue; }
      if (chunk.error) {
        const code = Number(chunk.error.code);
        throw new Error(code ? mapOpenRouterError(code, { error: chunk.error }) : (chunk.error.message || "Streaming error"));
      }
      if (chunk.model && !modelUsed) modelUsed = chunk.model;
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      if (delta.content) { content += delta.content; onDelta?.(delta.content); }
      if (delta.tool_calls) {
        for (const t of delta.tool_calls) {
          const idx = t.index ?? 0;
          const cur = toolAcc[idx] || (toolAcc[idx] = { id: t.id || `call_${idx}`, type: "function", function: { name: "", arguments: "" } });
          if (t.id) cur.id = t.id;
          if (t.function?.name) cur.function.name = t.function.name;
          if (t.function?.arguments) cur.function.arguments += t.function.arguments;
        }
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }

  const toolCalls = Object.keys(toolAcc)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => toolAcc[k])
    .filter((c) => c.function.name);
  return { content, toolCalls, finishReason, model: modelUsed };
}

// Bound the per-turn response length by the user's verbosity preference —
// keeps OpenRouter's cost pre-check realistic (see streamOnce) while still
// giving "detailed" responses enough room.
function maxTokensForConfig(config) {
  const v = config?.personality?.verbosity;
  if (v === "brief") return 1024;
  if (v === "detailed") return 4096;
  return 2048; // balanced (default)
}

// ---- multi-turn tool-calling loop with streaming ----
export async function runAssistantLoop({ config, messages, tools, executeTool, onDelta, onEvent, signal }) {
  const apiKey = (config?.apiKeys?.openrouter || "").trim();
  if (!apiKey) throw new Error("No OpenRouter API key set. Add one in Settings.");
  const model = resolveModel(config);
  const useTools = !!(tools && tools.length && config?.advanced !== false);
  const maxTokens = maxTokensForConfig(config);

  const working = [...messages];
  let finalContent = "";

  for (let iter = 0; iter < MAX_TOOL_ITERS; iter++) {
    const { content, toolCalls, model: usedModel } = await streamOnce({
      apiKey, model, messages: working,
      tools: useTools ? tools : undefined,
      maxTokens, onDelta, signal, webAccess: !!config?.webAccess,
    });
    if (usedModel) onEvent?.({ type: "model", model: usedModel });

    const assistantMsg = { role: "assistant", content: content || "" };
    if (toolCalls.length) assistantMsg.tool_calls = toolCalls;
    working.push(assistantMsg);
    if (content) finalContent = content;

    if (!toolCalls.length) break;

    const askCall = toolCalls.find((tc) => tc.function.name === ASK_USER_TOOL);
    for (const tc of toolCalls) {
      if (tc === askCall) continue; // handled after the loop, not run as a data tool
      let args = {};
      try { args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}; } catch (e) { args = {}; }
      onEvent?.({ type: "tool_start", name: tc.function.name, args });
      let result;
      try { result = await executeTool(tc.function.name, args); }
      catch (e) { result = { error: String(e?.message || e) }; }
      onEvent?.({ type: "tool_end", name: tc.function.name, result });
      working.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result ?? { ok: true }) });
    }

    if (askCall) {
      let args = {};
      try { args = askCall.function.arguments ? JSON.parse(askCall.function.arguments) : {}; } catch (e) { args = {}; }
      // Every tool_call on an assistant message needs a matching tool
      // result before the next assistant turn, per the API's own contract
      // -- there's no real result yet, so this is a placeholder that only
      // matters for a *later*, separate runAssistantLoop call whose
      // priorHistory includes this exchange.
      working.push({ role: "tool", tool_call_id: askCall.id, content: JSON.stringify({ presented: true }) });
      const question = String(args.question || "").trim();
      const options = Array.isArray(args.options) ? args.options.filter((o) => typeof o === "string" && o.trim()).slice(0, 6) : [];
      onEvent?.({ type: "ask_user", question, options });
      const combined = [finalContent, question].filter(Boolean).join("\n\n");
      return { messages: working, content: combined, quickReplies: options };
    }
  }

  return { messages: working, content: finalContent };
}

// ---- system prompt builder ----
export function buildSystemPrompt({ personality = {}, context = {}, toolsEnabled = false, webAccess = false }) {
  const p = personality;
  const warmth = Number(p.warmth ?? 70);
  const tone = warmth > 66 ? "warm, encouraging and human" : warmth > 33 ? "balanced and clear" : "concise and matter-of-fact";
  const verbosity = p.verbosity === "brief"
    ? "Keep answers short — 1 to 3 sentences when possible."
    : p.verbosity === "detailed"
      ? "Give thorough, well-structured answers."
      : "Use a balanced length.";
  const personaLine = {
    supportive: "You are a supportive companion who helps the user stay on track with their medications.",
    clinical: "You communicate like a careful clinical pharmacist: precise, evidence-aware and cautious.",
    friend: "You talk like a caring, down-to-earth friend.",
    coach: "You are an encouraging health coach who celebrates small wins.",
    concise: "You are a no-nonsense assistant that gets straight to the point.",
  }[p.persona || "supportive"];

  const lines = [
    `You are ${p.name || "Meditrax"}, the in-app assistant for the Meditrax medication tracker.`,
    personaLine,
    `Tone: ${tone}. ${verbosity}`,
    p.emoji ? "You may use a few tasteful emojis." : "Do not use emojis.",
    "Format answers in clean Markdown (short headings, bullet lists, **bold**) when it improves clarity.",
    "SAFETY: You provide educational information only and are NOT a substitute for professional medical advice. Never tell a user to abruptly stop or change a prescribed medication — advise consulting a clinician or pharmacist. Add a brief caution whenever giving dosing or tapering guidance.",
  ];
  if (toolsEnabled) {
    lines.push(
      "You can DIRECTLY operate this app using the provided tools: switch/create profiles, change the theme, add/update/delete medications, log doses (optionally starting effects tracking on that dose via track_effects), add a redose to a running effects session, adjust an active taper's pace/target/method, log mood check-ins, create taper plans, and navigate between pages. You can also READ computed analytics: get_refill_prediction (run-out/refill-by dates), get_behavior_analysis (usage-pattern signals — always relay these as educational patterns to discuss with a prescriber, never as a diagnosis), get_mood_trends, get_today, get_inventory, get_analytics, get_active_effects (live effects-tracker sessions), get_medication_tolerance, get_dose_effect_preview, check_interactions (works for a hypothetical substance the user hasn't tracked yet, not just their own medications) and research_substance (reference info for anything in the knowledge base, tracked or not — use this before a user's first dose of something new). When the user asks you to do something in the app, CALL the appropriate tool and then confirm what you did in plain language. Resolve a medication by name with list_medications first when needed. Prefer doing the action with a tool over telling the user to do it manually.",
      "BE AGENTIC: chain read-only tool calls yourself without narrating each step or asking permission in between — e.g. for \"is it safe to combine X and Y\", resolve both and call check_interactions directly; for \"how's my tolerance across everything\", call list_medications then get_medication_tolerance for each one that applies; for a taper request, look at get_today/list_medications first if the specifics aren't given. Only pause to ask when a WRITE action (logging, creating, deleting, adjusting a plan) is ambiguous about which medication or what values, or when it's meaningfully irreversible (delete_medication, a large taper adjustment). Reads never need confirmation.",
      "When you DO need to ask the user something with a short, enumerable set of likely answers — which medication they meant, taken vs. skipped vs. partial, yes/no, picking among a few doses or options — call ask_user with that question and 2-6 short options instead of asking in a plain sentence. Reserve plain-text questions for genuinely open-ended ones (how are you feeling, what would you like to focus on).",
      "TOLERANCE: when a tool reports tolerance, state it exactly as given (a plain-language band plus roughly how much weaker doses land, e.g. 'high tolerance — doses land about 50% weaker'). Never repeat the raw 0-100 level as if it were itself a percentage reduction in effect — that's a common misreading the app's own UI used to make and has since corrected everywhere tolerance is shown."
    );
  }
  if (webAccess) lines.push("You also have live web search (the 'web' plugin) for anything outside the app's own data — recent recalls, current guidance, news. Use it when the user asks about something time-sensitive or unfamiliar; app data always takes priority for anything about this user's own history.");
  if (p.customInstructions) lines.push(`User's custom instructions: ${p.customInstructions}`);
  if (context.profileName) lines.push(`Active profile: ${context.profileName}.`);
  if (context.medsSummary) lines.push(`Current medications for this profile: ${context.medsSummary}`);
  if (context.todaySummary) lines.push(`Today's status: ${context.todaySummary}`);
  lines.push(`Today's date is ${localDateStr()}.`);
  return lines.join("\n");
}

// ---- structured medication research (knowledge base autofill) ----
export async function autofillMedicationAI(name, config) {
  const sys = "You are a clinical drug-information assistant. Return ONLY valid minified JSON (no markdown, no code fences) describing the requested medication.";
  const schema = '{"name":string,"generic_name":string,"brand_names":string[],"street_names":string[],"drug_class":string,"category":one of ["antidepressant","benzodiazepine","opioid","stimulant","stimulant-fast","nsaid","antibiotic","sleep-aid","antihypertensive","diabetes","statin","ppi","antihistamine","thyroid","anticonvulsant","supplement","antipsychotic","muscle-relaxant","psychedelic","empathogen","dissociative","cannabis","depressant","other"],"default_unit":string,"common_dosages":number[],"typical_dosing":string,"max_daily_dose":number|null,"common_side_effects":string[],"serious_side_effects":string[],"interactions":string[],"warnings":string[],"risk_level":one of ["minimal","low","moderate","high"],"dependency_risk_category":one of ["none","low","moderate","high","extreme"],"mechanism":string,"half_life":string,"content":string}';
  // Structured extraction — the "light" (cheapest) model tier is plenty.
  const { parsed } = await completeJSON({
    config, tier: "light", system: sys, temperature: 0.2,
    user: `Provide accurate information for "${name}", which may be a prescription/OTC medication or a recreational/psychoactive substance. Respond with JSON exactly matching this schema: ${schema}. Use "street_names" for common slang names of recreational substances (leave empty for conventional medications). "content" should be a 2-3 sentence plain-language summary, and for recreational substances should include a harm-reduction framing (key risks, dangerous combinations) rather than encouragement to use. If "${name}" is not a real medication or substance, respond with {"error":"not_found"}.`,
  });
  if (parsed.error === "not_found" || !parsed.name) throw new Error(`Couldn't find reliable information for "${name}".`);

  parsed.common_dosages = Array.isArray(parsed.common_dosages) ? parsed.common_dosages.map(Number).filter((x) => !isNaN(x)) : [];
  ["brand_names", "street_names", "common_side_effects", "serious_side_effects", "interactions", "warnings"].forEach((k) => { if (!Array.isArray(parsed[k])) parsed[k] = []; });
  if (parsed.max_daily_dose != null && isNaN(Number(parsed.max_daily_dose))) parsed.max_daily_dose = null;
  return parsed;
}

// ---- optional: full model list for picker ----
export async function listModels(apiKey) {
  const key = (apiKey || "").trim();
  if (!key) throw new Error("Enter an API key first.");
  const resp = await fetch(OR_MODELS_URL, { headers: { Authorization: `Bearer ${key}` } });
  if (!resp.ok) throw new Error(mapOpenRouterError(resp.status));
  const data = await resp.json();
  return (data?.data || []).map((m) => ({ id: m.id, label: m.name || m.id }));
}

// ---- quick connectivity test ----
export async function testConnection(config) {
  const apiKey = (config?.apiKeys?.openrouter || "").trim();
  if (!apiKey) throw new Error("Enter an API key first.");
  const model = resolveModel(config);
  const resp = await fetch(OR_URL, {
    method: "POST", headers: headers(apiKey),
    body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with the single word: OK" }], max_tokens: 5 }),
  });
  if (!resp.ok) { let j = null; try { j = await resp.json(); } catch (e) { /* ignore */ } throw new Error(mapOpenRouterError(resp.status, j)); }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "OK";
}
