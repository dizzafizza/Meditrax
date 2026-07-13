import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useUI } from "@/context/UIContext";
import { getMedications } from "@/lib/api";
import MedColorDot from "@/components/MedColorDot";
import { Pill, ClipboardCheck, Sparkles, TrendingDown } from "lucide-react";
import { doseLabel } from "@/lib/format";

export default function QuickAddSheet() {
  const ui = useUI();
  const navigate = useNavigate();
  const { data: meds = [] } = useQuery({ queryKey: ["medications"], queryFn: () => getMedications(true), enabled: ui.quickAdd });
  const active = meds.filter((m) => m.is_active !== false);

  const go = (fn) => { ui.closeQuickAdd(); setTimeout(fn, 120); };

  return (
    <Drawer open={ui.quickAdd} onOpenChange={(o) => !o && ui.closeQuickAdd()}>
      <DrawerContent className="max-w-2xl mx-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-2xl">Quick actions</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2 grid grid-cols-2 gap-3">
          <ActionTile testid="quick-add-medication" icon={Pill} title="Add medication" desc="Track a new med" onClick={() => go(() => ui.openAddMed())} />
          <ActionTile testid="quick-add-taper" icon={TrendingDown} title="Taper planner" desc="Build a plan" onClick={() => go(() => navigate("/taper"))} />
          <ActionTile testid="quick-add-assistant" icon={Sparkles} title="Ask the assistant" desc="AI guidance" onClick={() => go(() => navigate("/assistant"))} />
          <ActionTile testid="quick-add-knowledge" icon={ClipboardCheck} title="Knowledge base" desc="Look up a drug" onClick={() => go(() => navigate("/knowledge"))} />
        </div>
        {active.length > 0 && (
          <div className="px-4 pb-6 pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Log a dose</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {active.map((m) => (
                <button
                  key={m.id}
                  data-testid="quick-add-log-med"
                  onClick={() => go(() => ui.openQuickLog(m, m.times?.[0] || null))}
                  className="pressable shrink-0 w-28 card-soft p-3 text-left"
                >
                  <MedColorDot color={m.color} size={34} />
                  <p className="mt-2 text-sm font-semibold truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{doseLabel(m.strength, m.unit)}</p>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="safe-bottom h-2" />
      </DrawerContent>
    </Drawer>
  );
}

function ActionTile({ icon: Icon, title, desc, onClick, testid }) {
  return (
    <button onClick={onClick} data-testid={testid} className="pressable card-soft p-4 text-left">
      <div className="h-11 w-11 rounded-xl bg-primary/12 text-primary flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </button>
  );
}
