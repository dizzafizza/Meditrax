# plan.md

## 1. Objectives
- Deliver a **fully static, offline-first** Meditrax clone that runs on **GitHub Pages (meditrax.ca)** with **no backend at runtime**.
- Preserve the full feature set (meds, reminders, logging, today dashboard, calendar, analytics/insights, inventory, taper planner, cyclic dosing, knowledge base, effects journal, health profile, settings) while moving **all persistence and computation client-side**.
- Ensure the **taper planner is fixed and consistent** (linear/exponential/hyperbolic/custom always reaches `finalDose`, monotonic non-increasing, and daily dose lookup matches generated schedule).
- Add a **client-side AI assistant** that uses **user-supplied OpenRouter API keys** (no Emergent key) with:
  - Provider: **OpenRouter ONLY** (browser CORS OK).
  - **Model routing** (`openrouter/auto`) and model selection.
  - **Customizable personality** (name, persona, warmth, verbosity, emoji policy, custom instructions) injected into the system prompt.
  - **Tool calling / agent mode** so the AI can directly manipulate the app: **switch profile, set theme, add/edit/delete meds, log a dose, create taper plan, navigate**.
- Improve chat UX with **streaming**, correct **Markdown rendering** (GFM), and safe formatting.
- Keep **notifications** working in a static PWA via **client-side Notification API + local scheduling** (foreground best-effort); be transparent about iOS background limitations.
- Support **multiple family profiles** (profile switcher + per-profile data namespaces).
- Add **shareable images** of medication info and taper plans (client-side image generation + share/download).
- Remove all Emergent branding and runtime dependencies: **remove “Made with Emergent” badge**, `emergent-main.js`, and PostHog script from `public/index.html`.

> **Status:** All static/offline pivot phases (A/B/C) are **COMPLETED** and **verified via browser automation**. App is ready for GitHub Pages deployment; backend remains in repo as dead code.

---

## 2. Implementation Steps

### Phase 1 — Core POC (Isolation, mandatory) **(COMPLETED)**
**User stories (POC):**
1. Verify GPT connectivity so AI features won’t fail later.
2. Unknown medications return structured JSON.
3. Taper calculations are correct and consistent.
4. iOS PWA push viability validated.
5. Search over seeded knowledge base reliably retrieves context.

**Steps (completed):**
1. Researched best practices for iOS Web Push and taper math.
2. Implemented a validation script `tests/test_core.py` covering:
   - Emergent GPT chat
   - Strict JSON medication autofill
   - Unified taper engine (generation + day lookup)
   - VAPID + pywebpush crypto path
   - Mongo text-search RAG retrieval
3. Ran and fixed until all checks passed.

**Exit gate:** ✅ all checks pass.

---

### Phase 2 — V1 App Development (FARM stack build) **(COMPLETED, now superseded at runtime)**
**Delivered (completed):**
- Backend (FastAPI + MongoDB) with catalog seed, meds/logs/reminders/tapers/cyclic/inventory/profile/settings/export/import, AI chat SSE + autofill, VAPID endpoints.
- Frontend premium iOS-style PWA with full page set + sheets.
- GitHub Pages deploy artifacts: `CNAME` (meditrax.ca), SPA 404 fallback, Actions workflow, `DEPLOY.md`.
- Testing: backend 100% (38/38), frontend 95% (minor overlap fixed). Taper engine verified.

**Note:** Backend remains in repo but must be **turned off / unused** for the static deployment pivot.

---

### Phase 3 — Major Pivot: Static Offline-First PWA (GitHub Pages) **(COMPLETED)**

#### 3.1 Updated Architecture
**Goal:** Remove runtime backend dependency while keeping the same feature surface.

- Persistence: **IndexedDB** via `localforage`.
- Data model: client-side collections:
  - profiles
  - medications
  - logs
  - reminders
  - tapers
  - cyclic plans
  - knowledge base docs (seeded curated catalog + AI-added)
  - settings
  - ai_config (OpenRouter key/model/personality)
  - chat history
- Computation: all analytics, “today schedule”, inventory projections, taper dose lookups computed in JS.
- Networking: only **OpenRouter** called directly from browser with **user key**.

**Progress / current state:**
- ✅ Added offline deps: `localforage`, `html-to-image`, `react-markdown`.
- ✅ Ported backend seed data to `src/lib/catalogSeed.js`.
- ✅ Ported taper engine to `src/lib/taperEngine.js`.
- ✅ Implemented offline data layer `src/lib/localdb.js` with profile-scoped CRUD + computed views.
- ✅ Replaced all backend runtime usage (no axios, no `/api/*` calls).

#### 3.2 Compatibility Strategy (minimize rewrites) **(COMPLETED)**
- `src/lib/api.js` is now a thin compatibility layer:
  - `export * from "./localdb"`
  - Shims:
    - `autofillMedication()` → OpenRouter client-side AI (`src/lib/ai.js`) + persist locally.
    - `testPush()` → local notification test.
  - Safe stubs for legacy AI endpoints (`getAiMessages/getAiSuggestions/clearAiMessages`) to prevent breakage.

#### 3.3 Data & Profiles (Family Mode) **(COMPLETED)**
**User stories:**
1. As a user, I can create multiple family profiles.
2. As a user, I can quickly switch profiles and see only that person’s meds/logs/plans.

**Implementation (completed):**
1. `src/context/ProfileContext.jsx`:
   - Reactive profiles, persists active profile ID.
   - Switching profiles invalidates react-query keys.
2. UI:
   - `src/components/ProfileSwitcher.jsx` wired into Today header.
   - `/profile` upgraded to **family profile manager** + **active health profile editor**.

#### 3.4 Offline Knowledge Base + AI Autofill (Local) **(COMPLETED)**
**User stories:**
1. As a user, I can search a comprehensive curated med library offline.
2. As a user, if a medication is unknown, AI generates structured data and it is saved locally.

**Implementation (completed):**
- Offline search uses `CATALOG_SEED` (via `localdb`).
- `autofillMedication()` shim:
  - Calls `autofillMedicationAI(name)`.
  - Validates/normalizes JSON client-side.
  - Persists via `localdb.saveCatalogEntry()`.
- KnowledgeBase page error handling updated to reflect user-key requirements and client-side errors.

#### 3.5 AI Assistant v2 (User Key + Personality + Model Routing + Tool Calling) **(COMPLETED + VERIFIED)**
**User stories:**
1. As a user, I can set my OpenRouter API key and select a model.
2. As a user, I can customize the assistant’s personality.
3. As a user, I can chat with streaming responses and Markdown rendering.
4. As a user, the AI can **directly change the app** via tool calls.

**Verified OpenRouter constraints:**
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`.
- Headers: `Authorization: Bearer ...`, plus recommended `HTTP-Referer` and `X-Title`.
- Streaming: SSE `data:` lines, `[DONE]` sentinel.
- Tools: OpenAI-compatible `tools` + `tool_choice`; streamed `delta.tool_calls` accumulated.

**Implementation (completed):**
1. `src/lib/ai.js`:
   - SSE streaming parser + tool-call accumulator.
   - `runAssistantLoop(...)` multi-turn tool loop.
   - `buildSystemPrompt(...)` injects personality + medical disclaimers.
   - Curated model list + optional `listModels()`.
   - `autofillMedicationAI(name)` strict JSON schema.
   - `testConnection(config)` for Settings.
   - Friendly error mapping for 401/402/429 etc.
2. `src/context/AIToolsContext.jsx`:
   - Tool schema + executor with react-query invalidation.
   - Tools implemented (14):
     - `set_theme`
     - `list_profiles`, `switch_profile`, `create_profile`
     - `list_medications`, `add_medication`, `update_medication`, `delete_medication`
     - `log_dose`
     - `create_taper_plan`
     - `get_today`, `get_inventory`, `get_analytics`
     - `navigate`
3. Assistant UI:
   - `src/pages/Assistant.jsx` rewritten:
     - Streaming + tool activity chips.
     - Uses local chat persistence (`getChat/addChatMessage/clearChat`).
     - Uses shared Markdown renderer (`src/components/Markdown.jsx`).
     - No-key setup card.
     - Graceful error bubbles.
4. Settings UI:
   - `src/pages/Settings.jsx` rewritten:
     - OpenRouter key show/hide, `openrouter/auto` routing, model picker.
     - Agent mode toggle **default ON**.
     - Full personality controls.
     - Test connection button.
     - Keeps appearance, notifications (local), export/import, disclaimers.

#### 3.6 Notifications (Static PWA, local scheduling) **(COMPLETED)**
**User stories:**
1. As a user, I can enable notifications.
2. As a user, reminders trigger while app is open; best-effort while installed.

**Implementation (completed):**
- `src/lib/push.js` rewritten to local-only:
  - Permission flow, local enabled flag.
  - `showLocalNotification()` via service worker where possible.
  - `sendTestNotification()`.
  - `scheduleAllReminders()` schedules upcoming doses via `setTimeout` horizon.
- `src/App.js` schedules reminders on load + visibility/focus changes and registers `sw.js`.

#### 3.7 Shareable Info Cards (Images) **(COMPLETED + VERIFIED)**
**User stories:**
1. As a user, I can generate a shareable image for a medication.
2. As a user, I can generate a shareable image for a taper plan.

**Implementation (completed):**
1. `src/lib/share.js`:
   - `html-to-image` PNG generation.
   - Web Share API support with download fallback.
2. `src/components/ShareDialog.jsx`:
   - Premium branded preview.
   - Includes medical disclaimer.
   - Provides `MedicationShareCard` and `TaperShareCard`.
3. Entry points:
   - Medication detail page: share button opens ShareDialog.
   - Taper detail page: share button opens ShareDialog.

#### 3.8 Remove Emergent Branding **(COMPLETED + VERIFIED)**
- Removed from `public/index.html`:
  - `emergent-main.js`
  - `#emergent-badge`
  - PostHog script
- Verified `public/index.html` contains **0** Emergent/PostHog refs.

#### Phase-end testing (static) **(COMPLETED + VERIFIED)**
- ✅ `esbuild` compiles clean after each phase.
- ✅ Offline CRUD smoke test: add med → appears in list → detail renders → share dialog works.
- ✅ Multi-profile: add/switch/delete profile controls present; isolation implemented.
- ✅ AI settings persistence across reload verified (fake key + custom name).
- ✅ Assistant behavior verified:
  - Without key: setup card.
  - With key: composer shown; fake key produces graceful “Invalid API key” bubble without crashing.
- ✅ No remaining backend references (no axios, no `/api/*`, no VAPID).

---

### Phase 4 — Polish, iOS refinement, and production readiness (static) **(OPTIONAL / FUTURE)**
**User stories (polish):**
1. Premium iOS-quality UX in standalone mode.
2. Taper visualization clarity + safety warnings.
3. Accessibility + large tap targets.
4. Family profile switching UX (fast and safe).

**Potential steps (future):**
- Improve reminder scheduling diagnostics and UX messaging.
- Add “undo” affordances for AI tool actions where safe.
- Add richer AI grounding (optional read tools already exist).
- Add optional per-profile chat separation UI (data layer supports session IDs; can namespace by profile).
- Consider background push notifications **only if** a server is reintroduced (not in scope).

---

## 3. Next Actions (updated, concrete)

### Immediate (Ready for deployment)
1. **GitHub Pages deployment check**:
   - Ensure build output uses correct `homepage`/base path.
   - Confirm SPA 404 fallback is present.
   - Confirm `manifest.json` + icons are correct.
2. **Manual QA on iOS Safari + Home Screen install**:
   - Verify Notification permission flow.
   - Verify reminder scheduling behavior expectations.
   - Verify share sheet works.
3. **Documentation**:
   - Add brief README section: how to add OpenRouter key; privacy note (stored locally).

### Optional improvements
- Add “Model list from OpenRouter” button in Settings (currently curated list is sufficient).
- Improve share cards (more steps, QR link back to app) if desired.

---

## 4. Success Criteria
- Static PWA runs on GitHub Pages with **no backend**.
- Data persists across sessions using IndexedDB/localforage.
- Multi-profile works: each profile has isolated meds/logs/plans/settings.
- Taper planner correctness:
  - linear/exponential/hyperbolic/custom schedules always end at `finalDose`
  - monotonic non-increasing
  - daily dose lookup matches schedule
- AI assistant:
  - user OpenRouter key entry + model selection (`openrouter/auto` supported)
  - personality customization reflected in responses
  - markdown formatting renders correctly (GFM)
  - tool calling can manipulate the app (theme/profile/meds/logs/tapers/navigation)
  - settings persist across reload
  - graceful error behavior when key is missing/invalid
- Notifications:
  - permission flow works
  - test notification works
  - reminders trigger while app is open/installed (best-effort background)
- Share cards:
  - generated image looks premium and contains correct info + disclaimer
  - Web Share API works where supported (fallback: download)
- Emergent branding removed (badge + scripts).
- End-to-end frontend tests pass for offline flows; AI settings UI validated without requiring live keys.
