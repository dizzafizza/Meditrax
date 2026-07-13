import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import TaperChart from "@/components/TaperChart";
import MedColorDot from "@/components/MedColorDot";
import ShareDialog, { TaperShareCard } from "@/components/ShareDialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getTaper, updateTaper, deleteTaper } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Pause, Play, Trash2, Download, AlertTriangle, Check, Circle, Share2 } from "lucide-react";

export default function TaperDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const { data: t, isLoading } = useQuery({ queryKey: ["taper", id], queryFn: () => getTaper(id) });

  const upd = useMutation({
    mutationFn: (patch) => updateTaper(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["taper", id] }); qc.invalidateQueries({ queryKey: ["tapers"] }); },
  });
  const del = useMutation({
    mutationFn: () => deleteTaper(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tapers"] }); qc.invalidateQueries({ queryKey: ["medications"] }); toast.success("Plan deleted"); navigate("/taper"); },
  });

  if (isLoading || !t) return <div><PageHeader back title="Taper plan" /><div className="px-4 h-48 rounded-2xl bg-muted/60 animate-pulse" /></div>;
  const steps = t.schedule?.steps || [];
  const warnings = t.schedule?.warnings || [];

  function exportPlan() {
    const lines = [`Meditrax taper plan — ${t.medication?.name || ""}`, `Method: ${t.method}`, `${t.initial_dose} → ${t.final_dose} ${t.unit} over ${t.total_days} days`, ""];
    steps.forEach((s) => lines.push(`Step ${s.step} (${s.date}): ${s.dose} ${t.unit}${s.reduction_pct ? `  (-${s.reduction_pct}%)` : ""}`));
    lines.push("", "Not medical advice. Taper under clinician guidance.");
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `taper-${(t.medication?.name || "plan").toLowerCase()}.txt`; a.click();
  }

  return (
    <div>
      <PageHeader back title={t.medication?.name || "Taper plan"} subtitle={`${t.method} taper`}
        right={
          <div className="flex items-center gap-1">
            <button onClick={() => setShareOpen(true)} data-testid="share-taper-button" aria-label="Share taper plan" className="pressable h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center text-primary"><Share2 className="h-5 w-5" /></button>
            <button onClick={exportPlan} data-testid="taper-export-plan-button" aria-label="Export as text" className="pressable h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center text-primary"><Download className="h-5 w-5" /></button>
          </div>
        } />
      <div className="px-4 space-y-4">
        <div className="card-soft p-4">
          <div className="flex items-center gap-3 mb-3">
            <MedColorDot color={t.medication?.color} size={44} />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Today's target dose</p>
              <p className="font-display text-2xl font-semibold">{t.current_dose} <span className="text-base font-body text-muted-foreground">{t.unit}</span></p>
            </div>
            <div className="text-right"><p className="text-xs text-muted-foreground">Step</p><p className="font-semibold">{(t.current_step ?? 0) + 1}/{steps.length}</p></div>
          </div>
          <TaperChart steps={steps} unit={t.unit} currentStep={t.current_step} height={180} />
        </div>

        {warnings.length > 0 && (
          <div className="card-soft p-4 bg-[hsl(var(--warning-surface))] border-[hsl(var(--warning))]/30">
            <div className="flex items-center gap-2 text-[hsl(var(--warning))] mb-1"><AlertTriangle className="h-4 w-4" /><p className="font-semibold text-sm">Safety notes</p></div>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">{warnings.slice(0, 4).map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1 h-11 rounded-xl" onClick={() => upd.mutate({ is_paused: !t.is_paused })} data-testid="taper-pause-button">
            {t.is_paused ? <><Play className="h-4 w-4 mr-1" />Resume</> : <><Pause className="h-4 w-4 mr-1" />Pause</>}
          </Button>
          {t.is_active && <Button variant="secondary" className="flex-1 h-11 rounded-xl" onClick={() => upd.mutate({ is_active: false })}>End plan</Button>}
        </div>

        <div>
          <p className="px-1 font-display text-lg font-semibold mb-2">Schedule</p>
          <div className="relative pl-6">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
            <div className="space-y-2.5">
              {steps.map((s) => {
                const done = (t.current_step ?? 0) > s.step;
                const current = (t.current_step ?? 0) === s.step;
                return (
                  <div key={s.step} data-testid="taper-step-item" className={cn("relative card-soft p-3", current && "ring-2 ring-primary")}> 
                    <span className={cn("absolute -left-[18px] top-4 h-3.5 w-3.5 rounded-full border-2 border-background", done ? "bg-[hsl(var(--success))]" : current ? "bg-primary" : "bg-muted")} />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{s.dose} {t.unit}{s.is_final ? " · Final" : ""}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(s.date, "MMM d, yyyy")}{s.reduction_pct ? ` · -${s.reduction_pct}%` : ""}</p>
                      </div>
                      {done ? <Check className="h-5 w-5 text-[hsl(var(--success))]" /> : current ? <span className="text-xs font-medium text-primary">Now</span> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    {s.note && <p className="text-xs text-[hsl(var(--warning))] mt-1">{s.note}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete plan</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete taper plan?</AlertDialogTitle><AlertDialogDescription>This removes the plan permanently.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate()} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} filename={`taper-${(t.medication?.name || "plan").toLowerCase()}-meditrax.png`} title={`${t.medication?.name || "Taper"} plan · Meditrax`}>
        <TaperShareCard taper={t} medName={t.medication?.name} />
      </ShareDialog>
    </div>
  );
}
