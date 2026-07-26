// Compatibility layer.
// The app's pages/components import data helpers from "@/lib/api".
// In the static offline-first build, all data lives client-side (localdb / IndexedDB)
// and AI calls go directly to OpenRouter from the browser. There is NO backend.

export * from "./localdb";

import * as db from "./localdb";
import { autofillMedicationAI } from "./ai";
import { sendTestNotification } from "./push";

// Retained for any legacy references; not used at runtime.
export const BACKEND_URL = "";
export const API_BASE = "";

// AI knowledge-base autofill (client-side via OpenRouter, then persisted locally).
export async function autofillMedication(name) {
  const config = await db.getAiConfig();
  const data = await autofillMedicationAI(name, config);
  const saved = await db.saveCatalogEntry({ ...data, source: "ai" });
  return { medication: saved };
}

// Legacy AI session helpers — the Assistant now persists chat locally via localdb.
// Kept as safe stubs so any stale imports don't break. (Suggestions are now
// real and contextual -- see lib/chatSuggestions.js.)
export const getAiMessages = async () => [];
export const clearAiMessages = async () => ({ cleared: true });

// Local notification test (replaces the old server push test).
export async function testPush(payload = {}) {
  const ok = await sendTestNotification(payload.title, payload.body);
  return { sent: ok ? 1 : 0 };
}
