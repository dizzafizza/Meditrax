// Harm-reduction guardrails for redosing an active effect session. Pure and
// storage-free so it's easy to test and can run live as the redose panel is
// edited. Two checks:
//   1. Too soon — redosing before the previous dose has peaked is the classic
//      "I don't feel it yet, take more" over-stacking pattern.
//   2. Over the typical maximum — the running session total (primary + all
//      redoses + this one) approaching or exceeding the substance's known
//      max daily dose.
// These are soft warnings, never hard blocks: the user still chooses.

export function redoseWarnings(session, { amount = null, at = null } = {}, maxDaily = null, unit = null) {
  const warnings = [];
  if (!session) return { warnings, cumulative: null, maxDaily };
  const when = at && !isNaN(new Date(at).getTime()) ? new Date(at).getTime() : Date.now();

  // 1. Too-soon vs. the most recent existing dose (primary or last redose).
  const doseTimes = [new Date(session.started_at).getTime(), ...(session.redoses || []).map((r) => new Date(r.at).getTime())].filter((t) => isFinite(t));
  const lastDoseMs = doseTimes.length ? Math.max(...doseTimes) : null;
  const peakMin = Number(session.profile?.peak_min);
  if (lastDoseMs != null && isFinite(peakMin) && peakMin > 0) {
    // A "now" redose entered via a minute-granularity picker can land a few
    // seconds before a dose taken moments ago; tolerate ~1 min of that so an
    // immediate redose still counts as "too soon" rather than being skipped.
    const minsSinceLast = (when - lastDoseMs) / 60000;
    if (minsSinceLast >= -1 && minsSinceLast < peakMin) {
      warnings.push({ type: "too_soon", severity: "caution", minsSinceLast: Math.max(0, Math.round(minsSinceLast)), peakMin: Math.round(peakMin) });
    }
  }

  // 2. Cumulative session total vs. the typical max daily dose.
  const primary = Number(session.dose) || 0;
  const priorRedoses = (session.redoses || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const addAmt = amount != null && amount !== "" && isFinite(Number(amount)) ? Number(amount) : primary;
  const cumulative = primary + priorRedoses + addAmt;
  const max = Number(maxDaily);
  if (isFinite(max) && max > 0 && cumulative > 0) {
    if (cumulative > max) warnings.push({ type: "over_max", severity: "severe", cumulative: round2(cumulative), maxDaily: max, unit });
    else if (cumulative >= max * 0.8) warnings.push({ type: "near_max", severity: "caution", cumulative: round2(cumulative), maxDaily: max, unit });
  }
  return { warnings, cumulative: round2(cumulative), maxDaily: isFinite(max) ? max : null };
}

function round2(x) { return Math.round(x * 100) / 100; }
