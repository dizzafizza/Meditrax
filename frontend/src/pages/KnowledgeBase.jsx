import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { RiskBadge } from "@/components/RiskBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getKnowledge, getKnowledgeCategories, autofillMedication } from "@/lib/api";
import { CATEGORY_LABELS, riskTone, depTone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Search, BookOpen, Sparkles, ChevronRight } from "lucide-react";

export default function KnowledgeBase() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const { data: items = [], isLoading } = useQuery({ queryKey: ["knowledge", q, cat], queryFn: () => getKnowledge(q, cat) });
  const { data: cats = [] } = useQuery({ queryKey: ["knowledge-cats"], queryFn: getKnowledgeCategories });

  const autofill = useMutation({
    mutationFn: () => autofillMedication(q),
    onSuccess: (res) => { toast.success(`Added ${res.medication.name} to the knowledge base`); navigate(`/knowledge/${res.medication.id}`); },
    onError: (e) => toast.error(e?.message || "Couldn't find that medication"),
  });

  return (
    <div>
      <PageHeader title="Knowledge Base" subtitle="Learn about medications" />
      <div className="px-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="knowledge-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any medication…" className="pl-9 h-11 rounded-xl" />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {["all", ...cats].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={cn("shrink-0 rounded-full px-4 h-9 text-sm font-medium border", cat === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>{c === "all" ? "All" : (CATEGORY_LABELS[c] || c)}</button>
          ))}
        </div>

        {isLoading && [0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted/60 animate-pulse" />)}

        {!isLoading && items.length === 0 && (
          <EmptyState icon={Sparkles} title={`No results for "${q}"`} description="Let the AI research this medication and add it to your knowledge base."
            action={q.trim() && <Button onClick={() => autofill.mutate()} disabled={autofill.isPending} className="rounded-xl" data-testid="knowledge-ai-add"><Sparkles className="h-4 w-4 mr-1" />{autofill.isPending ? "Researching…" : `Research "${q}" with AI`}</Button>} />
        )}

        <div className="space-y-2.5">
          {items.map((it) => (
            <button key={it.id} data-testid="knowledge-article-card" onClick={() => navigate(`/knowledge/${it.id}`)} className="w-full card-soft p-4 pressable text-left">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><p className="font-semibold truncate">{it.name}</p>{it.source === "ai" && <span className="text-[10px] rounded-full bg-primary/12 text-primary px-1.5 py-0.5">AI</span>}</div>
                  <p className="text-xs text-muted-foreground truncate">{it.drug_class}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{it.content}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{CATEGORY_LABELS[it.category] || it.category}</span>
                {it.risk_level === "high" && <RiskBadge tone="high" label="High risk" icon={false} />}
                {depTone(it.dependency_risk_category) === "high" && <RiskBadge tone="dependency" label="Dependency" icon={false} />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
