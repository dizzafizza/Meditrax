# Meditrax

A calm, premium medication tracker — offline-first, privacy-first, and smart about
inventory, adherence, mood, and medication risk. No account, no server, no tracking.
Your data stays on your device.

**Live app:** deployed via GitHub Pages (see [DEPLOY.md](DEPLOY.md)).

---

## Features

- **Today dashboard** — the day's scheduled doses and PRN meds, one-tap logging with
  undo, adherence streak, refill alerts with projected run-out dates.
- **Editable logs** — every dose log can be edited after the fact (date & time,
  status, amount, mood, effectiveness, notes) or deleted with exact inventory
  restore; doses can be logged retroactively via a date/time picker, and mood
  check-ins are editable the same way from the journal.
- **Medications** — strength, form, schedule, category, risk level and dependency-risk
  category per medication; multi-pill dosing (pills-per-dose, tracked independent of
  inventory) with a pill-count stepper when logging.
- **Smart inventory & refill prediction** — a blended predictor (`src/lib/predictor.js`)
  that combines your actual adherence history with the schedule for regular
  medications, a usage-based rate for PRN medications, and a forward simulation of the
  declining dose for active tapers — producing a run-out date, a refill-by date (lead
  time configurable in Settings), and a confidence level, not just a naive
  count ÷ doses-per-day guess. Undo restores the exact amount a log decremented, and
  duplicate logs for the same scheduled dose no longer double-decrement.
- **Mood check-ins & Effects journal** — quick standalone mood/energy/sleep/pain/anxiety
  check-ins (independent of logging a dose) plus the existing per-dose mood/effectiveness/
  notes, unified into one journal and trend chart.
- **Insights** — Adherence, Mood, and Behaviour tabs: adherence trend and streaks,
  mood trend over time, and a deterministic usage-pattern engine
  (`src/lib/behavior.js`) that flags things like PRN-usage escalation, dose escalation
  vs. baseline, shrinking intervals between doses, days exceeding the catalog's max
  daily dose, missed→binge patterns, and declining PRN effectiveness (tolerance) —
  framed as educational signals for a conversation with your prescriber, never a
  diagnosis, with crisis resources surfaced when appropriate.
- **Taper Planner** — linear / exponential / hyperbolic / custom taper schedules,
  always monotonic and reaching the target dose, with an integrated safety framing
  based on the medication's dependency-risk category. Today's taper dose drives the
  default when logging (amount and pill count), and pausing a plan freezes progress
  until you resume — the remaining schedule shifts forward to match.
- **Cyclic Dosing** — on/off dosing cycles (e.g. stimulant holidays) that actually
  drive the schedule: off days drop doses from Today and adherence, and fractional
  phases (e.g. half-dose maintenance) scale the default logged dose.
- **Knowledge Base** — an offline, curated medication reference library plus
  AI-assisted lookups for medications not in the catalog.
- **AI Assistant** — a chat assistant that can also *act* in the app (switch profiles,
  add/log/edit medications, create taper plans, check inventory, log a mood check-in,
  navigate) via tool calling. Personality, warmth, verbosity and model are all
  user-configurable.
- **Cost-aware AI routing** — the app assigns different OpenRouter models to different
  task complexity: fast/cheap models (Claude Haiku by default) for structured
  extraction and classification, a stronger model (Claude Sonnet by default) for
  narrative insights, and whatever model you pick for open-ended chat. AI insight
  narratives are cached locally and only regenerated on demand or when the underlying
  data changes meaningfully, so you control when credits are spent.
- **Family profiles** — track medications for multiple people, each with isolated
  data.
- **Reminders** — local, on-device dose reminders (no push server).
- **Export / Import** — a portable JSON backup you control; no cloud sync.
- **Privacy Policy, Terms of Use, and Medical Disclaimer** — in-app, under
  **More → Legal** (and linked from Settings), written to match what the app actually
  does.

## Architecture

Meditrax is a **static, offline-first Progressive Web App**. Everything runs
client-side:

- **Storage**: IndexedDB via [`localforage`](https://github.com/localForage/localForage),
  wrapped by `frontend/src/lib/localdb.js` — profile-scoped collections for
  medications, logs, mood check-ins, reminders, tapers, cyclic plans, chat history,
  and a cached-insights store, plus global collections for profiles, the medication
  catalog, settings, and AI configuration.
- **Algorithms are pure, storage-free modules** (no IndexedDB access, no side effects)
  so they're independently unit-tested:
  - `src/lib/dates.js` — local-timezone-correct date helpers (the app deliberately
    avoids `toISOString().slice(0, 10)`-style UTC bucketing, which used to shift a
    user's "today" near midnight).
  - `src/lib/predictor.js` — refill/run-out prediction.
  - `src/lib/behavior.js` — usage-pattern / dependency-signal analysis.
  - `src/lib/moodAnalytics.js` — mood series, trends, and mood↔usage correlation.
  - `src/lib/taperEngine.js` — taper schedule generation and dose lookup.
- **AI** is called directly from the browser to [OpenRouter](https://openrouter.ai/),
  using a **user-supplied API key** stored only on that device (`src/lib/ai.js`,
  `src/lib/aiInsights.js`). Nothing is ever proxied through a Meditrax-operated
  server — there isn't one.
- **`backend/`** (FastAPI + MongoDB) is **legacy code from an earlier architecture**
  and is not used by the deployed app. It predates the offline-first pivot and is kept
  in the repo for reference only.

### Tech stack

React 19, Create React App via [CRACO](https://craco.js.org/), Tailwind CSS,
Radix UI / shadcn-style components, TanStack Query, React Router, Recharts,
date-fns, localforage, react-markdown. Tests run on Jest via CRA's built-in test
runner.

## Development

```bash
cd frontend
yarn install        # or: npm install --legacy-peer-deps
yarn start          # dev server at http://localhost:3000
yarn test           # Jest — unit tests for the pure algorithm modules
yarn build          # production build to frontend/build
```

No environment variables or `.env` file are required for local development — the app
has nothing to talk to until you add an OpenRouter key in Settings.

### Project layout

```
frontend/
  src/
    lib/         # pure logic: localdb (storage), predictor, behavior,
                 # moodAnalytics, taperEngine, dates, ai, aiInsights, format
    pages/       # one component per route
    components/  # shared UI + sheets (drawers)
    context/     # Profile, Theme, UI, AITools React contexts
backend/         # legacy FastAPI backend — not used at runtime, kept for reference
.github/workflows/deploy-pages.yml   # builds frontend/ and publishes to GitHub Pages
```

## Deployment

See [DEPLOY.md](DEPLOY.md) — GitHub Pages via GitHub Actions, no backend or secrets
to configure.

## Privacy & safety

- All personal data (medications, logs, mood check-ins, health profile) stays in
  IndexedDB on your device. There is no account and no server-side copy.
- AI features are opt-in and require your own OpenRouter key; without one, every
  deterministic feature (inventory, predictions, adherence, mood trends, behaviour
  signals) still works fully offline.
- Meditrax provides educational information only, not medical advice. See the in-app
  **Medical Disclaimer** (More → Legal, or `/legal/disclaimer`) before making any
  medication decisions.

## Contributing

This is a personal project; issues and pull requests are welcome. Please run
`yarn test` and `yarn build` before submitting a change.
