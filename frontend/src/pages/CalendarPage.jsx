import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import { Calendar } from "@/components/ui/calendar";
import MedColorDot from "@/components/MedColorDot";
import EmptyState from "@/components/EmptyState";
import { getAnalytics, getToday } from "@/lib/api";
import { fmtDate, fmtTime12, doseLabel } from "@/lib/format";
import { localDateStr } from "@/lib/dates";
import { CalendarDays, Check, X } from "lucide-react";
import { parseISO } from "date-fns";

export default function CalendarPage() {
  const [selected, setSelected] = useState(new Date());
  const { data: analytics } = useQuery({ queryKey: ["analytics", 90], queryFn: () => getAnalytics(90) });
  const dateStr = localDateStr(selected);
  const { data: day } = useQuery({ queryKey: ["today", dateStr], queryFn: () => getToday(dateStr) });

  const { perfect, partial, missed } = useMemo(() => {
    const p = [], pa = [], mi = [];
    (analytics?.trend || []).forEach((t) => {
      if (t.expected === 0) return;
      const d = parseISO(t.date);
      if (t.adherence === 100) p.push(d);
      else if (t.taken > 0) pa.push(d);
      else mi.push(d);
    });
    return { perfect: p, partial: pa, missed: mi };
  }, [analytics]);

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Your adherence history" />
      <div className="px-4 space-y-4">
        <div className="card-soft p-2 flex justify-center" data-testid="adherence-calendar">
          <Calendar
            mode="single" selected={selected} onSelect={(d) => d && setSelected(d)}
            modifiers={{ perfect, partial, missed }}
            modifiersClassNames={{
              perfect: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-[hsl(var(--success))]",
              partial: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-[hsl(var(--warning))]",
              missed: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-destructive",
            }}
          />
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />Perfect</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(var(--warning))]" />Partial</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" />Missed</span>
        </div>

        <div>
          <p className="px-1 font-display text-lg font-semibold mb-2">{fmtDate(selected, "EEEE, MMMM d")}</p>
          {(day?.doses || []).length === 0 && (day?.prn || []).length === 0 ? (
            <EmptyState icon={CalendarDays} title="No doses" description="Nothing was scheduled on this day." />
          ) : (
            <div className="space-y-2.5">
              {(day?.doses || []).map((d) => (
                <div key={d.id} className="card-soft p-3 flex items-center gap-3">
                  <MedColorDot color={d.color} size={40} />
                  <div className="flex-1 min-w-0"><p className="font-semibold truncate">{d.name}</p><p className="text-xs text-muted-foreground">{fmtTime12(d.time)} · {doseLabel(d.strength, d.unit)}</p></div>
                  {(d.status === "taken" || d.status === "partial") ? <span className="text-[hsl(var(--success))]"><Check className="h-5 w-5" /></span>
                    : d.status === "pending" ? <span className="text-xs text-muted-foreground">pending</span>
                    : <span className="text-destructive"><X className="h-5 w-5" /></span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
