// Contextual "what could I ask?" chips shown above the assistant's message
// box on a blank conversation. Cheap (light-tier model) and cached by a
// hash of the context (see aiInsights.js's generateChatSuggestions), so
// opening the Assistant page repeatedly with nothing changed costs nothing
// after the first time. Falls back to a fixed, still-useful list if
// generation fails or hasn't resolved yet, so the box is never empty.
import { getMedications, getInventory, getTapers, getActiveEffectSessions, getMedicationTolerance } from "./localdb";
import { generateChatSuggestions } from "./aiInsights";
import { toleranceBand } from "./toleranceEngine";

export const FALLBACK_SUGGESTIONS = [
  "Add a new medication",
  "How do I taper safely?",
  "Summarize my adherence this month",
  "Any interactions I should watch for?",
];

async function buildContext() {
  const [meds, inventory, tapers, sessions] = await Promise.all([
    getMedications(), getInventory(), getTapers(), getActiveEffectSessions(),
  ]);
  const active = meds.filter((m) => m.is_active !== false);
  const tolerance = [];
  for (const m of active) {
    const t = await getMedicationTolerance(m.id);
    if (t) tolerance.push({ medication: m.name, band: toleranceBand(t.level).toLowerCase() });
  }
  return {
    medications: active.map((m) => ({ name: m.name, category: m.category, is_prn: !!m.is_prn })),
    active_effects: sessions.map((s) => s.medication_name),
    tolerance,
    active_tapers: tapers.filter((t) => t.is_active).map((t) => t.medication_name),
    refills_soon: inventory.filter((i) => i.status && i.status !== "ok").map((i) => i.name),
  };
}

export async function getChatSuggestions({ config, force = false } = {}) {
  try {
    const context = await buildContext();
    const suggestions = await generateChatSuggestions({ config, context, force });
    return suggestions.length ? suggestions : FALLBACK_SUGGESTIONS;
  } catch (e) {
    return FALLBACK_SUGGESTIONS;
  }
}
