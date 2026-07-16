# Changelog

Notable changes to Meditrax. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2026-07-16 — Active effects tracker that learns your metabolism

### Added
- **Active effects tracker** (`src/lib/effectsEngine.js`, `src/components/ActiveEffects.jsx`)
  — start tracking when logging a dose (a "Track effects" switch in the log sheet)
  or from a recent dose on the Effects page (backdated to when it was taken).
  While a session runs, the **home screen shows a simplified card** (current
  phase, live intensity %, progress bar, time remaining) and the **Effects page
  shows the detailed view**: the full predicted intensity curve with a "now"
  marker, predicted onset/peak/end clock times, one-tap feedback ("Feeling it",
  "Peaking", "Wearing off", "Gone"), and a 0–10 intensity slider.
- **On-device learning** — each medication gets a personal timing model
  (onset/peak/duration + reference dose) updated from your feedback via a
  bounded exponentially-weighted average, entirely offline and inspectable
  ("Personalized from N tracked sessions, medium confidence"). Predictions
  start from category/form-typical pharmacokinetic priors and adapt to your
  metabolism; dose is scaled sub-linearly against your usual dose. Sessions
  auto-expire without learning when abandoned — silence isn't feedback.
- **Assistant integration** — a `get_active_effects` tool so the AI can answer
  "when will this wear off?" from the personalized model.
- Effect sessions and learned models are profile-scoped, included in
  export/import/delete, and listed in the Privacy Policy's stored-data section.

## 2026-07-16 — Correct dose defaults for tapers & cycles; reminders that actually fire

### Fixed
- **Taper doses now flow into logging** — every log entry point (one-tap take on
  Today, the log sheet from any page, the AI assistant's `log_dose`) used the
  medication's base strength even when an active taper said today's dose was
  lower. A shared `effectiveDoseInfo`/`logDefaultsForMed` helper now computes the
  taper- and cycle-aware amount **and** the matching pill count (quarter-pill
  precision), so inventory decrements correctly too.
- **Cyclic dosing plans were completely inert** — creating an on/off cycle changed
  nothing: off days still scheduled full doses, and dose multipliers (e.g.
  "4 days full / 3 days half") never applied anywhere. Cycles now drive the
  schedule: off days drop the dose from Today/adherence/analytics, and
  fractional phases scale the default dose, the dose-card label ("50 mg (on)"),
  and reminder text.
- **Pausing a taper did nothing** — the dose kept stepping down by calendar date
  while "paused". Pausing now freezes progress at the current step (dose, step
  marker, and refill prediction all hold), and resuming shifts the remaining
  schedule forward by the paused duration so it picks up exactly where it left
  off, with step dates regenerated to match.
- **Custom reminders never fired** — reminders created on the Reminders page were
  stored but never scheduled (only today's dose schedule was). They now schedule
  alongside dose reminders, deduplicated against doses at the same time.
- **Dead notification settings are now real** — `lead_minutes` ("remind me
  early") and quiet hours existed in stored settings but were ignored and had no
  UI. Both now have Settings controls and are honored by the scheduler
  (including overnight quiet windows like 22:00–07:00).
- Logging a dose now reschedules pending reminders, so a dose taken early no
  longer notifies at its original time.

## 2026-07-16 — Editable logs & journal quality-of-life

### Added
- **Edit any dose log** — time & date, status, pill count, total amount, mood,
  effectiveness and notes. Open a log by tapping a completed dose on Today, a row
  in the new **History** card on the medication detail page, or a journal entry on
  Effects. Deleting from the edit sheet restores exactly the inventory the log
  consumed. Inventory reconciliation on edit is difference-based (`updateLog` in
  `src/lib/localdb.js`): a timestamp/notes edit never moves stock, quantity/status
  changes adjust by the delta with the same clamp-at-zero guarantees as
  create/undo, and legacy logs with unknowable decrements are left untouched.
- **Retroactive logging** — the dose-log sheet now has a "When" date/time field
  (defaults to now, capped at now), so a dose taken hours ago can be logged at the
  right time. The AI assistant's `log_dose` tool gained an optional `when`
  parameter for the same purpose.
- **Edit & delete mood check-ins** — tap a check-in in the Effects journal to
  change its mood, dimensions, notes or time, or delete it.
- **History card on medication detail** — the 8 most recent logs, tap to edit.

### Fixed
- Tapping an already-logged dose on Today used to open a blank log sheet whose
  save dedup-overwrote the existing log — resetting its time to "now" and wiping
  any notes/mood. It now opens the actual log in edit mode.
- Editing or undoing a log now also refreshes the medication-detail query, so its
  inventory count no longer goes stale.
- Moving a scheduled dose log onto a day that already has a log for the same slot
  is blocked with a clear error instead of silently creating a duplicate that the
  dedup guard could never merge.
- **`datetime-local` inputs overflowing their container on iOS Safari** — WebKit
  sizes the native date/time widget to its own intrinsic content width and can
  ignore `width: 100%` on narrow viewports, so the new "When" picker rendered
  wider than the screen instead of shrinking to fit. Fixed with a global rule
  constraining `date`/`time`/`datetime-local` inputs to their container
  (`box-sizing: border-box`, `width`/`max-width: 100%`, `min-width: 0`), plus
  `overflow-x: hidden` on `html`/`body` as a defensive backstop.

## 2026-07-15 — International data-compliance pass

### Fixed
- **Google Fonts CDN call** — the app loaded Fraunces/Manrope from
  `fonts.googleapis.com`/`fonts.gstatic.com` on every launch, an undisclosed,
  non-user-triggered network request that sends the visitor's IP address to Google
  (the source of the well-known EU "Google Fonts GDPR" liability cases). Fonts are
  now bundled with the app (`@fontsource-variable/fraunces`,
  `@fontsource-variable/manrope`), so the only network request the app ever makes is
  the OpenRouter call a user explicitly triggers with their own key — matching what
  the Privacy Policy already claimed.

### Added
- **Expanded Legal docs** (`src/pages/Legal.jsx`) — Privacy Policy, Terms of Use, and
  Medical Disclaimer now explicitly address international data-protection regimes:
  GDPR/UK GDPR (legal basis, Art. 9 special-category health data, data-subject
  rights), CCPA/CPRA and other US state privacy laws, PIPEDA (Canada), the Australian
  Privacy Act, and LGPD (Brazil); children's privacy (COPPA + EU age-of-consent);
  international AI data transfers; a HIPAA-applicability clarification; governing
  law/severability in the Terms; and a contact channel for privacy questions. All
  additions are framed around the app's actual local-only architecture rather than
  generic boilerplate.

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
