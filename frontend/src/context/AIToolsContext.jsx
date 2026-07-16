import { createContext, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/context/ThemeContext";
import { useProfiles } from "@/context/ProfileContext";
import * as db from "@/lib/localdb";
import { MED_COLORS, FREQUENCY_TIMES, WEEKDAYS } from "@/lib/format";
import { suggestTaperParams } from "@/lib/taperEngine";
import { analyzeMedication, analyzeAll, SAFETY_COPY } from "@/lib/behavior";
import { unifyMoodEntries, moodDailySeries, moodTrend } from "@/lib/moodAnalytics";

const AIToolsContext = createContext(null);
export const useAITools = () => useContext(AIToolsContext);

const ROUTES = [
  "/", "/medications", "/calendar", "/insights", "/inventory", "/taper",
  "/cyclic", "/knowledge", "/assistant", "/effects", "/reminders",
  "/profile", "/settings", "/more", "/legal",
];

// OpenAI / OpenRouter compatible tool definitions.
export const TOOL_SCHEMA = [
  { type: "function", function: { name: "set_theme", description: "Change the app's color theme.", parameters: { type: "object", properties: { theme: { type: "string", enum: ["light", "dark", "system"] } }, required: ["theme"] } } },
  { type: "function", function: { name: "list_profiles", description: "List all family profiles in the app.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "switch_profile", description: "Switch the active family profile by name.", parameters: { type: "object", properties: { name: { type: "string", description: "Profile name to switch to" } }, required: ["name"] } } },
  { type: "function", function: { name: "create_profile", description: "Create a new family profile.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "list_medications", description: "List the active profile's medications (use to resolve names/ids).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "add_medication", description: "Add a medication to the active profile.", parameters: { type: "object", properties: { name: { type: "string" }, strength: { type: "number" }, unit: { type: "string" }, frequency: { type: "string", enum: ["once_daily", "twice_daily", "three_times_daily", "four_times_daily", "every_other_day", "weekly", "as_needed"] }, times: { type: "array", items: { type: "string" }, description: "24h HH:MM times" }, is_prn: { type: "boolean" }, category: { type: "string" }, instructions: { type: "string" } }, required: ["name"] } } },
  { type: "function", function: { name: "update_medication", description: "Update an existing medication (resolve by name or id).", parameters: { type: "object", properties: { name: { type: "string" }, id: { type: "string" }, strength: { type: "number" }, unit: { type: "string" }, frequency: { type: "string" }, times: { type: "array", items: { type: "string" } }, instructions: { type: "string" }, notes: { type: "string" } }, required: [] } } },
  { type: "function", function: { name: "delete_medication", description: "Delete a medication and its logs/plans (resolve by name or id).", parameters: { type: "object", properties: { name: { type: "string" }, id: { type: "string" } }, required: [] } } },
  { type: "function", function: { name: "log_dose", description: "Log a dose for a medication. Supports retroactive logging via 'when'.", parameters: { type: "object", properties: { medication: { type: "string", description: "Medication name" }, status: { type: "string", enum: ["taken", "skipped", "missed", "partial"] }, dose: { type: "number" }, time: { type: "string", description: "scheduled time HH:MM (optional)" }, when: { type: "string", description: "when the dose was actually taken, local datetime like 2026-07-15T21:30 (optional, defaults to now, must not be in the future)" } }, required: ["medication"] } } },
  { type: "function", function: { name: "create_taper_plan", description: "Create a tapering plan for a medication.", parameters: { type: "object", properties: { medication: { type: "string" }, method: { type: "string", enum: ["linear", "exponential", "hyperbolic"] }, initial_dose: { type: "number" }, final_dose: { type: "number" }, total_days: { type: "number" }, step_interval_days: { type: "number" } }, required: ["medication"] } } },
  { type: "function", function: { name: "get_today", description: "Get today's dose schedule and adherence summary for the active profile.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_inventory", description: "Get inventory / refill projections for the active profile.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "get_analytics", description: "Get adherence analytics for the active profile.", parameters: { type: "object", properties: { days: { type: "number" } } } } },
  { type: "function", function: { name: "navigate", description: "Navigate to a page in the app.", parameters: { type: "object", properties: { path: { type: "string", description: "e.g. /medications, /insights, /taper, /knowledge, /settings" } }, required: ["path"] } } },
  { type: "function", function: { name: "get_refill_prediction", description: "Predict when medication inventory runs out (run-out date, refill-by date, daily rate, confidence). Omit medication for all tracked meds.", parameters: { type: "object", properties: { medication: { type: "string", description: "Medication name (optional)" } } } } },
  { type: "function", function: { name: "get_behavior_analysis", description: "Get the deterministic usage-pattern / dependency-signal analysis for the user's medications (educational, not diagnostic). Omit medication for all applicable meds.", parameters: { type: "object", properties: { medication: { type: "string", description: "Medication name (optional)" } } } } },
  { type: "function", function: { name: "log_mood_checkin", description: "Save a standalone mood check-in for the user (mood 1=bad … 5=great; optional 1-5 dimensions).", parameters: { type: "object", properties: { mood: { type: "number", description: "1-5" }, energy: { type: "number" }, sleep: { type: "number" }, pain: { type: "number" }, anxiety: { type: "number" }, notes: { type: "string" } }, required: ["mood"] } } },
  { type: "function", function: { name: "get_mood_trends", description: "Get the user's mood trend (average, direction, recent daily values) from check-ins and dose logs.", parameters: { type: "object", properties: { days: { type: "number", description: "Window in days, default 30" } } } } },
];

export function AIToolsProvider({ children }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setTheme } = useTheme();
  const { profiles, switchProfile, addProfile } = useProfiles();

  const invalidateAll = useCallback(() => {
    ["today", "medications", "medication", "inventory", "analytics", "tapers", "taper", "cyclic", "reminders", "logs", "checkins"].forEach((k) =>
      qc.invalidateQueries({ queryKey: [k] })
    );
  }, [qc]);

  const resolveMed = useCallback(async (ref) => {
    if (!ref) return null;
    const meds = await db.getMedications();
    const r = String(ref).toLowerCase();
    return (
      meds.find((m) => m.id === ref) ||
      meds.find((m) => (m.name || "").toLowerCase() === r) ||
      meds.find((m) => (m.name || "").toLowerCase().includes(r)) ||
      null
    );
  }, []);

  const executeTool = useCallback(async (name, args = {}) => {
    switch (name) {
      case "set_theme": {
        const t = args.theme;
        if (!["light", "dark", "system"].includes(t)) return { error: "theme must be light, dark or system" };
        setTheme(t);
        return { ok: true, theme: t };
      }
      case "list_profiles":
        return { profiles: profiles.map((p) => ({ id: p.id, name: p.name })) };
      case "switch_profile": {
        const target = String(args.name || "").toLowerCase();
        const p = profiles.find((x) => x.name.toLowerCase() === target) || profiles.find((x) => x.id === args.name);
        if (!p) return { error: `No profile named "${args.name}". Available: ${profiles.map((x) => x.name).join(", ")}` };
        await switchProfile(p.id);
        return { ok: true, active_profile: p.name };
      }
      case "create_profile": {
        if (!args.name) return { error: "name required" };
        const p = await addProfile({ name: args.name });
        return { ok: true, created: p.name, id: p.id };
      }
      case "list_medications": {
        const meds = await db.getMedications();
        return { medications: meds.map((m) => ({ id: m.id, name: m.name, strength: m.strength, unit: m.unit, frequency: m.frequency, times: m.times, is_prn: m.is_prn, is_active: m.is_active !== false })) };
      }
      case "add_medication": {
        if (!args.name) return { error: "name required" };
        const freq = args.frequency && FREQUENCY_TIMES[args.frequency] ? args.frequency : (args.is_prn ? "as_needed" : "once_daily");
        const med = await db.createMedication({
          name: args.name,
          strength: args.strength != null ? Number(args.strength) : null,
          unit: args.unit || "mg",
          form: args.form || "tablet",
          category: args.category || "other",
          color: MED_COLORS[Math.floor(Math.random() * MED_COLORS.length)],
          frequency: freq,
          times: Array.isArray(args.times) && args.times.length ? args.times : (FREQUENCY_TIMES[freq] || ["09:00"]),
          days_of_week: WEEKDAYS.slice(),
          is_prn: freq === "as_needed",
          instructions: args.instructions || "",
          notes: "",
          risk_level: "low",
          dependency_risk_category: "none",
        });
        invalidateAll();
        return { ok: true, added: med.name, id: med.id };
      }
      case "update_medication": {
        const med = await resolveMed(args.name || args.id);
        if (!med) return { error: "medication not found" };
        const patch = {};
        ["unit", "instructions", "notes", "frequency", "category"].forEach((k) => { if (args[k] != null) patch[k] = args[k]; });
        if (args.strength != null) patch.strength = Number(args.strength);
        if (Array.isArray(args.times)) patch.times = args.times;
        else if (args.frequency && FREQUENCY_TIMES[args.frequency]) patch.times = FREQUENCY_TIMES[args.frequency];
        const up = await db.updateMedication(med.id, patch);
        invalidateAll();
        return { ok: true, updated: up.name };
      }
      case "delete_medication": {
        const med = await resolveMed(args.name || args.id);
        if (!med) return { error: "medication not found" };
        await db.deleteMedication(med.id);
        invalidateAll();
        return { ok: true, deleted: med.name };
      }
      case "log_dose": {
        const med = await resolveMed(args.medication || args.name);
        if (!med) return { error: "medication not found" };
        const status = ["taken", "skipped", "missed", "partial"].includes(args.status) ? args.status : "taken";
        let timestamp;
        if (args.when) {
          const d = new Date(args.when); // local datetime strings parse in local time
          if (isNaN(d.getTime())) return { error: "invalid 'when' datetime" };
          if (d.getTime() > Date.now() + 60000) return { error: "'when' cannot be in the future" };
          timestamp = d.toISOString();
        }
        // Default the amount to what's actually due (taper/cyclic-aware), not base strength.
        const defaults = await db.logDefaultsForMed(med.id).catch(() => null);
        const strength = Number(med.strength);
        const doseTaken = args.dose != null ? Number(args.dose) : (defaults?.dose ?? med.strength);
        const quantity = args.dose != null && isFinite(strength) && strength > 0
          ? Math.max(0, Math.round((Number(args.dose) / strength) * 4) / 4)
          : defaults?.quantity;
        await db.createLog({ medication_id: med.id, status, dose_taken: doseTaken, unit: med.unit, scheduled_time: args.time || null, ...(quantity != null ? { quantity } : {}), ...(timestamp ? { timestamp } : {}) });
        invalidateAll();
        return { ok: true, logged: med.name, status, dose: doseTaken, ...(timestamp ? { at: timestamp } : {}) };
      }
      case "create_taper_plan": {
        const med = await resolveMed(args.medication || args.name);
        if (!med) return { error: "medication not found" };
        const sug = suggestTaperParams(med);
        const initial = args.initial_dose != null ? Number(args.initial_dose) : (med.strength || 0);
        if (!initial) return { error: "initial_dose required (medication has no strength on file)" };
        const total_days = Number(args.total_days || sug.suggested_weeks * 7);
        const taper = await db.createTaper({
          medication_id: med.id,
          initial_dose: initial,
          final_dose: args.final_dose != null ? Number(args.final_dose) : 0,
          unit: med.unit || "mg",
          method: args.method || sug.method,
          total_days,
          step_interval_days: Number(args.step_interval_days || sug.step_interval_days),
        });
        invalidateAll();
        return { ok: true, taper_id: taper.id, medication: med.name, method: taper.method, steps: taper.schedule.steps.length };
      }
      case "get_today": {
        const t = await db.getToday();
        return { date: t.date, summary: t.summary, doses: (t.doses || []).map((d) => ({ name: d.name, time: d.time, status: d.status })), refill_alerts: t.refill_alerts };
      }
      case "get_inventory": {
        const inv = await db.getInventory();
        return { inventory: inv };
      }
      case "get_analytics": {
        const a = await db.getAnalytics(Number(args.days || 30));
        return { overall_adherence: a.overall_adherence, current_streak: a.current_streak, range_days: a.range_days, active_medications: a.active_medications };
      }
      case "navigate": {
        let path = String(args.path || "");
        if (!path.startsWith("/")) path = "/" + path;
        const base = "/" + path.split("/")[1];
        if (!ROUTES.includes(base) && !ROUTES.includes(path)) return { error: `Unknown page "${path}"` };
        navigate(path);
        return { ok: true, navigated: path };
      }
      case "get_refill_prediction": {
        const inv = await db.getInventory();
        const filtered = args.medication
          ? inv.filter((i) => i.name.toLowerCase().includes(String(args.medication).toLowerCase()))
          : inv;
        if (args.medication && !filtered.length) return { error: `No tracked inventory found for "${args.medication}"` };
        return {
          predictions: filtered.map((i) => ({
            name: i.name, current_count: i.current_count, unit: i.unit, status: i.status,
            days_left: i.days_left, run_out_date: i.run_out_date, refill_by_date: i.refill_by_date,
            daily_rate: i.per_day, confidence: i.confidence, method: i.method,
          })),
        };
      }
      case "get_behavior_analysis": {
        const [meds, logs, checkins, catalog, tapers] = await Promise.all([
          db.getMedications(), db.getLogs({ limit: 1000 }), db.getCheckins({ limit: 500 }), db.getKnowledge(), db.getTapers(),
        ]);
        if (args.medication) {
          const r = String(args.medication).toLowerCase();
          const med = meds.find((m) => (m.name || "").toLowerCase() === r) || meds.find((m) => (m.name || "").toLowerCase().includes(r));
          if (!med) return { error: "medication not found" };
          const catalogEntry = (med.catalog_id && catalog.find((c) => c.id === med.catalog_id)) || catalog.find((c) => c.name_lower === (med.name || "").toLowerCase()) || null;
          const a = analyzeMedication({ med, logs, checkins, catalogEntry, taper: tapers.find((t) => t.medication_id === med.id && t.is_active) || null });
          return { framing: SAFETY_COPY.framing, analysis: { name: a.name, applicable: a.applicable, level: a.level, score: a.score, data_quality: a.data_quality, signals: (a.signals || []).map((s) => ({ label: s.label, detail: s.detail })) } };
        }
        const report = analyzeAll({ meds, logs, checkins, catalog, tapers });
        return {
          framing: SAFETY_COPY.framing,
          medications: report.per_med.map((a) => ({ name: a.name, level: a.level, score: a.score, data_quality: a.data_quality, signals: (a.signals || []).map((s) => s.label) })),
        };
      }
      case "log_mood_checkin": {
        const mood = Number(args.mood);
        if (!(mood >= 1 && mood <= 5)) return { error: "mood must be 1-5" };
        const c = await db.createCheckin({ mood, energy: args.energy, sleep: args.sleep, pain: args.pain, anxiety: args.anxiety, notes: args.notes || null });
        invalidateAll();
        return { ok: true, checkin_id: c.id, mood: c.mood };
      }
      case "get_mood_trends": {
        const days = Math.min(90, Math.max(7, Number(args.days || 30)));
        const [logs, checkins] = await Promise.all([db.getLogs({ limit: 1000 }), db.getCheckins({ limit: 500 })]);
        const series = moodDailySeries(unifyMoodEntries(checkins, logs), { days });
        const trend = moodTrend(series);
        return { days, average: trend.avg, direction: trend.direction, days_with_data: trend.n, last_14_days: series.slice(-14).map((p) => ({ date: p.date, mood: p.mood })) };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }, [profiles, switchProfile, addProfile, setTheme, navigate, invalidateAll, resolveMed]);

  return (
    <AIToolsContext.Provider value={{ tools: TOOL_SCHEMA, executeTool }}>
      {children}
    </AIToolsContext.Provider>
  );
}
