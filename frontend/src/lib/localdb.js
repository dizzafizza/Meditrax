// Meditrax local-first data layer (IndexedDB via localforage).
// Profile-scoped collections + catalog + settings + AI config + computed views.
import localforage from "localforage";
import { CATALOG_SEED } from "./catalogSeed";
import { generateTaperSchedule, taperDoseOnDate, suggestTaperParams } from "./taperEngine";
import { personalizedProfile, observationsFromSession, updateModel } from "./effectsEngine";
import { localDateStr, addDaysStr, diffDays, timestampToLocalDate, weekdayKeyLocal } from "./dates";
import { doseQuantity, predictRunOut, inventoryStatus, taperState } from "./predictor";

const store = localforage.createInstance({ name: "meditrax", storeName: "meditrax_v1" });

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const PROFILE_COLORS = ["#2A767B", "#E08A3C", "#7A6FB0", "#3E7CB1", "#B0436F", "#5B8C5A"];
// Every profile-scoped collection. Referenced by deleteProfile / export / import
// so new collections can't be forgotten in one of the three places.
export const PROFILE_COLLECTIONS = ["medications", "logs", "reminders", "tapers", "cyclic", "chat", "checkins", "insights", "effectSessions", "effectModels", "effectVersions"];

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
};

const DEFAULT_SETTINGS = {
  theme: "system", time_format: "12h",
  notifications: { enabled: true, lead_minutes: 0 },
  quiet_hours: { enabled: false, start: "22:00", end: "07:00" },
  refill_threshold_days: 7,
  refill_lead_days: 3,
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
    }
    if (!(await store.getItem("appSettings"))) await store.setItem("appSettings", DEFAULT_SETTINGS);
    if (!(await store.getItem("aiConfig"))) await store.setItem("aiConfig", DEFAULT_AI_CONFIG);
  })();
  return _initPromise;
}

function pkey(coll) { return `p:${_activeId}:${coll}`; }

export async function listProfiles() { await ensureInit(); return await getArr("profiles"); }
export async function getActiveProfileId() { await ensureInit(); return _activeId; }
export async function setActiveProfile(id) {
  await ensureInit();
  const profiles = await getArr("profiles");
  if (profiles.find((p) => p.id === id)) { _activeId = id; await store.setItem("activeProfileId", id); }
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
export async function getAiConfig() { await ensureInit(); const c = (await store.getItem("aiConfig")) || {}; return { ...DEFAULT_AI_CONFIG, ...c, apiKeys: { ...DEFAULT_AI_CONFIG.apiKeys, ...(c.apiKeys || {}) }, personality: { ...DEFAULT_AI_CONFIG.personality, ...(c.personality || {}) }, modelTiers: { ...DEFAULT_AI_CONFIG.modelTiers, ...(c.modelTiers || {}) } }; }
export async function updateAiConfig(patch) { await ensureInit(); const c = await getAiConfig(); const merged = { ...c, ...patch, apiKeys: { ...c.apiKeys, ...(patch.apiKeys || {}) }, personality: { ...c.personality, ...(patch.personality || {}) }, modelTiers: { ...c.modelTiers, ...(patch.modelTiers || {}) } }; await store.setItem("aiConfig", merged); return merged; }

// ---- profile (active) ----
export async function getProfile() { await ensureInit(); const profiles = await getArr("profiles"); return profiles.find((p) => p.id === _activeId); }
export async function updateProfile(patch) { await ensureInit(); return updateProfileById(_activeId, patch); }

// ---- catalog / knowledge ----
function scoreDoc(d, terms) {
  const hay = `${d.name} ${d.generic_name || ""} ${(d.brand_names || []).join(" ")} ${d.drug_class || ""} ${d.category || ""} ${d.content || ""}`.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (!t) continue;
    if (d.name_lower?.startsWith(t)) score += 12;
    if (d.name_lower?.includes(t)) score += 8;
    if ((d.generic_name || "").toLowerCase().includes(t)) score += 6;
    if ((d.brand_names || []).some((b) => b.toLowerCase().includes(t))) score += 6;
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

// Forget everything learned about a medication's timing and fall back to the
// typical profile. Active sessions for that med re-derive their curve too.
// Bumps the version counter so no earlier session can later "undo" past this
// point — a Reset is a deliberate, permanent forget.
export async function resetEffectModel(medication_id) {
  await ensureInit();
  const models = await getArr(pkey("effectModels"));
  await setArr(pkey("effectModels"), models.filter((m) => m.medication_id !== medication_id));
  await bumpEffectModelVersion(medication_id);
  const sessions = await getArr(pkey("effectSessions"));
  const med = (await getArr(pkey("medications"))).find((m) => m.id === medication_id) || {};
  let changed = false;
  sessions.forEach((s) => {
    if (s.medication_id === medication_id && s.status === "active") {
      s.profile = personalizedProfile(med, null, s.dose);
      s.updated_at = nowIso();
      changed = true;
    }
  });
  if (changed) await setArr(pkey("effectSessions"), sessions);
  return { reset: true };
}

export async function startEffectSession({ medication_id, dose = null, unit = null, log_id = null, started_at = null }) {
  await ensureInit();
  const med = (await getArr(pkey("medications"))).find((m) => m.id === medication_id);
  if (!med) throw new Error("Medication not found");
  const sessions = await getArr(pkey("effectSessions"));
  // One active session per medication — starting again replaces silently
  // confusing duplicates with a clean restart.
  sessions.forEach((s) => { if (s.medication_id === medication_id && s.status === "active") { s.status = "discarded"; s.ended_at = nowIso(); } });
  const model = (await getArr(pkey("effectModels"))).find((m) => m.medication_id === medication_id) || null;
  const doc = {
    id: uid(), medication_id, log_id,
    dose: dose != null && isFinite(Number(dose)) ? Number(dose) : null,
    unit: unit || med.unit || null,
    started_at: started_at && !isNaN(new Date(started_at).getTime()) ? new Date(started_at).toISOString() : nowIso(),
    ended_at: null, status: "active", events: [],
    profile: personalizedProfile(med, model, dose), // snapshot used for this session
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
    const med = (await getArr(pkey("medications"))).find((m) => m.id === s.medication_id) || {};
    const model = (await getArr(pkey("effectModels"))).find((m) => m.medication_id === s.medication_id) || null;
    s.profile = personalizedProfile(med, model, v);
  }
  s.updated_at = nowIso();
  await setArr(pkey("effectSessions"), sessions);
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
  if (learn) {
    const med = (await getArr(pkey("medications"))).find((m) => m.id === s.medication_id) || {};
    const obs = observationsFromSession(s);
    if (obs.onset_min != null || obs.peak_min != null || obs.end_min != null) {
      // Snapshot the exact prior model so this training step can be undone.
      const prev = await getEffectModel(s.medication_id);
      s.model_before = prev || null;
      const next = updateModel(prev, obs, s.dose, med);
      next.medication_id = s.medication_id;
      await saveEffectModel(next);
      s.model_after_version = await bumpEffectModelVersion(s.medication_id);
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
  s.updated_at = nowIso();
  await setArr(pkey("effectSessions"), sessions);
  return s;
}

// Active sessions with their medication attached. Sessions long past their
// predicted end (2× duration) auto-complete without learning — silence isn't
// feedback.
export async function getActiveEffectSessions() {
  await ensureInit();
  const sessions = await getArr(pkey("effectSessions"));
  const meds = await getArr(pkey("medications"));
  const now = Date.now();
  let changed = false;
  sessions.forEach((s) => {
    if (s.status !== "active") return;
    const dur = (s.profile?.duration_min || 360) * 60000;
    if (now - new Date(s.started_at).getTime() > dur * 2) { s.status = "completed"; s.ended_at = nowIso(); changed = true; }
  });
  if (changed) await setArr(pkey("effectSessions"), sessions);
  return sessions
    .filter((s) => s.status === "active")
    .sort((a, b) => (b.started_at || "").localeCompare(a.started_at || ""))
    .map((s) => {
      const m = meds.find((x) => x.id === s.medication_id);
      return { ...s, medication_name: m?.name || "Medication", medication_color: m?.color || "#2A767B", medication_unit: m?.unit || s.unit };
    });
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
    if (med.is_prn) { prn.push({ medication_id: med.id, name: med.name, color: med.color, strength: med.strength, unit: med.unit, category: med.category, risk_level: med.risk_level, dependency_risk_category: med.dependency_risk_category, dose_quantity: doseQuantity(med), effective_dose: eff.dose, cyclic_phase: eff.phase, cyclic_multiplier: eff.multiplier }); return; }
    const days = med.days_of_week || WEEKDAYS;
    if (!days.includes(wd)) return;
    const times = (med.times && med.times.length) ? med.times : ["09:00"];
    times.forEach((t) => {
      const lg = logIndex[`${med.id}|${t}`];
      doses.push({
        id: `${med.id}_${t}`, medication_id: med.id, name: med.name, color: med.color, strength: med.strength, unit: med.unit, form: med.form, time: t, scheduled_time: t, status: lg ? lg.status : "pending", instructions: med.instructions, category: med.category, risk_level: med.risk_level, dependency_risk_category: med.dependency_risk_category, log_id: lg ? lg.id : null, is_tapering: !!med.is_tapering, dose_quantity: eff.quantity,
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
  return { date: theDate, doses, prn, summary: { total, taken, pending, adherence: total ? Math.round((taken / total) * 100) : 100 }, refill_alerts: alerts };
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

  const trend = []; let totalExpected = 0, totalTaken = 0; const perMed = {}; const streakDays = [];
  for (let i = 0; i < days; i++) {
    const dk = addDaysStr(startStr, i);
    const { doses } = buildTodayDoses(meds, logsByDate[dk] || [], dk, tapers, cyclicPlans);
    const exp = doses.length; const tkn = doses.filter((x) => ["taken", "partial"].includes(x.status)).length;
    totalExpected += exp; totalTaken += tkn;
    trend.push({ date: dk, expected: exp, taken: tkn, adherence: exp ? Math.round((tkn / exp) * 100) : null });
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
export async function importData(payload) {
  await ensureInit();
  if (payload.profiles) await setArr("profiles", payload.profiles);
  if (payload.appSettings) await store.setItem("appSettings", payload.appSettings);
  if (payload.aiConfig) await store.setItem("aiConfig", payload.aiConfig);
  if (payload.catalog) await setArr("catalog", payload.catalog);
  if (payload.profileData) {
    for (const [pid, colls] of Object.entries(payload.profileData)) {
      for (const [coll, arr] of Object.entries(colls)) await store.setItem(`p:${pid}:${coll}`, arr);
    }
  }
  // legacy v1 single-profile import (medications/logs arrays at top level)
  if (!payload.profileData && payload.medications) {
    for (const coll of PROFILE_COLLECTIONS) if (payload[coll]) await setArr(pkey(coll), payload[coll]);
  }
  if (payload.activeProfileId) await setActiveProfile(payload.activeProfileId);
  return { imported: true };
}
