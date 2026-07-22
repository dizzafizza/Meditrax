import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import MedColorDot from "@/components/MedColorDot";
import { RiskBadge } from "@/components/RiskBadge";
import ShareDialog, { MedicationShareCard } from "@/components/ShareDialog";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useUI } from "@/context/UIContext";
import { getMedication, deleteMedication, adjustInventory, getLogs, getCheckins, getSettings, getKnowledge } from "@/lib/api";
import { predictRunOut } from "@/lib/predictor";
import { analyzeMedication, SAFETY_COPY } from "@/lib/behavior";
import { doseLabel, FREQUENCY_LABELS, CATEGORY_LABELS, fmtTime12, fmtDate, riskTone, depTone, WEEKDAY_LABELS, relativeTime } from "@/lib/format";
import { Pencil, Trash2, Clock, Package, Pill, TrendingDown, Minus, Plus, ClipboardList, ChevronRight, RefreshCw, Share2, ShieldAlert, History, Check, X, SkipForward, MinusCircle } from "lucide-react";

export default function MedicationDetail() {
  const { id } = useParams();
  const ui = useUI();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const { data: med, isLoading } = useQuery({ queryKey: ["medication", id], queryFn: () => getMedication(id) });
  const { data: logs = [] } = useQuery({ queryKey: ["logs", id], queryFn: () => getLogs({ medication_id: id, limit: 500 }) });
  const { data: checkins = [] } = useQuery({ queryKey: ["checkins"], queryFn: () => getCheckins({ limit: 500 }) });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const { data: catalog = [] } = useQuery({ queryKey: ["knowledge", "all"], queryFn: () => getKnowledge() });

  const prediction = useMemo(
    () => (med?.inventory ? predictRunOut({ med, logs, taper: med.active_taper, settings: settings || {} }) : null),
    [med, logs, settings]
  );
  const usage = useMemo(() => {
    if (!med) return null;
    const catalogEntry = (med.catalog_id && catalog.find((c) => c.id === med.catalog_id)) || catalog.find((c) => c.name_lower === (med.name || "").toLowerCase()) || null;
    return analyzeMedication({ med, logs, checkins, catalogEntry, taper: med.active_taper });
  }, [med, logs, checkins, catalog]);

  const invMut = useMutation({
    mutationFn: (delta) => adjustInventory(id, { delta }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["medication", id] }); qc.invalidateQueries({ queryKey: ["inventory"] }); },
  });
  const delMut = useMutation({
    mutationFn: () => deleteMedication(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["medications"] }); qc.invalidateQueries({ queryKey: ["today"] }); toast.success("Medication deleted"); navigate("/medications"); },
  });

  if (isLoading || !med) return <div className="p-4"><PageHeader back title="" /><div className="px-4 h-40 rounded-2xl bg-muted/60 animate-pulse" /></div>;

  const inv = med.inventory;
  const sections = [
    { key: "side_effects", title: "Common side effects", items: med.side_effects },
    { key: "interactions", title: "Interactions", items: med.interactions },
    { key: "warnings", title: "Warnings", items: med.warnings },
  ].filter((s) => s.items && s.items.length);

  return (
    <div>
      <PageHeader back title={med.name} subtitle={doseLabel(med.strength, med.unit)}
        right={
          <div className="flex items-center gap-1">
            <button onClick={() => setShareOpen(true)} data-testid="share-medication-button" aria-label="Share medication" className="pressable h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center text-primary"><Share2 className="h-5 w-5" /></button>
            <button onClick={() => ui.openEditMed(med)} data-testid="edit-medication-button" className="pressable h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center text-primary"><Pencil className="h-5 w-5" /></button>
          </div>
        } />
      <div className="px-4 space-y-4">
        {/* Header card */}
        <div className="card-soft p-4 flex items-center gap-4">
          <MedColorDot color={med.color} size={56} />
          <div className="flex-1">
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{CATEGORY_LABELS[med.category] || med.category}</span>
              <RiskBadge tone={riskTone(med.risk_level)} label={`${med.risk_level} risk`} />
              {depTone(med.dependency_risk_category) && <RiskBadge tone="dependency" label={`${med.dependency_risk_category} dependency`} icon={false} />}
            </div>
            {med.drug_class && <p className="text-xs text-muted-foreground mt-1.5">{med.drug_class}</p>}
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3">
          {/* Ad-hoc log, not tied to a scheduled slot — pass no scheduled_time so
              it always creates its own entry and decrements its own inventory,
              instead of dedup-merging into (and silently swallowing) today's
              already-logged scheduled dose. Use the dose card on Today to log
              a specific scheduled slot. */}
          <ActionBtn icon={ClipboardList} label="Log dose" onClick={() => ui.openQuickLog(med, null, med.strength)} testid="detail-log-dose" />
          <ActionBtn icon={TrendingDown} label={med.is_tapering ? "View taper" : "Start taper"} onClick={() => navigate(`/taper?med=${med.id}`)} testid="detail-start-taper" />
          <ActionBtn icon={RefreshCw} label="Cyclic" onClick={() => navigate(`/cyclic?med=${med.id}`)} testid="detail-cyclic" />
        </div>

        {/* Schedule */}
        <div className="card-soft p-4">
          <div className="flex items-center gap-2 mb-3"><Clock className="h-4 w-4 text-primary" /><p className="font-semibold">Schedule</p></div>
          <p className="text-sm">{FREQUENCY_LABELS[med.frequency] || med.frequency}</p>
          {!med.is_prn && med.times?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {med.times.map((t) => <span key={t} className="rounded-full bg-accent text-accent-foreground text-sm px-3 py-1">{fmtTime12(t)}</span>)}
            </div>
          )}
          {!med.is_prn && med.days_of_week?.length < 7 && (
            <p className="text-xs text-muted-foreground mt-2">{med.days_of_week.map((d) => WEEKDAY_LABELS[d]).join(", ")}</p>
          )}
          {med.instructions && <p className="text-sm text-muted-foreground mt-2">{med.instructions}</p>}
        </div>

        {/* Inventory */}
        {inv && (
          <div className="card-soft p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" /><p className="font-semibold">Inventory</p></div>
              <Link to="/inventory" className="text-xs text-primary font-medium">Details</Link>
            </div>
            <div className="flex items-center justify-between">
              <button onClick={() => invMut.mutate(-1)} className="pressable h-10 w-10 rounded-full border border-border flex items-center justify-center"><Minus className="h-4 w-4" /></button>
              <div className="text-center"><p className="font-display text-3xl font-semibold">{inv.current_count}</p><p className="text-xs text-muted-foreground">{inv.unit} remaining</p></div>
              <button onClick={() => invMut.mutate(1)} className="pressable h-10 w-10 rounded-full border border-border flex items-center justify-center"><Plus className="h-4 w-4" /></button>
            </div>
            {prediction && prediction.run_out_date && (
              <p className="text-xs text-muted-foreground text-center mt-2" data-testid="detail-prediction">
                Runs out ~{fmtDate(prediction.run_out_date, "MMM d")}{prediction.refill_by_date ? ` · refill by ${fmtDate(prediction.refill_by_date, "MMM d")}` : ""} · {prediction.confidence} confidence
              </p>
            )}
            {prediction && !prediction.run_out_date && med.is_prn && (
              <p className="text-xs text-muted-foreground text-center mt-2">As-needed — log doses to build a refill projection.</p>
            )}
          </div>
        )}

        {/* Usage patterns (behaviour / dependency signals) */}
        {usage && usage.applicable && usage.data_quality !== "insufficient" && usage.level !== "none" && (
          <div className="card-soft p-4" data-testid="usage-patterns-card">
            <div className="flex items-center gap-2 mb-2"><ShieldAlert className="h-4 w-4 text-primary" /><p className="font-semibold">Usage patterns</p>
              <span className="ml-auto text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground capitalize">{usage.level}</span>
            </div>
            <div className="space-y-2">
              {usage.signals.slice(0, 3).map((s) => (
                <div key={s.id} className="rounded-xl bg-muted/40 px-3 py-2">
                  <p className="text-sm font-medium">{s.label}</p>
                  {s.detail && <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>}
                </div>
              ))}
            </div>
            {usage.suggested_actions.map((a, i) => a.link ? (
              <Link key={i} to={a.link} className="block text-xs text-primary mt-2">{a.text} →</Link>
            ) : (
              <p key={i} className="text-xs text-muted-foreground mt-2">{a.text}</p>
            ))}
            <p className="text-[10px] text-muted-foreground mt-3">{SAFETY_COPY.framing}</p>
          </div>
        )}

        {/* Recent history — tap a log to edit its time, amount, status or notes */}
        {logs.length > 0 && (
          <div className="card-soft p-4" data-testid="log-history-card">
            <div className="flex items-center gap-2 mb-3"><History className="h-4 w-4 text-primary" /><p className="font-semibold">History</p>
              <span className="ml-auto text-[11px] text-muted-foreground">tap to edit</span>
            </div>
            <div className="divide-y divide-border -mx-1">
              {logs.slice(0, 8).map((l) => <LogHistoryRow key={l.id} log={l} med={med} onTap={() => ui.openEditLog(l, med)} />)}
            </div>
            {logs.length > 8 && <p className="text-[11px] text-muted-foreground text-center mt-2">Showing the 8 most recent of {logs.length} logs</p>}
          </div>
        )}

        {/* Active taper */}
        {med.active_taper && (
          <Link to={`/taper/${med.active_taper.id}`} className="block card-soft p-4 pressable">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center"><TrendingDown className="h-5 w-5" /></div>
              <div className="flex-1"><p className="font-semibold text-sm">Active taper plan</p><p className="text-xs text-muted-foreground capitalize">{med.active_taper.method} · {med.active_taper.initial_dose}→{med.active_taper.final_dose} {med.active_taper.unit}</p></div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </Link>
        )}

        {/* Sections */}
        {sections.length > 0 && (
          <div className="card-soft px-2">
            <Accordion type="multiple">
              {sections.map((s) => (
                <AccordionItem key={s.key} value={s.key} className="border-border">
                  <AccordionTrigger className="px-2 text-sm font-semibold">{s.title}</AccordionTrigger>
                  <AccordionContent className="px-2">
                    <ul className="list-disc pl-4 space-y-1 text-sm text-muted-foreground">{s.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}

        {med.notes && <div className="card-soft p-4"><p className="font-semibold text-sm mb-1">Notes</p><p className="text-sm text-muted-foreground">{med.notes}</p></div>}

        {/* Delete */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" data-testid="delete-medication-button"><Trash2 className="h-4 w-4 mr-2" />Delete medication</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete {med.name}?</AlertDialogTitle><AlertDialogDescription>This removes the medication and all its logs, reminders and taper plans. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => delMut.mutate()} className="bg-destructive text-destructive-foreground" data-testid="confirm-delete">Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} filename={`${(med.name || "medication").toLowerCase()}-meditrax.png`} title={`${med.name} · Meditrax`}>
        <MedicationShareCard med={med} />
      </ShareDialog>
    </div>
  );
}

const LOG_STATUS_META = {
  taken: { icon: Check, cls: "text-[hsl(var(--success))]" },
  partial: { icon: MinusCircle, cls: "text-[hsl(var(--warning))]" },
  skipped: { icon: SkipForward, cls: "text-muted-foreground" },
  missed: { icon: X, cls: "text-destructive" },
};

function LogHistoryRow({ log, med, onTap }) {
  const meta = LOG_STATUS_META[log.status] || LOG_STATUS_META.taken;
  const Icon = meta.icon;
  const amount = log.dose_taken != null ? doseLabel(log.dose_taken, log.unit || med.unit) : (log.quantity ? `${log.quantity} ${med.form === "capsule" ? "caps" : "pills"}` : null);
  return (
    <button onClick={onTap} data-testid="log-history-row" className="w-full flex items-center gap-3 px-1 py-2.5 text-left pressable">
      <span className={meta.cls}><Icon className="h-4 w-4" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{relativeTime(log.timestamp)}</p>
        <p className="text-xs text-muted-foreground">
          <span className="capitalize">{log.status}</span>{amount ? ` · ${amount}` : ""}{log.scheduled_time ? ` · ${fmtTime12(log.scheduled_time)} dose` : ""}{log.notes ? " · 📝" : ""}
        </p>
      </div>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

function ActionBtn({ icon: Icon, label, onClick, testid }) {
  return (
    <button onClick={onClick} data-testid={testid} className="card-soft p-3 pressable flex flex-col items-center gap-1.5">
      <Icon className="h-5 w-5 text-primary" /><span className="text-xs font-medium">{label}</span>
    </button>
  );
}
