# Changelog

Notable changes to Meditrax. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2026-08-19 — Push the new logo to already-installed apps

### Fixed
- **Installed home-screen apps now actually receive the new logo.** The
  redesign shipped under the same filenames, but Chrome only refreshes an
  installed app's icon when the icon *URL* in the manifest changes (it
  never re-downloads same-URL icons to compare bytes), and favicons sit in
  stubborn HTTP caches of their own. Every icon reference — manifest,
  favicon, Apple touch icon, and the notification icon/badge used by the
  service worker and reminders — now points at versioned `-v2` filenames,
  and the service worker cache name is bumped so old caches are swept on
  activation. Android/desktop installs pick the new icon up on their next
  launch-triggered manifest check; iOS snapshots its icon at
  add-to-home-screen time and offers no update mechanism, so an existing
  iOS install shows the new logo after removing and re-adding the app —
  a platform restriction, not something a deploy can override. The old
  filenames remain in place (carrying the new art) so anything still
  holding stale references keeps working.

## 2026-08-19 — A new logo: the dose becomes the curve

### Changed
- **New app icon across every surface** (home-screen icon, maskable Android
  icon, Apple touch icon, favicon, notification badge), replacing the
  generic flat capsule. The new mark tells the app's own story: an amber
  capsule at the origin of a flowing mint line that draws Meditrax's actual
  effect-intensity curve — rise, the signature full-intensity plateau,
  eased decline — ending in fading data points, on a deep sea-glass
  gradient. Nothing else in the health space looks like it because the
  shape *is* this app's own model. All sizes are rendered from one master
  SVG: the maskable variant keeps the mark inside the Android safe zone,
  the Apple touch icon is full-bleed per iOS convention, and the
  notification badge is the required pure-white-on-transparent monochrome.
  Existing home-screen installs keep their cached icon until re-added —
  that's platform behavior, not a bug.

## 2026-08-19 — Backup import audit: validation, active-profile safety, ghost cleanup

### Fixed
- **Importing a backup could make all your data appear erased.** Two paths
  led there: a backup missing its `activeProfileId` (or naming one not in
  its own profile list) left the app pointed at a profile id that no longer
  existed after the import — every screen read from a dead namespace and
  looked wiped, while new logs quietly went to the same orphaned space. And
  a malformed file containing an empty `profiles` array would overwrite the
  real profile list, orphaning everything behind a fresh auto-created
  profile on next launch. Import now validates the payload before writing a
  single byte (anything that isn't a recognizable Meditrax backup is
  rejected with a clear error instead of a false "Data imported" success),
  and the active profile is guaranteed to land on a profile that actually
  exists — the backup's own choice when valid, the device's current one if
  it survived, the first imported profile otherwise.
- **Corrupt collection values can no longer be written.** A damaged backup
  with e.g. an object where the medications array belongs used to be stored
  verbatim and crash every later read of that collection; unknown
  collection names were stored too. Only known collections with well-formed
  arrays are accepted now.
- **After a restore, everything on screen updates.** The import success path
  invalidated a hand-maintained list of caches that had quietly gone stale —
  logs, check-ins, effect sessions, the learned meal model, interactions and
  more were missing, so those screens kept showing pre-import data until a
  full reload. It now flushes every cache, and reschedules the imported
  reminders so they actually fire without waiting for some other trigger.
- Smaller import/export hygiene: namespaces belonging to profiles the backup
  doesn't include are cleaned up instead of sitting in storage forever as
  invisible ghosts; the exported file's object URL is released after
  download; a failed import clears the file picker so the same file can be
  re-selected; and the real error reason is shown instead of a generic
  "Invalid backup file" for every failure.

## 2026-08-07 — The meal factors now calibrate to your own metabolism

### Added
- **The stomach-fullness adjustment learns your personal response**, the same
  way the timing model already learns your onset/peak/duration. The
  population factors (a full meal ≈ ×1.6 slower onset, and so on) are now
  only the starting point: every tracked session that carried a meal answer
  compares your actual reported timings against your own no-meal baseline,
  and an averaging model (seeded at the population prior, first sample moves
  it halfway, bounded so one wild tap can't write something absurd) walks
  the factors toward *your* gastric response. Learned per profile rather
  than per medication — stomach emptying is your physiology, so every oral
  medication's sessions pool into the same signal instead of fragmenting it.
  The picker's caption shows where calibration stands ("Calibrated to you
  from N of your own sessions").
- **The baseline timing model is now protected from meal contamination.** A
  session answered "full meal" used to feed its (meal-delayed) timings
  straight into the baseline model, teaching it the drug itself was slow —
  and the meal delay would then be applied *again* on top next time. The
  meal shift applied at session start is now divided back out before the
  baseline trains, so fed and fasted sessions both sharpen the same clean
  baseline.
- Guardrails that keep the calibration honest: meal learning only engages
  once the medication's own baseline model is trustworthy (3+ trained
  sessions — before that, a slow session can't be attributed to the meal
  rather than to a baseline that's simply wrong for you); the "light meal"
  baseline state and non-oral routes never train it; undoing a session's
  completion rolls the meal model back under the same not-touched-since
  guard as the timing model; and peak *intensity* deliberately stays a
  population prior, because timing has a real observation channel (your
  feedback taps) and intensity does not.

## 2026-08-07 — Bring back the original effects curve; ask how long ago you ate

### Reverted
- **The effect-intensity curve is back to the original three-segment shape**
  (rise to the reported peak, a full-intensity plateau across the first
  stretch after it, an eased decline to the reported end, then a small
  after-effects tail), on user feedback that it tracked their real
  experience better than the one-compartment PK/PD model that briefly
  replaced it. The revert is surgical: an exact-match regression test now
  pins the restored curve pointwise against an independent verbatim copy of
  the original, and everything that shipped alongside the rewrite but isn't
  the curve's shape — the saturating Emax dose-response, Emax redose
  stacking, the tolerance model, the residual-on-board preview — is kept.
  One knock-on effect worth knowing: the restored curve reads higher
  mid-decline than the PK/PD one did, so the "+X% still active from a
  recent dose" line in the dose preview reports larger numbers for the same
  history (still capped as before).

### Added
- **"When did you last eat?" on the Track-effects toggle** for swallowed
  doses. Gastric emptying is the rate-limiting step for an oral dose, so
  stomach fullness genuinely moves the curve: a full meal (under an hour
  ago) models slower onset and come-up, a somewhat blunted and slightly
  longer effect (the blunt-and-spread pattern food-effect studies show);
  an empty stomach (3+ hours) models faster onset and a slightly stronger
  peak. A light meal (1–3 hours) is the baseline — the category values
  were already population-typical oral numbers — and skipping the question
  changes nothing at all. Same "UX prior, not medicine" framing as the
  rest of the engine. The answer is stored on the session, correctable
  later from the session card's edit panel, survives model resets and the
  live tolerance recompute, feeds the dose-effect preview live while
  logging, and the assistant's log_dose tool accepts it too. Non-oral
  routes (smoked, insufflated, injected, patches) are never asked and
  never adjusted.
- Fixed a small pre-existing gap the meal picker exposed: the Today page's
  log sheets never received the medication's form, so form-dependent UI
  (like the capsule label) silently fell back to defaults.

## 2026-07-29 — Pharmacology audit: interaction gaps, false alarms, and a wrong nicotine curve

Audited the pharmacology layer end to end — the PK/PD curve engine, the
tolerance model, the interaction rules, the taper math, and all 58 knowledge-base
entries — by cross-checking each engine against the catalog rather than reading
them in isolation. Half-lives, maximum daily doses and the hyperbolic taper
(which correctly linearises receptor occupancy) all checked out. The problems
were concentrated in the interaction rules, where a drug's *category* is
sometimes simply the wrong description of it.

### Fixed
- **Tramadol combined with an SSRI or SNRI produced no warning at all** — the
  single most serious gap found. Tramadol is filed as an opioid, so it flagged
  correctly against sedatives, but it is also a serotonin-norepinephrine
  reuptake inhibitor, and the antidepressants sat in a different cluster that
  never met it. Its own knowledge-base entry warns about exactly this pairing.
  Both the serotonin syndrome risk and the compounding effect on tramadol's
  lowered seizure threshold are now flagged as high-risk.
- **Lithium alongside an NSAID, ACE inhibitor, ARB or thiazide was silent.**
  All of these reduce lithium's renal clearance, and lithium has a narrow
  therapeutic range, so a previously stable dose can drift into toxicity.
  Lithium *augmentation of an antidepressant* is deliberately still not
  flagged — that combination is standard psychiatric practice, and warning
  about it would be a false alarm.
- **MDMA was treated as purely serotonergic**, so combining it with a
  stimulant raised nothing despite being a substituted amphetamine itself. It
  now also counts as a stimulant, which additionally covers MDMA with alcohol.
  Where both apply — MDMA with an antidepressant — the serotonin syndrome
  warning still takes precedence.
- **A classic psychedelic taken with a stimulant** now flags the added
  cardiovascular and temperature load, as LSD's own entry describes.
- **SSRI/SNRI plus an NSAID** now flags GI bleeding risk (serotonin depletion
  in platelets plus direct COX inhibition). Easy to hit by accident given the
  NSAID half is sold over the counter. Bupropion, an NDRI, correctly does not
  trigger it.
- **Acetaminophen with alcohol** now flags liver risk.
- **Nicotine is now recognised as a stimulant** for interaction purposes
  despite sitting in the "other" category, which otherwise holds
  chronic-condition medications.

### Fixed — false alarms
- **Lamotrigine plus an opioid was reported as a leading cause of overdose
  death.** That is true of gabapentinoids, which share the "anticonvulsant"
  bucket, but false of lamotrigine — a sodium-channel agent that is neither
  sedating nor respiratory-depressant. The same over-statement applied to
  second-generation antihistamines like cetirizine, chosen specifically for
  minimal CNS penetration. Both now get an accurate note about additive
  drowsiness instead. The genuinely dangerous members of those categories —
  gabapentin, pregabalin, diphenhydramine — keep the severe warning, which is
  the point: a warning that fires on everything gets ignored on the one that
  matters.

### Fixed — plumbing
- **The nicotine effects curve was modelling the wrong product.** Its timings
  are referenced to inhaled nicotine (effects over within the hour), but the
  catalog defaulted the entry to a patch. Since form adjusts absorption *rate*,
  that combination produced a ~3 h curve for a product designed to hold a
  steady level for 16-24 h. Nicotine now defaults to smoked/vaporized, matching
  both its reference data and how it is usually tracked here, and the entry
  describes patch and gum dosing separately. A regression test now rejects any
  substance defaulting to a depot form, and the limitation is documented where
  the form multipliers are defined.
- **Medications saved under a brand name skipped every substance-level
  interaction rule** on the home screen, because the generic name was never
  passed along with the dose — so "Ultram" would not have matched the new
  tramadol rule, nor "Xanax" the existing ones. The generic name now travels
  with each dose.

## 2026-07-27 — Give the Calendar a dot for as-needed-only days

### Fixed
- **The colored adherence dots never showed for a day with only as-needed
  activity and no scheduled medications** — a direct side effect of the
  previous fix, which correctly surfaced as-needed dose history in the
  day-detail list but didn't touch the dots above it. Those are still
  computed purely from schedule adherence (`expected`/`taken`), which is
  the right math for a scheduled medication but is always zero for a
  purely as-needed one — so a user like the person who reported this, whose
  only tracked substance is as-needed, saw a completely blank calendar
  again: real logged doses in the list below, but never a single dot.
  `getAnalytics()` now also reports `prn_taken` per day, and the Calendar
  shows a 4th, distinct dot color ("As needed", blue) for a day with
  as-needed activity but nothing scheduled — kept separate from
  Perfect/Partial/Missed rather than folded into them, since "adherence"
  isn't a meaningful concept for a dose that was never expected on a
  schedule in the first place.

## 2026-07-27 — Fix the Calendar page: as-needed doses never showed up, and past days looked permanently "pending"

### Fixed
- **As-needed (PRN) doses never appeared in the Calendar's day view, on any
  day, ever** — likely the main reason it felt non-functional, since a lot
  of what this app tracks (kratom, alcohol, psilocybin, and similar) is
  logged as-needed rather than on a fixed schedule. The day-detail list
  only ever rendered `doses` (fixed-schedule entries) and gated its empty
  state on `prn`, which is the *undated* "which as-needed meds exist"
  list the Today page uses for its always-visible quick-log buttons — not
  a history of what was actually taken. The net effect: tapping any day
  showed a blank area with nothing in it, or a wrongly-suppressed "No
  doses" empty state, regardless of how much was actually logged that day.
  `getToday()` now also returns `prn_logs` — the real as-needed dose
  history for that date — and the Calendar renders it alongside scheduled
  doses; `Today.jsx`'s existing use of `prn` is untouched. Verified
  end-to-end through the real UI: added an as-needed medication, logged a
  dose from the Today page, and confirmed it now shows up under today's
  date on the Calendar.
- **A past day's never-logged scheduled dose read "pending" forever**,
  even for a day long over, while the calendar's own colored dot for that
  exact day correctly showed "missed" — a direct, confusing contradiction
  between the dot and the list underneath it when you tapped in. Nothing
  in the app ever automatically marked a lapsed dose as missed; only an
  elapsed day now gets that treatment (today's still-open doses are
  untouched, so they stay actionable exactly as before).

## 2026-07-27 — Make the assistant actually use interactive quick-reply buttons

### Fixed
- **The assistant would end a reply with a plain-text question instead of
  tappable buttons**, even for a clear yes/no offer like "Want me to set
  up a taper plan?" — the `ask_user` tool and its UI wiring were both
  working correctly (confirmed: the return value already flows into the
  quick-reply buttons, and other tools were firing fine in the same
  turn), the model was simply choosing to type the question as its last
  sentence instead of calling the tool. The system prompt's guidance
  covered explicit multiple-choice prompts but didn't call out this
  specific pattern — an offer to take further action tacked onto the end
  of a longer explanation — clearly enough. Rewrote the instruction to
  name that exact pattern, state plainly that it applies after a long
  answer just as much as a short one, and clarify that the explanation
  and the tool call can (and should) coexist in the same turn rather than
  restating the question in text after calling the tool.

## 2026-07-27 — Stop sizing the assistant page with vh/dvh; pin it to the real viewport

### Fixed
- **The assistant page's header could scroll out of view on a real,
  installed-to-home-screen iPhone even on a completely empty
  conversation**, where nothing should be scrollable at all — confirmed
  from device screenshots showing the header disappear off the top while
  the fixed input bar and tab bar stayed put, which only happens if the
  document itself is slightly taller than the true visible viewport. The
  page's root was sized with a hardcoded `height: 100vh`; iOS has a
  long-documented habit of getting `vh` units wrong relative to the actual
  visible area, and this build was still hitting it even after the
  previous two rounds of fixes to this page. Rather than swap to `dvh`
  again — which was already tried once, reverted after looking like it
  made scrolling worse, and can't be verified in this environment since
  only Chromium is available here, not WebKit — the root now uses
  `position: fixed; inset: 0` with `overflow: hidden`, the same technique
  the input bar already used successfully in every prior screenshot from
  this saga. This isn't a viewport-unit value at all, so there's no vh/dvh
  computation left to get wrong; verified directly that the document
  cannot scroll in any of the three states (no key, empty chat, populated
  chat) even when a scroll gesture is deliberately forced.

### Fixed
- **A large blank void could sit between the "How can I help?" intro and
  the input box on a blank conversation**, on tall phones especially — not
  a scroll bug (that container has nothing to overflow: measured directly,
  its scrollHeight and clientHeight were identical), but a layout one. The
  intro was top-aligned with a fixed `pt-8`, so on a screen taller than its
  own content it just left everything below to sit empty instead of using
  it. Centered it vertically within the actual available space instead
  (`flex-1` + `justify-center` on the intro block, applied only when the
  conversation is empty — a populated conversation's message list is
  completely unaffected, verified directly). This was a distinct defect
  from the reserved-bottom-padding mismatch fixed for populated
  conversations in the previous change; that fix was correct as far as it
  went, it just didn't cover this screen, which has no messages to reserve
  space below at all.

## 2026-07-26 — Revert the vh→dvh change; fix the assistant's real bottom-padding mismatch instead

### Fixed
- **The previous `100vh` → `dvh` swap made scrolling feel worse, not
  better, and was reverted in full** (`.App`, the `Layout.jsx` shell, the
  Assistant page's wrapper, and the toast viewport are back to plain
  `100vh`/`min-h-screen`, and `overscroll-behavior-y` is back to `body`
  only). Two screenshots of the same scroll position, taken before and
  after that change, showed an *identical* gap — meaning `dvh` never
  touched the actual reported defect — while live scrolling reportedly got
  glitchier. The likely mechanism: `dvh` is a genuinely *dynamic* value,
  and having two nested containers (`.App` and its `<main>`) both track it
  live gives the browser two dependent layouts to recompute against a
  value that can change mid-gesture, which is a known source of scroll-time
  jank on iOS — a worse trade for a bug this specific fallback didn't even
  fix.
- **The real defect**: the assistant's message list reserved a hardcoded
  `180px` of bottom padding to keep the last message clear of the fixed
  input bar below it — a guess that didn't track the bar's actual height,
  which changes with conversation state (the suggestion-chip row only
  shows on an empty chat) and would drift further out of sync on any
  device with different safe-area insets. Replaced the guess with a real
  measurement: a `ResizeObserver` on the fixed bar reports its live height,
  and the message list's reserved space is computed from that plus the tab
  bar and safe-area variables already used to position the bar itself —
  so the reserved space always matches exactly, with a small fixed margin,
  regardless of device or conversation state.

## 2026-07-26 — Contextual autofill suggestions and interactive quick-reply questions

### Added
- **AI-generated, contextual suggestions above the chat box**, replacing the
  fixed four-string list that had been there unchanged since the assistant
  shipped. Grounded in this person's actual state — real medication names,
  an effects session in progress, tolerance worth asking about, a taper
  underway, refills coming due — instead of always the same generic
  prompts. Cheap (light-tier model) and cached by a hash of that context, so
  reopening the assistant with nothing changed costs nothing after the
  first time. Tapping one **fills** the message box rather than sending
  immediately — these are starting points, not guaranteed-correct guesses
  about intent, so there's a chance to edit first.
- **`ask_user`: the assistant can ask a question with tappable quick-reply
  buttons** instead of only plain text — "which medication did you mean,"
  "taken or skipped," confirming a value — answerable in one tap instead of
  typing. It's a UI-only tool with no app-data effect: the loop ends the
  turn the moment it's called (there's nothing to feed back yet — the
  answer is whatever the user taps next, which arrives as an ordinary
  message on the following exchange), so it composes with every existing
  tool and the agentic tool-chaining from the previous change without any
  special-casing elsewhere. The system prompt steers the model to reach for
  it whenever a question has a short, enumerable set of likely answers, and
  reserve plain text for genuinely open-ended ones.

### Removed
- The `getAiSuggestions` stub in `lib/api.js` (four hardcoded strings,
  never actually wired to the UI — the chat box's suggestion row had its
  own separate hardcoded list). Superseded by the contextual generator
  above.

## 2026-07-26 — Interaction checks, taper adjustments, a scheduled digest, and a more agentic assistant

### Added
- **`check_interactions` tool.** The app has had a category-level interaction
  checker since the combined-effects chart shipped, but the assistant had no
  way to use it. Works two ways: given just a medication, checks it against
  everything currently active in the body (mirrors the in-app warning);
  given a second substance too, checks that specific pair directly — which
  works even for something the user hasn't added as a tracked medication,
  e.g. "what if I combine my kratom with alcohol" resolves alcohol from the
  knowledge base rather than requiring it to exist as a medication first.
- **`research_substance` tool.** Reference lookup (typical dosing, expected
  onset/peak/duration timing, risk level, dependency risk, side effects,
  warnings) for anything in the knowledge base, tracked or not — meant for
  "what should I expect from X" before a first dose, which previously had no
  grounded answer beyond the model's own (unsourced) knowledge.
- **`adjust_taper_plan` tool, and `adjustTaper` underneath it.** The assistant
  could create a taper but never change one — "slow my taper down" had no
  path but delete-and-restart, which loses history. `adjustTaper` reshapes
  the *remaining* schedule from today's actual dose forward to an optionally
  new target/duration/method/step size, in place (same id, notes intact);
  didn't exist at the data layer at all before this, since `updateTaper` only
  ever touched `is_active`/`is_paused`/notes.
- **A scheduled AI digest**, in Settings → AI Digest: daily or weekly, a
  time (and weekday, for weekly), and a custom-instructions box — the same
  idea as ChatGPT's scheduled tasks. Delivered as a proactive message in the
  assistant's own chat thread plus a local notification, not a separate
  report screen. Its payload includes active effects-tracker sessions and
  tolerance (in the same plain-language terms as the tolerance meter),
  alongside the existing adherence/refill/mood/behaviour data the on-demand
  insights already used. Since this is a client-only app with no server to
  run it on a real clock, it's checked best-effort on every app open —
  unlike a reminder notification (which is simply missed if the app wasn't
  open at that exact moment), a digest whose scheduled time already passed
  is generated late on the next open rather than silently skipped. A failed
  generation leaves the schedule untouched so it's retried, not lost, for
  that period. A "Send a digest now" button sends one immediately (still
  using the same custom instructions) for testing without waiting.
- **Web access, actually wired up.** The AI config has had a `webAccess`
  flag since the assistant shipped, with no UI to set it and nothing reading
  it — a dead setting. It now has a toggle in Settings and, when on, adds
  OpenRouter's `web` plugin to chat requests, so the assistant can look up
  something time-sensitive (a recall, current guidance) instead of relying
  only on its training data or the app's own stored data.

### Changed
- **More agentic tool use.** The system prompt now explicitly tells the
  model to chain read-only tool calls on its own — resolve a medication,
  then check its tolerance, then check interactions, then preview a dose —
  without narrating each step or asking permission in between, reserving
  confirmation for ambiguous or genuinely irreversible writes. The tool-loop
  iteration cap went from 5 to 10 turns, since a single request can now
  reasonably chain several of the tools above in sequence before it would
  have been cut off mid-chain with calls still pending.

### Fixed
- **`sessionId()` (the shared chat-thread id) could throw in any environment
  without a global `crypto`**, silently breaking whatever called it — moved
  out of the Assistant page (where it was previously a private, untested
  helper) into `lib/ai.js`, shared with the new digest, and given a real
  guard instead of assuming `crypto` exists.

## 2026-07-26 — The AI assistant catches up to the effects tracker

### Fixed
- **`get_active_effects` (the assistant's view of a running effects session)
  was reading a pre-redose, pre-tolerance-rebaseline version of the engine.**
  It computed intensity from the *original* dose's curve and scaled it by a
  raw `intensity_scale`, so a session with a redose on top reported the
  superseded first dose's fading curve instead of the current one — and
  phase was measured from session start rather than from the most recent
  dose, so "coming up again" after a redose read as "wearing off" instead.
  Neither matched what the Effects page itself shows. It now reuses the same
  `sessionDoseStack` / `phaseAt` / `doseIntensityAt` the chart renders from
  (via a new shared `describeActiveSession`), reports how many redoses are
  stacked, and states tolerance in the same plain terms as the tolerance
  meter rather than a bare number.

### Added
- **Two new read tools**, wired into the assistant's tool schema and system
  prompt: `get_medication_tolerance` (a plain-language band, roughly how much
  weaker a dose lands, and whether it looks faded after a gap) and
  `get_dose_effect_preview` (previews a specific dose's percent-of-usual
  before it's taken — exactly what the log sheet shows when entering that
  dose). Both derive from the same functions the UI uses, so the assistant
  can never disagree with what's on screen.
- **Two new action tools**: `log_dose` takes an optional `track_effects` flag
  that starts an effects-tracking session on the dose just logged (mirroring
  the log sheet's toggle), and `add_redose` stacks a redose onto a
  medication's running session, surfacing the same too-soon / over-max safety
  warnings the Effects page's redose flow shows.
- The system prompt now explicitly warns the model against restating a raw
  tolerance level as if it were itself a percentage reduction in effect —
  the exact misreading corrected everywhere else in this app in the change
  above.

## 2026-07-26 — Say what "tolerance" actually means

### Changed
- **The tolerance meter said "91%" and left you to guess what it was 91%
  *of*.** It was never a percentage drop in effect: it's progress along the
  substance's own tolerance range, and each substance has a different ceiling
  on how far tolerance can blunt it (opioids ~60%, antihistamines ~30%). So
  91% on an opioid means doses land about 55% weaker, not 91% weaker — a gap
  wide enough to matter when the number is being used to decide a dose. The
  meter now leads with the plain-language band and the figure people actually
  mean ("Very high · doses land ~51% weaker"), labels the bar's scale under
  it ("no tolerance" → "85% of the most this substance can build"), and hides
  the derivation behind an (i) that explains all three of: what it measures,
  that it comes from your own logged daily amounts rather than dose counts,
  and what it does *not* change.
- **Faded tolerance now leads with the drop, not the leftover.** Sitting next
  to a "this could hit harder than you're used to" caution, a headline of
  "Low · doses land ~6% weaker" read as *nothing to see here* — the opposite
  of the point. It now reads "Low now · was very high", and the caution below
  gives the numbers.
- **The dose preview's explanation was restructured and corrected.** It
  claimed to "account for your current tolerance" and then, a clause later,
  that tolerance "mostly cancels out" — both true, but stated as if they
  contradicted each other. It's now three short labelled parts (what 100%
  means, what moves it, where tolerance fits), and the tolerance part branches
  properly: normally it cancels because your usual dose carries the same
  tolerance, but when tolerance has **faded** it explicitly does not, and the
  text now says so instead of asserting the cancellation and then walking it
  back.

### Fixed
- **The two tolerance figures shown inches apart in the log sheet could not
  be checked against each other.** The preview reported "blunting effect by
  about X%" from one derivation and the meter reported a raw level from
  another; the ceiling those two share wasn't carried through to the meter at
  all. It now is, and a test pins the two to the same number.

## 2026-07-26 — Sessions already running pick up the corrected scale

### Fixed
- **A session that was already in flight kept showing the old 40%-ceiling
  curve.** Rescaling the curve against the user's own baseline only changed
  what *new* sessions were given: `intensity_scale` is written onto a
  session's profile when it starts and was then returned verbatim forever, so
  a session running at the time of the change stayed on the old value until
  it ended — hours of a curve that couldn't exceed 40% however the dose
  actually felt. A running session's height and tolerance are now recomputed
  on read, since both are just functions of the dose and current tolerance.
  Its *timing* is still snapshotted and deliberately not re-derived — a curve
  that shifted underneath you mid-session would be worse than useless.
  As a side effect the tolerance shown against a running session now tracks
  doses logged after it started, instead of reporting the moment it began.

## 2026-07-26 — The curve is scaled against your own usual, like everything else

### Fixed
- **A dose at its peak read "Peak · 40% intensity" while the log sheet called
  the same dose 100% of usual.** The curve was scaled by *absolute* tolerance
  — at 98% tolerance the factor is `1 − 0.98×0.6 ≈ 0.41` — so a long-term
  user's curve topped out around 40% of a full-height axis and never went
  near the top of the chart, no matter what they took. That's the same
  drug-naive baseline already corrected in the predicted-effect headline, and
  having the two disagree about the same dose was the visible symptom.
  Tolerance is now applied relative to the person's own recent baseline, so:
  - a usual dose peaks at 100% for everyone, and the axis is spent on what
    actually varies rather than on a constant offset;
  - a **larger** dose rises above 100%, as it already did;
  - tolerance that has **faded** since the doses this one follows also rises
    above 100%, which is exactly the "this will land harder" case the warning
    beside it describes.
  Absolute tolerance is unchanged and still reported in full by the meter
  beside the chart — it's shown once, in the place meant for it, instead of
  being silently folded into a second number on a different scale.

## 2026-07-26 — The tolerance meter reads the same everywhere

### Fixed
- **The tolerance meter beside the effects graph disagreed with the identical
  meter in the log sheet** — 81% against 88% in a reproduced session. The
  effects graph was reading the tolerance snapshot stored on the session's
  profile, which is frozen at the moment the session started and deliberately
  excludes the session's own dose. That is the right input for *dampening
  that dose's curve*, but wrong for a meter labelled "Tolerance": it goes
  stale as the session runs and never counts a redose logged during it. The
  graph now reads current tolerance from the same source as the log sheet and
  the medication page, under the same query key, so all three share one cache
  entry and can't drift apart. The curve itself still uses the snapshot, which
  is what it should be dampened by.

## 2026-07-26 — Chart tooltip now reads on the same scale as the axis

### Fixed
- **The chart's hover detail still measured from the session start after the
  axis had been rebased onto the current dose.** With previous doses hidden
  the axis reads as time since the dose being shown, but the tooltip kept
  reporting session time — so a point sitting at roughly 45 minutes on the
  axis announced itself as "4 h 59 m after dose". It now uses the same origin
  as the axis ("54 min after this dose" zoomed in, "after dose" when the whole
  session is in view).
- **The "+dose" marker no longer collides with "now".** Zoomed to the current
  dose, that marker sits exactly on the axis origin, where "0" already means
  this dose — so the tag said nothing and overlapped the "now" label beside
  it. It's dropped at the origin and returns when the wider view puts the
  redose somewhere meaningful.

## 2026-07-26 — Curve continuity with old feedback, and residual drug in the prediction

### Verified
- **Checked that the PK/PD rewrite didn't reinterpret feedback people had
  already given**, by replaying the previous spline against the new curve
  across every category. The two anchors users actually tap are effectively
  unchanged: **peak is identical** (100 at `peak_min` in both) and **onset is
  within 2 points**. Total exposure (area under the curve) stays within ±20%
  — the same dose, not a different drug. The real divergence is mid-decline,
  where the new curve is 9-41 points lower, and that is the intended
  correction: the old shape held a dead-flat 100% for a third of the
  post-peak span, which no real drug does.
- These bounds are now regression tests, along with one that trains a model
  from real feedback taps and confirms the reported onset carries into the
  next session's curve verbatim with the peak still anchored at 100 — so this
  can't silently drift again.

### Fixed
- **A dose reported "Gone" no longer reads as still substantially active.**
  The fitted curve retained 12-22% at `duration_min`, so the moment someone
  reported no effect the model still showed a fifth of peak. The
  after-effects taper now begins slightly *before* that point rather than at
  it, easing out across the report instead of after it — bringing the
  residual to 0-17% without touching the fitted peak.
- **The taper could flatten the peak itself on a compressed profile.** Where
  a learned onset sits close under its peak, a fixed fraction of duration can
  fall on the wrong side of the peak; the taper is now clamped to never start
  before it. Caught by the round-trip test above.

### Added
- **Predicted effect now accounts for drug still on board from earlier
  doses.** This was only ever modeled *within* a single effects session, so a
  dose logged a couple of hours after another — or during a separate session
  entirely — was treated as landing on nothing, despite that being the
  largest short-term factor after the dose itself. Each recent dose now
  contributes its own curve's value at that moment, scaled by its size and
  dampened by the same tolerance as the new dose. Surfaced explicitly:
  "Includes +98% still active from a recent dose — this one lands on top of
  it."
- **The prediction reports its own breakdown** (`factors`: dose, residual,
  tolerance dampening), and the explainer now states plainly that tolerance
  is accounted for and by roughly how much ("currently blunting effect by
  about 47%") — so "does this take tolerance into account" has a visible
  answer rather than an implicit one. Tolerance still largely cancels from
  the headline by design, because it affects the usual dose being compared
  against too; the meter beneath reports it on its own.

## 2026-07-26 — The curve is now a real PK/PD model, and tolerance follows daily exposure

### Changed
- **The intensity curve is a one-compartment pharmacokinetic model feeding an
  Emax pharmacodynamic one, rather than three splines bolted together.**
  Concentration follows first-order absorption and elimination (the Bateman
  function), and effect follows from concentration through the same Emax
  relationship the dose-response already uses — because it *is* the same
  relationship, receptor occupancy against available drug. The old shape had
  two features nothing in real pharmacology has: a dead-flat 100% plateau
  holding for a third of the post-peak span, and a discontinuous step down
  into a separate "after-effects" block that showed as a visible notch on
  every chart. Both are gone; the curve now has a rounded peak and a
  genuinely exponential decline.
  - All three learned parameters are preserved *exactly*, each pinned to the
    part of the model it actually corresponds to: `onset_min` is where effect
    crosses the perception threshold (solved via C50), `peak_min` is
    concentration tmax, `duration_min` is where effect has fallen back to a
    small fraction. The learner, the phase labels and every caller are
    untouched.
  - The fit needs an absorption lag to be solvable at all — real for anything
    swallowed, and without it a curve peaking at 75 minutes is already a
    quarter of the way up at 8, so no threshold can place a fast onset. Rates
    are solved by bisection and memoized per distinct profile, so each curve
    costs one solve and then a couple of exponentials per sample.
  - Where a profile asks for something a one-compartment curve genuinely
    cannot deliver (a fast onset *and* a short duration around a late peak),
    the fit takes the closest achievable shape rather than running off to a
    nonsense extreme.
- **Tolerance is driven by each day's total exposure rather than by counting
  dose events.** Every dose used to contribute one unit regardless of size, so
  someone splitting 8 g of kratom across four 2 g doses was modeled as *four
  times* as tolerant as someone taking the same 8 g at once — backwards, since
  tolerance follows total exposure, not dosing frequency. Doses are now
  aggregated per local calendar day and weighted by that day's total against a
  median typical day (median for the same reason the dose-response reference
  is: an escalation shouldn't quietly redefine "typical" and hide itself).
  Histories with no recorded amounts fall back to counting each *day* once,
  still an improvement on counting each dose.
- **A redose's strength now uses the same saturating dose-response as
  everything else.** It scaled linearly and without bound, so a redose of four
  times the primary was modeled as four times the effect.
- **The x-axis is rebased on the dose being shown.** With previous doses
  hidden the chart is zoomed to the current dose, but the axis still measured
  from session start — so that dose's onset was labelled "6h", time belonging
  to a curve that isn't even drawn. It now reads as time since *this* dose,
  starting at 0, and reverts to session-relative time when earlier doses come
  back into view.

### Fixed
- **The redose guardrails now check the whole day, not just the session.**
  `redoseWarnings` compared its running total against `max_daily_dose` while
  only ever seeing the current session, so a morning dose before an afternoon
  session — or an entirely separate earlier session — counted for nothing
  against a limit that is by definition daily. New `getPriorDoseTotalToday`
  supplies the rest of the day's total, excluding the session's own logs so
  nothing is double-counted.

### Verified
- Full suite: 328 tests passing (7 new). Curve coverage asserts the peak lands
  exactly where learned, that there is a single rounded maximum rather than a
  plateau, that the decline is monotone with no cliff anywhere across the
  after-effects boundary, and that every category × form profile the engine
  can produce stays well-formed. Tolerance coverage asserts that splitting a
  day's amount across more doses gives the *same* tolerance, that a day
  heavier than the person's own norm raises it, and that amount-less histories
  still count each day once.
- Browser-verified against the production build: the curve renders with a
  rounded peak and continuous tail (no notch), and the axis reads
  `0 · 1h · 2h … 6h` with the previous dose hidden, reverting to
  `0 · 2h · 4h … 12h` when it's shown.

## 2026-07-26 — Saturating dose-response, and a preview that answers the right question

Reported: doubling a kratom dose barely moved the predicted effect, which sat
in the 30-60% band regardless. Reproducing it turned up three separate
faults, each independently enough to flatten the number.

### Fixed
- **Dose scaling was linear and then hard-clamped at 1.5x.** Doubling and
  quadrupling a dose produced *identical* output (both 67% in the reported
  scenario), because both saturated the clamp. Real dose-response is neither
  linear nor abruptly clipped — it saturates smoothly, because receptors are
  finite. Replaced with the standard Hill/Emax equation,
  `E = Emax·Dʰ / (ED50ʰ + Dʰ)`, normalized so a typical dose is exactly 1.0.
  Each category (and, where it matters, each substance) now carries a Hill
  slope and a "where a typical dose already sits on the curve" fraction — the
  latter being what sets the headroom:
  - **Buprenorphine** gets a genuine ceiling. As a partial agonist its curve
    flattens hard past a moderate dose, which is exactly why it's used for
    maintenance; doubling now moves it under 15%.
  - **NSAIDs** get their well-known analgesic ceiling, for the same reason.
  - **Psychedelics and dissociatives** get steep slopes — the gap between "a
    bit more" and "far too much" is genuinely narrow for both.
  - **Kratom** gets more headroom than a conventional oral opioid, since its
    effect keeps climbing past a typical dose as the opioid-like side takes
    over from the stimulant-like one.
- **The reference dose was the mean of all logged amounts**, so escalating
  dragged the baseline up along with you and a genuinely doubled dose read as
  only slightly above "typical". Now the median, which the escalation being
  measured can't pull.
- **The headline was an absolute number, and tolerance dominated it.** For a
  daily user with saturated tolerance, "% of typical" was pinned near 40%
  whatever they did — it was describing an opioid-naive stranger, not them,
  and left no room for the dose to matter. It now reads **against their own
  recent normal**: 100% means a usual dose, above means stronger. Tolerance
  cancels out of that comparison exactly (it's still reported, in full, by
  the tolerance meter directly below), *except* after a detected break, where
  the pre-break tolerance is the honest baseline and the dose really will
  land harder. The bar runs 0-200% with a marker at 100%, so a normal dose
  sits mid-track with visible headroom rather than pinning full.

### Verified
- Full suite: 317 tests passing (9 new), covering: a typical dose is exactly
  the reference point for any parameters; the curve is monotonic with each
  doubling buying strictly less than the last; it saturates at the ceiling
  its parameters imply and never beyond; ceiling-effect substances stay flat
  while high-headroom ones climb; and the median reference resists the
  escalation it's measuring.
- Browser-verified against the production build, reproducing the reported
  setup (21 days of daily 2 g kratom, then sweeping the amount):
  1 g → 53%, 2 g → 100%, 3 g → 131%, 4 g → 152%, 6 g → 176%, 8 g → 189%.
  Previously 4 g and 8 g both read 67%. Tolerance still reported separately
  at 88%.

## 2026-07-26 — Per-substance pharmacology, and two engine logic fixes

Audit of the effects engine's accuracy against published pharmacology,
prompted by kratom — whose absorption is far faster than the generic oral
opioid bucket it shares. The audit found the bucket approach itself was the
problem for a meaningful slice of the catalog, plus two latent logic faults.

### Added
- **Substances whose pharmacology is genuinely unlike their category now
  carry their own timings** (`SUBSTANCE_PK` in effectsEngine.js), taking
  precedence over `CATEGORY_PK`, which stays as the prior for substances
  there's no specific data on. Keyed by name/generic_name (plus a small
  brand/street alias list), so existing medications pick their profile up
  with no migration or catalog re-seed. 21 entries; the ones the category
  was worst for:
  - **Buprenorphine** — the generic opioid bucket said 4.5 h. Its very slow
    mu-receptor dissociation means effects long outlast plasma levels;
    now modeled at ~24 h. This was the single largest error in the engine.
  - **Nicotine** — sat in "other" at 6 h; effects are over in well under an
    hour even though plasma nicotine takes hours to clear. Now 45 min.
  - **Psilocybin vs LSD** — shared one 8 h psychedelic bucket, but LSD runs
    roughly twice as long as psilocybin (~8.2 h vs ~4.9 h in head-to-head
    trials). Split into 540 min and 300 min.
  - **Kratom** — onset 8 min rather than the bucket's 25, duration 5.5 h.
    Its effects are also famously dose-dependent (stimulant-leaning at low
    doses, opioid-like and sedating at high); the timing is similar across
    that range, but the *character* change is not something a single
    intensity curve can express, so it's documented rather than faked.
  - **Modafinil** (7 h → 11 h), **cyclobenzaprine** (5 h → 15 h, ~18 h
    half-life), **clonazepam** (6 h → 12 h), **lisdexamfetamine** (a prodrug,
    with a deliberately slow 90 min onset), **methamphetamine**, **caffeine**,
    **tramadol**, and others.
- **Nicotine now has modeled tolerance** (`SUBSTANCE_TOLERANCE`). Its "other"
  category correctly models none — that bucket otherwise holds
  chronic-condition medications — but nicotine is among the most
  tolerance-forming substances in the catalog, and was getting nothing.
- Tests assert every override round-trips through the engine unchanged at its
  own reference route (so no entry can silently claim numbers a clamp is
  rewriting), that no category × form × substance combination can produce a
  degenerate curve, and that every table key still names a real catalog entry
  — a rename on either side would otherwise silently drop a substance back to
  its less accurate category default with nothing failing.

### Fixed
- **A route-specific baseline was being sped up twice.** The cannabis
  baseline was already measured for smoked material, but `FORM_SPEED` then
  applied the 0.15 smoked multiplier on top, collapsing an 8-minute onset to
  about 1. Each substance profile now records the route its numbers actually
  describe, and form is applied *relative* to it — so declaring the same
  route is a no-op, while a genuinely slower one (an edible) still slows the
  curve, and by the right amount.
- **A large route change could crush the come-up.** Onset scales linearly
  with route speed but the come-up only by its square root, so past a certain
  ratio onset overtook peak and the ordering clamp flattened the come-up to
  its 5-minute floor — a curve that spikes the instant it begins. Peak is now
  derived as onset plus a scaled come-up, which keeps the curve's shape and
  keeps `onset < peak` true by construction for any ratio.
- **A long curve made the combined chart's x-axis unreadable.** Nothing in
  the catalog previously ran long enough to stress it; buprenorphine's ~30 h
  window emitted 15 ticks of full clock times that collided into a smear.
  Tick spacing now scales past the old 2-hour maximum (to 6- and 12-hour
  steps), leaving short and medium sessions exactly as they were.

### Verified
- Full suite: 308 tests passing (18 new). Browser-verified against the
  production build: kratom charts onset ~8 min / peak ~75 min / end ~5.5 h,
  buprenorphine charts onset ~30 min / peak ~2 h / end the *following day*,
  and both the combined and detail charts render legible axes across a 30 h
  window.

## 2026-07-26 — Confidence-gated calibration, and a first-time explainer

### Added
- **A one-time intro explains the dose-effect preview the first time it has
  something to show**, instead of a new UI element just quietly appearing.
  A dismissible card ("New: a preview of how this dose may feel...") shows
  in context — right alongside the first real preview, not as a cold
  standalone popup — and a new `seen_dose_effect_intro` settings flag means
  it never shows again once dismissed. A persistent (i) toggle next to
  "Predicted effect" remains available afterward for anyone who wants a
  refresher on what the numbers mean.
- **The preview now says plainly where its number comes from.** A small
  line under the bar reads "Based on typical values for this category" or
  "Based on your calibrated effects-tracker data," so it's never ambiguous
  whether a given estimate reflects population research or this person's
  own tracked timing.

### Fixed
- **The preview could call a medication "calibrated" off a single, noisy
  data point.** `personalizedProfile`'s onset/peak/duration_min come from
  timing self-reports, EWMA-learned -- and the very first observation is
  *adopted outright*, with no averaging at all (see `updateModel`), so one
  session's reported timing is exactly as noisy as a single self-report can
  be. `estimateDoseEffectiveness` now only trusts those learned values over
  the researched category default once `modelConfidence` reaches "medium"
  (3+ tracked sessions) — below that, the population-typical curve is
  genuinely more accurate than an under-sampled personal one. This is
  deliberately scoped to the new preview only, not `personalizedProfile`
  itself or the real effects-tracker curve, which are unaffected and keep
  their existing (and separately well-tested) behavior everywhere else.
  `ref_dose` (how much was actually taken -- a plain recorded number, not a
  fuzzy timing estimate) is a different kind of signal and is still trusted
  starting from a single session, learned or, as before, averaged from plain
  log history when no effects-tracker model exists at all.
- **MDMA's tolerance-decay estimate was too optimistic.** `empathogen`'s
  `decayDays` was 14 -- but harm-reduction guidance for MDMA specifically
  recommends waiting *months*, not weeks, between sessions for fuller
  subjective recovery (the well-documented "can't recreate the magic"
  phenomenon). Raised to 30 days and `maxDampening` to 0.6 so the estimate
  errs toward the more conservative, better-supported end rather than
  implying tolerance resets quickly. Reviewed every other category's
  formation/decay constants against known pharmacology in the same pass;
  none of the others showed a clear enough discrepancy to justify changing
  an already-cited estimate.

### Verified
- New test: a model trained with one atypical session (adopted outright,
  per `updateModel`'s no-averaging-on-first-sample behavior) is correctly
  reported as `calibrated: false` and doesn't affect `intensityScale`
  relative to a same-size dose; three sessions (samples=3, medium
  confidence) flips it to `calibrated: true`. Full suite: 290 tests passing.
- Browser-verified against the production build: the one-time intro appears
  exactly once (persists dismissed across sheet reopens), the info toggle
  reveals detail text, the source line reads "typical values" before any
  effects-tracker use and switches to "your calibrated effects-tracker data"
  after three tracked sessions on the same medication.

## 2026-07-26 — A live dose-effect preview when logging, for any schedule

### Added
- **Logging a dose now shows a live preview of how it's likely to land —
  predicted effect strength and tolerance — for any medication with enough
  history to say something, not just PRN ones using the effects tracker.**
  A compact card appears right under the dose-amount fields in
  `QuickLogSheet` (before saving, no need to expand "Add mood, effectiveness
  & notes"), showing "Predicted effect: X% of typical" plus the same
  tolerance meter used elsewhere, and it recomputes live as the dose amount
  is adjusted. Quiet by design: it only appears once there's something
  meaningful to report (the dose deviates from typical, or tolerance is
  non-trivial or faded) — a fresh medication or one with nothing unusual
  going on shows nothing extra.
- **Works for medications that have never used the effects tracker at all —
  the "existing older schedules" case.** Dose-ratio scaling previously only
  activated once a `ref_dose` had been *learned* from a completed
  effects-tracker session, so a medication logged the plain way for months
  on a fixed schedule would never reflect its dose amount in this preview.
  `estimateDoseEffectiveness` now falls back to the medication's own average
  historically logged amount as the reference dose when no learned model
  exists, for this preview computation only — the real effects-tracker
  curve/model is untouched, still trained exclusively from actual feedback.
  Confirmed against a scheduled (once-daily, non-PRN) medication with five
  days of plain history and no effects-tracker session ever started: the
  preview correctly showed a dampened predicted effect and rising tolerance,
  and scaling the entered amount up 3x visibly raised the predicted-effect
  percentage.
- Also verified against a taper-plan medication (dose changing day to day
  under a separate schedule on top of the log history) — the preview reads
  the taper-adjusted dose amount already prefilled into the form and renders
  a sane, non-crashing result.

### Verified
- Two new localdb integration tests: dose-ratio scaling now works from
  historical average alone (no trained model), and logs with no recorded
  dose amount are correctly excluded from that average rather than
  poisoning it. Full suite: 289 tests passing.
- Browser-verified against the production build with three medication
  shapes: a fresh PRN one, a scheduled once-daily one with no effects-
  tracker history, and a taper-plan medication — all render the preview (or
  correctly render nothing) without errors.

## 2026-07-26 — Tolerance meter, and a smarter effectiveness-rating default

### Added
- **Tolerance now has an actual visual meter, not just prose.** The effects
  tracker's session detail shows a thin percentage bar (the app's existing
  0-100% idiom — same pattern as the intensity bar on the home-screen card),
  colored amber and with a marker at the recent peak level when tolerance has
  faded since a gap, so "it used to be this high, now it's back down to here"
  is visible at a glance instead of only in a sentence. The same meter is now
  also shown on `MedicationDetail` as its own "Tolerance" card, persistent
  and live even without an active effects session (new `getMedicationTolerance`
  data-layer function) — previously tolerance was only visible mid-session.
- **The effectiveness slider in QuickLogSheet now suggests a starting point
  computed from tolerance and dose amount, instead of always defaulting to a
  fixed 7/10.** New `modeledEffectiveness(intensity_scale)` (effectsEngine.js)
  maps the same intensity_scale the curve itself uses — dose-ratio and
  tolerance dampening both included — onto a 1-10 scale, exactly reproducing
  7 when neither factor is in play (so a medication with no history behaves
  identically to before). The suggestion recomputes live as the dose amount
  field changes, and is clearly captioned ("Starting point from your recent
  usage and dose — adjust to how it actually felt") until the user actually
  touches the slider, at which point it's entirely theirs.
  - **Deliberately does not overwrite or replace the user's own rating.**
    `behavior.js`'s `toleranceSignal` already infers tolerance indirectly from
    a *declining trend* in self-reported effectiveness over time; if the
    stored rating became fully computed from the same tolerance model, that
    signal would just be regressing the model against itself. The suggestion
    is a pre-fill only — what gets saved is whatever the user leaves on the
    slider, so the self-report stays genuine, independent evidence.

### Fixed
- **The effectiveness suggestion (and, less visibly, the tolerance meter)
  could silently show a stale, pre-history value after logging several doses
  back to back.** Two compounding bugs, both in query/data freshness rather
  than the tolerance math itself:
  1. `QuickLogSheet`'s and `Today.jsx`'s dose-logging invalidation lists
     didn't include the new `effectivenessSuggestion`/`medicationTolerance`
     query keys at all, so neither ever refreshed after a log was saved.
  2. Even after adding that, the suggestion could still land on a stale
     value: opening, saving, and reopening the sheet for the same
     medication+dose within seconds re-enables and disables the identical
     query key on every cycle, and the resulting overlapping lookups could
     resolve **out of order** — an earlier, lower-tolerance computation
     finishing *after* a later, more accurate one and silently overwriting
     it. Replaced the react-query-based lookup with a plain effect guarded by
     a monotonically increasing request id, so only the most recently
     *started* request's result is ever applied, regardless of resolution
     order.
  Reproduced with a Playwright script that logs five backdated doses in
  quick succession and checks the suggested rating right after: showed a
  flat 7/10 (no dampening at all) before the fix, 4/10 (correctly reflecting
  ~61% modeled tolerance) after.

### Verified
- New tests for `modeledEffectiveness` (identity at intensity_scale=1,
  monotonic in both directions, clamped to 1-10, non-finite input falls back
  to neutral) and for `getMedicationTolerance`/`estimateDoseEffectiveness`
  wired into real logged sessions (dampens with history, unaffected for
  non-recreational categories, a bigger dose suggests higher once a
  reference dose is learned). Full suite: 287 tests passing.
- Browser-verified against the production build: the tolerance meter renders
  with the correct bar width and peak marker in the session detail and on
  MedicationDetail without an active session; the effectiveness slider
  suggests a dampened value after building tolerance, the suggestion caption
  disappears the instant the slider is manually touched, and — the specific
  regression this round caught — the suggestion is no longer stuck on the
  very first (zero-tolerance) computation after several rapid dose logs.

## 2026-07-26 — Usage-based tolerance modeling in the effects tracker

### Added
- **The effects tracker now models real pharmacological tolerance from your
  own recent use of each medication, instead of always predicting the same
  curve regardless of how often you've taken it.** New module
  `toleranceEngine.js`, wired into `personalizedProfile` (effectsEngine.js)
  and computed fresh at session start/edit from each medication's own logged
  dose history (localdb.js) — pure and storage-free, same convention as
  `redoseSafety.js`/`usageStats.js`. Two distinct, real effects are modeled:
  - **Tolerance forms with frequent/recent use**, blunting the modeled peak
    intensity for the same dose (pharmacodynamic tolerance — receptor
    downregulation/desensitization). A category-specific time constant
    controls how fast: e.g. psychedelics build near-total tachyphylaxis after
    a single dose (the classic "why the second trip a day later feels
    smaller" effect), while benzodiazepines build tolerance much more slowly
    over about ten days of regular use, matching the clinical literature for
    each.
  - **Tolerance fades during a gap in use** — and if a substantial recent
    tolerance has since faded, the usual dose can hit noticeably harder than
    expected. This is the mechanism behind a lot of real-world overdoses
    (classically opioids after a break), so it's surfaced as an explicit
    caution ("Tolerance may have faded — it's been N days since your last
    dose...") rather than folded silently into the curve.
  - Deliberately **not** modeled: cross-substance/cross-tolerance (one
    opioid's tolerance affecting another), and metabolic tolerance (faster
    clearance from chronic enzyme induction — real for e.g. heavy alcohol use,
    but narrow enough to be out of scope for this pass). Both are called out
    as explicit non-goals in `toleranceEngine.js`.
- **Formation/decay rates are keyed by the effects-engine's own PK category
  (stimulant, opioid, psychedelic, etc.), not by the existing
  `dependency_risk_category` field.** These are genuinely different axes:
  psychedelics build the fastest tolerance of any category here but have low
  physical dependence potential, while benzodiazepines are the opposite —
  form tolerance slowly but carry high dependence risk. Keying off the wrong
  axis would have gotten this backwards. Only recreational/psychoactive
  categories where "how strongly does this hit" is the relevant, felt axis
  are modeled (opioid, benzodiazepine, stimulant, stimulant-fast, depressant,
  cannabis, psychedelic, empathogen, dissociative, sleep-aid, antihistamine,
  muscle-relaxant); chronic-condition categories (antidepressant,
  antipsychotic, anticonvulsant, nsaid, "other", etc.) are left out entirely —
  modeling acute tolerance for e.g. an SSRI would misrepresent pharmacology
  that actually works the opposite way (delayed therapeutic onset,
  discontinuation syndrome).
- The dose that starts a session is always excluded from its own tolerance
  calculation (a first-ever dose of anything now correctly shows zero
  tolerance, not a self-inflicted dampening from the very dose being logged).
- Surfaced transparently in the session detail view: a muted note when
  tolerance is simply dampening the curve ("Recent use may be dampening this
  curve (~X% modeled tolerance)"), and a distinct amber caution box (same
  visual language as the existing redose-safety warnings) when tolerance
  looks like it's faded since a gap.
- `resetEffectModel` ("forget what I've learned") only clears the *learned*
  onset/peak/duration model — tolerance is a live computation from actual
  dose history, not part of that model, so it's correctly unaffected by a
  reset.

### Verified
- New `toleranceEngine.test.js` (formation/decay math, category table
  sanity, faded-tolerance detection) plus new `effectsEngine.test.js`/localdb
  integration tests (dampening wired into real sessions, non-applicable
  categories untouched, the current dose excluded from its own tolerance,
  faded-tolerance flagging on a real gap, tolerance surviving a model reset).
  Full suite: 279 tests passing, no regressions to the existing PK/redose/
  learning test coverage.
- Browser-verified against the production build: five days of daily logged
  Kratom doses show a "~61% modeled tolerance" note and a visibly dampened
  curve on the next session; a Tramadol history of six doses ending 30 days
  ago (well past that category's decay window) shows the faded-tolerance
  caution instead, while a same-day dose right after building tolerance
  correctly shows no faded warning.

## 2026-07-25 — Finished sessions now drop off the home screen immediately

### Changed
- **Follow-up to the "Gone" fix below: on the home screen, a finished session
  now disappears the instant its curve is done instead of sitting there
  reading "Gone".** `ActiveEffectsSimple` filters out any session whose
  client-computed phase has already reached "Complete" (the same check the
  card itself used to show "Gone" for), so there's no card at all in that
  window rather than a card that just says "Gone". The Effects page's session
  detail badge is unchanged and still reads "Gone" for a session you're
  actively looking at, since you're already engaged with it there (redosing,
  giving feedback, ending it) rather than just glancing at a summary list.
- Verified with the same fake-clock reproduction as before, now asserting the
  home-screen card is gone (not present) at the crossing instant rather than
  asserting its text.

## 2026-07-25 — The effects tracker briefly read "0%" instead of "Gone"

### Fixed
- **A session could flash "0% intensity" for up to a minute right as it
  finished, instead of just reading "Gone".** A session auto-completes once
  its curve has fully played out, but that completion check only runs when
  the `effectSessions` query refetches (every 60s); the on-screen clock
  (`useNow`) ticks every 30s independently. So there's a real window — up to
  ~30s wide — where the curve has already decayed to exactly 0% and the phase
  is "Complete", but the session hasn't been reclassified yet and is still
  showing as active. In that window the home screen's active-effects card and
  the Effects page's session badge both read a bare "0%"/"0% intensity",
  which reads as broken rather than finished. Both now show "Gone" instead of
  a numeric 0% once the phase reaches "Complete".
- Reproduced deterministically with a fake-clock Playwright test that lands
  exactly on the tick where the client-side clock has crossed the curve's end
  but the query hasn't refetched yet — confirmed "0%" before the fix, "Gone"
  after, on both the home card and the session detail badge.

## 2026-07-25 — Redose inventory decrement was invisible until it went stale

### Fixed
- **Audited the redose → inventory feature end to end.** The data layer
  (`addEffectDose`/`removeEffectDose` creating/deleting a real log entry so
  inventory decrements/restores through the same path as any other dose) was
  confirmed correct and unregressed. The bug was in the UI's cache
  invalidation: `SessionDetail`'s `invalidate()` (in `ActiveEffects.jsx`) only
  invalidated the `effectSessions` query after a redose or a redose removal,
  unlike every other dose-logging entry point (`Today.jsx`, `QuickLogSheet.jsx`),
  which also invalidate `inventory`, `medications`, `medication`, `today`,
  `logs`, `analytics`, `activeSubstances`, and `interactions`.
  Practically: redose from the effects tracker, then open Inventory (or a
  medication's detail page) — the count still showed the pre-redose value,
  because React Query had no reason to consider that cached data stale
  (`isInvalidated` stayed `false`), so it kept serving it until the app's
  15-second `staleTime` happened to expire on its own. Confirmed via a
  browser-driven repro that primes the inventory cache, redoses through
  genuine client-side navigation, and reads the displayed count immediately —
  reproduced 29 → still 29 (should be 28) before the fix, 29 → 28 → 29 (add
  then remove) after it. Added `invalidateDoseChange()` alongside the
  existing `invalidate()`, used only by the `redose`/`removeDose` mutations
  (the only two in `SessionDetail` that actually touch a log/inventory),
  mirroring the app's established broad-invalidation convention.

## 2026-07-25 — Collapsible graph preview on the home screen's active-effects cards

### Added
- **Each active-effects card on the home screen now has a collapsible graph
  preview.** A chevron next to the intensity number expands a compact chart
  in place — gridlines, axis labels, onset/peak/end reference lines, a "now"
  marker, and (for a redosed session) the previous dose as its own dotted
  line, same visual language as the full Effects page and the share image —
  without leaving Today. Tapping the rest of the card still opens the full
  Effects page as before; the two are now separate tap targets so expanding
  the preview doesn't also navigate away. The expand/collapse is animated
  (CSS grid-rows, no layout jump) and the preview is only mounted once
  expanded, so collapsed cards don't pay any chart-rendering cost.

### Verified
- Full suite: 253 tests passing (rendering-only change). Production build
  clean.
- Browser-verified against the production build: the preview starts
  unmounted/collapsed; tapping the row navigates to `/effects` while the
  chevron does not; expanding reveals a properly-sized inline chart and
  collapsing shrinks the region back to 0 height; a redosed session's
  preview includes the dotted previous-dose line, matching the full chart
  and share image.

## 2026-07-25 — Share image matches the dotted-line graph; chart zooms in when the previous dose is hidden

### Added
- **The session chart now zooms in to the current dose's own window when the
  previous dose is hidden**, instead of always showing the full timeline with
  a dead flat zero region before the redose. Toggling "Show previous dose"
  smoothly zooms back out to reveal the earlier dose's dotted line across the
  full chart, and hiding it again zooms back in — animated (eased, ~420ms),
  not a hard cut, and respects the OS's reduced-motion setting. Onset/peak/end
  markers, redose markers, feedback dots and the "now" line all fade out of
  view correctly as they scroll outside the zoomed window instead of floating
  outside the plot.

### Fixed
- **The session share image still drew the old collapsed-sum curve.** It
  hadn't been updated for the "plot only the dose you're on" change, so a
  shared image still showed the previous dose folded into the total instead
  of matching what the app itself now shows. `MiniCurve` now plots the same
  newest-dose-only solid curve, draws every superseded dose as its own dotted
  line (always, since a static image can't offer a toggle), aligns the onset/
  peak/end reference lines to the plotted dose, and the legend gained a
  "Previous dose" entry with a matching dotted swatch.

### Verified
- Full suite: 253 tests passing (both changes are rendering-only). Production
  build clean.
- Browser-verified against the production build: with a dose 2h old plus a
  redose, the default (previous hidden) view's x-axis ticks start at "2h" —
  skipping the dead zero region — and toggling "Show previous dose" zooms out
  to include "0" again with more ticks visible, then toggling back re-zooms;
  the share image's legend includes "Previous dose", and its solid curve is
  confirmed flat before the redose with a genuinely dotted (`4 3` dasharray)
  line tracing the original dose separately.

## 2026-07-25 — The session curve now shows only the dose you're on, with previous doses as dotted lines

### Changed
- **A previous dose is now kept out of the session's filled curve entirely**,
  rather than folded into it until the hand-off. The solid curve is the dose
  you're currently on, so a redose reads as its own clean curve instead of
  carrying a hump over from the dose before it — the axis drops back to a
  plain 0-100% instead of an inflated stacked total.
- **"Show previous dose" now brings each superseded dose back as its own
  dotted line**, drawn across the whole chart alongside the current dose, so
  the earlier dose stays fully visible for as long as the toggle is on. The
  vertical dose/onset/peak/end markers remain visible at all times either way.
- The intensity number, phase label, onset/peak/ends markers and their clock
  times all now describe the dose being plotted (the most recent one), so the
  graph, the markers and the written values agree. Previously the markers and
  times still described the *first* dose while the curve had moved on — e.g.
  an onset line drawn at 45 min when the plotted curve didn't start rising
  until the redose two hours later.
- Sessions without a redose are completely unaffected: the plotted curve is
  that single dose's curve, exactly as before.

### Verified
- New unit test pinning the invariant the chart relies on: the newest dose's
  own curve is zero before that dose was taken and peaks on its own clock,
  while a superseded dose keeps its own separate curve to plot. Full suite:
  253 tests passing. Production build clean.
- Browser-verified against the production build, reading values off the chart
  rather than eyeballing it: with a dose 2 h old plus a redose, the curve is
  0% at 26 min and at 1 h 48 m (before the redose) and then runs its own
  58% → 100% → decay; the y-axis sits at 0-100%; the toggle adds and removes
  the dotted previous-dose line and flips its label; and the onset/peak
  markers line up with where the plotted curve actually rises and peaks.

## 2026-07-25 — A redose now fully takes over by its peak, with a toggle to see the previous dose

### Changed
- **The previous dose now actually collapses when a redose peaks.** The
  hand-off previously *started* at the redose's peak, so at the peak moment
  the older dose was still contributing in full and the curve spiked to a
  clearly implausible total (a 2 h-apart MDMA redose topped out around 175%).
  The hand-off now runs across the redose's come-up instead: the older dose
  holds full weight until the redose starts being felt (its onset), then
  fades out so it has *fully* collapsed by the moment the redose peaks — the
  same scenario now tops out at 125%, with the redose's peak reading as its
  own peak rather than a pile-on. Doses that genuinely overlap on the way up
  still stack above 100%, since that's a real experience; only a redose taken
  well after the previous dose peaked hands over instead of adding.
- **Added a small "Show previous dose" toggle** above the session chart
  (only when a session has redoses). It plots each superseded dose again as
  its own faint dashed line over the handed-off curve, so the collapse is
  visible and inspectable rather than just implied.

### Verified
- New/updated unit tests around the hand-off: full weight until the redose's
  onset, weight exactly 0 at its peak, a gradual fade in between with no jump
  at either end, `{ collapse: false }` returning the raw sum for the toggle,
  and `doseIntensityAt` exposing a single dose's own curve. Also pinned the
  distinction that an early (overlapping) redose still exceeds 100% while a
  late one hands over. Full suite: 252 tests passing. Production build clean.
- Browser-verified against the production build: the same redose scenario
  that previously charted to 175% now tops out at 125%, and the toggle adds
  and removes the superseded dose's dashed line and flips its label.

## 2026-07-24 — Effects and interaction warnings now clear when the effects are over

### Fixed
- **A finished session left a dead card on the home and Effects screens for
  hours.** Sessions only auto-completed once *twice* the predicted duration
  had elapsed, but the curve is visibly finished (0% intensity, phase
  "Complete") at 1.25× — so a spent session sat there reading "Effects
  complete · 0% intensity" for up to another 0.75× duration. A session now
  auto-completes as soon as its curve has actually played out, including the
  after-effects tail, and moves straight into Session history. Redoses still
  extend the curve, so a redosed session stays active until *its* stacked
  curve is done.
- **The red interaction warning kept firing long after the effects ended.**
  A substance counted as "active" for a flat 12 hours after any dose,
  regardless of how long it actually lasts — so a short-acting substance
  flashed a high-risk warning for most of a day after its effects were
  plainly over. The window now follows each medication's own effect curve
  (learned model where available, category/form default otherwise) including
  the tail, floored at 2 h so a very short curve still warns for a sensible
  buffer and capped at 12 h so nothing warns indefinitely. An active effect
  session always counts, whatever the log timing.
- **Ending a session immediately re-offered to track the same dose.** The
  "Track effects of X" prompt only skipped medications with a *currently
  active* session, so finishing one instantly re-offered the very dose just
  tracked and the tracker never looked cleared. Doses that already have a
  session (of any status), including redose entries, are no longer offered.

### Verified
- New regression tests, each confirmed to fail against the old behavior: a
  session clears the moment its curve ends rather than at 2× duration, a
  redose keeps the session alive until the extended curve is over, and a
  short-acting substance drops out of the interaction window while a
  long-acting one is still counted (plus: a just-taken dose and an active
  session always count). Full suite: 250 tests passing. Production build clean.
- Browser-verified against the production build: a cocaine dose logged 4 h
  ago leaves no active card on the home screen, no session detail on the
  Effects page, no stale interaction warning, and is not re-offered for
  tracking — while a freshly-logged dose still raises the warning as before.

## 2026-07-24 — Session share legend swatches match the chart's exact line style

### Fixed
- The share card's legend previously approximated "dashed" with a generic CSS
  border, which doesn't reproduce the chart's actual dash patterns — Onset/
  Peak/Ends use a coarser dash than Redose's finer dotted line, but the CSS
  border made them look identical. Legend swatches are now tiny inline SVG
  lines using the exact same `stroke-dasharray` as the chart itself (solid
  for Intensity, "3 3" for Onset/Peak/Ends, "1 3" for Redose), so each
  legend entry is unmistakably the same line as its counterpart on the chart.

### Verified
- Full suite: 245 tests passing (rendering-only change). Production build
  clean. Browser-verified against the production build: the downloaded PNG
  shows the legend's dash patterns matching the chart's reference lines
  exactly (Onset/Peak/Ends dashed, Redose finer-dotted, Intensity solid).

## 2026-07-24 — Session share image: gridlines, axis labels and a legend

### Changed
- **The session share card's mini curve is now a fully-labeled chart**,
  matching the real effects-tracker graph instead of a bare sparkline: y-axis
  percent labels and horizontal gridlines, x-axis hour labels and vertical
  gridlines, and dashed reference lines for the predicted Onset/Peak/Ends
  (and Redose, when the session had one) — colored the same way as the
  in-app chart. A legend row below the chart labels each line/color so the
  image is self-explanatory to someone who doesn't use the app.

### Verified
- Full suite: 245 tests passing (unchanged; this is a rendering-only change).
  Production build clean.
- Browser-verified against the **production build** specifically (not the
  dev server): confirmed every axis label renders (0/50/100%, a >100% top
  tick for a stacked redose, and 0–8h time labels), the legend lists
  Intensity/Onset/Peak/Ends/Redose, and the downloaded PNG matches. (Caught
  and fixed a margin-clipping issue where a 3-digit "175%" top label ran
  close to the card edge — widened the axis margin.) Also caught, diagnosed,
  and confirmed as dev-server-only noise (not a real bug): the local dev
  server's source-mapping instrumentation injects HTML `<span>` wrappers
  into dynamic text, which SVG's `<text>` element can't render — invisible
  in the shipped production build, which has no such instrumentation.

## 2026-07-24 — Session summaries now share as an image

### Changed
- **The "Share" button on a completed effects session now generates a polished
  image**, matching the medication and taper share sheets, instead of copying
  plain text. It opens a preview dialog showing a share card — substance, date
  and duration, a mini stacked-effect curve (with the redose double-peak),
  every dose and redose with timing, the cumulative total, the onset → peak →
  wearing-off → gone timeline with peak intensity, and the Meditrax brand +
  disclaimer — then renders it to a PNG via the same client-side
  `html-to-image` path. It uses the native share sheet with a file where
  supported (mobile/PWA) and downloads the PNG otherwise. Fully offline.
- New `SessionShareCard` render component (with an inline-SVG mini curve) in
  the shared `ShareDialog`.

### Verified
- Existing `sessionSummaryData` unit tests still cover the underlying data
  (doses, timeline, totals). Full suite: 245 tests passing. Production build
  clean.
- Browser-verified end to end: an MDMA session with feedback and a redose
  produces a share card whose PNG (≈89 KB) renders the double-peak curve,
  the Dose 1 / Redose 1 (+2 h) / Total 150 mg breakdown, the "How it felt"
  timeline, and the branded footer.

## 2026-07-24 — Shareable session summaries

### Added
- **A "Session history" section on the Effects & Journal page** listing your
  completed effect-tracker sessions (substance, date, duration, dose/redose
  count, peak time and peak reported intensity), each with a **Share** button.
  (Superseded the same day by image sharing — see the entry above.) New pure
  `sessionSummaryData` / `sessionSummaryText` helpers (unit-tested).

### Verified
- New unit tests: dose + redose collection with offsets and cumulative total,
  the phase-ordered feedback timeline and max reported intensity, bare-session
  and null handling. Full suite: 245 tests passing. Production build clean.

## 2026-07-24 — Usage-frequency insights

### Added
- **A "How often you're using" card on the Insights → Adherence tab.** For
  every medication taken in the last 30 days it shows the count this week and
  over 30 days, a week-over-week trend (rising / easing / steady vs. the
  prior week), and a "higher risk" flag for medications with a
  moderate-or-worse dependency risk or high risk level — because frequency,
  not just dose, is what shapes tolerance and dependence and isn't visible
  from single sessions. Most-used medications are listed first; a descriptive
  "not a diagnosis" note points toward discussing a rising trend with a
  clinician. Fully offline.
- New pure `usageFrequency` helper (unit-tested).

### Verified
- New unit tests: 7/30-day window counting, exclusion of skipped/missed and
  out-of-window logs, week-over-week trend direction (rising/easing/steady),
  and exact day-boundary bucketing. Full suite: 238 tests passing. Production
  build clean.
- Browser-verified: logging Alprazolam three times surfaces "3× this week ·
  3× in 30 days" with a "higher risk" flag and a "rising" trend on the card.

## 2026-07-24 — Redose safety guardrails

### Added
- **The redose panel now warns before you add a risky dose.** As you fill in
  a redose it checks, live:
  - **Too soon** — the redose lands before the previous dose is predicted to
    peak (the classic "I don't feel it yet, take more" over-stacking
    pattern), showing how long it's been vs. the typical peak time.
  - **Over the typical maximum** — the running session total (primary + all
    redoses + this one) reaches 80% of, or exceeds, the substance's known max
    daily dose from the knowledge base.
  When either fires, a warning box appears in the panel and the button
  changes to "Add anyway" — these are soft guardrails, never hard blocks, so
  you stay in control. Warnings clear automatically as you adjust the amount
  or time.
- New pure `redoseWarnings` helper (fully unit-tested) and a
  `getMedicationMaxDaily` data-layer lookup that resolves the max daily dose
  from the medication's catalog entry.

### Verified
- New unit tests: too-soon detection (measured from the most recent dose,
  clears past peak), over-max and near-max thresholds, cumulative totals
  counting existing redoses, unspecified-amount fallback, and both warnings
  firing together — plus data-layer tests for `getMedicationMaxDaily`
  (catalog-id and name-match resolution, null for unknown). Full suite: 234
  tests passing. Production build clean.
- Browser-verified: a 3 mg Alprazolam primary dose then an immediate 3 mg
  redose shows both the too-soon and over-max warnings (session total 6 mg
  vs. 4 mg max) with an "Add anyway" button; lowering the amount and dating
  it past the peak clears both.

## 2026-07-24 — Smarter Form defaults when adding a medication from the knowledge base

### Added
- **Route-dependent substances now auto-pick the right Form.** Adding a
  medication from a knowledge-base article previously always defaulted the
  Form field to "tablet". Curated entries where the route materially changes
  onset/duration now carry a `default_form` that pre-fills the Form select —
  Cannabis → smoked/vaporized, Cocaine/Ketamine → insufflated,
  Alcohol/GHB → liquid, Methamphetamine → smoked/vaporized, insulin →
  injection, nicotine → patch. This also gives the effects tracker a more
  accurate starting curve for that route (e.g. smoked cannabis's near-instant
  onset vs. an edible's slow one). Medications without a `default_form`
  (ordinary tablets/capsules) are unchanged. Existing installs pick up the
  new field via the catalog merge migration (seed version bumped to 3).

### Verified
- New unit tests: every `default_form` is a valid Form-dropdown option, the
  route-dependent recreational substances carry the expected form, and the
  field reaches existing installs on upgrade. Full suite: 222 tests passing.
  Production build clean.
- Browser-verified: adding Cocaine auto-selects "insufflated", Cannabis
  auto-selects "smoked/vaporized", and an ordinary medication (Ibuprofen)
  still defaults to "tablet".

## 2026-07-24 — A redose collapses the previous dose's curve once it peaks

### Changed
- **The stacked effects curve no longer sums every dose forever.** Previously
  a redose's curve was literally added on top of the earlier dose's for the
  rest of the session, so two or three doses could show an implausible,
  ever-taller total (up to 200-300%+) all the way to the end. Now, once a
  redose reaches its own predicted peak, the dose(s) before it fade out to
  zero over a short window (~8-45 min, scaled to the substance's duration)
  instead of continuing to contribute — modeling the newest dose's peak
  taking over as the dominant felt effect, the way a real redose is
  typically experienced, rather than a naive PK sum. The most recent dose in
  a session never collapses; it plays out its own full curve and tail as
  normal. This is a pure curve-shape change — the underlying dose stack,
  inventory decrementing and journaling from the redosing feature are
  unaffected.

### Verified
- New unit tests: a dose contributes in full right up until the next dose's
  predicted peak (no discontinuity at the handoff instant), fully collapses
  to zero shortly after, the most recent dose never collapses, and three
  stacked full-strength doses stay well under a literal 300% sum. Full
  suite: 219 tests passing. Production build clean.
- Browser-verified: logged a backdated primary Cocaine dose, added a redose
  ~15 minutes in, and confirmed the chart shows a double-peak that then
  collapses into a single smooth decline (settling into the normal
  after-effects tail) instead of staying inflated for the rest of the curve.

## 2026-07-23 — Redosing now decrements inventory and journals the dose

### Fixed
- **The effects tracker's "Add a dose" (redose) button didn't touch
  inventory at all.** It only recorded the extra dose inside the effect
  session's internal state, so stock stayed unchanged and the redose never
  appeared in the medication's log history/journal — inconsistent with every
  other way of logging a dose. `addEffectDose` now creates a real log entry
  for the redose (no scheduled_time, so it always creates its own entry
  rather than merging into an already-logged dose), which decrements
  inventory through the same path as any other dose; an amount left blank
  falls back to the medication's standard per-dose pill count, same as any
  other ad-hoc log. Removing a redose (`removeEffectDose`) now deletes that
  log too, restoring exactly the stock it took.

### Verified
- New unit test: redosing with a specified amount decrements the correct
  pill count, redosing with no amount falls back to the standard per-dose
  count, the redose shows up via `getLogs()` as its own entry, and removing
  it restores stock and deletes the log. Full suite: 214 tests passing.
  Production build clean.
- Browser-verified end to end: added a medication with inventory tracking,
  took the primary dose (30 → 29), redosed from the effects tracker
  (29 → 28) — confirmed as 2 distinct rows in the medication's log
  history — then removed the redose and confirmed stock restored to 29 and
  the log row disappeared.

## 2026-07-23 — Pre-dose interaction warnings (red box + confirmation popup, home-screen cards)

### Added
- **A red interaction warning now appears before you log a dose.** When you
  open the log sheet for a medication that interacts with something you have
  active (taken in the last 12 h or currently effect-tracking), a red box
  lists the risk at the top of the sheet, and pressing "Save log" raises a
  red confirmation popup naming the interaction — you must tap "Log anyway"
  (or "Cancel") to proceed. Prescription meds and recreational substances are
  treated the same.
- **A red interaction box on the home screen med cards.** Each scheduled-dose
  and as-needed card shows the same warning at its bottom when that
  medication interacts with an active substance — so you see the risk in
  context before you even open the log sheet.
- New data-layer helpers `getActiveSubstances` (medications recently taken or
  effect-tracking) and `getInteractionsForMedication`, plus an
  `interactionsWith` matrix helper, so the warning resolves each medication's
  category by id (robust to the trimmed med objects some entry points pass)
  and reuses the same mechanism-based interaction rules as the effects
  tracker.

### Verified
- New unit tests: `interactionsWith` (candidate-vs-active filtering, self-
  exclusion, empty cases) and the `getActiveSubstances` /
  `getInteractionsForMedication` data-layer glue (recency window, skipped-
  dose exclusion, active effect sessions, category resolution by id). Full
  suite: 213 tests passing. Production build clean.
- Browser-verified end to end: taking Oxycodone then opening Alprazolam shows
  the red box on the home card and in the log sheet, and the confirmation
  popup gates the save — Cancel aborts, "Log anyway" proceeds.

## 2026-07-23 — Interaction checking, combined multi-drug effects graph, redosing & PWA catalog sync

### Added
- **Intelligent interaction checking** between concurrently-active effect
  sessions. A new mechanism-based matrix flags risky combinations —
  CNS/respiratory-depressant stacking (opioids + benzodiazepines + alcohol,
  etc.), serotonin-syndrome risk (MDMA/psychedelics + antidepressants),
  compounded cardiovascular strain (two stimulants), stimulant-masking-a-
  depressant, and cannabis pairings — plus a few name-specific overrides
  (cocaine + alcohol → cocaethylene; lithium + classic psychedelics →
  seizure risk). Warnings appear at the top of the effects tracker only while
  the substances are actually active together, each with a severity badge and
  a plain-language reason, and a clear "harm-reduction heuristic, not a
  clinical database" caveat.
- **Combined multi-drug effects graph.** When two or more effect sessions are
  active at once, a single "Combined view" chart overlays every substance's
  curve on one shared wall-clock timeline (one colored line per substance,
  with a legend), instead of only showing each in isolation. Colors that
  collide (two meds sharing the default swatch) are automatically
  de-conflicted so the lines stay distinguishable, and the y-axis scales to
  fit stacked/strong-dose peaks above 100%.
- **Redosing.** You can now add another dose to an active effect session
  ("Add a dose") instead of starting a confusing separate one. The curve
  sums the still-active tail of earlier doses with a fresh, dose-scaled curve
  from the redose time; redoses are marked on the graph, listed with remove
  buttons, and extend the session's timeline. Because stacked timings aren't a
  clean single-dose reading, redosed sessions deliberately don't train your
  personal timing model. Works in the home-screen summary and the combined
  view too.

### Fixed
- **Existing installs (including the installed PWA) now receive new and
  updated knowledge-base entries.** The curated catalog was only seeded on
  first run, so anyone who had used an earlier version never saw later
  additions — which is why the new recreational/psychoactive drugs didn't
  show up. A version-gated merge migration now adds any missing curated
  entries and refreshes still-curated ones on upgrade, while leaving your own
  AI-researched or edited entries untouched and preserving entry ids so
  existing links keep working.

## 2026-07-22 — Recreational/psychoactive substance templates for the effects tracker & knowledge base

### Added
- **10 new knowledge-base entries** for commonly-tracked recreational and
  psychoactive substances — Alcohol, Cannabis (THC), Cocaine, GHB/GBL,
  Ketamine, Kratom, LSD, MDMA, Methamphetamine, and Psilocybin mushrooms —
  alongside the existing prescription/OTC catalog. Each follows the same
  schema as every other entry (dosing, side effects, interactions, warnings,
  risk level, dependency risk, mechanism, half-life) with harm-reduction
  framing: dangerous combinations (e.g. depressants + alcohol/opioids,
  MDMA/LSD + MAOIs), dosing/measurement precautions, and realistic risk
  levels — consistent with how the app already treats controlled substances
  like benzodiazepines and opioids. A new `street_names` field (e.g. "Molly",
  "Acid", "Ice") is searchable alongside brand names and shown on the
  knowledge article page.
- **6 new effects-tracker categories** with dedicated pharmacokinetic
  baselines — psychedelic (LSD/psilocybin), empathogen (MDMA), dissociative
  (ketamine), cannabis, depressant (alcohol/GHB), and stimulant-fast
  (cocaine) — so newly-tracked substances start from a realistic onset/peak/
  duration curve instead of silently falling back to the generic "other"
  default. Categories that intentionally have no dedicated curve (chronic
  maintenance meds like blood pressure/diabetes/thyroid) continue to fall
  back to "other" as before.
- **3 new medication forms** — smoked/vaporized, insufflated, edible — so
  routes with very different absorption speed (e.g. smoked vs. edible
  cannabis) produce a correspondingly different default curve.
- The AI-assisted "Research with AI" knowledge-base autofill now recognizes
  the expanded category list and `street_names`, so substances outside the
  curated seed get classified consistently and researched with harm-reduction
  framing rather than encouragement to use.

### Verified
- New unit tests assert every `CATEGORY_PK` entry (existing and new) and
  every `FORM_SPEED` combination produces a sanely-ordered profile
  (onset < peak < duration), that the fast (cocaine/ketamine/cannabis) and
  slow (psychedelic) baselines are meaningfully different, and that smoked
  cannabis has a faster onset/shorter duration than edible.
- A new catalog sanity test asserts every entry has a valid category,
  risk level and dependency-risk level, no duplicate names, and that the
  ten new entries each carry a non-minimal risk level and at least one
  harm-reduction warning. Full suite: 189 tests passing.
- Verified in-browser: searching "molly" surfaces MDMA via its street name,
  the new category filter chips all render, and adding LSD from its
  knowledge article then logging a dose renders a correctly-scaled 8-hour
  effects curve (0-100%, hourly gridlines, no cutoff) — confirming the new
  psychedelic PK profile flows end-to-end through the existing chart.

## 2026-07-18 — Extra/unscheduled doses silently skipped inventory

### Fixed
- **Logging an extra, unscheduled dose of a medication that has a schedule
  didn't decrement inventory at all**, and silently overwrote the day's
  already-logged scheduled dose instead of adding a second entry. The "Log
  dose" button on a medication's detail page, and the per-medication "Log"
  tile in the quick-actions sheet, both stamped every ad-hoc log with the
  medication's *first scheduled time* — so if that scheduled dose had
  already been taken today, the new log matched createLog's same-slot dedup
  guard and merged into it (correct behavior when re-editing that exact
  scheduled dose, wrong when logging something in addition to it): the
  extra dose's amount replaced the original's instead of adding to it, and
  the net inventory change was the *difference* between the two, not the
  sum — for two equal doses, that's zero. Taking your normal dose, then an
  extra one, could leave stock completely unchanged.
  Both entry points now log with no scheduled_time, so an ad-hoc/extra dose
  always creates its own entry and always decrements its own inventory,
  regardless of whether a scheduled dose was already logged that day. (Tap
  the actual dose card on Today to edit a specific scheduled slot instead.)
- Verified the underlying decrement math (and the two fixes above) hold
  identically across medication forms — tablet, capsule, liquid, and patch
  all took a scheduled dose then an extra dose correctly, decrementing twice
  and leaving two distinct log entries — confirming the inventory model is
  form-agnostic rather than tablet-specific.

## 2026-07-17 — Inventory under-decremented for doses above the default amount

### Fixed
- **Logging a dose higher than a medication's default only decremented one
  pill's worth of stock.** The "Pills taken" stepper and "Total amount" field
  in the log sheet were only synced one way — editing the amount didn't
  update the pill count inventory actually decrements by, and once the
  amount had been touched once, the stepper stopped syncing it back either.
  Logging 100 mg of a 50 mg medication (2 pills) could decrement only 1 pill
  from stock. Both fields now stay in sync in both directions, always, for
  any medication with a known strength.
- **Migration for existing users**: a new `reconcileMedicationInventory` /
  `reconcileAllInventory` pass recomputes every past log's pill count from
  its recorded total amount and the medication's strength, and applies the
  shortfall to stock — so inventory that drifted under old versions self-
  corrects to match the log history, not just new logs going forward. Runs
  automatically once per profile (flagged so it never repeats), on first
  load and on every profile switch. Skips logs whose unit no longer matches
  the medication's (unsafe to infer) and logs without a recorded amount, and
  clamps to available stock the same way normal decrements do.

## 2026-07-17 — Undo & edit effects-tracker feedback

### Added
- **Undo and per-event editing for the effects tracker.** Previously, a wrong
  tap (or a mistaken "Gone" that closed the session and trained the model on
  bad data) had no fix short of Reset, which wipes the medication's *entire*
  learned history, not just the mistake.
  - **"Your feedback" list** on the active session card shows every recorded
    event (most recent first) with a × to remove any specific one — fixes a
    fat-fingered entry buried under later correct ones without touching them.
  - **"Undo last"** removes the most recent event in one tap.
  - **Ending a session** (via "Gone", "End session", or "Discard") now shows
    an **Undo** action on its confirmation toast, matching the pattern
    already used for dose logs elsewhere in the app. Undo reactivates the
    session and, if nothing else has touched the model since, reverts the
    training that completion triggered to the exact prior state — not a
    blanket reset, a precise rollback of just that one mistake.
  - Undo is safely refused (with a clear reason) if a *newer* session has
    since trained the model, or if the model was explicitly Reset in the
    meantime — reverting then would silently erase real, unrelated learning.
    A per-medication version counter (independent of whether a model
    currently exists, so it survives Reset) makes this check exact rather
    than time-based guesswork.

### Fixed
- `addEffectEvent` stored `intensity: 0` instead of `null` on plain phase
  events (onset/peak/wearing off/gone) that never carried a value —
  `Number(null)` coerces to `0`, which passed the `isFinite` check.
- `deleteMedication` never cleaned up that medication's effect-tracker
  sessions, learned model, or version counter, leaving orphaned rows behind
  after deletion.

## 2026-07-17 — Effects graph scale fix

### Fixed
- **Effects curve went off-scale from the written percentage.** For a
  larger-than-usual dose the header/tooltip multiply intensity by the dose
  scale (e.g. a slightly bigger dose reads "110%", a double dose "150%"), but
  the plotted curve used the raw 0–100% value and capped at the 100% gridline —
  so the number disagreed with the graph. The plotted curve now uses the same
  scaled percentage, and the Y-axis grows in 25% steps up to 150% to fit it
  (with 100% kept as a labelled "typical peak" line). Axis, gridlines, curve,
  feedback dots, and the written numbers now always agree.

## 2026-07-16 — Honest taper-state labels across the UI

### Fixed
- **Inventory said "based on your taper schedule" even when the taper was paused
  or long finished.** The predictor now classifies the taper's state
  (`taperState`: running / paused / finished) and reports it: paused tapers
  predict from the frozen dose and say "based on your paused taper — holding the
  current dose"; a taper that completed **to zero** stops pretending the schedule
  predicts anything and projects from observed usage instead ("taper complete —
  based on your actual usage"); a taper finished at a maintenance dose keeps
  simulating at that final dose. Ended plans already fell back to schedule-based
  projections.
- **Ended taper plans looked alive** — the detail page still offered a working
  Pause/Resume button and nothing said the plan was over. It now shows a clear
  "This plan has ended" notice, drops the pause controls, and the subtitle
  reflects the state (— ended / — paused / — complete); the planner list gains a
  "complete" chip for plans past their end date.
- **Today's dose card** now tags a frozen dose as "(taper paused)" instead of
  presenting it as an actively stepping taper.

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
- **Session editing** — a pencil button on the detailed card edits the start
  time ("I actually took it earlier") and dose of a running session; moving the
  start re-anchors the whole curve, and a dose change re-derives the profile.
- **Detailed chart** — hourly gridlines and tick labels (denser for short
  curves), a 0–100% intensity axis, dashed markers at predicted onset/peak/end,
  a labelled "now" line, and the user's own feedback events plotted where they
  happened (intensity reports at the strength actually felt).
- **Reset button** — the personalization line on the detail card gains a Reset
  control (with confirm) that forgets everything learned about a medication's
  timing; active sessions immediately fall back to the typical curve and future
  feedback starts teaching the model from scratch.

### Fixed
- Effects-tracker layout at narrow widths: the chart's "100%" axis label was
  clipped to "00%" (axis too narrow), the header squeezed "started …" onto a
  wrapped line next to the pencil and phase chip (the chip now sits on its own
  row), and the "now" label collided with the top axis tick when a session had
  just started (suppressed until the line clears the left edge).
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
