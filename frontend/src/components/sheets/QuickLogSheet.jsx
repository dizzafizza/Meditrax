import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { useUI } from "@/context/UIContext";
import { createLog } from "@/lib/api";
import MedColorDot from "@/components/MedColorDot";
import { doseLabel, fmtTime12 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check, X, SkipForward, MinusCircle, PlusCircle } from "lucide-react";

const MOODS = [
  { v: "great", e: "\uD83D\uDE0A", l: "Great" },
  { v: "good", e: "\uD83D\uDE42", l: "Good" },
  { v: "okay", e: "\uD83D\uDE10", l: "Okay" },
  { v: "low", e: "\uD83D\uDE15", l: "Low" },
  { v: "bad", e: "\uD83D\uDE1F", l: "Bad" },
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
  const perDose = Number(med?.dose_quantity ?? med?.inventory?.units_per_dose ?? 1) || 1;
  const [status, setStatus] = useState("taken");
  const [quantity, setQuantity] = useState(1);
  const [dose, setDose] = useState("");
  const [doseTouched, setDoseTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState(null);
  const [effectiveness, setEffectiveness] = useState([7]);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (ui.logSheet.open) {
      const m = ui.logSheet.med;
      const per = Number(m?.dose_quantity ?? m?.inventory?.units_per_dose ?? 1) || 1;
      setStatus("taken");
      setQuantity(per);
      setDose(ui.logSheet.med?.strength != null ? ui.logSheet.med.strength * per : (ui.logSheet.dose ?? ""));
      setDoseTouched(false);
      setNotes(""); setMood(null); setEffectiveness([7]); setShowMore(false);
    }
  }, [ui.logSheet.open]); // eslint-disable-line

  // Keep the total-amount field derived from the pill count unless the user
  // has manually overridden it.
  const changeQuantity = (q) => {
    const next = Math.max(0, Math.round(q * 4) / 4); // quarter-pill precision
    setQuantity(next);
    if (!doseTouched && med?.strength != null) setDose(med.strength * next);
  };
  const selectStatus = (s) => {
    setStatus(s);
    if (s === "partial" && quantity === perDose) changeQuantity(perDose / 2);
    if (s === "taken" && quantity === perDose / 2) changeQuantity(perDose);
  };

  const mutation = useMutation({
    mutationFn: (payload) => createLog(payload),
    onSuccess: () => {
      ["today", "logs", "analytics", "inventory", "medications"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success("Dose logged");
      ui.closeQuickLog();
      if (navigator.vibrate) try { navigator.vibrate(12); } catch {}
    },
    onError: () => toast.error("Could not log dose"),
  });

  if (!med) return null;

  function save() {
    const consuming = status === "taken" || status === "partial";
    mutation.mutate({
      medication_id: med.id,
      scheduled_time: ui.logSheet.time || null,
      status,
      quantity: consuming ? quantity : 0,
      dose_taken: dose === "" ? null : Number(dose),
      unit: med.unit,
      notes: notes || null,
      mood,
      effectiveness: med.is_prn ? effectiveness[0] : null,
    });
  }

  return (
    <Drawer open={ui.logSheet.open} onOpenChange={(o) => !o && ui.closeQuickLog()}>
      <DrawerContent className="max-w-2xl mx-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-3">
            <MedColorDot color={med.color} size={42} />
            <div>
              <p className="font-display text-xl leading-tight">{med.name}</p>
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
                  <Input type="number" value={dose} onChange={(e) => { setDose(e.target.value); setDoseTouched(true); }} className="h-11 rounded-xl" data-testid="quick-log-dose-input" />
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
              {med.is_prn && (
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

        <div className="p-4 safe-bottom">
          <Button data-testid="quick-log-save-button" className="w-full h-12 rounded-xl" onClick={save} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save log"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
