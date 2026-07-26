// Periodic AI-written digest -- best-effort client-side scheduling, the same
// pattern push.js already uses for reminders: there's no server to run this
// on a real clock, so "due" is checked whenever the app is opened or comes
// back to the foreground. Unlike a reminder notification (which only fires
// in a forward setTimeout window and is simply missed if the app wasn't
// open at that exact moment), a digest whose scheduled time has already
// passed is generated late on the next open rather than skipped entirely --
// the better trade-off for something meant to summarize a whole day/week
// rather than mark a single instant.
import { getAiConfig, updateAiConfig, getMedications, getAnalytics, getInventory, getCheckins, getKnowledge, getTapers, getLogs, getActiveEffectSessions, getMedicationTolerance, describeActiveSession, addChatMessage } from "./localdb";
import { analyzeAll } from "./behavior";
import { unifyMoodEntries, moodDailySeries, moodTrend } from "./moodAnalytics";
import { buildDigestPayload, generateDigest } from "./aiInsights";
import { hasKey, sessionId } from "./ai";
import { toleranceBand } from "./toleranceEngine";
import { showLocalNotification } from "./push";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// The scheduled instant for the period `now` falls in -- today's time-of-day
// for a daily digest, or this calendar week's configured weekday+time for a
// weekly one. Deliberately never rewound to a past period just because that
// slot hasn't happened yet today/this week: that's what stops enabling the
// feature at, say, 8am with a 9pm send time from being treated as instantly
// overdue for a slot that's actually still hours away. Pure and
// independently testable so the due-check doesn't need a running clock or a
// live AI config to verify.
function currentPeriodOccurrence(now, time, weekday) {
  const [h, m] = (time || "09:00").split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (weekday) {
    const target = WEEKDAY_KEYS.indexOf(weekday);
    let diff = d.getDay() - (target < 0 ? 1 : target);
    if (diff < 0) diff += 7;
    d.setDate(d.getDate() - diff);
  }
  return d;
}

export function isDigestDue(digest, now = new Date()) {
  if (!digest?.enabled) return false;
  const occurrence = currentPeriodOccurrence(now, digest.time, digest.frequency === "weekly" ? (digest.weekday || "mon") : null);
  if (now.getTime() < occurrence.getTime()) return false; // this period's slot hasn't arrived yet
  const last = digest.last_generated_at ? new Date(digest.last_generated_at) : null;
  // Not sent since the current period's slot arrived -- covers both "never
  // sent" and "sent for an earlier period," including one or more entirely
  // missed periods, which are caught up on the next open rather than
  // skipped (see the module comment).
  return !last || last.getTime() < occurrence.getTime();
}

async function gatherPayload() {
  const now = Date.now();
  const [meds, analytics, inventory, checkins, catalog, tapers, logs, sessions] = await Promise.all([
    getMedications(), getAnalytics(30), getInventory(), getCheckins({ limit: 500 }), getKnowledge(), getTapers(), getLogs({ limit: 1000 }), getActiveEffectSessions(),
  ]);
  const behaviorReport = analyzeAll({ meds, logs, checkins, catalog, tapers });
  const series = moodDailySeries(unifyMoodEntries(checkins, logs), { days: 30 });
  const trend = moodTrend(series);

  const activeEffects = sessions.map((s) => {
    const d = describeActiveSession(s, now);
    return { medication: s.medication_name, phase: d.phase, intensity_pct: d.intensity_pct };
  });

  const tolerance = [];
  for (const m of meds) {
    if (m.is_active === false) continue;
    const t = await getMedicationTolerance(m.id);
    if (!t) continue;
    tolerance.push({
      medication: m.name, applicable: true, faded: !!t.faded,
      band: toleranceBand(t.level).toLowerCase(),
      weaker_pct: t.maxDampening != null ? Math.round(t.level * t.maxDampening * 100) : null,
    });
  }

  return buildDigestPayload({ analytics, inventory, behaviorReport, moodTrend: trend, moodSeries: series, meds, activeEffects, tolerance });
}

export async function runDigest({ config, customPrompt } = {}) {
  const cfg = config || (await getAiConfig());
  const payload = await gatherPayload();
  const { text, model } = await generateDigest({ config: cfg, payload, customPrompt: customPrompt ?? cfg?.digest?.customPrompt });
  return { text, model, payload };
}

async function deliverDigest(text) {
  await addChatMessage(sessionId(), "assistant", text);
  await updateAiConfig({ digest: { last_generated_at: new Date().toISOString() } });
  const firstLine = text.split("\n").map((l) => l.replace(/^#+\s*/, "").trim()).find(Boolean) || "Your digest is ready";
  showLocalNotification("Meditrax digest", firstLine.slice(0, 150), { tag: "meditrax-digest", url: "/assistant" }).catch(() => {});
}

// Checked on every app open/foreground (see App.js) -- generates and
// delivers straight into the assistant's one chat thread if a scheduled
// digest is due and hasn't been sent yet. Silently does nothing otherwise:
// no key, disabled, not due, or a failed generation -- which deliberately
// leaves last_generated_at untouched so it's retried on the next open
// rather than skipped for the whole period.
export async function maybeRunDigest() {
  try {
    const config = await getAiConfig();
    if (!hasKey(config) || !isDigestDue(config.digest)) return false;
    const { text } = await runDigest({ config });
    await deliverDigest(text);
    return true;
  } catch (e) {
    return false;
  }
}

// "Send me one now" from Settings -- bypasses the due-check but still marks
// it as sent, so a real scheduled digest doesn't also fire moments later
// for the same period.
export async function sendDigestNow(config) {
  const { text } = await runDigest({ config });
  await deliverDigest(text);
  return text;
}
