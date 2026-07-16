import { useState, useEffect } from "react";
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
import { createLog, updateLog, deleteLog, logDefaultsForMed } from "@/lib/api";
import { scheduleAllReminders } from "@/lib/push";
import MedColorDot from "@/components/MedColorDot";
import { doseLabel, fmtTime12, toDatetimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check, X, SkipForward, MinusCircle, PlusCircle, Trash2 } from "lucide-react";

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

export default function QuickLogSheet() {
  const ui = useUI();
  const qc = useQueryClient();
  const med = ui.logSheet.med;
  const editLog = ui.logSheet.log; // present = editing an existing log
  const perDose = Number(med?.dose_quantity ?? med?.inventory?.units_per_dose ?? 1) || 1;
  const [status, setStatus] = useState("taken");
  const [quantity, setQuantity] = useState(1);
  const [dose, setDose] = useState("");
  const [doseTouched, setDoseTouched] = useState(false);
  const [when, setWhen] = useState("");
  const [whenTouched, setWhenTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState(null);
  const [effectiveness, setEffectiveness] = useState([7]);
  const [showMore, setShowMore] = useState(false);
  // While true, the dose/quantity fields track the computed taper/cyclic-aware
  // default; any manual change hands control to the user.
  const [autoDefault, setAutoDefault] = useState(true);

  // Taper/cyclic-aware default for today — the med objects passed in by the
  // various entry points don't carry plan info, so the sheet resolves it.
  const { data: defaults } = useQuery({
    queryKey: ["logDefaults", med?.id],
    queryFn: () => logDefaultsForMed(med.id),
    enabled: !!(ui.logSheet.open && !ui.logSheet.log && med?.id),
  });

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
      setDoseTouched(lg.dose_taken != null);
      setWhen(toDatetimeLocal(lg.timestamp));
      setNotes(lg.notes || "");
      setMood(lg.mood || null);
      setEffectiveness([lg.effectiveness != null ? lg.effectiveness : 7]);
      setShowMore(!!(lg.notes || lg.mood || lg.effectiveness != null));
    } else {
      setStatus("taken");
      setQuantity(per);
      setDose(m?.strength != null ? m.strength * per : (ui.logSheet.dose ?? ""));
      setDoseTouched(false);
      setWhen(toDatetimeLocal());
      setNotes(""); setMood(null); setEffectiveness([7]); setShowMore(false);
    }
    setWhenTouched(false);
  }, [ui.logSheet.open]); // eslint-disable-line

  // Keep the total-amount field derived from the pill count unless the user
  // has manually overridden it.
  const changeQuantity = (q) => {
    setAutoDefault(false);
    const next = Math.max(0, Math.round(q * 4) / 4); // quarter-pill precision
    setQuantity(next);
    if (!doseTouched && med?.strength != null) setDose(med.strength * next);
  };
  const selectStatus = (s) => {
    setStatus(s);
    if (s === "partial" && quantity === perDose) changeQuantity(perDose / 2);
    if (s === "taken" && quantity === perDose / 2) changeQuantity(perDose);
  };

  const invalidate = () => ["today", "logs", "analytics", "inventory", "medications", "medication"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const mutation = useMutation({
    mutationFn: (payload) => (editLog ? updateLog(editLog.id, payload) : createLog(payload)),
    onSuccess: () => {
      invalidate();
      scheduleAllReminders().catch(() => {}); // don't notify for doses just logged
      toast.success(editLog ? "Log updated" : "Dose logged");
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
                  <Input type="number" value={dose} onChange={(e) => { setDose(e.target.value); setDoseTouched(true); setAutoDefault(false); }} className="h-11 rounded-xl" data-testid="quick-log-dose-input" />
                  <span className="text-sm text-muted-foreground w-12">{med.unit}</span>
                </div>
              </div>
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
                  <Slider value={effectiveness} onValueChange={setEffectiveness} min={1} max={10} step={1} className="mt-3" />
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
          <Button data-testid="quick-log-save-button" className="w-full h-12 rounded-xl" onClick={save} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : editLog ? "Save changes" : "Save log"}
          </Button>
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
