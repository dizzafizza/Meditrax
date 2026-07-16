// Local (on-device) notifications for the static PWA — no server, no VAPID.
// Reminders are scheduled in-page while the app is open / installed (best-effort).
import * as db from "./localdb";

const ENABLED_KEY = "meditrax-notif-enabled";

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
export function pushSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}
export function notifEnabledFlag() {
  return localStorage.getItem(ENABLED_KEY) === "1";
}

export async function getRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.ready; } catch (e) { return null; }
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("unsupported");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("denied");
  localStorage.setItem(ENABLED_KEY, "1");
  await scheduleAllReminders();
  return true;
}

export async function disablePush() {
  localStorage.setItem(ENABLED_KEY, "0");
  clearScheduled();
  return true;
}

export async function pushStatus() {
  if (!pushSupported()) return { supported: false, permission: "unsupported", subscribed: false };
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: notifEnabledFlag() && Notification.permission === "granted",
  };
}

export async function showLocalNotification(title, body, data = {}) {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const opts = {
    body,
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    tag: data.tag || "meditrax",
    data: { url: data.url || "/" },
    vibrate: [80, 40, 80],
  };
  try {
    const reg = await getRegistration();
    if (reg && reg.showNotification) { await reg.showNotification(title, opts); return true; }
    // eslint-disable-next-line no-new
    new Notification(title, opts);
    return true;
  } catch (e) { return false; }
}

export async function sendTestNotification(title = "Meditrax", body = "Test reminder — notifications are working!") {
  if (!pushSupported()) return false;
  if (Notification.permission !== "granted") {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;
    localStorage.setItem(ENABLED_KEY, "1");
  }
  return showLocalNotification(title, body, { tag: "meditrax-test" });
}

// ---- in-page scheduling (foreground / installed best-effort) ----
let timers = [];
export function clearScheduled() {
  timers.forEach((t) => clearTimeout(t));
  timers = [];
}

// "HH:MM" is inside the quiet window? Handles overnight windows (22:00–07:00).
function inQuietHours(date, quiet) {
  if (!quiet?.enabled || !quiet.start || !quiet.end) return false;
  const p = (n) => String(n).padStart(2, "0");
  const hm = `${p(date.getHours())}:${p(date.getMinutes())}`;
  return quiet.start <= quiet.end
    ? hm >= quiet.start && hm < quiet.end
    : hm >= quiet.start || hm < quiet.end;
}

export async function scheduleAllReminders() {
  clearScheduled();
  if (!pushSupported() || Notification.permission !== "granted" || !notifEnabledFlag()) return 0;
  let today, settings, reminders, meds;
  try {
    [today, settings, reminders, meds] = await Promise.all([
      db.getToday(), db.getSettings(), db.getReminders(), db.getMedications(),
    ]);
  } catch (e) { return 0; }
  const now = new Date();
  const HORIZON_MS = 16 * 60 * 60 * 1000; // setTimeout reliability window
  const leadMin = Math.max(0, Number(settings?.notifications?.lead_minutes) || 0);
  const quiet = settings?.quiet_hours;
  let scheduled = 0;

  const scheduleAt = (when, title, body, tag) => {
    const delay = when - now;
    if (delay <= 0 || delay > HORIZON_MS) return false;
    if (inQuietHours(when, quiet)) return false;
    timers.push(setTimeout(() => showLocalNotification(title, body, { tag, url: "/" }), delay));
    scheduled++;
    return true;
  };

  // Scheduled doses still pending today (lead time applies here).
  (today.doses || []).forEach((dose) => {
    if (dose.status !== "pending" || !dose.time) return;
    const [h, m] = dose.time.split(":").map(Number);
    const when = new Date();
    when.setHours(h, m - leadMin, 0, 0);
    const amount = dose.effective_dose ?? dose.strength; // taper/cyclic-aware
    const label = amount ? `${dose.name} · ${amount} ${dose.unit || ""}`.trim() : dose.name;
    scheduleAt(when, "Time for your medication", label, `dose-${dose.id}`);
  });

  // User-created reminders (Reminders page) matching today's weekday.
  const wd = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()];
  (reminders || []).forEach((r) => {
    if (r.is_active === false || !r.time) return;
    if (r.days_of_week?.length && !r.days_of_week.includes(wd)) return;
    // A pending dose at the same time already notifies — don't double up.
    const dupe = (today.doses || []).some((d) => d.medication_id === r.medication_id && d.time === r.time);
    if (dupe) return;
    const [h, m] = r.time.split(":").map(Number);
    const when = new Date();
    when.setHours(h, m, 0, 0);
    const med = (meds || []).find((x) => x.id === r.medication_id);
    scheduleAt(when, "Medication reminder", med?.name || "Time for your medication", `rem-${r.id}`);
  });

  return scheduled;
}
