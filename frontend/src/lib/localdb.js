// Meditrax local-first data layer (IndexedDB via localforage).
// Profile-scoped collections + catalog + settings + AI config + computed views.
import localforage from "localforage";
import { CATALOG_SEED } from "./catalogSeed";
import { generateTaperSchedule, taperDoseOnDate, suggestTaperParams } from "./taperEngine";
import { personalizedProfile, observationsFromSession, updateModel, sessionDoseStack, sessionTotalDose, stackChartEnd, doseIntensityAt, phaseAt, modeledEffectiveness, modelConfidence, doseResponse, doseResponseFor, intensityAt, mealFactorsFor, MEAL_STATES, observedMealFactors, updateMealModel, baselineObservations, isOralForm } from "./effectsEngine";
import { estimateTolerance, toleranceBand } from "./toleranceEngine";
import { localDateStr, addDaysStr, diffDays, timestampToLocalDate, weekdayKeyLocal } from "./dates";
import { doseQuantity, predictRunOut, inventoryStatus, taperState, pillsFromAmount } from "./predictor";
import { interactionsWith } from "./interactions";

const store = localforage.createInstance({ name: "meditrax", storeName: "meditrax_v1" });

// Bump whenever CATALOG_SEED changes so existing installs pick up new/updated
// curated entries. The catalog is seeded once on first run; without this,
// users who installed an earlier version would never see later additions.
const CATALOG_SEED_VERSION = 3;

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const PROFILE_COLORS = ["#2A767B", "#E08A3C", "#7A6FB0", "#3E7CB1", "#B0436F", "#5B8C5A"];
// Every profile-scoped collection. Referenced by deleteProfile / export / import
// so new collections can't be forgotten in one of the three places.
export const PROFILE_COLLECTIONS = ["medications", "logs", "reminders", "tapers", "cyclic", "chat", "checkins", "insights", "effectSessions", "effectModels", "effectVersions", "mealModels"];

export function uid() {
  return (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2));
}
export function nowIso() { return new Date().toISOString(); }
// Local calendar day (was UTC — wrong "today" near midnight for non-UTC users).
function todayStr() { return localDateStr(); }

async function getArr(key) { return (await store.getItem(key)) || []; }
async function setArr(key, val) { await store.setItem(key, val); return val; }

// ---- init / profiles ----
let _activeId = null;
let _initPromise = null;

const DEFAULT_AI_CONFIG = {
  provider: "openrouter",
  apiKeys: { openrouter: "", anthropic: "", gemini: "" },
  model: "openrouter/auto",
  autoRoute: true,
  webAccess: false,
  advanced: true,
  // Per-task-tier model overrides; null = recommended default (see ai.js TASK_TIER_DEFAULTS)
  modelTiers: { light: null, standard: null },
  personality: {
    name: "Meditrax",
    persona: "supportive",          // supportive | clinical | friend | coach | concise
    warmth: 70,                      // 0-100
    verbosity: "balanced",          // brief | balanced | detailed
    emoji: false,
    customInstructions: "",
  },
  // Periodic AI-written summary, delivered as a proactive message in the
  // assistant chat (plus a local notification) -- checked best-effort
  // whenever the app is opened/foregrounded, same as reminders, since there
  // is no server to run this on a real clock. See lib/digest.js.
  digest: {
    enabled: false,
    frequency: "weekly",   // daily | weekly
    time: "09:00",          // local HH:MM
    weekday: "mon",         // used when frequency is weekly
    customPrompt: "",       // e.g. "focus on my sleep and mood, skip adherence"
    last_generated_at: null,
  },
};

const DEFAULT_SETTINGS = {
  theme: "system", time_format: "12h",
  notifications: { enabled: true, lead_minutes: 0 },
  quiet_hours: { enabled: false, start: "22:00", end: "07:00" },
  refill_threshold_days: 7,
  refill_lead_days: 3,
  seen_dose_effect_intro: false,
};

async function ensureInit() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    let profiles = await store.getItem("profiles");
    if (!profiles || !profiles.length) {
      const id = uid();
      profiles = [{ id, name: "Me", color: PROFILE_COLORS[0], date_of_birth: null, allergies: [], conditions: [], emergency_contact: null, created_at: nowIso() }];
      await store.setItem("profiles", profiles);
      await store.setItem("activeProfileId", id);
    }
    _activeId = (await store.getItem("activeProfileId")) || profiles[0].id;
    if (!profiles.find((p) => p.id === _activeId)) { _activeId = profiles[0].id; await store.setItem("activeProfileId", _activeId); }

    const catalog = await store.getItem("catalog");
    if (!catalog || !catalog.length) {
      const seeded = CATALOG_SEED.map((c) => ({ ...c, id: uid(), name_lower: c.name.toLowerCase(), source: c.source || "curated", created_at: nowIso() }));
      await store.setItem("catalog", seeded);
      await store.setItem("catalogSeedVersion", CATALOG_SEED_VERSION);
    } else {
      await reconcileCatalogSeed();
    }
    if (!(await store.getItem("appSettings"))) await store.setItem("appSettings", DEFAULT_SETTINGS);
    if (!(await store.getItem("aiConfig"))) await store.setItem("aiConfig", DEFAULT_AI_CONFIG);
    await autoReconcileInventoryOnce();
  })();
  return _initPromise;
}

function pkey(coll) { return `p:${_activeId}:${coll}`; }

export async function listProfiles() { await ensureInit(); return await getArr("profiles"); }
export async function getActiveProfileId() { await ensureInit(); return _activeId; }
export async function setActiveProfile(id) {
  await ensureInit();
  const profiles = await getArr("profiles");
  if (profiles.find((p) => p.id === id)) {
    _activeId = id;
    await store.setItem("activeProfileId", id);
    await autoReconcileInventoryOnce(); // no-op once this profile has already been checked
  }
  return _activeId;
}
export async function createProfile(data) {
  await ensureInit();
  const profiles = await getArr("profiles");
  const prof = { id: uid(), name: data.name || "New profile", color: data.color || PROFILE_COLORS[profiles.length % PROFILE_COLORS.length], date_of_birth: data.date_of_birth || null, allergies: data.allergies || [], conditions: data.conditions || [], emergency_contact: data.emergency_contact || null, created_at: nowIso() };
  profiles.push(prof);
  await setArr("profiles", profiles);
  return prof;
}
export async function updateProfileById(id, patch) {
  await ensureInit();
  const profiles = await getArr("profiles");
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Profile not found");
  profiles[idx] = { ...profiles[idx], ...patch, id, updated_at: nowIso() };
  await setArr("profiles", profiles);
  return profiles[idx];
}
export async function deleteProfile(id) {
  await ensureInit();
  let profiles = await getArr("profiles");
  if (profiles.length <= 1) throw new Error("At least one profile is required");
  profiles = profiles.filter((p) => p.id !== id);
  await setArr("profiles", profiles);
  for (const coll of PROFILE_COLLECTIONS) await store.removeItem(`p:${id}:${coll}`);
  if (_activeId === id) { _activeId = profiles[0].id; await store.setItem("activeProfileId", _activeId); }
  return { deleted: true };
}

// ---- settings / ai config ----
export async function getSettings() { await ensureInit(); return { ...DEFAULT_SETTINGS, ...((await store.getItem("appSettings")) || {}) }; }
export async function updateSettings(patch) { await ensureInit(); const s = await getSettings(); const merged = { ...s, ...patch }; await store.setItem("appSettings", merged); return merged; }
export async function getAiConfig() { await ensureInit(); const c = (await store.getItem("aiConfig")) || {}; return { ...DEFAULT_AI_CONFIG, ...c, apiKeys: { ...DEFAULT_AI_CONFIG.apiKeys, ...(c.apiKeys || {}) }, personality: { ...DEFAULT_AI_CONFIG.personality, ...(c.personality || {}) }, modelTiers: { ...DEFAULT_AI_CONFIG.modelTiers, ...(c.modelTiers || {}) }, digest: { ...DEFAULT_AI_CONFIG.digest, ...(c.digest || {}) } }; }
export async function updateAiConfig(patch) { await ensureInit(); const c = await getAiConfig(); const merged = { ...c, ...patch, apiKeys: { ...c.apiKeys, ...(patch.apiKeys || {}) }, personality: { ...c.personality, ...(patch.personality || {}) }, modelTiers: { ...c.modelTiers, ...(patch.modelTiers || {}) }, digest: { ...c.digest, ...(patch.digest || {}) } }; await store.setItem("aiConfig", merged); return merged; }

// ---- profile (active) ----
export async function getProfile() { await ensureInit(); const profiles = await getArr("profiles"); return profiles.find((p) => p.id === _activeId); }
export async function updateProfile(patch) { await ensureInit(); return updateProfileById(_activeId, patch); }

// ---- catalog / knowledge ----
// Merge the shipped CATALOG_SEED into an already-seeded catalog so existing
// installs pick up new and updated curated entries. Idempotent and safe:
//  • adds any seed entry the user doesn't have yet (matched by name);
//  • refreshes entries that are still "curated" (curated entries are never
//    user-editable, so a still-curated match hasn't been touched — refreshing
//    propagates content fixes while preserving the entry's id, so knowledge
//    links and any medication.catalog_id references stay valid);
//  • never touches "ai"/user-sourced entries, or entries not in the seed.
// Uses the raw store (not ensureInit) so it can run from inside ensureInit
// without re-entrancy. Public callers should go through reconcileCatalogSeed().
async function reconcileCatalogSeedUnsafe() {
  if ((await store.getItem("catalogSeedVersion")) === CATALOG_SEED_VERSION) return { changed: false, added: 0 };
  const catalog = (await store.getItem("catalog")) || [];
  const byName = new Map(catalog.map((d) => [d.name_lower, d]));
  let changed = false, added = 0;
  for (const c of CATALOG_SEED) {
    const nl = c.name.toLowerCase();
    const existing = byName.get(nl);
    if (!existing) {
      catalog.push({ ...c, id: uid(), name_lower: nl, source: c.source || "curated", created_at: nowIso() });
      changed = true; added++;
    } else if ((existing.source || "curated") === "curated") {
      const refreshed = { ...c, id: existing.id, name_lower: nl, source: c.source || "curated", created_at: existing.created_at || nowIso() };
      if (JSON.stringify(refreshed) !== JSON.stringify(existing)) {
        catalog[catalog.findIndex((d) => d.id === existing.id)] = refreshed;
        changed = true;
      }
    }
  }
  if (changed) await store.setItem("catalog", catalog);
  await store.setItem("catalogSeedVersion", CATALOG_SEED_VERSION);
  return { changed, added };
}
async function reconcileCatalogSeed() { return reconcileCatalogSeedUnsafe(); }

function scoreDoc(d, terms) {
  const hay = `${d.name} ${d.generic_name || ""} ${(d.brand_names || []).join(" ")} ${(d.street_names || []).join(" ")} ${d.drug_class || ""} ${d.category || ""} ${d.content || ""}`.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (!t) continue;
    if (d.name_lower?.startsWith(t)) score += 12;
    if (d.name_lower?.includes(t)) score += 8;
    if ((d.generic_name || "").toLowerCase().includes(t)) score += 6;
    if ((d.brand_names || []).some((b) => b.toLowerCase().includes(t))) score += 6;
    if ((d.street_names || []).some((b) => b.toLowerCase().includes(t))) score += 6;
    if ((d.drug_class || "").toLowerCase().includes(t)) score += 3;
    if (hay.includes(t)) score += 1;
  }
  return score;
}
export async function searchCatalog(q, limit = 20) {
  await ensureInit();
  const catalog = await getArr("catalog");
  if (!q || !q.trim()) return [...catalog].sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return catalog.map((d) => ({ d, s: scoreDoc(d, terms) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.d);
}
export async function getKnowledge(q = "", category = "all") {
  await ensureInit();
  let catalog = await getArr("catalog");
  if (category && category !== "all") catalog = catalog.filter((d) => d.category === category);
  if (q && q.trim()) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return catalog.map((d) => ({ d, s: scoreDoc(d, terms) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.d);
  }
  return [...catalog].sort((a, b) => a.name.localeCompare(b.name));
}
export async function getKnowledgeCategories() { await ensureInit(); const c = await getArr("catalog"); return [...new Set(c.map((d) => d.category).filter(Boolean))].sort(); }
export async function getKnowledgeItem(id) { await ensureInit(); return (await getArr("catalog")).find((d) => d.id === id); }
export async function findCatalogByName(name) { await ensureInit(); return (await getArr("catalog")).find((d) => d.name_lower === name.trim().toLowerCase()); }
export async function saveCatalogEntry(data) {
  await ensureInit();
  const catalog = await getArr("catalog");
  const entry = { ...data, id: data.id || uid(), name_lower: (data.name || "").toLowerCase(), source: data.source || "ai", created_at: nowIso() };
  const idx = catalog.findIndex((d) => d.name_lower === entry.name_lower);
  if (idx >= 0) { catalog[idx] = { ...catalog[idx], ...entry, id: catalog[idx].id }; } else catalog.push(entry);
  await setArr("catalog", catalog);
  return idx >= 0 ? catalog[idx] : entry;
}

// ---- medications ----
export async function getMedications() { await ensureInit(); return (await getArr(pkey("medications"))).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")); }
export async function getMedication(id) {
  await ensureInit();
  const med = (await getArr(pkey("medications"))).find((m) => m.id === id);
  if (!med) throw new Error("Medication not found");
  const tapers = await getArr(pkey("tapers"));
  const cyclic = await getArr(pkey("cyclic"));
  return { ...med, active_taper: tapers.find((t) => t.medication_id === id && t.is_active) || null, active_cyclic: cyclic.find((c) => c.medication_id === id && c.is_active) || null };
}
export async function createMedication(data) {
  await ensureInit();
  const meds = await getArr(pkey("medications"));
  const doc = { ...data, id: uid(), created_at: nowIso(), updated_at: nowIso(), start_date: data.start_date || todayStr(), is_active: data.is_active !== false };
  if (doc.dose_quantity == null) doc.dose_quantity = Number(doc.inventory?.units_per_dose || 1);
  meds.push(doc);
  await setArr(pkey("medications"), meds);
  return doc;
}
export async function updateMedication(id, data) {
  await ensureInit();
  const meds = await getArr(pkey("medications"));
  const idx = meds.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error("Medication not found");
  meds[idx] = { ...meds[idx], ...data, id, updated_at: nowIso() };
  await setArr(pkey("medications"), meds);
  return meds[idx];
}
export async function deleteMedication(id) {
  await ensureInit();
  for (const coll of ["medications", "logs", "reminders", "tapers", "cyclic", "effectSessions", "effectModels", "effectVersions"]) {
    let arr = await getArr(pkey(coll));
    arr = coll === "medications" ? arr.filter((x) => x.id !== id) : arr.filter((x) => x.medication_id !== id);
    await setArr(pkey(coll), arr);
  }
  return { deleted: true };
}
export async function adjustInventory(id, payload) {
  const meds = await getArr(pkey("medications"));
  const idx = meds.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error("Medication not found");
  const inv = meds[idx].inventory || { current_count: 0, unit: "tablets", units_per_dose: 1, refill_threshold: 10 };
  if (payload.set != null) inv.current_count = Number(payload.set);
  else if (payload.delta != null) inv.current_count = Math.max(0, Number(inv.current_count || 0) + Number(payload.delta));
  ["unit", "units_per_dose", "refill_threshold"].forEach((k) => { if (k in payload) inv[k] = payload[k]; });
  if ("units_per_dose" in payload) meds[idx].dose_quantity = Number(payload.units_per_dose) || 1;
  inv.last_updated = nowIso();
  meds[idx].inventory = inv; meds[idx].updated_at = nowIso();
  await setArr(pkey("medications"), meds);
  return inv;
}

// ---- logs ----
// delta > 0 consumes stock, delta < 0 restores it. Returns the amount actually
// applied (consumption is clamped to available stock so a later undo or edit
// restores exactly what was taken out, never more).
function applyStockDelta(med, delta) {
  if (!med?.inventory || !delta) return 0;
  const count = Number(med.inventory.current_count || 0);
  const applied = delta > 0 ? Math.min(delta, count) : delta;
  med.inventory.current_count = Math.max(0, count - applied);
  med.inventory.last_updated = nowIso();
  return applied;
}
const LOG_CONSUMING_STATUSES = ["taken", "partial"];
function logConsumption(log) {
  return LOG_CONSUMING_STATUSES.includes(log.status) ? Math.max(0, Number(log.quantity || 0)) : 0;
}

// ---- inventory reconciliation ----
// Self-heals a historical bug: editing the "Total amount" field in the log
// sheet didn't update the pill count inventory decrements by, so any dose
// logged above the medication's default pill count under-decremented stock.
// Recomputes each consuming log's pill quantity from its recorded dose_taken
// and the medication's current strength, and applies the shortfall (or
// excess) to stock. Idempotent — once a log's quantity matches what
// dose_taken implies, re-running finds nothing left to fix.
// Internal — assumes ensureInit() has already resolved. Split out so the
// auto-heal hook inside ensureInit() itself can call this directly instead
// of re-entering ensureInit() (which would deadlock: it would await the very
// _initPromise it's currently running inside of).
async function reconcileMedicationInventoryUnsafe(medication_id) {
  const meds = await getArr(pkey("medications"));
  const med = meds.find((m) => m.id === medication_id);
  if (!med || !med.inventory || !(Number(med.strength) > 0)) return { fixed: 0, delta: 0 };
  const logs = await getArr(pkey("logs"));
  let totalDelta = 0, fixedCount = 0;
  logs.forEach((log) => {
    if (log.medication_id !== medication_id) return;
    if (!LOG_CONSUMING_STATUSES.includes(log.status)) return;
    if (log.dose_taken == null) return;
    if (log.unit && med.unit && log.unit !== med.unit) return; // unit changed since — can't safely infer
    const expected = pillsFromAmount(log.dose_taken, med.strength);
    if (expected == null) return;
    const recorded = Number(log.quantity || 0);
    const diff = Math.round((expected - recorded) * 4) / 4;
    if (Math.abs(diff) < 0.01) return; // already matches
    const applied = applyStockDelta(med, diff);
    log.quantity = expected;
    log.inventory_delta = Math.round((Number(log.inventory_delta || 0) + applied) * 100) / 100;
    log.updated_at = nowIso();
    totalDelta += applied;
    fixedCount++;
  });
  if (fixedCount > 0) {
    await setArr(pkey("logs"), logs);
    await setArr(pkey("medications"), meds);
  }
  return { fixed: fixedCount, delta: Math.round(totalDelta * 100) / 100 };
}
export async function reconcileMedicationInventory(medication_id) {
  await ensureInit();
  return reconcileMedicationInventoryUnsafe(medication_id);
}

async function reconcileAllInventoryUnsafe() {
  const meds = await getArr(pkey("medications"));
  const results = [];
  for (const med of meds) {
    if (!med.inventory) continue;
    const r = await reconcileMedicationInventoryUnsafe(med.id);
    if (r.fixed > 0) results.push({ medication_id: med.id, name: med.name, unit: med.inventory.unit, ...r });
  }
  return results;
}
// Runs reconciliation across every inventory-tracked medication for the
// active profile. Safe to call repeatedly — a no-op once everything matches.
export async function reconcileAllInventory() {
  await ensureInit();
  return reconcileAllInventoryUnsafe();
}

// Runs the fix at most once per profile (flagged in storage), so returning
// users self-heal automatically the first time inventory data is touched
// without repeating the log scan on every load.
async function autoReconcileInventoryOnce() {
  const key = pkey("inventoryReconciledV1");
  if (await store.getItem(key)) return null;
  const results = await reconcileAllInventoryUnsafe();
  await store.setItem(key, true);
  return results;
}

export async function getLogs(params = {}) {
  await ensureInit();
  let logs = await getArr(pkey("logs"));
  if (params.medication_id) logs = logs.filter((l) => l.medication_id === params.medication_id);
  if (params.start) logs = logs.filter((l) => timestampToLocalDate(l.timestamp) >= params.start);
  if (params.end) logs = logs.filter((l) => timestampToLocalDate(l.timestamp) <= params.end);
  logs.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return params.limit ? logs.slice(0, params.limit) : logs;
}
export async function createLog(data) {
  await ensureInit();
  const meds = await getArr(pkey("medications"));
  const med = meds.find((m) => m.id === data.medication_id);
  if (!med) throw new Error("Medication not found");
  const logs = await getArr(pkey("logs"));
  const doc = { ...data, id: uid(), timestamp: data.timestamp || nowIso(), created_at: nowIso(), unit: data.unit || med.unit || "mg", side_effects: data.side_effects || [] };
  const decrement = doc.decrement_inventory !== false;
  delete doc.decrement_inventory;

  // Units (pills) actually consumed by this log.
  const perDose = doseQuantity(med);
  let quantity = doc.quantity != null && isFinite(Number(doc.quantity)) ? Math.max(0, Number(doc.quantity)) : (doc.status === "partial" ? perDose / 2 : perDose);
  doc.quantity = quantity;

  const consumes = LOG_CONSUMING_STATUSES.includes(doc.status);
  const wanted = decrement && consumes && med.inventory ? quantity : 0;

  // Dedup guard: a second log for the same med + scheduled slot + local day
  // updates the existing entry instead of double-logging/double-decrementing.
  let existing = null;
  if (doc.scheduled_time) {
    const day = timestampToLocalDate(doc.timestamp);
    existing = logs.find((l) => l.medication_id === doc.medication_id && l.scheduled_time === doc.scheduled_time && timestampToLocalDate(l.timestamp) === day);
  }

  let saved;
  if (existing) {
    const prevDelta = Number(existing.inventory_delta || 0);
    const appliedNet = applyStockDelta(med, wanted - prevDelta);
    saved = { ...existing, ...doc, id: existing.id, created_at: existing.created_at, inventory_delta: prevDelta + appliedNet, updated_at: nowIso() };
    logs[logs.findIndex((l) => l.id === existing.id)] = saved;
  } else {
    doc.inventory_delta = applyStockDelta(med, wanted);
    logs.push(doc);
    saved = doc;
  }
  await setArr(pkey("logs"), logs);
  if (med.inventory) await setArr(pkey("medications"), meds);
  return existing ? { ...saved, deduped: true } : saved;
}
export async function getLog(id) {
  await ensureInit();
  return (await getArr(pkey("logs"))).find((l) => l.id === id) || null;
}
export async function updateLog(id, patch) {
  await ensureInit();
  const logs = await getArr(pkey("logs"));
  const idx = logs.findIndex((l) => l.id === id);
  if (idx === -1) throw new Error("Log not found");
  const log = logs[idx];
  const meds = await getArr(pkey("medications"));
  const med = meds.find((m) => m.id === log.medication_id);

  const next = { ...log };
  ["status", "notes", "mood", "effectiveness", "dose_taken", "unit", "side_effects"].forEach((k) => { if (k in patch) next[k] = patch[k]; });
  if ("quantity" in patch) {
    const q = Number(patch.quantity);
    if (!isFinite(q) || q < 0) throw new Error("quantity must be a non-negative number");
    next.quantity = q;
  }
  if ("timestamp" in patch) {
    const d = new Date(patch.timestamp);
    if (!patch.timestamp || isNaN(d.getTime())) throw new Error("Invalid timestamp");
    next.timestamp = d.toISOString();
  }

  // Moving a scheduled dose onto a day that already holds a log for the same
  // slot would create a duplicate the createLog dedup guard can never merge.
  if (next.scheduled_time && next.timestamp !== log.timestamp) {
    const day = timestampToLocalDate(next.timestamp);
    const clash = logs.find((l) => l.id !== id && l.medication_id === log.medication_id && l.scheduled_time === next.scheduled_time && timestampToLocalDate(l.timestamp) === day);
    if (clash) throw new Error("A log for this dose already exists on that day");
  }

  // Reconcile stock only when the consumed amount actually changed — a
  // timestamp/notes edit must never move inventory. The recorded
  // inventory_delta is the ground truth of what this log took out (it can be
  // less than quantity when stock clamped at 0, and 0 for legacy logs), so
  // adjust relative to it: undo/edit can never restore more than was taken.
  const oldWanted = logConsumption(log);
  const newWanted = logConsumption(next);
  // Legacy consuming logs (pre-inventory_delta) decremented an unknowable
  // amount — leave stock alone for them, like deleteLog does.
  const legacyUnknowable = log.inventory_delta === undefined && oldWanted > 0;
  if (med?.inventory && newWanted !== oldWanted && !legacyUnknowable) {
    const prevDelta = Number(log.inventory_delta || 0);
    const applied = applyStockDelta(med, newWanted - prevDelta);
    next.inventory_delta = prevDelta + applied;
    await setArr(pkey("medications"), meds);
  }

  next.updated_at = nowIso();
  logs[idx] = next;
  await setArr(pkey("logs"), logs);
  return next;
}
export async function deleteLog(id) {
  await ensureInit();
  const logs = await getArr(pkey("logs"));
  const log = logs.find((l) => l.id === id);
  await setArr(pkey("logs"), logs.filter((l) => l.id !== id));
  // Restore exactly what this log took out of stock (0 for legacy logs, which
  // recorded no delta — we can't know what they decremented).
  const restore = Number(log?.inventory_delta || 0);
  if (restore > 0) {
    const meds = await getArr(pkey("medications"));
    const med = meds.find((m) => m.id === log.medication_id);
    if (med?.inventory) {
      med.inventory.current_count = Number(med.inventory.current_count || 0) + restore;
      med.inventory.last_updated = nowIso();
      await setArr(pkey("medications"), meds);
    }
  }
  return { deleted: true };
}
export const undoLog = deleteLog;

// ---- reminders ----
export async function getReminders(medication_id) { await ensureInit(); let r = await getArr(pkey("reminders")); if (medication_id) r = r.filter((x) => x.medication_id === medication_id); return r; }
export async function createReminder(data) { await ensureInit(); const r = await getArr(pkey("reminders")); const doc = { ...data, id: uid(), created_at: nowIso(), is_active: data.is_active !== false }; r.push(doc); await setArr(pkey("reminders"), r); return doc; }
export async function updateReminder(id, data) { await ensureInit(); const r = await getArr(pkey("reminders")); const idx = r.findIndex((x) => x.id === id); if (idx === -1) throw new Error("Reminder not found"); r[idx] = { ...r[idx], ...data, id }; await setArr(pkey("reminders"), r); return r[idx]; }
export async function deleteReminder(id) { await ensureInit(); let r = await getArr(pkey("reminders")); r = r.filter((x) => x.id !== id); await setArr(pkey("reminders"), r); return { deleted: true }; }

// ---- taper ----
export async function taperSuggest(medId) { const m = await getMedication(medId); return suggestTaperParams(m); }
export function taperPreview(p) {
  return Promise.resolve(generateTaperSchedule({
    initialDose: p.initial_dose, finalDose: p.final_dose ?? 0, startDate: p.start_date, stepIntervalDays: p.step_interval_days,
    totalDays: p.total_days, method: p.method, unit: p.unit, customSteps: p.custom_steps,
  }));
}
export async function getTapers() {
  await ensureInit();
  const tapers = await getArr(pkey("tapers"));
  const meds = await getArr(pkey("medications"));
  return tapers.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).map((t) => {
    const m = meds.find((x) => x.id === t.medication_id);
    return { ...t, medication_name: m?.name || "Unknown", medication_color: m?.color || "#2A767B", is_finished: taperState(t, todayStr()) === "finished" };
  });
}
export async function createTaper(p) {
  await ensureInit();
  const meds = await getArr(pkey("medications"));
  const med = meds.find((m) => m.id === p.medication_id);
  if (!med) throw new Error("Medication not found");
  const sched = generateTaperSchedule({ initialDose: p.initial_dose, finalDose: p.final_dose ?? 0, startDate: p.start_date, stepIntervalDays: p.step_interval_days, totalDays: p.total_days, method: p.method, unit: p.unit, customSteps: p.custom_steps });
  let tapers = await getArr(pkey("tapers"));
  tapers = tapers.map((t) => (t.medication_id === p.medication_id && t.is_active ? { ...t, is_active: false } : t));
  const doc = { id: uid(), medication_id: p.medication_id, initial_dose: p.initial_dose, final_dose: p.final_dose ?? 0, unit: p.unit, method: p.method, start_date: p.start_date ? localDateStr(new Date(p.start_date.length <= 10 ? p.start_date + "T00:00" : p.start_date)) : todayStr(), total_days: p.total_days, step_interval_days: p.step_interval_days, custom_steps: p.custom_steps || null, notes: p.notes || null, schedule: sched, is_active: true, is_paused: false, created_at: nowIso(), updated_at: nowIso() };
  tapers.push(doc);
  await setArr(pkey("tapers"), tapers);
  med.is_tapering = true; await setArr(pkey("medications"), meds);
  return doc;
}
export async function getTaper(id) {
  await ensureInit();
  const t = (await getArr(pkey("tapers"))).find((x) => x.id === id);
  if (!t) throw new Error("Taper not found");
  const med = (await getArr(pkey("medications"))).find((m) => m.id === t.medication_id);
  // While paused, progress (dose AND step marker) holds at the pause date.
  const effToday = t.is_paused && t.paused_on && t.paused_on < todayStr() ? t.paused_on : todayStr();
  const day = diffDays(t.start_date, effToday);
  const interval = t.step_interval_days || 7;
  return {
    ...t, medication: med,
    current_dose: taperDoseOnDate(t, todayStr()),
    current_step: day >= 0 ? Math.max(0, Math.min(t.schedule.steps.length - 1, Math.floor(day / interval))) : 0,
    is_finished: taperState(t, todayStr()) === "finished",
  };
}
export async function updateTaper(id, patch) {
  await ensureInit();
  const tapers = await getArr(pkey("tapers"));
  const idx = tapers.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error("Taper not found");
  const t = tapers[idx];
  // Pausing freezes progress at today's step; resuming shifts the whole
  // schedule forward by the paused duration so the taper picks up exactly
  // where it left off (dates regenerate to match the new start).
  if ("is_paused" in patch && patch.is_paused !== t.is_paused) {
    if (patch.is_paused) {
      t.paused_on = todayStr();
    } else {
      const shift = t.paused_on ? Math.max(0, diffDays(t.paused_on, todayStr())) : 0;
      if (shift > 0) {
        t.start_date = addDaysStr(t.start_date, shift);
        try {
          t.schedule = generateTaperSchedule({
            initialDose: t.initial_dose, finalDose: t.final_dose ?? 0, startDate: t.start_date,
            stepIntervalDays: t.step_interval_days, totalDays: t.total_days, method: t.method,
            unit: t.unit, customSteps: t.custom_steps,
          });
        } catch { /* keep old schedule if params are somehow invalid */ }
      }
      t.paused_on = null;
    }
  }
  ["is_active", "is_paused", "notes"].forEach((k) => { if (k in patch) t[k] = patch[k]; });
  t.updated_at = nowIso();
  await setArr(pkey("tapers"), tapers);
  if (patch.is_active === false) {
    const meds = await getArr(pkey("medications"));
    const m = meds.find((x) => x.id === tapers[idx].medication_id);
    if (m) { m.is_tapering = false; await setArr(pkey("medications"), meds); }
  }
  return tapers[idx];
}
// Regenerate a taper's remaining schedule from today's actual dose forward
// -- changing pace, target, or method without discarding progress already
// made or starting an entirely separate plan (previously the only way to
// change a taper's core parameters at all: `updateTaper` only ever touched
// is_active/is_paused/notes). Whatever dose today's existing schedule calls
// for becomes the new starting point; only the remainder is reshaped. Used
// by the AI's adjust_taper_plan tool.
export async function adjustTaper(id, patch = {}) {
  await ensureInit();
  const tapers = await getArr(pkey("tapers"));
  const idx = tapers.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error("Taper not found");
  const t = tapers[idx];
  if (!t.is_active) throw new Error("Only an active taper can be adjusted");
  const today = todayStr();
  // While paused, the dose has been frozen at the pause date -- that's the
  // real jumping-off point, not whatever today's now-stale schedule implies.
  const currentDose = t.is_paused && t.paused_on && t.paused_on < today ? taperDoseOnDate(t, t.paused_on) : taperDoseOnDate(t, today);
  const final_dose = patch.final_dose != null ? Number(patch.final_dose) : t.final_dose;
  const total_days = patch.total_days != null ? Number(patch.total_days) : t.total_days;
  const step_interval_days = patch.step_interval_days != null ? Number(patch.step_interval_days) : t.step_interval_days;
  const method = patch.method || t.method;
  // Validates dose/duration bounds and throws a clear error if the request
  // doesn't make sense (e.g. a final dose above where the taper already is).
  const schedule = generateTaperSchedule({ initialDose: currentDose, finalDose: final_dose, startDate: today, stepIntervalDays: step_interval_days, totalDays: total_days, method, unit: t.unit, customSteps: null });
  t.initial_dose = currentDose;
  t.final_dose = final_dose;
  t.total_days = total_days;
  t.step_interval_days = step_interval_days;
  t.method = method;
  t.start_date = today;
  t.custom_steps = null;
  t.is_paused = false;
  t.paused_on = null;
  t.schedule = schedule;
  t.updated_at = nowIso();
  await setArr(pkey("tapers"), tapers);
  return tapers[idx];
}

export async function deleteTaper(id) {
  await ensureInit();
  let tapers = await getArr(pkey("tapers"));
  const t = tapers.find((x) => x.id === id);
  tapers = tapers.filter((x) => x.id !== id);
  await setArr(pkey("tapers"), tapers);
  if (t) { const meds = await getArr(pkey("medications")); const m = meds.find((x) => x.id === t.medication_id); if (m) { m.is_tapering = false; await setArr(pkey("medications"), meds); } }
  return { deleted: true };
}

// ---- cyclic ----
export async function getCyclic() {
  await ensureInit();
  const plans = await getArr(pkey("cyclic"));
  const meds = await getArr(pkey("medications"));
  return plans.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).map((p) => { const m = meds.find((x) => x.id === p.medication_id); return { ...p, medication_name: m?.name || "Unknown", medication_color: m?.color || "#2A767B" }; });
}
export async function createCyclic(data) { await ensureInit(); const plans = await getArr(pkey("cyclic")); const doc = { ...data, id: uid(), start_date: data.start_date || todayStr(), created_at: nowIso(), updated_at: nowIso(), is_active: data.is_active !== false }; plans.push(doc); await setArr(pkey("cyclic"), plans); return doc; }
export async function updateCyclic(id, patch) { await ensureInit(); const plans = await getArr(pkey("cyclic")); const idx = plans.findIndex((p) => p.id === id); if (idx === -1) throw new Error("Cyclic plan not found"); plans[idx] = { ...plans[idx], ...patch, updated_at: nowIso() }; await setArr(pkey("cyclic"), plans); return plans[idx]; }
export async function deleteCyclic(id) { await ensureInit(); let plans = await getArr(pkey("cyclic")); plans = plans.filter((p) => p.id !== id); await setArr(pkey("cyclic"), plans); return { deleted: true }; }

// ---- chat ----
export async function getChat(sessionId) { await ensureInit(); return (await getArr(pkey("chat"))).filter((m) => m.session_id === sessionId).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")); }
export async function addChatMessage(sessionId, role, content) { await ensureInit(); const all = await getArr(pkey("chat")); const msg = { id: uid(), session_id: sessionId, role, content, created_at: nowIso() }; all.push(msg); await setArr(pkey("chat"), all); return msg; }
export async function clearChat(sessionId) { await ensureInit(); let all = await getArr(pkey("chat")); all = all.filter((m) => m.session_id !== sessionId); await setArr(pkey("chat"), all); return { cleared: true }; }

// ---- mood check-ins ----
export async function getCheckins(params = {}) {
  await ensureInit();
  let items = await getArr(pkey("checkins"));
  if (params.start) items = items.filter((c) => timestampToLocalDate(c.timestamp) >= params.start);
  if (params.end) items = items.filter((c) => timestampToLocalDate(c.timestamp) <= params.end);
  items.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return params.limit ? items.slice(0, params.limit) : items;
}
export async function createCheckin(data) {
  await ensureInit();
  const mood = Math.min(5, Math.max(1, Math.round(Number(data.mood))));
  if (!isFinite(mood)) throw new Error("mood (1-5) is required");
  const items = await getArr(pkey("checkins"));
  const doc = { id: uid(), mood, timestamp: data.timestamp || nowIso(), created_at: nowIso(), notes: data.notes || null };
  ["energy", "sleep", "pain", "anxiety"].forEach((k) => {
    const v = Number(data[k]);
    doc[k] = isFinite(v) && data[k] != null ? Math.min(5, Math.max(1, Math.round(v))) : null;
  });
  items.push(doc);
  await setArr(pkey("checkins"), items);
  return doc;
}
export async function updateCheckin(id, patch) {
  await ensureInit();
  const items = await getArr(pkey("checkins"));
  const idx = items.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Check-in not found");
  const next = { ...items[idx] };
  if ("mood" in patch) {
    const mood = Math.min(5, Math.max(1, Math.round(Number(patch.mood))));
    if (!isFinite(mood)) throw new Error("mood (1-5) is required");
    next.mood = mood;
  }
  if ("notes" in patch) next.notes = patch.notes || null;
  ["energy", "sleep", "pain", "anxiety"].forEach((k) => {
    if (!(k in patch)) return;
    const v = Number(patch[k]);
    next[k] = isFinite(v) && patch[k] != null ? Math.min(5, Math.max(1, Math.round(v))) : null;
  });
  if ("timestamp" in patch) {
    const d = new Date(patch.timestamp);
    if (!patch.timestamp || isNaN(d.getTime())) throw new Error("Invalid timestamp");
    next.timestamp = d.toISOString();
  }
  next.updated_at = nowIso();
  items[idx] = next;
  await setArr(pkey("checkins"), items);
  return next;
}
export async function deleteCheckin(id) {
  await ensureInit();
  const items = await getArr(pkey("checkins"));
  await setArr(pkey("checkins"), items.filter((c) => c.id !== id));
  return { deleted: true };
}

// ---- active effects tracker ----
// Sessions capture one dose's effect timeline; the per-med model learns the
// user's personal onset/peak/duration from session feedback (effectsEngine).

export async function getEffectModel(medication_id) {
  await ensureInit();
  return (await getArr(pkey("effectModels"))).find((m) => m.medication_id === medication_id) || null;
}

async function saveEffectModel(model) {
  const models = await getArr(pkey("effectModels"));
  const idx = models.findIndex((m) => m.medication_id === model.medication_id);
  if (idx >= 0) models[idx] = model; else models.push(model);
  await setArr(pkey("effectModels"), models);
  return model;
}

// The per-person learned meal-factor model (see effectsEngine's
// updateMealModel). One per profile rather than per medication: stomach
// fullness acts on gastric emptying -- the person's physiology -- so every
// oral medication's sessions pool into the same signal instead of each
// fragmenting it. Stored as a single-element array so the plain
// PROFILE_COLLECTIONS export/import path carries it untouched.
export async function getMealModel() {
  await ensureInit();
  return (await getArr(pkey("mealModels")))[0] || {};
}

async function saveMealModel(model) {
  await setArr(pkey("mealModels"), [model || {}]);
  return model;
}

// A monotonic per-medication counter, independent of whether a model
// currently exists. Sessions record the version they produced when they
// trained the model (model_after_version); undoing a session checks the
// counter hasn't moved since — i.e. nothing newer (another session, or a
// Reset) has touched the model — before it's safe to roll back to the
// exact pre-session snapshot. The counter itself is never rolled back, so
// version numbers are never reused even across a reset.
async function getEffectModelVersion(medication_id) {
  const versions = await getArr(pkey("effectVersions"));
  return versions.find((v) => v.medication_id === medication_id)?.version || 0;
}
async function bumpEffectModelVersion(medication_id) {
  const versions = await getArr(pkey("effectVersions"));
  const idx = versions.findIndex((v) => v.medication_id === medication_id);
  const next = (idx >= 0 ? versions[idx].version : 0) + 1;
  if (idx >= 0) versions[idx].version = next; else versions.push({ medication_id, version: next });
  await setArr(pkey("effectVersions"), versions);
  return next;
}

// How far back to look for a medication's own consuming-dose history when
// estimating tolerance (see toleranceEngine.js). Generous relative to the
// longest decay constant used there (benzodiazepine, 21 days) so a real gap
// in use is never mistaken for "no history at all."
const TOLERANCE_LOOKBACK_DAYS = 120;

// `excludeLogId` leaves out the dose this profile is being computed *for* --
// tolerance reflects what the body brought into this dose, not this dose's
// own contribution (otherwise even a first-ever dose would show tolerance).
async function toleranceForMedication(med, { now = Date.now(), excludeLogId = null } = {}) {
  const logs = await getArr(pkey("logs"));
  const cutoff = now - TOLERANCE_LOOKBACK_DAYS * 86400000;
  // Amounts travel with the timestamps so tolerance is driven by each day's
  // total exposure rather than by how many separate times it was taken.
  const doses = logs
    .filter((l) => l.medication_id === med.id && l.id !== excludeLogId && LOG_CONSUMING_STATUSES.includes(l.status))
    .map((l) => ({ t: new Date(l.timestamp).getTime(), amount: Number(l.dose_taken) }))
    .filter((d) => isFinite(d.t) && d.t >= cutoff && d.t <= now);
  // Pass the whole medication, not just its category, so a substance with
  // its own tolerance constants (see SUBSTANCE_TOLERANCE) gets them.
  return estimateTolerance(doses, med, now);
}

// Public read of a medication's current modeled tolerance -- independent of
// any active effects session, so it can be shown on MedicationDetail even
// when nothing is actively being tracked. Returns null both for a category
// with no modeled tolerance at all (see toleranceEngine.js's TOLERANCE_PARAMS)
// and for one with nothing meaningful to show yet -- callers don't need to
// separately re-derive "is this worth surfacing."
export async function getMedicationTolerance(medication_id) {
  await ensureInit();
  const med = (await getArr(pkey("medications"))).find((m) => m.id === medication_id);
  if (!med) return null;
  const tolerance = await toleranceForMedication(med);
  if (!tolerance.applicable) return null;
  if (!tolerance.faded && tolerance.level < 0.15) return null;
  return tolerance;
}

// A suggested (not authoritative) 1-10 starting point for QuickLogSheet's
// effectiveness slider, from this medication's current tolerance and the
// dose amount being logged -- see modeledEffectiveness in effectsEngine.js.
// The user's own rating, once they touch the slider, is what actually gets
// stored; this only pre-fills a smarter default than the fixed "7" so the
// tool reflects what it already knows before asking the person to guess.
export async function estimateDoseEffectiveness({ medication_id, dose = null, now = Date.now(), last_meal = null } = {}) {
  await ensureInit();
  const med = (await getArr(pkey("medications"))).find((m) => m.id === medication_id);
  if (!med) return null;
  const model = (await getArr(pkey("effectModels"))).find((m) => m.medication_id === medication_id) || null;
  const tolerance = await toleranceForMedication(med);
  // Onset/peak/duration come from timing self-reports (when did it kick in,
  // when did it peak) -- EWMA-learned, and the very first observation is
  // adopted outright with no smoothing at all (see updateModel), so a
  // sample or two is genuinely noisy. Only trust those learned values over
  // the researched category default once modelConfidence reaches "medium"
  // (>=3 sessions); below that, this preview is more accurate using the
  // population-typical curve than an under-sampled personal one.
  const calibrated = !!model && ["medium", "high"].includes(modelConfidence(model));
  const timingModel = calibrated ? model : null;
  // ref_dose is a different kind of signal -- "how much did you take," a
  // plain recorded number, not a fuzzy timing estimate -- so it's trusted
  // starting from a single session, learned or (as a fallback) averaged
  // from plain log history. Dose-ratio scaling in personalizedProfile only
  // kicks in with a ref_dose, which only exists once the effects tracker has
  // actually been used and completed at least once -- so a medication
  // logged for months on a fixed schedule (never "Track effects") would
  // never reflect the dose amount in this preview at all without this
  // fallback. The real effects-tracker curve/model is untouched either way,
  // still trained exclusively from actual feedback.
  let refDose = model?.ref_dose;
  if (!refDose) {
    const logs = await getArr(pkey("logs"));
    const amounts = logs
      .filter((l) => l.medication_id === medication_id && LOG_CONSUMING_STATUSES.includes(l.status) && isFinite(Number(l.dose_taken)) && Number(l.dose_taken) > 0)
      .map((l) => Number(l.dose_taken))
      .sort((a, b) => a - b);
    // Median, not mean: someone escalating their dose would otherwise drag
    // their own baseline up along with them, so a genuinely doubled dose
    // would read as only slightly above "typical" and the preview would
    // barely move -- exactly the thing this number exists to show.
    if (amounts.length) {
      const mid = Math.floor(amounts.length / 2);
      refDose = amounts.length % 2 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;
    }
  }
  const lastMeal = MEAL_STATES.includes(last_meal) ? last_meal : null;
  const mealModel = await getMealModel();
  const refModel = timingModel || refDose ? { ...(timingModel || {}), ref_dose: refDose } : null;
  const profile = personalizedProfile(med, refModel, dose, tolerance, { lastMeal, mealModel });

  // The headline is expressed against *this person's own recent normal*,
  // not against an opioid-naive baseline. For a daily user, saturated
  // tolerance pins the absolute number near 40% no matter what they do,
  // which tells them nothing about the choice actually in front of them --
  // and makes doubling a dose look like it barely mattered. Dividing by the
  // effect their usual dose has been having lately cancels the shared
  // tolerance term, so 100% means "like your usual", above means stronger.
  // Absolute tolerance is still reported separately by the meter below.
  //
  // Computed from the unrounded dose-response rather than from the profile's
  // 1dp-rounded intensity_scale, which at these magnitudes would otherwise
  // contribute several percent of error on its own.
  const dv = Number(dose);
  const doseRatio = refDose > 0 && isFinite(dv) && dv > 0 ? Math.min(10, Math.max(0.1, dv / refDose)) : 1;
  // Tolerance normally cancels exactly: the comparison is against what this
  // person's usual dose would do *right now*, so the only variable left is
  // the dose itself. The one exception is a detected break -- there the
  // baseline really is the tolerance they'd built before it faded, and the
  // dose genuinely will land harder than they're used to.
  const usualLevel = tolerance.applicable && tolerance.faded ? tolerance.recentPeakLevel : tolerance.level;
  const curFactor = tolerance.applicable ? 1 - tolerance.level * tolerance.maxDampening : 1;
  const usualFactor = tolerance.applicable ? 1 - usualLevel * tolerance.maxDampening : 1;
  // The meal factor multiplies only the numerator: "your usual" is
  // meal-agnostic, so unlike tolerance it must survive the ratio rather
  // than cancel out of it. Residual is left unadjusted too -- the meal
  // states of earlier doses aren't known.
  const mealIntensity = mealFactorsFor(lastMeal, med.form, mealModel).intensity;
  const doseEffect = doseResponse(doseRatio, doseResponseFor(med)) * curFactor * mealIntensity;

  // Drug still on board from earlier doses. A dose taken while the last one
  // is still working lands on top of it -- the single biggest short-term
  // factor after the dose itself, and until now modeled only *within* one
  // effects session, so a dose logged a couple of hours after another (or
  // during a separate session entirely) was treated as landing on nothing.
  // Each prior dose contributes its own curve's value at this moment,
  // scaled by its size, and dampened by the same tolerance as the new one.
  const logs = await getArr(pkey("logs"));
  const windowMin = profile.duration_min * 1.25;
  let residual = 0;
  for (const l of logs) {
    if (l.medication_id !== medication_id || !LOG_CONSUMING_STATUSES.includes(l.status)) continue;
    const elapsed = (now - new Date(l.timestamp).getTime()) / 60000;
    if (!(elapsed > 0) || elapsed >= windowMin) continue;
    const amt = Number(l.dose_taken);
    const priorRatio = refDose > 0 && isFinite(amt) && amt > 0 ? Math.min(10, Math.max(0.1, amt / refDose)) : 1;
    residual += (intensityAt(elapsed, profile) / 100) * doseResponse(priorRatio, doseResponseFor(med));
  }
  residual = Math.min(3, residual) * curFactor;

  const relativeToUsual = usualFactor > 0 ? (doseEffect + residual) / usualFactor : 1;

  return {
    suggested: modeledEffectiveness(relativeToUsual),
    relativeToUsual: Math.round(relativeToUsual * 100) / 100,
    intensityScale: profile.intensity_scale,
    tolerance: profile.tolerance || null,
    calibrated,
    // The pieces behind the headline, so the UI can show what moved it.
    factors: {
      dose: Math.round((usualFactor > 0 ? doseEffect / usualFactor : 1) * 100) / 100,
      residual: Math.round((usualFactor > 0 ? residual / usualFactor : 0) * 100) / 100,
      toleranceDampening: Math.round((1 - curFactor) * 100) / 100,
    },
  };
}

// Forget everything learned about a medication's timing and fall back to the
// typical profile. Active sessions for that med re-derive their curve too.
// Bumps the version counter so no earlier session can later "undo" past this
// point — a Reset is a deliberate, permanent forget. Tolerance is a live
// computation from real dose history, not part of the learned model, so it's
// still applied here rather than reset to zero.
export async function resetEffectModel(medication_id) {
  await ensureInit();
  const models = await getArr(pkey("effectModels"));
  await setArr(pkey("effectModels"), models.filter((m) => m.medication_id !== medication_id));
  await bumpEffectModelVersion(medication_id);
  const sessions = await getArr(pkey("effectSessions"));
  const med = (await getArr(pkey("medications"))).find((m) => m.id === medication_id) || {};
  let changed = false;
  for (const s of sessions) {
    if (s.medication_id === medication_id && s.status === "active") {
      const tolerance = await toleranceForMedication(med, { excludeLogId: s.log_id });
      s.profile = personalizedProfile(med, null, s.dose, tolerance, { lastMeal: s.last_meal || null, mealModel: await getMealModel() });
      s.updated_at = nowIso();
      changed = true;
    }
  }
  if (changed) await setArr(pkey("effectSessions"), sessions);
  return { reset: true };
}

export async function startEffectSession({ medication_id, dose = null, unit = null, log_id = null, started_at = null, last_meal = null }) {
  await ensureInit();
  const med = (await getArr(pkey("medications"))).find((m) => m.id === medication_id);
  if (!med) throw new Error("Medication not found");
  const sessions = await getArr(pkey("effectSessions"));
  // One active session per medication — starting again replaces silently
  // confusing duplicates with a clean restart.
  sessions.forEach((s) => { if (s.medication_id === medication_id && s.status === "active") { s.status = "discarded"; s.ended_at = nowIso(); } });
  const model = (await getArr(pkey("effectModels"))).find((m) => m.medication_id === medication_id) || null;
  const tolerance = await toleranceForMedication(med, { excludeLogId: log_id });
  // "How long since you last ate" -- anything unrecognized (including an
  // unanswered picker) stores as null, which the engine treats as no
  // adjustment. Kept on the session so every later profile recompute
  // (edit, model reset, the live intensity refresh) re-applies it. The
  // exact factors baked into this snapshot are stored alongside, because
  // session-end learning must undo precisely what was applied at start --
  // not whatever the (by then further-trained) meal model would apply.
  const lastMeal = MEAL_STATES.includes(last_meal) ? last_meal : null;
  const mealModel = await getMealModel();
  const doc = {
    id: uid(), medication_id, log_id,
    dose: dose != null && isFinite(Number(dose)) ? Number(dose) : null,
    unit: unit || med.unit || null,
    started_at: started_at && !isNaN(new Date(started_at).getTime()) ? new Date(started_at).toISOString() : nowIso(),
    ended_at: null, status: "active", events: [],
    last_meal: lastMeal,
    meal_factors: mealFactorsFor(lastMeal, med.form, mealModel),
    profile: personalizedProfile(med, model, dose, tolerance, { lastMeal, mealModel }), // snapshot used for this session
    created_at: nowIso(),
  };
  sessions.push(doc);
  await setArr(pkey("effectSessions"), sessions);
  return doc;
}

// Edit an active session's start time ("I actually took it earlier") and/or
// dose. A dose change re-derives the profile snapshot (dose scaling); a start
// change re-anchors the whole curve, so predictions shift with it.
export async function updateEffectSession(sessionId, patch = {}) {
  await ensureInit();
  const sessions = await getArr(pkey("effectSessions"));
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error("Session not found");
  if (s.status !== "active") throw new Error("Only active sessions can be edited");
  if ("started_at" in patch) {
    const d = new Date(patch.started_at);
    if (!patch.started_at || isNaN(d.getTime())) throw new Error("Invalid start time");
    if (d.getTime() > Date.now() + 60000) throw new Error("Start time can't be in the future");
    s.started_at = d.toISOString();
  }
  if ("dose" in patch) {
    const v = Number(patch.dose);
    if (!isFinite(v) || v < 0) throw new Error("Invalid dose");
    s.dose = v;
  }
  if ("last_meal" in patch) {
    s.last_meal = MEAL_STATES.includes(patch.last_meal) ? patch.last_meal : null;
  }
  // Either a dose change (dose scaling) or a meal correction (timing + peak
  // shift) invalidates the snapshot, so re-derive it once for both.
  if ("dose" in patch || "last_meal" in patch) {
    const med = (await getArr(pkey("medications"))).find((m) => m.id === s.medication_id) || {};
    const model = (await getArr(pkey("effectModels"))).find((m) => m.medication_id === s.medication_id) || null;
    const tolerance = await toleranceForMedication(med, { excludeLogId: s.log_id });
    const mealModel = await getMealModel();
    s.meal_factors = mealFactorsFor(s.last_meal || null, med.form, mealModel);
    s.profile = personalizedProfile(med, model, s.dose, tolerance, { lastMeal: s.last_meal || null, mealModel });
  }
  s.updated_at = nowIso();
  await setArr(pkey("effectSessions"), sessions);
  return s;
}

// Redose: add another dose of the same substance to an active session so its
// effect stacks onto the still-active tail of earlier doses, instead of the
// user having to start a confusing separate session. Stored as an entry in
// `redoses`; the primary dose stays represented by started_at/dose.
export async function addEffectDose(sessionId, { amount = null, at = null } = {}) {
  await ensureInit();
  const sessions = await getArr(pkey("effectSessions"));
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error("Session not found");
  if (s.status !== "active") throw new Error("Only an active session can be redosed");
  const when = at && !isNaN(new Date(at).getTime()) ? new Date(at) : new Date();
  if (when.getTime() > Date.now() + 60000) throw new Error("Redose time can't be in the future");
  // Compare against the session-start minute, not the exact second — a redose
  // entered as "now" via a minute-granularity datetime picker can otherwise
  // land a few seconds before a session started moments ago.
  const startMinute = Math.floor(new Date(s.started_at).getTime() / 60000) * 60000;
  if (when.getTime() < startMinute) throw new Error("Redose can't be before the session started");
  let amt = null;
  if (amount != null && amount !== "") {
    amt = Number(amount);
    if (!isFinite(amt) || amt < 0) throw new Error("Invalid dose");
  }

  // A redose is a real dose taken — log it like any other dose so inventory
  // decrements and it shows up in the journal/history, not just internally on
  // the session. No scheduled_time, so it always creates its own log entry
  // instead of dedup-merging into an already-logged scheduled dose (same
  // reasoning as the ad-hoc "extra dose" fix elsewhere in the log entry points).
  const meds = await getArr(pkey("medications"));
  const med = meds.find((m) => m.id === s.medication_id);
  const logPayload = { medication_id: s.medication_id, status: "taken", scheduled_time: null, timestamp: when.toISOString(), unit: s.unit || med?.unit || null };
  if (amt != null) {
    logPayload.dose_taken = amt;
    const pills = med?.strength != null ? pillsFromAmount(amt, med.strength) : null;
    if (pills != null) logPayload.quantity = pills;
  }
  const log = await createLog(logPayload);

  s.redoses = s.redoses || [];
  s.redoses.push({ id: uid(), at: when.toISOString(), amount: amt, unit: s.unit || null, log_id: log.id });
  s.redoses.sort((a, b) => a.at.localeCompare(b.at));
  s.updated_at = nowIso();
  await setArr(pkey("effectSessions"), sessions);
  return s;
}

export async function removeEffectDose(sessionId, doseId) {
  await ensureInit();
  const sessions = await getArr(pkey("effectSessions"));
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error("Session not found");
  if (s.status !== "active") throw new Error("Only an active session's doses can be edited");
  const before = (s.redoses || []).length;
  const removed = (s.redoses || []).find((r) => r.id === doseId);
  s.redoses = (s.redoses || []).filter((r) => r.id !== doseId);
  if (s.redoses.length === before) throw new Error("Dose not found");
  s.updated_at = nowIso();
  await setArr(pkey("effectSessions"), sessions);
  // Undo the inventory decrement and remove the journal entry this redose created.
  if (removed?.log_id) await deleteLog(removed.log_id);
  return s;
}

export async function addEffectEvent(sessionId, { kind, intensity = null, note = null }) {
  await ensureInit();
  const sessions = await getArr(pkey("effectSessions"));
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error("Session not found");
  if (s.status !== "active") throw new Error("Session is not active");
  const KINDS = ["onset", "peak", "wearing_off", "gone", "intensity", "note"];
  if (!KINDS.includes(kind)) throw new Error("Unknown event kind");
  // Number(null) coerces to 0 (finite!), which would wrongly store intensity:
  // 0 on plain phase events (onset/peak/...) that never carried a value.
  const v = intensity != null ? Number(intensity) : NaN;
  s.events.push({ id: uid(), t: nowIso(), kind, intensity: isFinite(v) ? Math.min(10, Math.max(0, v)) : null, note: note || null });
  // "gone" is terminal feedback — close and learn in the same step.
  if (kind === "gone") return endEffectSessionInternal(sessions, s, { learn: true });
  await setArr(pkey("effectSessions"), sessions);
  return s;
}

// Remove one recorded feedback event — the "editing" counterpart to Undo,
// for fixing a specific wrong tap without discarding everything else.
// Deleting the event that completed the session (kind "gone") is the same
// as undoing the completion: hand off to reopenEffectSession, which also
// reverts the model training that completion triggered (if still safe to).
export async function deleteEffectEvent(sessionId, eventId) {
  await ensureInit();
  const sessions = await getArr(pkey("effectSessions"));
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error("Session not found");
  const idx = (s.events || []).findIndex((e) => e.id === eventId);
  if (idx === -1) throw new Error("Event not found");
  if (s.events[idx].kind === "gone") return reopenEffectSession(sessionId);
  if (s.status !== "active") throw new Error("Only an active session's feedback can be edited");
  s.events.splice(idx, 1);
  s.updated_at = nowIso();
  await setArr(pkey("effectSessions"), sessions);
  return s;
}

async function endEffectSessionInternal(sessions, s, { learn }) {
  s.status = "completed";
  s.ended_at = nowIso();
  // A redosed session's onset/peak/gone timings reflect stacked doses, not a
  // single dose, so they'd corrupt the learned single-dose model — don't train
  // from redosed sessions.
  if (learn && (s.redoses || []).length) learn = false;
  if (learn) {
    const med = (await getArr(pkey("medications"))).find((m) => m.id === s.medication_id) || {};
    const obs = observationsFromSession(s);
    if (obs.onset_min != null || obs.peak_min != null || obs.end_min != null) {
      // Snapshot the exact prior model so this training step can be undone.
      const prev = await getEffectModel(s.medication_id);
      s.model_before = prev || null;
      // The base timing model trains on baseline-equivalent observations:
      // a full-stomach session's late onset is the meal's doing, not the
      // drug's, so the meal shift applied at start is divided back out
      // first. Old sessions without meal_factors pass through unchanged.
      const applied = s.meal_factors || { onset: 1, comeUp: 1, intensity: 1, duration: 1 };
      const next = updateModel(prev, baselineObservations(obs, s.profile, applied), s.dose, med);
      next.medication_id = s.medication_id;
      await saveEffectModel(next);
      s.model_after_version = await bumpEffectModelVersion(s.medication_id);

      // Meal-factor calibration -- the person's own gastric response,
      // learned from how far this session's real timings deviated from its
      // no-meal baseline. Gated on the *base* model already being reliable
      // (medium+ confidence, i.e. 3+ trained sessions): while the baseline
      // itself is still uncertain, a deviation can't be attributed to the
      // meal rather than to a baseline that's simply wrong for this person
      // -- the classic identifiability trap. "light" is the baseline state,
      // so there's nothing to learn from it; non-oral sessions never carry
      // a meal answer in the first place.
      if ((s.last_meal === "empty" || s.last_meal === "full") && isOralForm(med.form)
          && ["medium", "high"].includes(modelConfidence(prev))) {
        const observed = observedMealFactors(obs, s.profile, applied);
        if (Object.keys(observed).length) {
          const mealModel = await getMealModel();
          s.meal_model_before = mealModel; // undone alongside model_before on reopen
          await saveMealModel(updateMealModel(mealModel, s.last_meal, observed));
        }
      }
    }
  }
  await setArr(pkey("effectSessions"), sessions);
  return s;
}

export async function endEffectSession(sessionId, { learn = true, discard = false } = {}) {
  await ensureInit();
  const sessions = await getArr(pkey("effectSessions"));
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error("Session not found");
  if (discard) {
    s.status = "discarded";
    s.ended_at = nowIso();
    await setArr(pkey("effectSessions"), sessions);
    return s;
  }
  return endEffectSessionInternal(sessions, s, { learn });
}

// Undo a session's completion (via "Gone" feedback, "End session", or
// "Discard"): reactivates it, strips the terminal event, and — only if
// nothing has touched the medication's model since (checked via the version
// counter) — rolls the model back to exactly what it was before this
// session trained it. If a newer session (or a Reset) has since changed the
// model, reverting would silently erase that newer, unrelated learning, so
// it's refused with a clear reason instead.
export async function reopenEffectSession(sessionId) {
  await ensureInit();
  const sessions = await getArr(pkey("effectSessions"));
  const s = sessions.find((x) => x.id === sessionId);
  if (!s) throw new Error("Session not found");
  if (s.status === "active") return s;
  if (!["completed", "discarded"].includes(s.status)) throw new Error("This session can no longer be undone");
  if (s.model_after_version != null) {
    const current = await getEffectModelVersion(s.medication_id);
    if (current !== s.model_after_version) {
      throw new Error("Your medication's timing model has changed since this session completed — it can no longer be undone.");
    }
    const models = await getArr(pkey("effectModels"));
    const idx = models.findIndex((m) => m.medication_id === s.medication_id);
    if (s.model_before) { if (idx >= 0) models[idx] = s.model_before; else models.push(s.model_before); }
    else if (idx >= 0) models.splice(idx, 1);
    await setArr(pkey("effectModels"), models);
    // The meal model trained from the same feedback taps, so it rolls back
    // under the same not-touched-since guard the timing model just passed.
    if (s.meal_model_before !== undefined) await saveMealModel(s.meal_model_before);
  }
  // Reactivating must preserve the one-active-session-per-medication rule.
  sessions.forEach((other) => {
    if (other.id !== s.id && other.medication_id === s.medication_id && other.status === "active") {
      other.status = "discarded";
      other.ended_at = nowIso();
    }
  });
  s.events = (s.events || []).filter((e) => e.kind !== "gone");
  s.status = "active";
  s.ended_at = null;
  delete s.model_before;
  delete s.model_after_version;
  delete s.meal_model_before;
  s.updated_at = nowIso();
  await setArr(pkey("effectSessions"), sessions);
  return s;
}

// How long after its start a session's curve is completely over — the last
// dose's own after-effects tail included. Past this the chart reads 0% and
// the phase label is "Complete", so the session has nothing left to show.
export function sessionEndsAfterMin(session) {
  const profile = session?.profile || { duration_min: 360, onset_min: 30, peak_min: 90 };
  return stackChartEnd(profile, sessionDoseStack(session));
}

// Active sessions with their medication attached. A session auto-completes
// (without learning — silence isn't feedback) once its curve has fully played
// out, i.e. past the last dose's after-effects tail. Previously this waited
// for 2× the duration, which left a dead "Effects complete · 0% intensity"
// card sitting on the home and Effects screens for hours after the curve was
// visibly over. Redoses extend the curve, so a redosed session stays active
// as long as its own stacked curve is still running.
export async function getActiveEffectSessions() {
  await ensureInit();
  const sessions = await getArr(pkey("effectSessions"));
  const meds = await getArr(pkey("medications"));
  const now = Date.now();
  let changed = false;
  sessions.forEach((s) => {
    if (s.status !== "active") return;
    const endsAt = new Date(s.started_at).getTime() + sessionEndsAfterMin(s) * 60000;
    if (now > endsAt) { s.status = "completed"; s.ended_at = nowIso(); changed = true; }
  });
  if (changed) await setArr(pkey("effectSessions"), sessions);
  const models = await getArr(pkey("effectModels"));
  const active = sessions
    .filter((s) => s.status === "active")
    .sort((a, b) => (b.started_at || "").localeCompare(a.started_at || ""));

  const out = [];
  for (const s of active) {
    const m = meds.find((x) => x.id === s.medication_id);
    let profile = s.profile;
    // The *timing* of a running session stays snapshotted -- a curve that
    // shifted underneath you mid-session would be worse than useless. Its
    // height does not: intensity_scale is just a function of the dose and
    // current tolerance, both of which we can recompute. Without this, a
    // session started before a change to how that scale is derived keeps the
    // old value baked in until it ends, which is exactly how a curve could
    // still be drawn against a stale baseline hours later.
    if (m && profile) {
      const model = models.find((x) => x.medication_id === s.medication_id) || null;
      const tolerance = await toleranceForMedication(m, { now, excludeLogId: s.log_id });
      // last_meal must ride along here: this recompute runs on every read,
      // and without it the meal's intensity factor from the session snapshot
      // would be silently clobbered the moment the page re-rendered.
      const fresh = personalizedProfile(m, model, s.dose, tolerance, { lastMeal: s.last_meal || null, mealModel: await getMealModel() });
      profile = {
        ...profile,
        intensity_scale: fresh.intensity_scale,
        tolerance: fresh.tolerance,
        hill: fresh.hill,
        typicalFraction: fresh.typicalFraction,
      };
    }
    out.push({ ...s, profile, medication_name: m?.name || "Medication", medication_color: m?.color || "#2A767B", medication_unit: m?.unit || s.unit, medication_form: m?.form });
  }
  return out;
}

// Plain-language summary of one active session's current state, for the AI
// assistant's get_active_effects tool. Deliberately reuses the exact same
// helpers the Effects page renders from (sessionDoseStack, phaseAt,
// doseIntensityAt off the *newest* dose, stackChartEnd) so a redosed session
// is read the same way here as on screen -- current phase and intensity
// track the most recent dose, not the session's original one, and "ends at"
// accounts for a redose extending the tail. Tolerance is reported in the
// same terms as the tolerance meter (see ToleranceNote), not a bare level.
export function describeActiveSession(session, now = Date.now()) {
  const t = Math.max(0, (now - new Date(session.started_at).getTime()) / 60000);
  const p = session.profile;
  const stack = sessionDoseStack(session);
  const newestIdx = stack.length - 1;
  const lastOffset = stack[newestIdx].tOffset;
  const phase = phaseAt(t - lastOffset, p);
  const startMs = new Date(session.started_at).getTime();
  const at = (mins) => new Date(startMs + mins * 60000).toISOString();
  // profile.tolerance (from personalizedProfile) is omitted entirely for a
  // non-applicable category -- its presence alone means "applicable", unlike
  // estimateTolerance()'s raw result which carries an explicit flag.
  const tol = p.tolerance;
  return {
    elapsed_min: Math.round(t),
    phase: phase.label,
    intensity_pct: Math.round(doseIntensityAt(t, p, stack, newestIdx)),
    // From the session's own redose list, NOT the dose stack: the stack
    // merges near-simultaneous doses for curve purposes, which would make a
    // same-time redose disappear from this count.
    redose_count: (session.redoses || []).length,
    total_dose: sessionTotalDose(session),
    unit: session.unit || null,
    predicted: { onset_at: at(p.onset_min), peak_at: at(p.peak_min), ends_at: at(stackChartEnd(p, stack)) },
    personalized: p.learned ? `from ${p.samples} sessions (${p.confidence} confidence)` : "typical values (no personal data yet)",
    tolerance: tol ? {
      band: toleranceBand(tol.level).toLowerCase(),
      weaker_pct: tol.maxDampening != null ? Math.round(tol.level * tol.maxDampening * 100) : null,
      faded: !!tol.faded,
    } : null,
  };
}

// Substances considered "currently in the body" for interaction checking:
// any medication with an active effect session, or a dose taken recently
// enough that its effects haven't run out yet.
//
// The recency window is per-medication rather than a flat cutoff, derived
// from that medication's own effect curve (learned model where available,
// category/form default otherwise) including the after-effects tail. A flat
// 12 h window meant a short-acting substance kept flashing a red interaction
// warning for most of a day after its effects were plainly over. The window
// is floored at 2 h so a very short curve still warns for a sensible buffer,
// and capped at `withinHours` so nothing warns indefinitely.
const MIN_ACTIVE_WINDOW_MIN = 120;
export async function getActiveSubstances({ withinHours = 12 } = {}) {
  await ensureInit();
  const meds = await getArr(pkey("medications"));
  const logs = await getArr(pkey("logs"));
  const sessions = await getArr(pkey("effectSessions"));
  const models = await getArr(pkey("effectModels"));
  const now = Date.now();
  const capMin = withinHours * 60;

  const windowFor = (med) => {
    const model = models.find((m) => m.medication_id === med.id) || null;
    const profile = personalizedProfile(med, model, null);
    return Math.min(capMin, Math.max(MIN_ACTIVE_WINDOW_MIN, profile.duration_min * 1.25));
  };

  const activeIds = new Set();
  for (const s of sessions) if (s.status === "active") activeIds.add(s.medication_id);
  for (const l of logs) {
    if (!["taken", "partial"].includes(l.status)) continue;
    if (activeIds.has(l.medication_id)) continue;
    const med = meds.find((m) => m.id === l.medication_id);
    if (!med) continue;
    if (now - new Date(l.timestamp).getTime() <= windowFor(med) * 60000) activeIds.add(med.id);
  }
  return meds
    .filter((m) => activeIds.has(m.id) && m.is_active !== false)
    .map((m) => ({ id: m.id, name: m.name, generic_name: m.generic_name, category: m.category }));
}

// Interaction findings between one medication and everything currently active
// (excluding itself). Used to warn before logging a dose and on home cards.
export async function getInteractionsForMedication(medication_id, { withinHours = 12 } = {}) {
  await ensureInit();
  const med = (await getArr(pkey("medications"))).find((m) => m.id === medication_id);
  if (!med) return [];
  const others = await getActiveSubstances({ withinHours });
  return interactionsWith({ id: med.id, name: med.name, generic_name: med.generic_name, category: med.category }, others);
}

// The typical max daily dose for a medication, resolved from the catalog
// entry it was created from (medications don't store it themselves). Used by
// the redose safety guardrails. Returns a number or null.
// How much of this medication was already taken earlier today *outside* a
// given session -- so the redose guardrails can check a max-DAILY-dose limit
// against the actual day rather than just the session in front of the user.
// Excludes the session's own primary and redose logs to avoid double-counting.
export async function getPriorDoseTotalToday(medication_id, { excludeSessionId = null, now = Date.now() } = {}) {
  await ensureInit();
  const today = localDateStr(new Date(now));
  const excludedLogIds = new Set();
  if (excludeSessionId) {
    const s = (await getArr(pkey("effectSessions"))).find((x) => x.id === excludeSessionId);
    if (s) {
      if (s.log_id) excludedLogIds.add(s.log_id);
      for (const r of s.redoses || []) if (r.log_id) excludedLogIds.add(r.log_id);
    }
  }
  return (await getArr(pkey("logs")))
    .filter((l) => l.medication_id === medication_id
      && LOG_CONSUMING_STATUSES.includes(l.status)
      && !excludedLogIds.has(l.id)
      && timestampToLocalDate(l.timestamp) === today)
    .reduce((sum, l) => sum + (isFinite(Number(l.dose_taken)) ? Number(l.dose_taken) : 0), 0);
}

export async function getMedicationMaxDaily(medication_id) {
  await ensureInit();
  const med = (await getArr(pkey("medications"))).find((m) => m.id === medication_id);
  if (!med) return null;
  const catalog = await getArr("catalog");
  const nameLower = (med.name || "").toLowerCase();
  const cat = (med.catalog_id && catalog.find((c) => c.id === med.catalog_id)) || catalog.find((c) => c.name_lower === nameLower);
  const v = cat && Number(cat.max_daily_dose);
  return isFinite(v) && v > 0 ? v : null;
}

export async function getEffectSessions({ medication_id, limit } = {}) {
  await ensureInit();
  let sessions = await getArr(pkey("effectSessions"));
  if (medication_id) sessions = sessions.filter((s) => s.medication_id === medication_id);
  sessions.sort((a, b) => (b.started_at || "").localeCompare(a.started_at || ""));
  return limit ? sessions.slice(0, limit) : sessions;
}

// ---- AI insights cache (key-value per profile) ----
export async function getInsight(key) {
  await ensureInit();
  return (await getArr(pkey("insights"))).find((i) => i.key === key) || null;
}
export async function saveInsight(key, value) {
  await ensureInit();
  const items = await getArr(pkey("insights"));
  const idx = items.findIndex((i) => i.key === key);
  const doc = { key, ...value, saved_at: nowIso() };
  if (idx >= 0) items[idx] = doc; else items.push(doc);
  await setArr(pkey("insights"), items);
  return doc;
}

// ---- compute: today / inventory / analytics ----

// Where a date falls in a cyclic plan's repeating pattern.
// Returns { multiplier, phase } — multiplier 1 / phase null when the plan
// doesn't apply (not started yet, empty pattern, invalid durations).
export function cyclicMultiplierOn(plan, dateStr) {
  const none = { multiplier: 1, phase: null };
  if (!plan || plan.is_active === false) return none;
  const pattern = (plan.pattern || []).filter((p) => Number(p.duration) > 0);
  if (!pattern.length) return none;
  const total = pattern.reduce((a, p) => a + Number(p.duration), 0);
  const day = diffDays(plan.start_date, dateStr);
  if (day < 0) return none; // plan hasn't started yet
  let idx = day % total;
  for (const p of pattern) {
    if (idx < Number(p.duration)) {
      const m = Number(p.dose_multiplier);
      return { multiplier: isFinite(m) && m >= 0 ? m : 1, phase: p.phase || null };
    }
    idx -= Number(p.duration);
  }
  return none;
}

// Round to quarter-pill, the same precision the log sheet stepper uses.
function quarter(x) { return Math.max(0, Math.round(x * 4) / 4); }

// The per-dose amount actually due on a date, honoring an active taper
// (pause-aware) and an active cyclic plan. Returns { dose, quantity,
// multiplier, phase, taper_dose } — dose/quantity null when unknowable.
export function effectiveDoseInfo(med, { taper = null, cyclic = null } = {}, dateStr) {
  const { multiplier, phase } = cyclicMultiplierOn(cyclic, dateStr);
  const taperDose = taper && taper.is_active !== false ? taperDoseOnDate(taper, dateStr) : null;
  const strength = Number(med?.strength);
  const perDose = doseQuantity(med);
  const base = taperDose != null ? taperDose : (isFinite(strength) && strength > 0 ? strength * perDose : null);
  const dose = base != null ? Math.round(base * multiplier * 10000) / 10000 : null;
  const quantity = dose != null && isFinite(strength) && strength > 0 ? quarter(dose / strength) : perDose;
  return { dose, quantity, multiplier, phase, taper_dose: taperDose };
}

// One-stop default for "log a dose now": the taper/cyclic-aware amount and
// pill count for a medication today. Used by the log sheet and the AI tool so
// every entry point defaults to what is actually due, not the base strength.
export async function logDefaultsForMed(medId, dateStr) {
  await ensureInit();
  const med = (await getArr(pkey("medications"))).find((m) => m.id === medId);
  if (!med) throw new Error("Medication not found");
  const theDate = dateStr || todayStr();
  const taper = (await getArr(pkey("tapers"))).find((t) => t.medication_id === medId && t.is_active) || null;
  const cyclic = (await getArr(pkey("cyclic"))).find((c) => c.medication_id === medId && c.is_active !== false) || null;
  return effectiveDoseInfo(med, { taper, cyclic }, theDate);
}

function buildTodayDoses(meds, logsToday, forDate, tapers = [], cyclicPlans = []) {
  const wd = weekdayKeyLocal(forDate);
  // An unlogged dose on a day that's already over wasn't "pending" -- it
  // was missed. Only elapsed days get this treatment (never today), so the
  // Today page's still-actionable doses are untouched; this only affects
  // Calendar/history views of a past day, which otherwise showed "pending"
  // forever for a dose that will never be logged, contradicting the
  // calendar's own adherence dot (computed from the same taken/expected
  // counts) for that same day.
  const isElapsedDay = forDate < todayStr();
  const doses = []; const prn = [];
  const logIndex = {};
  logsToday.forEach((l) => { logIndex[`${l.medication_id}|${l.scheduled_time || ""}`] = l; });
  meds.forEach((med) => {
    if (med.is_active === false) return;
    if (med.start_date && forDate < med.start_date) return; // med didn't exist yet
    const taper = tapers.find((t) => t.medication_id === med.id && t.is_active) || null;
    const cyclic = cyclicPlans.find((c) => c.medication_id === med.id && c.is_active !== false) || null;
    const eff = effectiveDoseInfo(med, { taper, cyclic }, forDate);
    // Cyclic "off" day: no dose is due — exclude from schedule and adherence.
    if (eff.multiplier === 0) return;
    // generic_name travels with the dose because the interaction rules match
    // substances by name: someone who added "Ultram" or "Xanax" rather than
    // the generic would otherwise skip every name-level rule.
    if (med.is_prn) { prn.push({ medication_id: med.id, name: med.name, generic_name: med.generic_name, color: med.color, strength: med.strength, unit: med.unit, form: med.form, category: med.category, risk_level: med.risk_level, dependency_risk_category: med.dependency_risk_category, dose_quantity: doseQuantity(med), effective_dose: eff.dose, cyclic_phase: eff.phase, cyclic_multiplier: eff.multiplier }); return; }
    const days = med.days_of_week || WEEKDAYS;
    if (!days.includes(wd)) return;
    const times = (med.times && med.times.length) ? med.times : ["09:00"];
    times.forEach((t) => {
      const lg = logIndex[`${med.id}|${t}`];
      const status = lg ? lg.status : (isElapsedDay ? "missed" : "pending");
      doses.push({
        id: `${med.id}_${t}`, medication_id: med.id, name: med.name, generic_name: med.generic_name, color: med.color, strength: med.strength, unit: med.unit, form: med.form, time: t, scheduled_time: t, status, instructions: med.instructions, category: med.category, risk_level: med.risk_level, dependency_risk_category: med.dependency_risk_category, log_id: lg ? lg.id : null, is_tapering: !!med.is_tapering, dose_quantity: eff.quantity,
        effective_dose: eff.dose, cyclic_phase: eff.phase, cyclic_multiplier: eff.multiplier,
        taper_dose: eff.taper_dose != null ? eff.taper_dose : undefined, taper_unit: eff.taper_dose != null ? (taper?.unit || med.unit) : undefined,
        taper_paused: eff.taper_dose != null && taper?.is_paused ? true : undefined,
      });
    });
  });
  doses.sort((a, b) => a.time.localeCompare(b.time));
  return { doses, prn };
}
export async function getToday(dateStr) {
  await ensureInit();
  const theDate = dateStr || todayStr();
  const meds = await getArr(pkey("medications"));
  const allLogs = await getArr(pkey("logs"));
  const logs = allLogs.filter((l) => timestampToLocalDate(l.timestamp) === theDate);
  const tapers = await getArr(pkey("tapers"));
  const cyclicPlans = await getArr(pkey("cyclic"));
  const { doses, prn } = buildTodayDoses(meds, logs, theDate, tapers, cyclicPlans);
  const total = doses.length;
  const taken = doses.filter((x) => ["taken", "partial"].includes(x.status)).length;
  const pending = doses.filter((x) => x.status === "pending").length;
  // `prn` above is "which as-needed meds are available to log right now" (used
  // by the Today page's always-visible quick-log buttons) -- it isn't
  // date-scoped and says nothing about what actually happened on `theDate`.
  // `prn_logs` is the real history: actual as-needed doses logged that day,
  // for history views (Calendar) where "what was taken" is the point.
  const prnMedIds = new Set(meds.filter((m) => m.is_prn).map((m) => m.id));
  const prnLogs = logs
    .filter((l) => prnMedIds.has(l.medication_id))
    .map((l) => {
      const med = meds.find((m) => m.id === l.medication_id);
      return { id: l.id, medication_id: l.medication_id, name: med?.name, color: med?.color, unit: l.unit || med?.unit, strength: med?.strength, quantity: l.quantity, dose_taken: l.dose_taken, status: l.status || "taken", timestamp: l.timestamp };
    })
    .sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
  const settings = await getSettings();
  const alerts = [];
  meds.forEach((med) => {
    const inv = med.inventory;
    if (!inv || inv.current_count == null || med.is_active === false) return;
    const taper = tapers.find((t) => t.medication_id === med.id && t.is_active) || null;
    const prediction = predictRunOut({ med, logs: allLogs, taper, settings });
    const status = inventoryStatus({ med, prediction, settings });
    if (status === "out") alerts.push({ medication_id: med.id, name: med.name, type: "out", days_left: 0, run_out_date: todayStr() });
    else if (status === "low") alerts.push({ medication_id: med.id, name: med.name, type: "low", days_left: prediction.days_left, run_out_date: prediction.run_out_date, refill_by_date: prediction.refill_by_date });
  });
  return { date: theDate, doses, prn, prn_logs: prnLogs, summary: { total, taken, pending, adherence: total ? Math.round((taken / total) * 100) : 100 }, refill_alerts: alerts };
}
export async function getInventory() {
  await ensureInit();
  const meds = (await getArr(pkey("medications"))).filter((m) => m.is_active !== false);
  const allLogs = await getArr(pkey("logs"));
  const tapers = await getArr(pkey("tapers"));
  const settings = await getSettings();
  const out = [];
  meds.forEach((med) => {
    const inv = med.inventory; if (!inv) return;
    const taper = tapers.find((t) => t.medication_id === med.id && t.is_active) || null;
    const prediction = predictRunOut({ med, logs: allLogs, taper, settings });
    const status = inventoryStatus({ med, prediction, settings });
    out.push({
      medication_id: med.id, name: med.name, color: med.color, is_prn: !!med.is_prn,
      current_count: inv.current_count, unit: inv.unit, units_per_dose: doseQuantity(med),
      per_day: prediction.daily_rate, days_left: prediction.days_left,
      refill_threshold: inv.refill_threshold || 10, status,
      run_out_date: prediction.run_out_date, refill_by_date: prediction.refill_by_date,
      confidence: prediction.confidence, method: prediction.method,
    });
  });
  out.sort((a, b) => (a.days_left == null ? 1 : 0) - (b.days_left == null ? 1 : 0) || (a.days_left ?? 1e9) - (b.days_left ?? 1e9));
  return out;
}
// ---- trip / vacation planning ----
// How much of each medication to pack for a date range. Scheduled meds are
// simulated day by day through the exact same code the Today screen uses
// (buildTodayDoses), so weekday-limited schedules, cyclic off-days, and a
// taper's declining dose during the trip are all counted for real rather
// than approximated with a flat per-day rate. As-needed meds have no
// schedule to simulate, so their estimate reuses the refill predictor's
// exponentially-weighted actual daily usage. `buffer_days` adds slack for
// delays and lost doses. Dates are local "YYYY-MM-DD", inclusive on both
// ends.
export async function planTrip({ start, end, buffer_days = 2 } = {}) {
  await ensureInit();
  const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isDate(start) || !isDate(end)) throw new Error("Enter valid start and end dates");
  const tripDays = diffDays(start, end) + 1;
  if (tripDays < 1) throw new Error("The trip must end on or after the day it starts");
  if (tripDays > 366) throw new Error("Trips longer than a year aren't supported");
  const buffer = Math.max(0, Math.min(30, Math.round(Number(buffer_days) || 0)));

  const meds = await getArr(pkey("medications"));
  const activeMeds = meds.filter((m) => m.is_active !== false);
  const logs = await getArr(pkey("logs"));
  const tapers = await getArr(pkey("tapers"));
  const cyclicPlans = await getArr(pkey("cyclic"));
  const settings = await getSettings();

  // Scheduled units per med, simulated over the trip plus the buffer days
  // (the buffer is counted at end-of-trip dosing levels -- for a taper
  // that's the lower, later dose, which is the correct direction to err).
  const scheduledTrip = new Map();
  const scheduledBuffer = new Map();
  for (let i = 0; i < tripDays + buffer; i++) {
    const day = addDaysStr(start, i);
    const { doses } = buildTodayDoses(meds, [], day, tapers, cyclicPlans);
    const bucket = i < tripDays ? scheduledTrip : scheduledBuffer;
    for (const d of doses) bucket.set(d.medication_id, (bucket.get(d.medication_id) || 0) + (Number(d.dose_quantity) || 0));
  }

  const items = [];
  for (const med of activeMeds) {
    const taper = tapers.find((t) => t.medication_id === med.id && t.is_active) || null;
    let tripUnits, bufferUnits, basis, confidence = null, perDay = null;
    if (med.is_prn) {
      const prediction = predictRunOut({ med, logs, taper, settings });
      perDay = Number(prediction.daily_rate) || 0;
      if (!(perDay > 0)) {
        // No usage history to estimate from -- surface the med so it isn't
        // forgotten while packing, but be honest that there's no number.
        items.push({ medication_id: med.id, name: med.name, color: med.color, unit: med.inventory?.unit || null, form: med.form || null, is_prn: true, basis: "unknown", trip_units: null, buffer_units: null, total_units: null, per_day: null, confidence: prediction.confidence || "low", current_stock: med.inventory?.current_count ?? null, enough: null, shortfall: null, is_tapering: false, days: tripDays, buffer_days: buffer });
        continue;
      }
      tripUnits = perDay * tripDays;
      bufferUnits = perDay * buffer;
      basis = "usage";
      confidence = prediction.confidence || null;
    } else {
      tripUnits = scheduledTrip.get(med.id) || 0;
      bufferUnits = scheduledBuffer.get(med.id) || 0;
      basis = "schedule";
      if (tripUnits + bufferUnits <= 0) continue; // nothing due during the trip (e.g. taper already finished)
    }
    // Packing granularity is whole units -- nobody packs 0.4 of a capsule.
    const total = Math.ceil(tripUnits + bufferUnits);
    const stock = med.inventory?.current_count ?? null;
    items.push({
      medication_id: med.id, name: med.name, color: med.color,
      unit: med.inventory?.unit || null, form: med.form || null, is_prn: !!med.is_prn,
      basis, per_day: perDay != null ? Math.round(perDay * 100) / 100 : null, confidence,
      trip_units: Math.ceil(tripUnits), buffer_units: Math.max(0, total - Math.ceil(tripUnits)),
      total_units: total,
      current_stock: stock,
      enough: stock != null ? stock >= total : null,
      shortfall: stock != null && stock < total ? total - stock : null,
      is_tapering: !!med.is_tapering && !!taper,
      days: tripDays, buffer_days: buffer,
    });
  }
  items.sort((a, b) => (b.shortfall || 0) - (a.shortfall || 0) || (a.name || "").localeCompare(b.name || ""));
  return {
    start, end, days: tripDays, buffer_days: buffer,
    items,
    shortfalls: items.filter((x) => x.shortfall != null && x.shortfall > 0).length,
    unknowns: items.filter((x) => x.basis === "unknown").length,
  };
}

export async function getAnalytics(days = 30) {
  await ensureInit();
  const meds = await getArr(pkey("medications"));
  const tapers = await getArr(pkey("tapers"));
  const cyclicPlans = await getArr(pkey("cyclic"));
  const endStr = todayStr();
  const startStr = addDaysStr(endStr, -(days - 1));
  const allLogs = await getArr(pkey("logs"));
  const logsByDate = {};
  let logs = [];
  allLogs.forEach((l) => {
    const k = timestampToLocalDate(l.timestamp);
    if (k >= startStr && k <= endStr) { (logsByDate[k] = logsByDate[k] || []).push(l); logs.push(l); }
  });

  // As-needed meds have no schedule to be "adherent" to, so they're excluded
  // from expected/taken above by design -- but a day with only as-needed
  // activity (no scheduled meds at all) would then never show anything on
  // the Calendar's dot trend, even though real activity happened. Track it
  // separately so callers with an all-PRN medication list still get a signal.
  const prnMedIds = new Set(meds.filter((m) => m.is_prn).map((m) => m.id));
  const trend = []; let totalExpected = 0, totalTaken = 0; const perMed = {}; const streakDays = [];
  for (let i = 0; i < days; i++) {
    const dk = addDaysStr(startStr, i);
    const dayLogs = logsByDate[dk] || [];
    const { doses } = buildTodayDoses(meds, dayLogs, dk, tapers, cyclicPlans);
    const exp = doses.length; const tkn = doses.filter((x) => ["taken", "partial"].includes(x.status)).length;
    const prnTaken = dayLogs.filter((l) => prnMedIds.has(l.medication_id) && ["taken", "partial"].includes(l.status || "taken")).length;
    totalExpected += exp; totalTaken += tkn;
    trend.push({ date: dk, expected: exp, taken: tkn, adherence: exp ? Math.round((tkn / exp) * 100) : null, prn_taken: prnTaken });
    streakDays.push(exp ? tkn === exp : null);
    doses.forEach((dose) => { const s = perMed[dose.medication_id] || (perMed[dose.medication_id] = { medication_id: dose.medication_id, name: dose.name, color: dose.color, expected: 0, taken: 0 }); s.expected++; if (["taken", "partial"].includes(dose.status)) s.taken++; });
  }
  let streak = 0;
  for (let i = streakDays.length - 1; i >= 0; i--) { if (streakDays[i] === true) streak++; else if (streakDays[i] === false) break; }
  const perMedication = Object.values(perMed).map((s) => ({ ...s, adherence: s.expected ? Math.round((s.taken / s.expected) * 100) : 0 })).sort((a, b) => a.adherence - b.adherence);
  const statusBreakdown = { taken: 0, missed: 0, skipped: 0, partial: 0 };
  logs.forEach((l) => { const s = l.status || "taken"; statusBreakdown[s] = (statusBreakdown[s] || 0) + 1; });
  return { range_days: days, overall_adherence: totalExpected ? Math.round((totalTaken / totalExpected) * 100) : 100, total_expected: totalExpected, total_taken: totalTaken, current_streak: streak, trend, per_medication: perMedication, status_breakdown: statusBreakdown, active_medications: meds.filter((m) => m.is_active !== false).length };
}

// ---- export / import ----
export async function exportData() {
  await ensureInit();
  const profiles = await getArr("profiles");
  const data = { version: 2, exported_at: nowIso(), profiles, activeProfileId: _activeId, appSettings: await getSettings(), aiConfig: await getAiConfig(), catalog: await getArr("catalog"), profileData: {} };
  for (const p of profiles) {
    data.profileData[p.id] = {};
    for (const coll of PROFILE_COLLECTIONS) data.profileData[p.id][coll] = (await store.getItem(`p:${p.id}:${coll}`)) || [];
  }
  return data;
}
// Restore a backup produced by exportData (v2), or a legacy v1 single-profile
// export. Validates before writing anything: the old implementation accepted
// arbitrary JSON -- an unrelated file "imported" successfully while writing
// nothing, and a malformed one could overwrite the profile list with garbage
// (an empty profiles array orphaned every byte of real data behind a fresh
// auto-created profile). Import is atomic in intent: it either throws before
// any write, or applies the whole backup.
export async function importData(payload) {
  await ensureInit();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Not a Meditrax backup file");
  const isV2 = Array.isArray(payload.profiles) && payload.profileData && typeof payload.profileData === "object";
  const isV1 = !payload.profileData && Array.isArray(payload.medications);
  if (!isV2 && !isV1) throw new Error("Not a Meditrax backup file");
  if (isV2) {
    if (!payload.profiles.length) throw new Error("Backup contains no profiles");
    if (payload.profiles.some((p) => !p || typeof p !== "object" || typeof p.id !== "string" || !p.id)) throw new Error("Backup profile list is damaged");
  }

  if (payload.appSettings && typeof payload.appSettings === "object" && !Array.isArray(payload.appSettings)) await store.setItem("appSettings", payload.appSettings);
  if (payload.aiConfig && typeof payload.aiConfig === "object" && !Array.isArray(payload.aiConfig)) await store.setItem("aiConfig", payload.aiConfig);
  if (Array.isArray(payload.catalog) && payload.catalog.length) await setArr("catalog", payload.catalog);

  if (isV2) {
    await setArr("profiles", payload.profiles);
    const importedIds = new Set(payload.profiles.map((p) => p.id));
    for (const [pid, colls] of Object.entries(payload.profileData)) {
      // Only data belonging to a profile the backup actually lists, only
      // collections this app knows, and only well-formed arrays -- a corrupt
      // value written here would crash every later read of that collection.
      if (!importedIds.has(pid) || !colls || typeof colls !== "object") continue;
      for (const coll of PROFILE_COLLECTIONS) {
        if (Array.isArray(colls[coll])) await store.setItem(`p:${pid}:${coll}`, colls[coll]);
      }
    }
    // The active profile must exist in the list that was just imported --
    // otherwise every read/write after this targets a dead namespace and the
    // app looks like the import erased everything. Prefer the backup's own
    // choice, keep the device's current one if it survived, else first.
    const target = importedIds.has(payload.activeProfileId) ? payload.activeProfileId
      : importedIds.has(_activeId) ? _activeId
      : payload.profiles[0].id;
    _activeId = target;
    await store.setItem("activeProfileId", target);
    // Clear namespaces for profiles that no longer exist (from profiles the
    // backup didn't include, or left over from older buggy imports) so they
    // don't sit in storage forever as invisible ghosts.
    if (typeof store.keys === "function") {
      for (const key of await store.keys()) {
        const m = /^p:([^:]+):/.exec(key);
        if (m && !importedIds.has(m[1])) await store.removeItem(key);
      }
    }
  } else {
    // legacy v1 single-profile import (medications/logs arrays at top level)
    for (const coll of PROFILE_COLLECTIONS) {
      if (Array.isArray(payload[coll])) await setArr(pkey(coll), payload[coll]);
    }
  }
  return { imported: true };
}
