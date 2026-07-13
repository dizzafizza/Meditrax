import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import MedColorDot from "@/components/MedColorDot";
import { RiskBadge } from "@/components/RiskBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUI } from "@/context/UIContext";
import { getMedications } from "@/lib/api";
import { doseLabel, FREQUENCY_LABELS, CATEGORY_LABELS, fmtTime12, riskTone, depTone } from "@/lib/format";
import { Search, Plus, Pill, ChevronRight, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FILTERS = [
  { v: "all", l: "All" }, { v: "scheduled", l: "Scheduled" },
  { v: "prn", l: "PRN" }, { v: "tapering", l: "Tapering" },
];

export default function Medications() {
  const ui = useUI();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const { data: meds = [], isLoading } = useQuery({ queryKey: ["medications"], queryFn: () => getMedications(true) });

  const filtered = useMemo(() => {
    return meds.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (filter === "prn") return m.is_prn;
      if (filter === "scheduled") return !m.is_prn;
      if (filter === "tapering") return m.is_tapering;
      return true;
    });
  }, [meds, q, filter]);

  return (
    <div>
      <PageHeader title="Medications" subtitle={`${meds.length} tracked`}
        right={<button onClick={() => ui.openAddMed()} data-testid="add-medication-button" className="pressable h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Plus className="h-5 w-5" /></button>} />
      <div className="px-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="medications-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search medications" className="pl-9 h-11 rounded-xl" />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <button key={f.v} data-testid="filter-chip" onClick={() => setFilter(f.v)}
              className={cn("shrink-0 rounded-full px-4 h-9 text-sm font-medium border", filter === f.v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>{f.l}</button>
          ))}
        </div>

        {isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted/60 animate-pulse" />)}</div>}

        {!isLoading && filtered.length === 0 && (
          <EmptyState icon={Pill} title={meds.length ? "No matches" : "No medications yet"}
            description={meds.length ? "Try a different search or filter." : "Add a medication to begin tracking."}
            action={!meds.length && <Button onClick={() => ui.openAddMed()} className="rounded-xl"><Plus className="h-4 w-4 mr-1" />Add medication</Button>} />
        )}

        <div className="space-y-2.5">
          {filtered.map((m) => (
            <button key={m.id} data-testid="medication-card" onClick={() => navigate(`/medications/${m.id}`)} className="w-full card-soft p-3.5 pressable text-left">
              <div className="flex items-center gap-3">
                <MedColorDot color={m.color} size={46} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{m.name}</p>
                    {m.is_tapering && <span className="inline-flex items-center gap-0.5 text-[11px] text-primary font-medium"><TrendingDown className="h-3 w-3" />Tapering</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {doseLabel(m.strength, m.unit)} · {FREQUENCY_LABELS[m.frequency] || m.frequency}
                    {!m.is_prn && m.times?.length ? ` · ${m.times.map(fmtTime12).join(", ")}` : ""}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{CATEGORY_LABELS[m.category] || m.category}</span>
                    {m.risk_level === "high" && <RiskBadge tone="high" label="High risk" icon={false} />}
                    {depTone(m.dependency_risk_category) === "high" && <RiskBadge tone="dependency" label="Dependency" icon={false} />}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
