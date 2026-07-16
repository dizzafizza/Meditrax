import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import TaperChart from "@/components/TaperChart";
import MedColorDot from "@/components/MedColorDot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMedications, getTapers, taperPreview, createTaper, taperSuggest } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TrendingDown, Plus, Info, AlertTriangle, ChevronRight } from "lucide-react";

const METHODS = [
  { v: "hyperbolic", l: "Hyperbolic", d: "Gentlest near the end — best for dependency-forming meds" },
  { v: "exponential", l: "Exponential", d: "Fixed % of current dose each step" },
  { v: "linear", l: "Linear", d: "Equal amount reduced each step" },
];
const INTERVALS = [{ v: 3, l: "Every 3 days" }, { v: 7, l: "Weekly" }, { v: 14, l: "Every 2 weeks" }];

export default function TaperPlanner() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { data: tapers = [] } = useQuery({ queryKey: ["tapers"], queryFn: getTapers });
  const { data: meds = [] } = useQuery({ queryKey: ["medications"], queryFn: () => getMedications(true) });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get("med") && meds.length) setOpen(true);
  }, [params, meds.length]);

  return (
    <div>
      <PageHeader title="Taper Planner" subtitle="Plan a safe dose reduction"
        right={<button onClick={() => setOpen(true)} data-testid="taper-create-plan-button" className="pressable h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Plus className="h-5 w-5" /></button>} />
      <div className="px-4 space-y-3">
        <div className="card-soft p-4 flex gap-3 items-start">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">Tapering means reducing a dose gradually. The <span className="text-foreground font-medium">hyperbolic</span> method makes the smallest cuts at the lowest doses, which most guidelines recommend for benzodiazepines and antidepressants. Always taper under a clinician's guidance.</p>
        </div>

        {tapers.length === 0 ? (
          <EmptyState icon={TrendingDown} title="No taper plans yet" description="Create a plan to visualize a safe, step-by-step dose reduction."
            action={<Button onClick={() => setOpen(true)} className="rounded-xl"><Plus className="h-4 w-4 mr-1" />Create a plan</Button>} />
        ) : (
          tapers.map((t) => (
            <button key={t.id} onClick={() => navigate(`/taper/${t.id}`)} className="w-full card-soft p-4 pressable text-left">
              <div className="flex items-center gap-3">
                <MedColorDot color={t.medication_color} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><p className="font-semibold truncate">{t.medication_name}</p>{!t.is_active && <span className="text-[11px] text-muted-foreground">ended</span>}{t.is_active && t.is_paused && <span className="text-[11px] text-[hsl(var(--warning))]">paused</span>}{t.is_active && !t.is_paused && t.is_finished && <span className="text-[11px] text-[hsl(var(--success))]">complete</span>}</div>
                  <p className="text-xs text-muted-foreground capitalize">{t.method} · {t.initial_dose}→{t.final_dose} {t.unit} · {t.total_days} days</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="mt-2 -mb-1"><TaperChart steps={t.schedule?.steps || []} unit={t.unit} height={90} /></div>
            </button>
          ))
        )}
      </div>
      <TaperBuilder open={open} onClose={() => setOpen(false)} meds={meds} initialMed={params.get("med")} onCreated={(id) => { qc.invalidateQueries({ queryKey: ["tapers"] }); qc.invalidateQueries({ queryKey: ["medications"] }); setOpen(false); navigate(`/taper/${id}`); }} />
    </div>
  );
}

function TaperBuilder({ open, onClose, meds, initialMed, onCreated }) {
  const [medId, setMedId] = useState("");
  const [initial, setInitial] = useState("");
  const [final, setFinal] = useState("0");
  const [method, setMethod] = useState("hyperbolic");
  const [weeks, setWeeks] = useState(8);
  const [interval, setInterval] = useState(7);
  const [preview, setPreview] = useState(null);
  const med = meds.find((m) => m.id === medId);
  const unit = med?.unit || "mg";

  useEffect(() => {
    if (!open) return;
    const mid = initialMed || meds[0]?.id || "";
    setMedId(mid);
  }, [open, initialMed, meds]);

  useEffect(() => {
    if (!medId) return;
    const m = meds.find((x) => x.id === medId);
    if (m?.strength) setInitial(String(m.strength));
    taperSuggest(medId).then((s) => { setMethod(s.method); setInterval(s.step_interval_days); setWeeks(s.suggested_weeks); }).catch(() => {});
  }, [medId]); // eslint-disable-line

  useEffect(() => {
    if (!initial || Number(initial) <= 0) { setPreview(null); return; }
    const t = setTimeout(async () => {
      try {
        const p = await taperPreview({ initial_dose: Number(initial), final_dose: Number(final) || 0, method, total_days: weeks * 7, step_interval_days: interval, unit });
        setPreview(p);
      } catch { setPreview(null); }
    }, 280);
    return () => clearTimeout(t);
  }, [initial, final, method, weeks, interval, unit]);

  const createMut = useMutation({
    mutationFn: () => createTaper({ medication_id: medId, initial_dose: Number(initial), final_dose: Number(final) || 0, method, total_days: weeks * 7, step_interval_days: interval, unit }),
    onSuccess: (t) => { toast.success("Taper plan created"); onCreated(t.id); },
    onError: (e) => toast.error(e?.response?.data?.detail || "Could not create plan"),
  });

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-w-2xl mx-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <DrawerHeader className="text-left"><DrawerTitle className="font-display text-2xl">New taper plan</DrawerTitle></DrawerHeader>
        <div className="px-4 overflow-y-auto scroll-y" style={{ maxHeight: "66vh" }}>
          {meds.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Add a medication first to build a taper plan.</p>
          ) : (
            <>
              <Label className="text-xs text-muted-foreground">Medication</Label>
              <Select value={medId} onValueChange={setMedId}>
                <SelectTrigger className="h-11 rounded-xl mt-1" data-testid="taper-med-select"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{meds.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div><Label className="text-xs text-muted-foreground">Starting dose ({unit})</Label><Input type="number" value={initial} onChange={(e) => setInitial(e.target.value)} className="h-11 rounded-xl mt-1" data-testid="taper-initial-input" /></div>
                <div><Label className="text-xs text-muted-foreground">Final dose ({unit})</Label><Input type="number" value={final} onChange={(e) => setFinal(e.target.value)} className="h-11 rounded-xl mt-1" data-testid="taper-final-input" /></div>
              </div>

              <Label className="text-xs text-muted-foreground mt-4 block">Method</Label>
              <div className="space-y-2 mt-2" data-testid="taper-method-selector">
                {METHODS.map((m) => (
                  <button key={m.v} onClick={() => setMethod(m.v)} className={cn("w-full text-left rounded-xl border p-3", method === m.v ? "border-primary bg-accent" : "border-border bg-card")}>
                    <p className="font-medium text-sm">{m.l}</p><p className="text-xs text-muted-foreground">{m.d}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Duration: {weeks} weeks</Label>
                  <input type="range" min={2} max={52} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="w-full mt-3 accent-[hsl(var(--primary))]" data-testid="taper-weeks-slider" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Reduce</Label>
                  <Select value={String(interval)} onValueChange={(v) => setInterval(Number(v))}>
                    <SelectTrigger className="h-11 rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{INTERVALS.map((i) => <SelectItem key={i.v} value={String(i.v)}>{i.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {preview && (
                <div className="mt-4 card-soft p-3">
                  <TaperChart steps={preview.steps} unit={unit} height={170} />
                  <p className="text-xs text-muted-foreground text-center mt-1">{preview.summary.num_steps} steps · {preview.summary.initial_dose}→{preview.summary.final_dose} {unit}</p>
                  {preview.warnings?.length > 0 && (
                    <div className="mt-2 rounded-xl bg-[hsl(var(--warning-surface))] text-[hsl(var(--warning))] p-2.5 text-xs flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /><span>{preview.warnings[0]} Consider a longer duration for a gentler taper.</span></div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <div className="p-4 safe-bottom flex gap-3">
          <Button variant="secondary" className="flex-1 h-12 rounded-xl" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 h-12 rounded-xl" disabled={!medId || !initial || createMut.isPending} onClick={() => createMut.mutate()} data-testid="taper-save-button">{createMut.isPending ? "Creating…" : "Create plan"}</Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
