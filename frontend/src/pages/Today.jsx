import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import AdherenceRing from "@/components/AdherenceRing";
import EmptyState from "@/components/EmptyState";
import MedColorDot from "@/components/MedColorDot";
import { RiskBadge } from "@/components/RiskBadge";
import { Button } from "@/components/ui/button";
import { useUI } from "@/context/UIContext";
import ProfileSwitcher from "@/components/ProfileSwitcher";
import { getToday, getAnalytics, createLog, deleteLog, getLog, getCheckins } from "@/lib/api";
import { greeting, fmtDate, fmtTime12, timeOfDay, doseLabel, depTone, riskTone } from "@/lib/format";
import { localDateStr } from "@/lib/dates";
import { Check, SkipForward, Clock, Pill, Flame, AlertTriangle, ChevronRight, Sparkles, Plus, Smile } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Today() {
  const ui = useUI();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["today"], queryFn: () => getToday() });
  const { data: analytics } = useQuery({ queryKey: ["analytics", 30], queryFn: () => getAnalytics(30) });
  const { data: todayCheckins = [] } = useQuery({
    queryKey: ["checkins", "today"],
    queryFn: () => { const s = localDateStr(); return getCheckins({ start: s, end: s }); },
  });

  const invalidate = () => ["today", "analytics", "inventory", "logs", "medications", "medication"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const logMut = useMutation({
    mutationFn: ({ _name, ...payload }) => createLog(payload),
    onSuccess: (log, vars) => {
      invalidate();
      if (navigator.vibrate) try { navigator.vibrate(10); } catch {}
      toast.success(vars.status === "taken" ? `${vars._name} marked taken` : `${vars._name} skipped`, {
        action: {
          label: "Undo",
          onClick: () => deleteLog(log.id).then(invalidate).catch(() => toast.error("Could not undo")),
        },
      });
    },
    onError: () => toast.error("Could not update dose"),
  });

  const quickLog = (dose, status) => {
    const quantity = status === "taken" ? (dose.dose_quantity || 1) : 0;
    logMut.mutate({
      medication_id: dose.medication_id, scheduled_time: dose.scheduled_time, status,
      quantity: status === "taken" ? quantity : undefined,
      dose_taken: status === "taken" && dose.strength != null ? dose.strength * quantity : null,
      unit: dose.unit, _name: dose.name,
    });
  };

  // Tapping a dose that's already logged opens the existing log for editing
  // (previously this opened a blank sheet whose save dedup-overwrote the log,
  // resetting its time to now and wiping notes/mood).
  const openDose = async (d) => {
    const medLike = { id: d.medication_id, name: d.name, color: d.color, strength: d.strength, unit: d.unit, is_prn: false, dose_quantity: d.dose_quantity || 1 };
    if (d.log_id) {
      try {
        const log = await getLog(d.log_id);
        if (log) return ui.openEditLog(log, medLike);
      } catch {}
    }
    ui.openQuickLog(medLike, d.scheduled_time, d.strength);
  };

  const grouped = useMemo(() => {
    const groups = {};
    (data?.doses || []).forEach((d) => {
      const g = timeOfDay(d.time);
      (groups[g] = groups[g] || []).push(d);
    });
    return groups;
  }, [data]);

  const nextDose = useMemo(() => {
    const now = new Date();
    const pending = (data?.doses || []).filter((d) => d.status === "pending");
    const upcoming = pending.map((d) => {
      const [h, m] = d.time.split(":").map(Number);
      const dt = new Date(); dt.setHours(h, m, 0, 0);
      return { d, dt };
    }).filter((x) => x.dt >= now).sort((a, b) => a.dt - b.dt);
    return upcoming[0]?.d || pending[0] || null;
  }, [data]);

  const summary = data?.summary || { total: 0, taken: 0, pending: 0, adherence: 100 };
  const order = ["Morning", "Afternoon", "Evening", "Night"];

  return (
    <div>
      <PageHeader
        large
        title={greeting()}
        subtitle={fmtDate(new Date(), "EEEE, MMMM d")}
        right={<ProfileSwitcher />}
      />

      <div className="px-4 space-y-4">
        {/* Hero */}
        <div className="card-soft hero-wash p-5 animate-rise">
          <div className="flex items-center gap-5">
            <AdherenceRing value={summary.adherence} label={`${summary.adherence}%`} sublabel="today" />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm">
                <Flame className="h-4 w-4 text-[hsl(var(--warning))]" />
                <span data-testid="adherence-streak" className="font-semibold">{analytics?.current_streak || 0} day streak</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {summary.total === 0 ? "No doses scheduled today." : `${summary.taken} of ${summary.total} doses taken`}
              </p>
              {nextDose ? (
                <div data-testid="next-dose-countdown" className="mt-3 inline-flex items-center gap-2 rounded-full bg-card/80 border border-border px-3 py-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm"><span className="font-semibold">{nextDose.name}</span> at {fmtTime12(nextDose.time)}</span>
                </div>
              ) : summary.total > 0 ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--success-surface))] text-[hsl(var(--success))] px-3 py-1.5">
                  <Check className="h-4 w-4" /><span className="text-sm font-medium">All caught up</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Refill alerts */}
        {(data?.refill_alerts || []).length > 0 && (
          <Link to="/inventory" className="block card-soft p-4 border-[hsl(var(--warning-border))]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[hsl(var(--warning-surface))] text-[hsl(var(--warning))] flex items-center justify-center"><AlertTriangle className="h-5 w-5" /></div>
              <div className="flex-1">
                <p className="font-semibold text-sm">Refill soon</p>
                <p className="text-xs text-muted-foreground">
                  {data.refill_alerts.map((a) => a.type === "out" ? `${a.name} is out` : `${a.name}${a.run_out_date ? ` — runs out ~${fmtDate(a.run_out_date, "MMM d")}` : ""}`).join(" · ")}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Link>
        )}

        {/* Mood check-in nudge */}
        {!isLoading && todayCheckins.length === 0 && (
          <button onClick={ui.openCheckin} data-testid="checkin-card" className="block w-full text-left card-soft p-4 pressable">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center"><Smile className="h-5 w-5" /></div>
              <div className="flex-1"><p className="font-semibold text-sm">How are you feeling today?</p><p className="text-xs text-muted-foreground">A 10-second check-in improves your mood & behaviour insights</p></div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </button>
        )}

        {/* Loading */}
        {isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted/60 animate-pulse" />)}</div>}

        {/* Empty */}
        {!isLoading && summary.total === 0 && (data?.prn || []).length === 0 && (
          <EmptyState icon={Pill} title="No medications yet" description="Add your first medication to start tracking doses, adherence and refills."
            action={<Button onClick={() => ui.openAddMed()} className="rounded-xl" data-testid="empty-add-med"><Plus className="h-4 w-4 mr-1" />Add medication</Button>} />
        )}

        {/* Dose groups */}
        {order.filter((g) => grouped[g]?.length).map((g) => (
          <div key={g}>
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{g}</p>
            <div className="space-y-2.5">
              {grouped[g].map((d) => <DoseCard key={d.id} dose={d} onTake={() => quickLog(d, "taken")} onSkip={() => quickLog(d, "skipped")} onTap={() => openDose(d)} />)}
            </div>
          </div>
        ))}

        {/* PRN */}
        {(data?.prn || []).length > 0 && (
          <div>
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">As needed</p>
            <div className="space-y-2.5">
              {data.prn.map((m) => (
                <div key={m.medication_id} className="card-soft p-3 flex items-center gap-3">
                  <MedColorDot color={m.color} size={42} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{doseLabel(m.strength, m.unit)} · as needed</p>
                  </div>
                  <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => ui.openQuickLog({ id: m.medication_id, name: m.name, color: m.color, strength: m.strength, unit: m.unit, is_prn: true, dose_quantity: m.dose_quantity || 1 })} data-testid="prn-log-button">Log</Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assistant nudge */}
        <Link to="/assistant" className="block card-soft p-4 pressable">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center"><Sparkles className="h-5 w-5" /></div>
            <div className="flex-1"><p className="font-semibold text-sm">Ask the Meditrax assistant</p><p className="text-xs text-muted-foreground">Questions about your meds, tapering or side effects</p></div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </Link>
      </div>
    </div>
  );
}

function DoseCard({ dose, onTake, onSkip, onTap }) {
  const done = dose.status === "taken" || dose.status === "partial";
  const skipped = dose.status === "skipped" || dose.status === "missed";
  return (
    <div data-testid="dose-card" className={cn("card-soft p-3 transition-opacity", (done || skipped) && "opacity-70")}>
      <div className="flex items-center gap-3">
        <MedColorDot color={dose.color} size={44} />
        <button onClick={onTap} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">{dose.name}</p>
            {depTone(dose.dependency_risk_category) === "high" && <RiskBadge tone="dependency" label="Dependency" icon={false} />}
          </div>
          <p className="text-xs text-muted-foreground">
            {fmtTime12(dose.time)} · {dose.taper_dose != null ? `${dose.taper_dose} ${dose.taper_unit} (taper)` : doseLabel(dose.strength, dose.unit)}
            {dose.instructions ? ` · ${dose.instructions}` : ""}
          </p>
        </button>
        {done ? (
          <span className="inline-flex items-center gap-1 text-[hsl(var(--success))] text-sm font-medium pr-1"><Check className="h-4 w-4" />Done</span>
        ) : skipped ? (
          <span className="text-muted-foreground text-sm pr-1 capitalize">{dose.status}</span>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={onSkip} data-testid="dose-skip-button" aria-label="Skip" className="pressable h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground"><SkipForward className="h-4 w-4" /></button>
            <button onClick={onTake} data-testid="dose-take-button" aria-label="Take" className="pressable h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Check className="h-5 w-5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
