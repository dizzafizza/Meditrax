// Shareable summary of an effects-tracker session — pure and storage-free.
// Turns a session (primary dose + redoses + the user's feedback timeline)
// into structured rows for display and a plain-text block for sharing/export,
// as a personal harm-reduction record.

import { fmtMins } from "./effectsEngine";

const KIND_LABEL = { onset: "Started feeling it", peak: "Peak", wearing_off: "Wearing off", gone: "Gone" };

export function sessionSummaryData(session, med) {
  if (!session) return null;
  const start = new Date(session.started_at).getTime();
  const name = med?.name || session.medication_name || "Substance";
  const unit = session.unit || med?.unit || "";
  const minsAt = (iso) => Math.max(0, Math.round((new Date(iso).getTime() - start) / 60000));

  const doses = [{ label: "Dose 1", amount: numOrNull(session.dose), at: session.started_at, offset: 0 }];
  (session.redoses || []).forEach((r, i) => doses.push({ label: `Redose ${i + 1}`, amount: numOrNull(r.amount), at: r.at, offset: minsAt(r.at) }));
  const knownAmounts = doses.map((d) => d.amount).filter((a) => a != null);
  const total = knownAmounts.length ? knownAmounts.reduce((s, a) => s + a, 0) : null;

  const timeline = [];
  for (const kind of ["onset", "peak", "wearing_off", "gone"]) {
    const e = (session.events || []).find((x) => x.kind === kind);
    if (e) timeline.push({ kind, label: KIND_LABEL[kind], min: minsAt(e.t) });
  }
  const intensities = (session.events || []).filter((e) => e.kind === "intensity" && e.intensity != null).map((e) => Number(e.intensity));
  const maxIntensity = intensities.length ? Math.max(...intensities) : null;

  const endIso = session.ended_at || null;
  return {
    name, unit, doses, total, timeline, maxIntensity,
    startedAt: session.started_at, endedAt: endIso,
    durationMin: endIso ? minsAt(endIso) : null,
    redoseCount: (session.redoses || []).length,
  };
}

const doseStr = (amount, unit) => (amount != null ? `${amount}${unit ? ` ${unit}` : ""}` : "—");

export function sessionSummaryText(session, med, { fmtClock } = {}) {
  const d = sessionSummaryData(session, med);
  if (!d) return "";
  const clock = fmtClock || ((iso) => new Date(iso).toLocaleString());
  const lines = [];
  lines.push(`${d.name} — session summary`);
  lines.push(`Started: ${clock(d.startedAt)}`);
  if (d.endedAt) lines.push(`Ended: ${clock(d.endedAt)}${d.durationMin != null ? ` (${fmtMins(d.durationMin)})` : ""}`);
  lines.push("");
  lines.push("Doses:");
  for (const dose of d.doses) {
    lines.push(`  - ${dose.label}: ${doseStr(dose.amount, d.unit)}${dose.offset ? ` (+${fmtMins(dose.offset)})` : ""}`);
  }
  if (d.total != null) lines.push(`  Total: ${doseStr(d.total, d.unit)}`);
  if (d.timeline.length || d.maxIntensity != null) {
    lines.push("");
    lines.push("How it felt:");
    for (const t of d.timeline) lines.push(`  - ${t.label}: ${fmtMins(t.min)} in`);
    if (d.maxIntensity != null) lines.push(`  - Peak intensity reported: ${d.maxIntensity}/10`);
  }
  lines.push("");
  lines.push("Tracked with Meditrax — a personal harm-reduction record, not medical advice.");
  return lines.join("\n");
}

function numOrNull(v) {
  const n = Number(v);
  return v != null && v !== "" && isFinite(n) ? n : null;
}
