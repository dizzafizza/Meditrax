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

jest.mock("../aiInsights", () => {
  const actual = jest.requireActual("../aiInsights");
  return { ...actual, generateChatSuggestions: jest.fn() };
});

import * as db from "../localdb";
import { generateChatSuggestions } from "../aiInsights";
import { getChatSuggestions, FALLBACK_SUGGESTIONS } from "../chatSuggestions";

describe("getChatSuggestions", () => {
  const config = { apiKeys: { openrouter: "sk-test" } };

  beforeEach(() => {
    generateChatSuggestions.mockReset();
    generateChatSuggestions.mockResolvedValue(["How's my kratom tolerance?"]);
  });

  test("returns the model's suggestions on success", async () => {
    const result = await getChatSuggestions({ config });
    expect(result).toEqual(["How's my kratom tolerance?"]);
  });

  test("falls back to the fixed list if generation returns nothing", async () => {
    generateChatSuggestions.mockResolvedValue([]);
    expect(await getChatSuggestions({ config })).toEqual(FALLBACK_SUGGESTIONS);
  });

  test("falls back to the fixed list if generation throws (no key, network error, etc.)", async () => {
    generateChatSuggestions.mockRejectedValue(new Error("no key"));
    expect(await getChatSuggestions({ config })).toEqual(FALLBACK_SUGGESTIONS);
  });

  test("the context handed to the generator reflects real app state -- medications, active effects, and tolerance", async () => {
    const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString();
    const med = await db.createMedication({ name: "ChatSuggestMed", strength: 10, unit: "mg", category: "opioid", form: "tablet", times: [], is_prn: true });
    for (let i = 10; i >= 1; i--) await db.createLog({ medication_id: med.id, status: "taken", dose_taken: 10, timestamp: daysAgoIso(i) });
    await db.startEffectSession({ medication_id: med.id, dose: 10 });

    await getChatSuggestions({ config });
    const context = generateChatSuggestions.mock.calls[0][0].context;
    expect(context.medications.some((m) => m.name === "ChatSuggestMed")).toBe(true);
    expect(context.active_effects).toContain("ChatSuggestMed");
    expect(context.tolerance.some((t) => t.medication === "ChatSuggestMed" && t.band)).toBe(true);
  });
});
