import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useUI } from "@/context/UIContext";
import { createLog, updateLog, deleteLog, logDefaultsForMed, startEffectSession, getInteractionsForMedication, estimateDoseEffectiveness, getSettings, updateSettings, getMealModel } from "@/lib/api";
import { ToleranceNote, MEAL_OPTIONS } from "@/components/ActiveEffects";
import { isOralForm } from "@/lib/effectsEngine";
import { scheduleAllReminders } from "@/lib/push";
import { Switch } from "@/components/ui/switch";
import MedColorDot from "@/components/MedColorDot";
import InteractionAlert from "@/components/InteractionAlert";
import { doseLabel, fmtTime12, toDatetimeLocal } from "@/lib/format";
import { pillsFromAmount } from "@/lib/predictor";
import { cn } from "@/lib/utils";
import { Check, X, SkipForward, MinusCircle, PlusCircle, Trash2, Info } from "lucide-react";

const MOODS = [
  { v: "great", e: "😊", l: "Great" },
  { v: "good", e: "🙂", l: "Good" },
  { v: "okay", e: "😐", l: "Okay" },
  { v: "low", e: "😕", l: "Low" },
  { v: "bad", e: "😟", l: "Bad" },
];

const STATUSES = [
  { v: "taken", l: "Taken", icon: Check },
  { v: "partial", l: "Partial", icon: MinusCircle },
  { v: "skipped", l: "Skip", icon: SkipForward },
  { v: "missed", l: "Missed", icon: X },
];

// True once there's actually something worth showing in the preview below --
// the dose entered deviates from typical, or tolerance has something to say.
// Shared by the preview itself and the one-time intro (which should only
// ever appear alongside real content, not on its own).
function isDoseEffectMeaningful(suggestion) {
  if (!suggestion) return false;
  const { relativeToUsual, tolerance, factors } = suggestion;
  return Math.abs((relativeToUsual ?? 1) - 1) >= 0.05
    || !!(tolerance && (tolerance.level >= 0.15 || tolerance.faded))
    || (factors?.residual ?? 0) >= 0.05;
}

// A live preview of how this dose is likely to land -- for ANY medication
// with enough history to say something (scheduled or PRN, however long it's
// been logged), not just ones actively using the effects tracker. Reuses the
// same intensityScale the effects-tracker curve itself is built from, so
// "predicted effect" here means exactly the same thing it means everywhere
// else in the app. Quiet by design: renders nothing unless the dose entered
// actually deviates from typical, or tolerance has something to say.
//
// Says plainly where the number comes from: population-typical research
// until the effects tracker has calibrated to this person specifically
// (modelConfidence "medium"+, i.e. 3+ tracked sessions -- see
// estimateDoseEffectiveness, which is deliberately conservative about
// trusting a single noisy self-reported timing over the researched default).
function DoseEffectPreview({ suggestion }) {
  const [showInfo, setShowInfo] = useState(false);
  if (!isDoseEffectMeaningful(suggestion)) return null;
  const { relativeToUsual, tolerance, calibrated, factors } = suggestion;
  const pct = Math.round((relativeToUsual ?? 1) * 100);
  const stronger = pct >= 110;
  // The track runs 0-200% so a usual dose sits mid-bar with visible headroom
  // above it -- a full bar at "normal" would leave nowhere to show stronger.
  const fill = Math.min(100, pct / 2);
  return (
    <div className="mt-4 rounded-xl bg-muted/40 px-3 py-2.5" data-testid="dose-effect-preview">
      <div className="flex items-center justify-between text-xs">
        <button type="button" onClick={() => setShowInfo((v) => !v)} className="flex items-center gap-1 text-muted-foreground" aria-label="What is this?" data-testid="dose-effect-info-toggle">
          Predicted effect <Info className="h-3 w-3" />
        </button>
        <span className={cn("font-medium", stronger && "text-[hsl(var(--warning))]")} data-testid="dose-effect-pct">
          {pct}% of your usual
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", stronger ? "bg-[hsl(var(--warning))]" : "bg-primary")}
          style={{ width: `${fill}%` }}
        />
        {/* Where a usual dose lands, so a half-filled bar reads as "normal". */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-muted-foreground/40" />
      </div>
      {(factors?.residual ?? 0) >= 0.05 && (
        <p className="mt-1.5 text-[11px] text-muted-foreground" data-testid="dose-effect-residual">
          Includes <span className="font-medium text-foreground">+{Math.round(factors.residual * 100)}%</span> still active from a recent dose — this one lands on top of it.
        </p>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground/80" data-testid="dose-effect-source">
        {calibrated ? "Based on your calibrated effects-tracker data" : "Based on typical values for this category"}
      </p>
      {showInfo && (
        <div className="mt-1.5 space-y-1 text-[11px] text-muted-foreground leading-snug animate-rise" data-testid="dose-effect-info-text">
          <p>
            <span className="font-medium text-foreground">What 100% means.</span>{" "}
            What your usual dose does for you right now — not a drug-free maximum. Above 100% means this dose should land stronger than you're used to, below means weaker.
          </p>
          <p>
            <span className="font-medium text-foreground">What moves it.</span>{" "}
            The amount, on a saturating dose-response curve — each extra unit adds less than the one before it, so doubling a dose is well short of doubling the effect — plus any drug still active from a recent dose{calibrated ? ", timed with your own calibration from tracked sessions" : ""}.
          </p>
          <p>
            <span className="font-medium text-foreground">Where tolerance fits.</span>{" "}
            {tolerance?.faded
              ? "Your tolerance looks like it has faded since your last dose, so this is compared against the tolerance you had built up before the break, not the little you have now. That's why it reads high — the same amount really will land harder than you're used to."
              : (factors?.toleranceDampening ?? 0) >= 0.05
                ? `Tolerance is blunting doses by about ${Math.round(factors.toleranceDampening * 100)}% right now — but it blunts your usual dose by the same amount, so it cancels out of this comparison rather than dragging the number down. The meter below tracks it on its own.`
                : "Tolerance blunts this dose and your usual dose alike, so it cancels out of this comparison rather than dragging the number down. The meter below tracks it on its own."}
          </p>
          <p>
            {!calibrated && "Track effects on a few doses (Onset → Peak → Gone) to calibrate the timing to you specifically. "}
            It's a helpful guide, not a guarantee — always start low if you're unsure.
          </p>
        </div>
      )}
      <ToleranceNote tolerance={tolerance} />
    </div>
  );
}

// Shown exactly once, the first time the preview above has something to say,
// so the explanation appears in context rather than as a cold, out-of-place
// popup. Dismissing persists to settings (seen_dose_effect_intro) so it
// never shows again; the (i) toggle on the preview itself remains available
// any time afterward for anyone who wants a refresher.
function DoseEffectIntro({ onDismiss }) {
  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3" data-testid="dose-effect-intro">
      <p className="text-xs font-semibold text-primary">New: a preview of how this dose may feel</p>
      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
        Meditrax now estimates predicted effect and tolerance from your own dose history right when you log — and calibrates to your personal timing once you've tracked a few effects-tracker sessions. Tap the <Info className="h-3 w-3 inline align-text-bottom" /> next to "Predicted effect" anytime for details.
      </p>
      <button onClick={onDismiss} className="mt-2 text-xs font-medium text-primary" data-testid="dose-effect-intro-dismiss">Got it</button>
    </div>
  );
}

export default function QuickLogSheet() {
  const ui = useUI();
  const qc = useQueryClient();
  const med = ui.logSheet.med;
  const editLog = ui.logSheet.log; // present = editing an existing log
  const perDose = Number(med?.dose_quantity ?? med?.inventory?.units_per_dose ?? 1) || 1;
  const [status, setStatus] = useState("taken");
  const [quantity, setQuantity] = useState(1);
  const [dose, setDose] = useState("");
  const [when, setWhen] = useState("");
  const [whenTouched, setWhenTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState(null);
  const [effectiveness, setEffectiveness] = useState([7]);
  const [effectivenessTouched, setEffectivenessTouched] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [trackEffects, setTrackEffects] = useState(false);
  const [lastMeal, setLastMeal] = useState(null);
  // While true, the dose/quantity fields track the computed taper/cyclic-aware
  // default; any manual change hands control to the user.
  const [autoDefault, setAutoDefault] = useState(true);

  const [confirmOpen, setConfirmOpen] = useState(false);

  // One-time intro for the dose-effect preview (see DoseEffectIntro below).
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings, enabled: ui.logSheet.open });
  const dismissIntro = useMutation({
    mutationFn: () => updateSettings({ seen_dose_effect_intro: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  // Taper/cyclic-aware default for today — the med objects passed in by the
  // various entry points don't carry plan info, so the sheet resolves it.
  const { data: defaults } = useQuery({
    queryKey: ["logDefaults", med?.id],
    queryFn: () => logDefaultsForMed(med.id),
    enabled: !!(ui.logSheet.open && !ui.logSheet.log && med?.id),
  });

  // Interactions between this medication and everything currently active —
  // resolved by id (the passed-in med object may not carry its category).
  const { data: interactions = [] } = useQuery({
    queryKey: ["interactions", med?.id],
    queryFn: () => getInteractionsForMedication(med.id),
    enabled: !!(ui.logSheet.open && med?.id),
  });
  // Learned per-person meal factors — read here only for the calibration
  // status line under the picker; the engine reads its own copy when the
  // session actually starts.
  const { data: mealModel } = useQuery({
    queryKey: ["mealModel"],
    queryFn: getMealModel,
    enabled: !!(ui.logSheet.open && !editLog),
  });
  const consumingStatus = status === "taken" || status === "partial";
  const showInteraction = !editLog && consumingStatus && interactions.length > 0;

  // Predicted effect + tolerance for the dose being entered, from this
  // medication's own dose history and modeled tolerance -- feeds both the
  // always-visible preview (any medication, scheduled or PRN, old or new --
  // see DoseEffectPreview below) and the effectiveness slider's starting
  // point (still PRN-only, matching that field's existing convention).
  // Computed for any consuming-status log, not just PRN ones, so a
  // medication that's been on a fixed schedule for months gets the same
  // preview as a fresh PRN one -- only for a brand-new log (never overrides
  // an existing rating being edited), and the slider's default only applies
  // until the user actually touches it themselves. Recomputes as the dose
  // amount changes, so it tracks "based off tolerance and dosage" live while
  // the form is open.
  //
  // Deliberately NOT a react-query useQuery: the sheet can open, save, close
  // and reopen for the same medication+dose within seconds (logging several
  // doses back to back), each cycle re-enabling and immediately disabling the
  // same query key -- overlapping lookups for that key can then resolve out
  // of order, letting an earlier (pre-history) result land in the cache
  // *after* a later, more accurate one and silently overwrite it. A plain
  // effect with a monotonically increasing request id sidesteps that: only
  // the result of the most recently *started* request is ever applied.
  const [effSuggestion, setEffSuggestion] = useState(null);
  const effReqRef = useRef(0);
  const effectivenessTouchedRef = useRef(effectivenessTouched);
  effectivenessTouchedRef.current = effectivenessTouched;
  const doseNum = dose === "" ? null : Number(dose);
  const effSuggestionEnabled = !!(ui.logSheet.open && !editLog && consumingStatus);
  // The meal answer only exists while the picker is visible (tracking on), so
  // the preview uses it under the same condition -- toggling tracking off
  // returns the preview to the unadjusted number rather than silently keeping
  // a hidden answer applied.
  const effMeal = trackEffects ? lastMeal : null;
  useEffect(() => {
    if (!effSuggestionEnabled) { effReqRef.current++; setEffSuggestion(null); return; }
    const reqId = ++effReqRef.current;
    estimateDoseEffectiveness({ medication_id: med.id, dose: doseNum, last_meal: effMeal }).then((result) => {
      if (reqId !== effReqRef.current) return; // superseded by a newer request
      setEffSuggestion(result);
      if (result && !effectivenessTouchedRef.current) setEffectiveness([result.suggested]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effSuggestionEnabled, med?.id, doseNum, effMeal]);

  useEffect(() => {
    if (!ui.logSheet.open || editLog || !autoDefault || !defaults) return;
    if (defaults.dose != null) {
      setDose(defaults.dose);
      setQuantity(defaults.quantity ?? perDose);
    }
  }, [defaults, ui.logSheet.open]); // eslint-disable-line

  useEffect(() => {
    if (!ui.logSheet.open) return;
    const m = ui.logSheet.med;
    const per = Number(m?.dose_quantity ?? m?.inventory?.units_per_dose ?? 1) || 1;
    const lg = ui.logSheet.log;
    setAutoDefault(!lg);
    if (lg) {
      setStatus(lg.status || "taken");
      setQuantity(Number(lg.quantity ?? per) || 0);
      setDose(lg.dose_taken != null ? lg.dose_taken : (m?.strength != null ? m.strength * (Number(lg.quantity ?? per) || 0) : ""));
      setWhen(toDatetimeLocal(lg.timestamp));
      setNotes(lg.notes || "");
      setMood(lg.mood || null);
      setEffectiveness([lg.effectiveness != null ? lg.effectiveness : 7]);
      setShowMore(!!(lg.notes || lg.mood || lg.effectiveness != null));
    } else {
      setStatus("taken");
      setQuantity(per);
      setDose(m?.strength != null ? m.strength * per : (ui.logSheet.dose ?? ""));
      setWhen(toDatetimeLocal());
      setNotes(""); setMood(null); setEffectiveness([7]); setShowMore(false);
    }
    setTrackEffects(false);
    setLastMeal(null);
    setWhenTouched(false);
    setEffectivenessTouched(false);
  }, [ui.logSheet.open]); // eslint-disable-line

  // Pill count and total amount are two views of the same thing, kept in sync
  // both ways so inventory (which decrements by pill count) always matches what
  // the user entered. Editing the pill stepper updates the amount; editing the
  // amount re-derives the pill count from the medication's per-unit strength.
  const changeQuantity = (q) => {
    setAutoDefault(false);
    const next = Math.max(0, Math.round(q * 4) / 4); // quarter-pill precision
    setQuantity(next);
    if (med?.strength != null) setDose(med.strength * next);
  };
  const changeDose = (v) => {
    setAutoDefault(false);
    setDose(v);
    // Back-derive the pill count so inventory decrements the real amount taken.
    const pills = pillsFromAmount(v, med?.strength);
    if (pills != null) setQuantity(pills);
  };
  const selectStatus = (s) => {
    setStatus(s);
    if (s === "partial" && quantity === perDose) changeQuantity(perDose / 2);
    if (s === "taken" && quantity === perDose / 2) changeQuantity(perDose);
  };

  const invalidate = () => ["today", "logs", "analytics", "inventory", "medications", "medication", "activeSubstances", "interactions", "effectivenessSuggestion", "medicationTolerance"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const mutation = useMutation({
    mutationFn: (payload) => (editLog ? updateLog(editLog.id, payload) : createLog(payload)),
    onSuccess: async (log, payload) => {
      if (!editLog && trackEffects && ["taken", "partial"].includes(payload.status)) {
        try {
          await startEffectSession({ medication_id: med.id, dose: payload.dose_taken, unit: med.unit, log_id: log.id, started_at: log.timestamp, last_meal: lastMeal });
          qc.invalidateQueries({ queryKey: ["effectSessions"] });
        } catch { toast.error("Could not start effects tracking"); }
      }
      invalidate();
      scheduleAllReminders().catch(() => {}); // don't notify for doses just logged
      toast.success(editLog ? "Log updated" : trackEffects ? "Dose logged — tracking effects" : "Dose logged");
      ui.closeQuickLog();
      if (navigator.vibrate) try { navigator.vibrate(12); } catch {}
    },
    onError: (err) => toast.error(err?.message || "Could not save log"),
  });

  const delMutation = useMutation({
    mutationFn: () => deleteLog(editLog.id),
    onSuccess: () => {
      invalidate();
      scheduleAllReminders().catch(() => {});
      toast.success("Log deleted");
      ui.closeQuickLog();
    },
    onError: () => toast.error("Could not delete log"),
  });

  if (!med) return null;

  function save() {
    const consuming = status === "taken" || status === "partial";
    let timestamp;
    if (editLog || whenTouched) {
      const d = new Date(when);
      if (!when || isNaN(d.getTime())) { toast.error("Enter a valid date and time"); return; }
      if (d.getTime() > Date.now() + 60000) { toast.error("Logs can't be in the future"); return; }
      timestamp = d.toISOString();
    }
    const payload = {
      status,
      quantity: consuming ? quantity : 0,
      dose_taken: dose === "" ? null : Number(dose),
      unit: med.unit,
      notes: notes || null,
      mood,
      effectiveness: med.is_prn || editLog?.effectiveness != null ? effectiveness[0] : null,
    };
    if (timestamp) payload.timestamp = timestamp;
    if (!editLog) {
      payload.medication_id = med.id;
      payload.scheduled_time = ui.logSheet.time || null;
    }
    mutation.mutate(payload);
  }

  return (
    <Drawer open={ui.logSheet.open} onOpenChange={(o) => !o && ui.closeQuickLog()}>
      <DrawerContent className="max-w-2xl mx-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-3">
            <MedColorDot color={med.color} size={42} />
            <div>
              <p className="font-display text-xl leading-tight">{editLog ? `Edit log · ${med.name}` : med.name}</p>
              <p className="text-sm text-muted-foreground font-normal">
                {doseLabel(med.strength, med.unit)}{ui.logSheet.time ? ` · ${fmtTime12(ui.logSheet.time)}` : ""}
              </p>
            </div>
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-2">
          {showInteraction && <InteractionAlert findings={interactions} className="mb-3" />}
          <div className="grid grid-cols-4 gap-2" data-testid="quick-log-status-toggle">
            {STATUSES.map((s) => {
              const Icon = s.icon; const active = status === s.v;
              return (
                <button key={s.v} onClick={() => selectStatus(s.v)} data-testid={`quick-log-status-${s.v}`}
                  className={cn("pressable rounded-xl border py-3 flex flex-col items-center gap-1 text-sm font-medium",
                    active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground")}>
                  <Icon className="h-5 w-5" />{s.l}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <Label className="text-xs text-muted-foreground">When</Label>
            <Input
              type="datetime-local"
              value={when}
              max={toDatetimeLocal()}
              onChange={(e) => { setWhen(e.target.value); setWhenTouched(true); }}
              className="h-11 rounded-xl mt-1"
              data-testid="quick-log-when-input"
            />
          </div>

          {(status === "taken" || status === "partial") && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">{med.form === "capsule" ? "Capsules" : "Pills"} taken</Label>
                <div className="flex items-center gap-2 mt-1">
                  <button onClick={() => changeQuantity(quantity - 0.5)} aria-label="Fewer pills" data-testid="quick-log-qty-minus" className="pressable h-11 w-11 rounded-xl border border-border flex items-center justify-center shrink-0"><MinusCircle className="h-4 w-4" /></button>
                  <span data-testid="quick-log-qty" className="flex-1 text-center font-display text-xl font-semibold">{quantity}</span>
                  <button onClick={() => changeQuantity(quantity + 0.5)} aria-label="More pills" data-testid="quick-log-qty-plus" className="pressable h-11 w-11 rounded-xl border border-border flex items-center justify-center shrink-0"><PlusCircle className="h-4 w-4" /></button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Total amount</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input type="number" value={dose} onChange={(e) => changeDose(e.target.value)} className="h-11 rounded-xl" data-testid="quick-log-dose-input" />
                  <span className="text-sm text-muted-foreground w-12">{med.unit}</span>
                </div>
              </div>
            </div>
          )}

          {!editLog && isDoseEffectMeaningful(effSuggestion) && settings && !settings.seen_dose_effect_intro && (
            <DoseEffectIntro onDismiss={() => dismissIntro.mutate()} />
          )}
          {!editLog && <DoseEffectPreview suggestion={effSuggestion} />}

          {!editLog && (status === "taken" || status === "partial") && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Track effects</p>
                <p className="text-xs text-muted-foreground">Live onset → peak → wear-off curve that learns your metabolism</p>
              </div>
              <Switch checked={trackEffects} onCheckedChange={setTrackEffects} data-testid="quick-log-track-effects" />
            </div>
          )}

          {/* Stomach fullness -- swallowed doses only (the engine ignores it
              for every other route, so there's no point asking). Skipping is
              always fine and means no adjustment. */}
          {!editLog && trackEffects && consumingStatus && isOralForm(med.form) && (
            <div className="mt-3 animate-rise">
              <Label className="text-xs text-muted-foreground">When did you last eat?</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {MEAL_OPTIONS.map((m) => (
                  <button key={m.v} onClick={() => setLastMeal(lastMeal === m.v ? null : m.v)} data-testid={`quick-log-meal-${m.v}`}
                    className={cn("pressable rounded-xl border py-2 px-1 text-center", lastMeal === m.v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground")}>
                    <span className="block text-xs font-medium leading-tight">{m.l}</span>
                    <span className={cn("block text-[10px] leading-tight mt-0.5", lastMeal === m.v ? "text-primary-foreground/80" : "text-muted-foreground")}>{m.d}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5" data-testid="quick-log-meal-caption">
                {(() => {
                  // Mirrors the timing model's own phrasing: typical values
                  // until this state has real calibration samples behind it.
                  const n = lastMeal && mealModel?.[lastMeal]?.samples;
                  return n >= 3
                    ? `Calibrated to you from ${n} of your own sessions — keeps refining with each one.`
                    : n >= 1
                      ? `Using typical values, starting to calibrate to you (${n} session${n > 1 ? "s" : ""} so far).`
                      : "Adjusts predicted onset and strength for swallowed doses — learns your own response as you give session feedback. Skip if unsure.";
                })()}
              </p>
            </div>
          )}

          <button onClick={() => setShowMore((s) => !s)} className="mt-4 text-sm font-medium text-primary">
            {showMore ? "Hide details" : "Add mood, effectiveness & notes"}
          </button>

          {showMore && (
            <div className="mt-3 space-y-4 animate-rise">
              <div>
                <Label className="text-xs text-muted-foreground">How do you feel?</Label>
                <div className="flex gap-2 mt-2">
                  {MOODS.map((m) => (
                    <button key={m.v} onClick={() => setMood(mood === m.v ? null : m.v)}
                      className={cn("flex-1 rounded-xl border py-2 text-center", mood === m.v ? "bg-accent border-primary" : "bg-card border-border")}>
                      <span className="text-xl">{m.e}</span>
                      <span className="block text-[10px] text-muted-foreground mt-0.5">{m.l}</span>
                    </button>
                  ))}
                </div>
              </div>
              {(med.is_prn || editLog?.effectiveness != null) && (
                <div>
                  <Label className="text-xs text-muted-foreground">Effectiveness: {effectiveness[0]}/10</Label>
                  <Slider
                    value={effectiveness}
                    onValueChange={(v) => { setEffectiveness(v); setEffectivenessTouched(true); }}
                    min={1} max={10} step={1} className="mt-3"
                    data-testid="quick-log-effectiveness-slider"
                  />
                  {!editLog && effSuggestion && !effectivenessTouched && (
                    <p className="text-[11px] text-muted-foreground mt-1.5" data-testid="quick-log-effectiveness-suggestion">
                      Starting point from your recent usage and dose — adjust to how it actually felt.
                    </p>
                  )}
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Side effects, context…" className="rounded-xl mt-1" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 safe-bottom space-y-2">
          <Button data-testid="quick-log-save-button" className="w-full h-12 rounded-xl" onClick={() => (showInteraction ? setConfirmOpen(true) : save())} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : editLog ? "Save changes" : "Save log"}
          </Button>
          {/* Interaction confirmation — a red popup the user must acknowledge
              before logging a dose that interacts with an active substance. */}
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent data-testid="interaction-confirm-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/12">⚠️</span>
                  Interaction warning
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div>
                    <p>Logging {med.name} may interact with something you have active:</p>
                    <ul className="mt-2 space-y-1.5">
                      {interactions.map((f, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium text-foreground">{f.otherName}:</span> {f.reason}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs">Harm-reduction heuristic based on drug category, not a clinical database. When in doubt, ask a pharmacist.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="interaction-confirm-cancel">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setConfirmOpen(false); save(); }} className="bg-destructive text-destructive-foreground" data-testid="interaction-confirm-proceed">Log anyway</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {editLog && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" data-testid="quick-log-delete-button">
                  <Trash2 className="h-4 w-4 mr-2" />Delete this log
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this log?</AlertDialogTitle>
                  <AlertDialogDescription>The entry is removed and any inventory it consumed is restored. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => delMutation.mutate()} className="bg-destructive text-destructive-foreground" data-testid="quick-log-confirm-delete">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
