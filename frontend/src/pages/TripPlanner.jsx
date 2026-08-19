import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import MedColorDot from "@/components/MedColorDot";
import EmptyState from "@/components/EmptyState";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { planTrip } from "@/lib/api";
import { localDateStr, addDaysStr, parseLocalDate } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Luggage, MinusCircle, PlusCircle, AlertTriangle, CheckCircle2, HelpCircle, Copy, TrendingDown } from "lucide-react";

// Human unit label: "capsules" for a capsule med, the inventory unit otherwise.
function unitLabel(item) {
  if (item.form === "capsule") return "capsules";
  if (item.form === "tablet") return "tablets";
  return item.unit || "units";
}

export default function TripPlanner() {
  const today = localDateStr();
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDaysStr(today, 6));
  const [buffer, setBuffer] = useState(2);

  const valid = start && end && parseLocalDate(end) >= parseLocalDate(start);
  const { data: plan, error, isLoading } = useQuery({
    queryKey: ["tripPlan", start, end, buffer],
    queryFn: () => planTrip({ start, end, buffer_days: buffer }),
    enabled: !!valid,
  });

  async function copyList() {
    if (!plan?.items?.length) return;
    const lines = [
      `Meditrax packing list — ${fmtDate(parseLocalDate(plan.start), "MMM d")} to ${fmtDate(parseLocalDate(plan.end), "MMM d")} (${plan.days} days + ${plan.buffer_days} buffer)`,
      ...plan.items.map((it) => it.basis === "unknown"
        ? `• ${it.name}: as-needed — no usage history, pack your judgment`
        : `• ${it.name}: ${it.total_units} ${unitLabel(it)}${it.shortfall ? ` (SHORT BY ${it.shortfall} — refill first)` : ""}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Packing list copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div>
      <PageHeader back title="Vacation Planner" subtitle="Pack enough to last the whole trip" />
      <div className="px-4 space-y-4 pb-8">
        <div className="card-soft p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Leaving</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-11 rounded-xl mt-1" data-testid="trip-start" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Back</Label>
              <Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="h-11 rounded-xl mt-1" data-testid="trip-end" />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Buffer days</p>
              <p className="text-xs text-muted-foreground">Extra slack for delays or a lost dose</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setBuffer((b) => Math.max(0, b - 1))} aria-label="Fewer buffer days" data-testid="trip-buffer-minus" className="pressable h-9 w-9 rounded-xl border border-border flex items-center justify-center"><MinusCircle className="h-4 w-4" /></button>
              <span className="w-6 text-center font-display text-lg font-semibold" data-testid="trip-buffer">{buffer}</span>
              <button onClick={() => setBuffer((b) => Math.min(14, b + 1))} aria-label="More buffer days" data-testid="trip-buffer-plus" className="pressable h-9 w-9 rounded-xl border border-border flex items-center justify-center"><PlusCircle className="h-4 w-4" /></button>
            </div>
          </div>
          {!valid && <p className="text-xs text-destructive">The return date must be on or after the departure date.</p>}
          {error && <p className="text-xs text-destructive">{error.message}</p>}
        </div>

        {plan && plan.shortfalls > 0 && (
          <div className="rounded-xl bg-[hsl(var(--risk-high-bg))] text-[hsl(var(--risk-high-fg))] px-3 py-2.5 text-sm flex items-center gap-2" data-testid="trip-shortfall-banner">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {plan.shortfalls === 1 ? "1 medication needs a refill before you go." : `${plan.shortfalls} medications need a refill before you go.`}
          </div>
        )}

        {plan && !plan.items.length && !isLoading && (
          <EmptyState icon={Luggage} title="Nothing to pack" description="No active medications have doses due during this trip." />
        )}

        {plan?.items.map((it) => (
          <div key={it.medication_id} className="card-soft p-4" data-testid="trip-item">
            <div className="flex items-center gap-3">
              <MedColorDot color={it.color} size={40} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{it.name}</p>
                {it.basis === "unknown" ? (
                  <p className="text-xs text-muted-foreground">As needed · no usage history to estimate from</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {it.trip_units} for {it.days} days + {it.buffer_units} buffer
                    {it.is_prn && it.per_day != null ? ` · ~${it.per_day}/day from your actual use` : ""}
                  </p>
                )}
              </div>
              {it.basis === "unknown" ? (
                <span className="inline-flex items-center gap-1 text-[11px] rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground"><HelpCircle className="h-3 w-3" />Your call</span>
              ) : (
                <div className="text-right shrink-0">
                  <p className="font-display text-2xl font-semibold leading-none" data-testid="trip-item-total">{it.total_units}</p>
                  <p className="text-[11px] text-muted-foreground">{unitLabel(it)}</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {it.enough === true && (
                <span className="inline-flex items-center gap-1 text-[11px] rounded-full bg-[hsl(var(--success-surface))] text-[hsl(var(--success))] px-2.5 py-1 font-medium"><CheckCircle2 className="h-3 w-3" />Stock covers it ({it.current_stock} on hand)</span>
              )}
              {it.shortfall != null && it.shortfall > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] rounded-full bg-[hsl(var(--risk-high-bg))] text-[hsl(var(--risk-high-fg))] px-2.5 py-1 font-medium" data-testid="trip-item-short"><AlertTriangle className="h-3 w-3" />Short by {it.shortfall} — refill first</span>
              )}
              {it.enough == null && it.basis !== "unknown" && (
                <span className="text-[11px] text-muted-foreground">Inventory not tracked for this medication</span>
              )}
              {it.is_tapering && (
                <span className="inline-flex items-center gap-1 text-[11px] rounded-full bg-accent text-accent-foreground px-2.5 py-1 font-medium"><TrendingDown className="h-3 w-3" />Taper continues — declining doses already counted</span>
              )}
              {it.is_prn && it.basis === "usage" && it.confidence && it.confidence !== "high" && (
                <span className="text-[11px] text-muted-foreground">Estimate confidence: {it.confidence}</span>
              )}
            </div>
          </div>
        ))}

        {plan?.items?.length > 0 && (
          <button onClick={copyList} data-testid="trip-copy" className="w-full pressable rounded-xl border border-border bg-card h-12 font-medium flex items-center justify-center gap-2">
            <Copy className="h-4 w-4" />Copy packing list
          </button>
        )}

        <p className="text-[11px] text-muted-foreground px-1">
          Scheduled amounts are simulated day by day through your actual schedules — weekday patterns, cyclic off-days and taper reductions during the trip are all counted. As-needed amounts use your real average daily use. Pack a little extra for controlled or hard-to-replace medications, and keep them in original packaging when crossing borders.
        </p>
      </div>
    </div>
  );
}
