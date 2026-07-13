import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import MedColorDot from "@/components/MedColorDot";
import { Button } from "@/components/ui/button";
import { getInventory, adjustInventory } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useUI } from "@/context/UIContext";
import { Package, Minus, Plus, Pill, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS = {
  ok: { l: "In stock", c: "bg-[hsl(var(--success-surface))] text-[hsl(var(--success))]" },
  low: { l: "Low", c: "bg-[hsl(var(--warning-surface))] text-[hsl(var(--warning))]" },
  out: { l: "Out", c: "bg-destructive/12 text-destructive" },
};

const CONFIDENCE = {
  high: { l: "high confidence", c: "text-[hsl(var(--success))]" },
  medium: { l: "medium confidence", c: "text-muted-foreground" },
  low: { l: "low confidence", c: "text-muted-foreground" },
};

function projectionLine(it) {
  if (it.days_left == null) {
    if (it.method === "prn") return "As needed — log doses to see a projection";
    if (it.method === "taper") return "Taper ends before stock runs out";
    return "No projection yet";
  }
  const parts = [`~${it.days_left} days left`];
  if (it.run_out_date) parts.push(`runs out ~${fmtDate(it.run_out_date, "MMM d")}`);
  if (it.refill_by_date && it.status !== "out") parts.push(`refill by ${fmtDate(it.refill_by_date, "MMM d")}`);
  return parts.join(" · ");
}

export default function Inventory() {
  const qc = useQueryClient();
  const ui = useUI();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["inventory"], queryFn: getInventory });

  const adjust = useMutation({
    mutationFn: ({ id, delta, set }) => adjustInventory(id, set != null ? { set } : { delta }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); qc.invalidateQueries({ queryKey: ["today"] }); },
  });

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Stock & refill projections" />
      <div className="px-4 space-y-3">
        {isLoading && [0, 1].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted/60 animate-pulse" />)}
        {!isLoading && items.length === 0 && (
          <EmptyState icon={Package} title="No tracked inventory" description="Turn on inventory tracking when adding or editing a medication to see refill projections."
            action={<Button onClick={() => ui.openAddMed()} className="rounded-xl">Add medication</Button>} />
        )}
        {items.map((it) => {
          const st = STATUS[it.status] || STATUS.ok;
          const conf = it.days_left != null ? CONFIDENCE[it.confidence] : null;
          const pct = it.refill_threshold ? Math.min(100, (it.current_count / (it.refill_threshold * 3)) * 100) : 50;
          return (
            <div key={it.medication_id} className="card-soft p-4">
              <div className="flex items-center gap-3">
                <MedColorDot color={it.color} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><p className="font-semibold truncate">{it.name}</p><span className={cn("text-[11px] rounded-full px-2 py-0.5 font-medium", st.c)}>{st.l}</span></div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="h-3 w-3 shrink-0" />
                    <span>{projectionLine(it)}</span>
                  </p>
                  {conf && (
                    <p className="text-[10px] text-muted-foreground">
                      {it.method === "prn" ? "based on your actual usage" : it.method === "taper" ? "based on your taper schedule" : it.method === "blended" ? "based on schedule + your history" : "based on your schedule"} · <span className={conf.c}>{conf.l}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full", it.status === "out" ? "bg-destructive" : it.status === "low" ? "bg-[hsl(var(--warning))]" : "bg-primary")} style={{ width: `${Math.max(4, pct)}%` }} /></div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => adjust.mutate({ id: it.medication_id, delta: -1 })} aria-label="Remove one" className="pressable h-9 w-9 rounded-full border border-border flex items-center justify-center"><Minus className="h-4 w-4" /></button>
                  {it.units_per_dose > 1 && (
                    <button onClick={() => adjust.mutate({ id: it.medication_id, delta: -it.units_per_dose })} data-testid="minus-dose-button" className="pressable h-9 px-3 rounded-full border border-border flex items-center gap-1 text-xs text-muted-foreground">
                      <Pill className="h-3.5 w-3.5" />−1 dose ({it.units_per_dose})
                    </button>
                  )}
                </div>
                <span className="font-display text-2xl font-semibold">{it.current_count}<span className="text-sm text-muted-foreground font-body font-normal ml-1">{it.unit}</span></span>
                <div className="flex items-center gap-2">
                  <button onClick={() => adjust.mutate({ id: it.medication_id, delta: 1 })} aria-label="Add one" className="pressable h-9 w-9 rounded-full border border-border flex items-center justify-center"><Plus className="h-4 w-4" /></button>
                  <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => { const v = window.prompt(`Set ${it.name} count`, it.current_count); if (v != null && !isNaN(Number(v))) { adjust.mutate({ id: it.medication_id, set: Number(v) }); toast.success("Inventory updated"); } }} data-testid="refill-button">Refill</Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
