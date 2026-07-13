# Changelog

Notable changes to Meditrax. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2026-07-12 — Inventory, prediction, mood/behaviour & AI overhaul

### Fixed
- **Inventory undo** — deleting/undoing a dose log now restores exactly the amount
  that log decremented from stock (previously nothing was restored).
- **Double-decrement** — logging the same scheduled dose twice (e.g. via a fast tap
  and the AI assistant) now updates the existing log in place instead of decrementing
  inventory twice.
- **Partial doses** — decrement by the actual quantity taken instead of a hardcoded
  half-of-default-dose.
- **PRN refill projections** — "as needed" medications now get a usage-based
  run-out projection instead of showing no projection at all.
- **Refill thresholds** — both the per-medication unit threshold and the app-level
  "days until low" setting are now actually used to decide low-stock status
  (previously the per-medication threshold was stored but ignored).
- **Timezone bug** — all "today" and day-bucketing logic now uses the local calendar
  day instead of UTC, fixing doses/adherence appearing on the wrong day near midnight
  for non-UTC users.
- Taper schedule dates now compute in local time (`taperEngine.js`), matching the
  same fix.

### Added
- **Blended refill predictor** (`src/lib/predictor.js`) — combines schedule,
  exponentially-weighted actual adherence, PRN usage history, and (for medications on
  an active taper) a forward simulation of the declining dose, to produce a run-out
  date, a refill-by date, and a confidence level.
- **Multi-pill dosage tracking** — medications now carry an explicit
  `dose_quantity` (pills per dose) independent of whether inventory tracking is on;
  the dose-logging sheet has a pill-count stepper, and logs record the actual
  quantity taken.
- **Mood check-ins** — a standalone mood/energy/sleep/pain/anxiety check-in,
  separate from logging a dose, unified with existing per-dose moods into one journal
  and trend (`src/lib/moodAnalytics.js`).
- **Behaviour & dependency-risk signals** (`src/lib/behavior.js`) — a deterministic,
  fully local engine that flags PRN-usage escalation, dose escalation vs. baseline,
  shrinking inter-dose intervals, days exceeding a medication's max daily dose,
  missed→binge adherence patterns, and declining PRN effectiveness (tolerance),
  gated to medications where it's relevant and suppressed when there isn't enough
  data. Always framed educationally, never diagnostic, with crisis resources surfaced
  at the highest signal level.
- **AI insights** (`src/lib/aiInsights.js`) — an on-demand, locally-cached narrative
  layer that summarizes the deterministic adherence/refill/mood/behaviour signals via
  the user's chosen OpenRouter model; never runs automatically, so it never spends
  credits without the user asking.
- **Cost-aware model routing** — light/structured AI tasks (e.g. medication
  autofill) now default to Claude Haiku; narrative insights default to Claude Sonnet;
  chat continues to use whatever model the user selects.
- **Insights tabs** — Adherence, Mood, and Behaviour views on the Insights page.
- **Legal pages** — in-app Privacy Policy, Terms of Use, and Medical Disclaimer
  (`More → Legal`, linked from Settings), written to match the app's actual
  local-only, no-account architecture.
- **Unit test suite** — 93 Jest tests across the pure algorithm modules (dates,
  predictor, behaviour, mood analytics, taper engine) and the inventory/log
  interactions in `localdb`.

### Changed
- `getInventory()` / `getToday()` output gained new fields (`run_out_date`,
  `refill_by_date`, `confidence`, `method`) without removing or renaming any existing
  field, so existing UI and AI tool consumers keep working.
- Four new AI assistant tools: `get_refill_prediction`, `get_behavior_analysis`,
  `log_mood_checkin`, `get_mood_trends`.
