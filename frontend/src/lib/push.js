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

export async function scheduleAllReminders() {
  clearScheduled();
  if (!pushSupported() || Notification.permission !== "granted" || !notifEnabledFlag()) return 0;
  let today;
  try { today = await db.getToday(); } catch (e) { return 0; }
  const now = new Date();
  const HORIZON_MS = 16 * 60 * 60 * 1000; // setTimeout reliability window
  let scheduled = 0;
  (today.doses || []).forEach((dose) => {
    if (dose.status !== "pending" || !dose.time) return;
    const [h, m] = dose.time.split(":").map(Number);
    const when = new Date();
    when.setHours(h, m, 0, 0);
    const delay = when - now;
    if (delay <= 0 || delay > HORIZON_MS) return;
    const id = setTimeout(() => {
      const label = dose.strength ? `${dose.name} · ${dose.strength} ${dose.unit || ""}`.trim() : dose.name;
      showLocalNotification("Time for your medication", label, { tag: `dose-${dose.id}`, url: "/" });
    }, delay);
    timers.push(id);
    scheduled++;
  });
  return scheduled;
}
