import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import MedColorDot from "@/components/MedColorDot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getMedications, getCyclic, createCyclic, deleteCyclic } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RefreshCw, Plus, X, Trash2 } from "lucide-react";

const PRESETS = {
  "5-2": [{ phase: "on", duration: 5, dose_multiplier: 1 }, { phase: "off", duration: 2, dose_multiplier: 0 }],
  "weekday": [{ phase: "on", duration: 5, dose_multiplier: 1 }, { phase: "off", duration: 2, dose_multiplier: 0 }],
  "on-off-week": [{ phase: "on", duration: 7, dose_multiplier: 1 }, { phase: "off", duration: 7, dose_multiplier: 0 }],
  "4-on-3-half": [{ phase: "on", duration: 4, dose_multiplier: 1 }, { phase: "maintenance", duration: 3, dose_multiplier: 0.5 }],
};

const PHASE_COLOR = { on: "hsl(var(--primary))", off: "hsl(var(--muted-foreground))", "taper-down": "hsl(var(--chart-5))", maintenance: "hsl(var(--info))" };

export default function CyclicDosing() {
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { data: plans = [] } = useQuery({ queryKey: ["cyclic"], queryFn: getCyclic });
  const { data: meds = [] } = useQuery({ queryKey: ["medications"], queryFn: () => getMedications(true) });
  const [open, setOpen] = useState(false);

  useEffect(() => { if (params.get("med") && meds.length) setOpen(true); }, [params, meds.length]);

  const del = useMutation({ mutationFn: deleteCyclic, onSuccess: () => { qc.invalidateQueries({ queryKey: ["cyclic"] }); toast.success("Cycle deleted"); } });

  return (
    <div>
      <PageHeader title="Cyclic Dosing" subtitle="On/off cycles & drug holidays"
        right={<button onClick={() => setOpen(true)} data-testid="cyclic-create-button" className="pressable h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Plus className="h-5 w-5" /></button>} />
      <div className="px-4 space-y-3">
        {plans.length === 0 ? (
          <EmptyState icon={RefreshCw} title="No cycles yet" description="Create on/off schedules — useful for stimulant holidays or intermittent dosing."
            action={<Button onClick={() => setOpen(true)} className="rounded-xl"><Plus className="h-4 w-4 mr-1" />New cycle</Button>} />
        ) : plans.map((p) => {
          const total = (p.pattern || []).reduce((a, x) => a + x.duration, 0) || 1;
          return (
            <div key={p.id} className="card-soft p-4">
              <div className="flex items-center gap-3">
                <MedColorDot color={p.medication_color} size={40} />
                <div className="flex-1 min-w-0"><p className="font-semibold truncate">{p.name}</p><p className="text-xs text-muted-foreground">{p.medication_name}</p></div>
                <button onClick={() => del.mutate(p.id)} className="h-9 w-9 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 flex h-8 rounded-lg overflow-hidden">
                {(p.pattern || []).map((ph, i) => (
                  <div key={i} className="flex items-center justify-center text-[10px] text-white font-medium" style={{ width: `${(ph.duration / total) * 100}%`, backgroundColor: PHASE_COLOR[ph.phase] || "hsl(var(--muted-foreground))" }} title={`${ph.phase} ${ph.duration}d`}>{ph.duration}d</div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {(p.pattern || []).map((ph, i) => <span key={i} className="capitalize">{ph.phase} ×{ph.duration}d ({Math.round(ph.dose_multiplier * 100)}%)</span>)}
              </div>
            </div>
          );
        })}
      </div>
      <CyclicBuilder open={open} onClose={() => setOpen(false)} meds={meds} initialMed={params.get("med")} onCreated={() => { qc.invalidateQueries({ queryKey: ["cyclic"] }); setOpen(false); }} />
    </div>
  );
}

function CyclicBuilder({ open, onClose, meds, initialMed, onCreated }) {
  const [medId, setMedId] = useState("");
  const [name, setName] = useState("");
  const [pattern, setPattern] = useState(PRESETS["5-2"]);

  useEffect(() => { if (open) { setMedId(initialMed || meds[0]?.id || ""); setName(""); setPattern(PRESETS["5-2"]); } }, [open]); // eslint-disable-line

  const create = useMutation({
    mutationFn: () => createCyclic({ medication_id: medId, name: name || "Cycle", type: "on-off-cycle", pattern }),
    onSuccess: onCreated, onError: () => toast.error("Could not create cycle"),
  });

  const updatePhase = (i, k, v) => setPattern((p) => p.map((ph, idx) => idx === i ? { ...ph, [k]: v } : ph));
  const addPhase = () => setPattern((p) => [...p, { phase: "off", duration: 2, dose_multiplier: 0 }]);
  const removePhase = (i) => setPattern((p) => p.filter((_, idx) => idx !== i));

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-w-2xl mx-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <DrawerHeader className="text-left"><DrawerTitle className="font-display text-2xl">New cycle</DrawerTitle></DrawerHeader>
        <div className="px-4 overflow-y-auto scroll-y" style={{ maxHeight: "64vh" }}>
          {meds.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Add a medication first.</p> : (
            <>
              <Label className="text-xs text-muted-foreground">Medication</Label>
              <Select value={medId} onValueChange={setMedId}><SelectTrigger className="h-11 rounded-xl mt-1"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{meds.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
              <Label className="text-xs text-muted-foreground mt-4 block">Cycle name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekday only" className="h-11 rounded-xl mt-1" />
              <Label className="text-xs text-muted-foreground mt-4 block">Presets</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {[["5-2", "5 on / 2 off"], ["on-off-week", "Week on / week off"], ["4-on-3-half", "4 full / 3 half"]].map(([k, l]) => (
                  <button key={k} onClick={() => setPattern(PRESETS[k])} className="rounded-full border border-border px-3 h-9 text-sm">{l}</button>
                ))}
              </div>
              <Label className="text-xs text-muted-foreground mt-4 block">Phases</Label>
              <div className="space-y-2 mt-2">
                {pattern.map((ph, i) => (
                  <div key={i} className="flex items-center gap-2 card-soft p-2">
                    <Select value={ph.phase} onValueChange={(v) => updatePhase(i, "phase", v)}><SelectTrigger className="h-9 rounded-lg w-28"><SelectValue /></SelectTrigger><SelectContent>{["on", "off", "maintenance", "taper-down"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
                    <Input type="number" value={ph.duration} onChange={(e) => updatePhase(i, "duration", Number(e.target.value))} className="h-9 rounded-lg w-16" /><span className="text-xs text-muted-foreground">days</span>
                    <Input type="number" step="0.25" value={ph.dose_multiplier} onChange={(e) => updatePhase(i, "dose_multiplier", Number(e.target.value))} className="h-9 rounded-lg w-16" /><span className="text-xs text-muted-foreground">×</span>
                    {pattern.length > 1 && <button onClick={() => removePhase(i)} className="ml-auto text-muted-foreground"><X className="h-4 w-4" /></button>}
                  </div>
                ))}
                <button onClick={addPhase} className="h-10 px-3 rounded-xl border border-dashed border-border text-sm text-primary flex items-center gap-1"><Plus className="h-4 w-4" />Add phase</button>
              </div>
            </>
          )}
        </div>
        <div className="p-4 safe-bottom flex gap-3">
          <Button variant="secondary" className="flex-1 h-12 rounded-xl" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 h-12 rounded-xl" disabled={!medId || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create cycle"}</Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
