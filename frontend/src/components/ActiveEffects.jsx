import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import MedColorDot from "@/components/MedColorDot";
import { RiskBadge } from "@/components/RiskBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getActiveEffectSessions, addEffectEvent, deleteEffectEvent, endEffectSession, reopenEffectSession, startEffectSession, updateEffectSession, resetEffectModel, addEffectDose, removeEffectDose, getMedicationMaxDaily, getLogs, getMedications } from "@/lib/api";
import { phaseAt, fmtMins, sessionDoseStack, stackedIntensityAt, stackChartEnd, stackedCurveSeries } from "@/lib/effectsEngine";
import { checkInteractions, severityMeta } from "@/lib/interactions";
import { redoseWarnings } from "@/lib/redoseSafety";
import { fmtDate, doseLabel, relativeTime, toDatetimeLocal, MED_COLORS } from "@/lib/format";
import { Activity, AlertTriangle, ChevronRight, X, Zap, TrendingUp, TrendingDown, CheckCircle2, Play, Pencil, Layers, Plus } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceDot, CartesianGrid } from "recharts";

// Re-render on a timer so curves/labels track the clock while a session runs.
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const elapsedMin = (session, now) => Math.max(0, (now - new Date(session.started_at).getTime()) / 60000);

function useActiveSessions() {
  return useQuery({
    queryKey: ["effectSessions", "active"],
    queryFn: getActiveEffectSessions,
    refetchInterval: 60000,
  });
}

// ---- simplified card (home screen) ----
export function ActiveEffectsSimple() {
  const navigate = useNavigate();
  const now = useNow(30000);
  const { data: sessions = [] } = useActiveSessions();
  if (!sessions.length) return null;
  return (
    <div className="space-y-2.5" data-testid="active-effects-simple">
      {sessions.map((s) => {
        const t = elapsedMin(s, now);
        const p = s.profile;
        const stack = sessionDoseStack(s);
        const lastOffset = stack[stack.length - 1].tOffset;
        // Phase and remaining track the most recent dose so a redose is
        // reflected as "coming up again" with time added back on.
        const phase = phaseAt(t - lastOffset, p);
        const intensity = Math.round(stackedIntensityAt(t, p, stack));
        const chartEnd = lastOffset + p.duration_min;
        const pct = Math.min(100, (t / chartEnd) * 100);
        const remaining = Math.max(0, chartEnd - t);
        return (
          <button key={s.id} onClick={() => navigate("/effects")} data-testid="active-effects-card" className="w-full text-left card-soft p-3 pressable">
            <div className="flex items-center gap-3">
              <MedColorDot color={s.medication_color} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">{s.medication_name}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] rounded-full bg-primary/12 text-primary px-2 py-0.5 font-medium"><Zap className="h-3 w-3" />{phase.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {phase.key === "complete" ? "Effects complete" : phase.key === "waiting" ? `Onset ~${fmtMins(Math.max(0, p.onset_min - (t - lastOffset)))}` : `~${fmtMins(remaining)} left`}
                  {s.dose != null ? ` · ${doseLabel(s.dose, s.unit)}` : ""}
                </p>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-1000" style={{ width: `${Math.max(3, pct)}%` }} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display text-xl font-semibold leading-none">{intensity}%</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">intensity</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---- detailed view (Effects page) ----
const FEEDBACK = [
  { kind: "onset", label: "Feeling it", icon: TrendingUp },
  { kind: "peak", label: "Peaking", icon: Zap },
  { kind: "wearing_off", label: "Wearing off", icon: TrendingDown },
  { kind: "gone", label: "Gone", icon: CheckCircle2 },
];

function SessionDetail({ session, now }) {
  const qc = useQueryClient();
  const [intensityInput, setIntensityInput] = useState([5]);
  const [editing, setEditing] = useState(false);
  const [editWhen, setEditWhen] = useState("");
  const [editDose, setEditDose] = useState("");
  const [redosing, setRedosing] = useState(false);
  const [redoseAmt, setRedoseAmt] = useState("");
  const [redoseWhen, setRedoseWhen] = useState("");
  // Typical max daily dose (from the catalog) for the redose guardrails.
  const { data: maxDaily = null } = useQuery({
    queryKey: ["medMaxDaily", session.medication_id],
    queryFn: () => getMedicationMaxDaily(session.medication_id),
  });
  const t = elapsedMin(session, now);
  const p = session.profile;
  // The session's effect is the sum of its primary dose and any redoses
  // (stacked curves). tOffset 0 for the primary; a redose's curve is shifted
  // to when it was taken and scaled by its amount vs. the primary.
  const stack = useMemo(() => sessionDoseStack(session), [session]);
  const redoses = session.redoses || [];
  const lastOffset = stack[stack.length - 1].tOffset;
  // Phase tracks the most recent dose so a redose reads as "coming up" again.
  const phase = phaseAt(t - lastOffset, p);
  // Plotted curve, axis, gridlines, dots and the written numbers all use this
  // same stacked percentage so the graph never disagrees with the label.
  const intensity = Math.round(stackedIntensityAt(t, p, stack));
  const series = useMemo(() => stackedCurveSeries(p, stack), [p, stack]);
  const startMs = new Date(session.started_at).getTime();
  const clockAt = (mins) => fmtDate(new Date(startMs + mins * 60000), "h:mm a");
  const given = (kind) => session.events?.some((e) => e.kind === kind);

  // Y-axis fits the highest point the stacked curve actually reaches (a strong
  // dose, or overlapping redoses, can exceed 100% — "your typical peak").
  const chartEnd = stackChartEnd(p, stack);
  const seriesMax = Math.max(100, ...series.map((pt) => pt.intensity));
  const strong = seriesMax > 100;
  const yMax = strong ? Math.min(300, Math.ceil(seriesMax / 25) * 25) : 100;
  const yTicks = strong
    ? Array.from(new Set([0, 50, 100, yMax])).sort((a, b) => a - b)
    : [0, 25, 50, 75, 100];
  const yGrid = yTicks.filter((v) => v > 0);

  // Hourly gridline positions across the curve (denser for short sessions).
  const hourTicks = useMemo(() => {
    const step = chartEnd <= 150 ? 30 : chartEnd > 720 ? 120 : 60;
    const out = [];
    for (let m = 0; m <= chartEnd; m += step) out.push(m);
    return out;
  }, [chartEnd]);

  // Feedback events plotted on the chart: phase reports sit on the (stacked)
  // curve, intensity reports at the strength the user actually felt (0-10 → 0-100%).
  const eventDots = useMemo(() => (session.events || []).map((e) => {
    const m = Math.max(0, (new Date(e.t).getTime() - startMs) / 60000);
    if (m > chartEnd) return null;
    const y = e.kind === "intensity" && e.intensity != null ? e.intensity * 10 : stackedIntensityAt(m, p, stack);
    return { key: e.id, x: Math.round(m), y: Math.round(y), kind: e.kind };
  }).filter(Boolean), [session.events, startMs, chartEnd, p, stack]);

  // Vertical markers where each redose was taken (skip the primary at 0).
  const redoseMarks = stack.slice(1).map((d) => Math.round(d.tOffset));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["effectSessions"] });
  // "Undo" on the toast reopens the session — reverses both the completion
  // and (if nothing newer has touched the model since) the training it
  // triggered. Wrapped so the error from a stale/unsafe undo surfaces clearly.
  const undoComplete = () => reopenEffectSession(session.id).then(invalidate).catch((e) => toast.error(e?.message || "Could not undo"));

  const feedback = useMutation({
    mutationFn: (payload) => addEffectEvent(session.id, payload),
    onSuccess: (s, vars) => {
      invalidate();
      if (vars.kind === "gone") {
        toast.success("Session complete — your model was updated", { action: { label: "Undo", onClick: undoComplete } });
      } else {
        toast.success("Noted — this tunes your personal curve");
      }
    },
    onError: (e) => toast.error(e?.message || "Could not record feedback"),
  });
  // Removes one recorded event ("editing" a session mid-flight) — for
  // anything but the very last tap, more precise than a full Undo.
  const undoEvent = useMutation({
    mutationFn: (eventId) => deleteEffectEvent(session.id, eventId),
    onSuccess: () => { invalidate(); toast.success("Removed"); },
    onError: (e) => toast.error(e?.message || "Could not remove"),
  });
  const finish = useMutation({
    mutationFn: (opts) => endEffectSession(session.id, opts),
    onSuccess: (_s, opts) => {
      invalidate();
      toast.success(opts?.discard ? "Session discarded" : "Session ended", { action: { label: "Undo", onClick: undoComplete } });
    },
    onError: () => toast.error("Could not end session"),
  });
  const edit = useMutation({
    mutationFn: (patch) => updateEffectSession(session.id, patch),
    onSuccess: () => { invalidate(); setEditing(false); toast.success("Session updated"); },
    onError: (e) => toast.error(e?.message || "Could not update session"),
  });
  const reset = useMutation({
    mutationFn: () => resetEffectModel(session.medication_id),
    onSuccess: () => { invalidate(); toast.success("Model reset — back to typical values"); },
    onError: () => toast.error("Could not reset the model"),
  });
  const redose = useMutation({
    mutationFn: (payload) => addEffectDose(session.id, payload),
    onSuccess: () => { invalidate(); setRedosing(false); setRedoseAmt(""); toast.success("Redose added — the curve now stacks it on"); },
    onError: (e) => toast.error(e?.message || "Could not add redose"),
  });
  const removeDose = useMutation({
    mutationFn: (doseId) => removeEffectDose(session.id, doseId),
    onSuccess: () => { invalidate(); toast.success("Redose removed"); },
    onError: (e) => toast.error(e?.message || "Could not remove redose"),
  });

  const openRedose = () => {
    setRedoseAmt(session.dose != null ? String(session.dose) : "");
    setRedoseWhen(toDatetimeLocal());
    setRedosing(true);
  };
  // Live safety check for the redose being composed (too-soon / over-max).
  const redoseSafety = useMemo(() => {
    if (!redosing) return { warnings: [] };
    const at = redoseWhen && !isNaN(new Date(redoseWhen).getTime()) ? new Date(redoseWhen).toISOString() : null;
    return redoseWarnings(session, { amount: redoseAmt, at }, maxDaily, session.unit);
  }, [redosing, redoseWhen, redoseAmt, session, maxDaily]);
  const saveRedose = () => {
    const when = new Date(redoseWhen);
    if (!redoseWhen || isNaN(when.getTime())) { toast.error("Enter a valid date and time"); return; }
    if (when.getTime() > Date.now() + 60000) { toast.error("Redose time can't be in the future"); return; }
    const payload = { at: when.toISOString() };
    if (redoseAmt !== "") {
      const v = Number(redoseAmt);
      if (!isFinite(v) || v < 0) { toast.error("Enter a valid dose"); return; }
      payload.amount = v;
    }
    redose.mutate(payload);
  };

  const openEdit = () => {
    setEditWhen(toDatetimeLocal(session.started_at));
    setEditDose(session.dose != null ? String(session.dose) : "");
    setEditing(true);
  };
  const saveEdit = () => {
    const d = new Date(editWhen);
    if (!editWhen || isNaN(d.getTime())) { toast.error("Enter a valid date and time"); return; }
    if (d.getTime() > Date.now() + 60000) { toast.error("Start time can't be in the future"); return; }
    const patch = { started_at: d.toISOString() };
    if (editDose !== "") {
      const v = Number(editDose);
      if (!isFinite(v) || v < 0) { toast.error("Enter a valid dose"); return; }
      patch.dose = v;
    }
    edit.mutate(patch);
  };

  return (
    <div className="card-soft p-4" data-testid="effect-session-detail">
      {/* Header: title row, then the live phase chip on its own row so the
          subtitle never wraps mid-time on narrow screens. */}
      <div className="flex items-center gap-3">
        <MedColorDot color={session.medication_color} size={44} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{session.medication_name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {session.dose != null ? `${doseLabel(session.dose, session.unit)} · ` : ""}started {relativeTime(session.started_at)}
          </p>
        </div>
        <button onClick={openEdit} aria-label="Edit session" data-testid="effect-edit-button" className="pressable h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-primary shrink-0"><Pencil className="h-4 w-4" /></button>
      </div>
      <div className="mt-2">
        <span className="inline-flex items-center gap-1 text-[11px] rounded-full bg-primary/12 text-primary px-2.5 py-1 font-medium"><Zap className="h-3 w-3" />{phase.label} · {intensity}% intensity</span>
      </div>

      {editing && (
        <div className="mt-3 rounded-xl border border-border p-3 animate-rise" data-testid="effect-edit-panel">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Taken at</Label>
              <Input type="datetime-local" value={editWhen} max={toDatetimeLocal()} onChange={(e) => setEditWhen(e.target.value)} className="h-11 rounded-xl mt-1" data-testid="effect-edit-when" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Dose{session.unit ? ` (${session.unit})` : ""}</Label>
              <Input type="number" value={editDose} onChange={(e) => setEditDose(e.target.value)} className="h-11 rounded-xl mt-1" data-testid="effect-edit-dose" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="flex-1 rounded-xl" onClick={saveEdit} disabled={edit.isPending} data-testid="effect-edit-save">Save</Button>
            <Button size="sm" variant="secondary" className="flex-1 rounded-xl" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Moving the start time re-anchors the whole curve — useful when you actually took the dose earlier.</p>
        </div>
      )}

      <div className="mt-3 -mx-1">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={series} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
            <defs>
              <linearGradient id={`fx-${session.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.55} strokeDasharray="2 4" horizontalValues={yGrid} verticalValues={hourTicks} />
            <XAxis dataKey="t" type="number" domain={[0, "dataMax"]} ticks={hourTicks} interval={0} tickFormatter={(m) => (m === 0 ? "0" : m % 60 === 0 ? `${m / 60}h` : `${m}m`)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, yMax + 5]} ticks={yTicks} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9 }} width={38} tickMargin={4} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              formatter={(v) => [`${Math.round(v)}%`, "Intensity"]}
              labelFormatter={(m) => `${fmtMins(m)} after dose · ${clockAt(m)}`}
            />
            {/* predicted phase boundaries */}
            <ReferenceLine x={p.onset_min} stroke="hsl(var(--info))" strokeOpacity={0.6} strokeDasharray="3 3" />
            <ReferenceLine x={p.peak_min} stroke="hsl(var(--success))" strokeOpacity={0.6} strokeDasharray="3 3" />
            <ReferenceLine x={p.duration_min} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="3 3" />
            {/* redose markers — where an additional dose was stacked on */}
            {redoseMarks.map((m, i) => (
              <ReferenceLine key={`rd-${i}`} x={m} stroke="hsl(var(--primary))" strokeOpacity={0.7} strokeDasharray="1 3" label={{ value: "+dose", position: "insideTopLeft", fontSize: 8, fill: "hsl(var(--primary))" }} />
            ))}
            <Area type="monotone" dataKey="intensity" stroke="hsl(var(--primary))" strokeWidth={2.5} fill={`url(#fx-${session.id})`} dot={false} />
            {/* the user's own feedback, plotted where it happened */}
            {eventDots.map((d) => (
              <ReferenceDot key={d.key} x={d.x} y={d.y} r={4} fill={d.kind === "intensity" ? "hsl(var(--warning))" : "hsl(var(--primary))"} stroke="hsl(var(--card))" strokeWidth={1.5} />
            ))}
            {/* label suppressed while the line hugs the left edge, where it
                would collide with the 100% axis tick */}
            <ReferenceLine x={Math.round(t)} stroke="hsl(var(--warning))" strokeDasharray="4 3" strokeWidth={2} label={t > chartEnd * 0.08 ? { value: "now", position: "insideTopRight", fontSize: 9, fill: "hsl(var(--warning))" } : undefined} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/40 py-1.5"><p className="text-[10px] text-muted-foreground">Onset</p><p className="text-xs font-medium">~{clockAt(p.onset_min)}</p></div>
        <div className="rounded-xl bg-muted/40 py-1.5"><p className="text-[10px] text-muted-foreground">Peak</p><p className="text-xs font-medium">~{clockAt(p.peak_min)}</p></div>
        <div className="rounded-xl bg-muted/40 py-1.5"><p className="text-[10px] text-muted-foreground">Ends</p><p className="text-xs font-medium">~{clockAt(p.duration_min)}</p></div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-2">
        <p className="text-[11px] text-muted-foreground">
          {p.learned
            ? `Personalized from ${p.samples} tracked ${p.samples === 1 ? "session" : "sessions"} (${p.confidence} confidence).`
            : "Using typical values for now — your feedback below teaches the tracker your metabolism."}
        </p>
        {p.learned && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="text-[11px] font-medium text-primary shrink-0" data-testid="effect-reset-model-button">Reset</button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset the learned model for {session.medication_name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Everything the tracker has learned about your onset, peak and duration for this medication is forgotten, and predictions go back to typical values. Future feedback starts teaching it again from scratch.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => reset.mutate()} className="bg-destructive text-destructive-foreground" data-testid="effect-reset-model-confirm">Reset model</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {FEEDBACK.map((f) => {
          const Icon = f.icon;
          const done = given(f.kind);
          return (
            <button
              key={f.kind}
              disabled={done || feedback.isPending}
              onClick={() => feedback.mutate({ kind: f.kind })}
              data-testid={`effect-feedback-${f.kind}`}
              className={`pressable rounded-xl border py-2 flex flex-col items-center gap-1 text-[11px] font-medium ${done ? "bg-accent border-primary text-muted-foreground opacity-60" : "bg-card border-border"}`}
            >
              <Icon className="h-4 w-4" />{f.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>How strong does it feel?</span><span>{intensityInput[0]}/10</span></div>
        <Slider value={intensityInput} onValueChange={setIntensityInput} onValueCommit={(v) => feedback.mutate({ kind: "intensity", intensity: v[0] })} min={0} max={10} step={1} data-testid="effect-intensity-slider" />
      </div>

      {/* Recorded feedback, most recent first — tap × to fix a specific wrong
          entry, or "Undo last" for the common case of the last tap. */}
      {session.events?.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs text-muted-foreground">Your feedback</p>
            <button
              onClick={() => undoEvent.mutate(session.events[session.events.length - 1].id)}
              disabled={undoEvent.isPending}
              data-testid="effect-undo-last-button"
              className="text-[11px] font-medium text-primary"
            >
              Undo last
            </button>
          </div>
          <div className="space-y-1">
            {[...session.events].reverse().map((e) => {
              const meta = FEEDBACK.find((f) => f.kind === e.kind);
              const mins = Math.max(0, (new Date(e.t).getTime() - startMs) / 60000);
              const label = e.kind === "intensity" ? `Intensity ${e.intensity}/10` : (meta?.label || e.kind);
              return (
                <div key={e.id} className="flex items-center justify-between rounded-lg bg-muted/30 pl-2.5 pr-1 py-1" data-testid="effect-event-row">
                  <span className="text-xs">{label} <span className="text-muted-foreground">· {fmtMins(mins)} in</span></span>
                  <button
                    onClick={() => undoEvent.mutate(e.id)}
                    disabled={undoEvent.isPending}
                    aria-label={`Remove ${label}`}
                    data-testid="effect-event-delete"
                    className="pressable h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Redose — stack another dose onto this session instead of starting a
          separate one. Taken doses are listed with remove buttons. */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Redose</p>
          {!redosing && (
            <button onClick={openRedose} data-testid="effect-redose-button" className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
              <Plus className="h-3.5 w-3.5" />Add a dose
            </button>
          )}
        </div>
        {redoses.length > 0 && (
          <div className="space-y-1 mt-1.5">
            {redoses.map((r) => {
              const mins = Math.max(0, (new Date(r.at).getTime() - startMs) / 60000);
              return (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/30 pl-2.5 pr-1 py-1" data-testid="effect-redose-row">
                  <span className="text-xs">{r.amount != null ? doseLabel(r.amount, r.unit || session.unit) : "Dose"} <span className="text-muted-foreground">· {fmtMins(mins)} in</span></span>
                  <button onClick={() => removeDose.mutate(r.id)} disabled={removeDose.isPending} aria-label="Remove redose" data-testid="effect-redose-delete" className="pressable h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
              );
            })}
          </div>
        )}
        {redosing && (
          <div className="mt-2 rounded-xl border border-border p-3 animate-rise" data-testid="effect-redose-panel">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Amount{session.unit ? ` (${session.unit})` : ""}</Label>
                <Input type="number" value={redoseAmt} onChange={(e) => setRedoseAmt(e.target.value)} className="h-11 rounded-xl mt-1" data-testid="effect-redose-amount" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Taken at</Label>
                <Input type="datetime-local" value={redoseWhen} max={toDatetimeLocal()} onChange={(e) => setRedoseWhen(e.target.value)} className="h-11 rounded-xl mt-1" data-testid="effect-redose-when" />
              </div>
            </div>
            <RedoseSafetyBox warnings={redoseSafety.warnings} unit={session.unit} />
            <div className="flex gap-2 mt-3">
              <Button size="sm" className={`flex-1 rounded-xl ${redoseSafety.warnings.length ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`} onClick={saveRedose} disabled={redose.isPending} data-testid="effect-redose-save">{redoseSafety.warnings.length ? "Add anyway" : "Add dose"}</Button>
              <Button size="sm" variant="secondary" className="flex-1 rounded-xl" onClick={() => setRedosing(false)}>Cancel</Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">The redose stacks onto whatever is still active — the curve sums both. Redosed sessions don't train your timing model, since the stacked timing isn't a clean single-dose reading.</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1 rounded-xl" onClick={() => finish.mutate({ learn: true })} data-testid="effect-end-button">End session</Button>
        <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground" onClick={() => finish.mutate({ discard: true })} data-testid="effect-discard-button"><X className="h-4 w-4 mr-1" />Discard</Button>
      </div>
    </div>
  );
}

// ---- redose safety guardrails ----
function RedoseSafetyBox({ warnings, unit }) {
  if (!warnings?.length) return null;
  const severe = warnings.some((w) => w.severity === "severe");
  const line = (w) => {
    if (w.type === "too_soon") return `The previous dose likely hasn't peaked yet (${fmtMins(w.minsSinceLast)} in, typically peaks ~${fmtMins(w.peakMin)}). Waiting until you feel the full effect avoids accidental over-stacking.`;
    if (w.type === "over_max") return `This brings the session total to ${w.cumulative}${unit ? ` ${unit}` : ""} — above the typical maximum of ${w.maxDaily}${unit ? ` ${unit}` : ""}.`;
    if (w.type === "near_max") return `This brings the session total to ${w.cumulative}${unit ? ` ${unit}` : ""}, near the typical maximum of ${w.maxDaily}${unit ? ` ${unit}` : ""}.`;
    return "";
  };
  return (
    <div className={`mt-3 rounded-xl border p-2.5 ${severe ? "border-destructive/40 bg-destructive/5" : "border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-surface))]"}`} data-testid="redose-safety-box">
      <div className="flex items-start gap-2">
        <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${severe ? "text-destructive" : "text-[hsl(var(--warning))]"}`} />
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${severe ? "text-destructive" : "text-[hsl(var(--warning))]"}`}>{severe ? "Dose safety" : "Heads up"}</p>
          <ul className="mt-1 space-y-1">
            {warnings.map((w, i) => <li key={i} className="text-[11px] text-muted-foreground leading-snug">{line(w)}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ---- interaction warnings (concurrently active substances) ----
function InteractionWarnings({ findings }) {
  if (!findings.length) return null;
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4" data-testid="interaction-warnings">
      <div className="flex gap-2 items-start">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <p className="font-semibold text-sm">Interaction check</p>
      </div>
      <div className="mt-2 space-y-2">
        {findings.map((f, i) => {
          const meta = severityMeta(f.severity);
          return (
            <div key={i} className="rounded-xl bg-card/60 p-2.5" data-testid="interaction-finding">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <RiskBadge tone={meta.tone} label={meta.label} />
                <span className="text-xs font-medium">{f.aName} + {f.bName}</span>
              </div>
              <p className="text-xs text-muted-foreground">{f.reason}</p>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">Harm-reduction heuristic based on drug category, not a clinical interaction database — when in doubt, ask a pharmacist or use a dedicated interaction checker.</p>
    </div>
  );
}

// Medications keep whatever color the user picked, but two meds can easily
// share the same (often default) swatch — illegible once their curves are
// overlaid on one chart. Keep colors that are already distinct; only
// reassign a fresh palette color to whichever sessions collide.
function distinctSessionColors(sessions) {
  const used = new Set();
  return sessions.map((s) => {
    let c = s.medication_color;
    if (used.has(c)) c = MED_COLORS.find((mc) => !used.has(mc)) || c;
    used.add(c);
    return c;
  });
}

// ---- combined chart (2+ concurrently active substances, one shared timeline) ----
function CombinedEffectsChart({ sessions, now }) {
  const colors = useMemo(() => distinctSessionColors(sessions), [sessions]);
  const anchor = useMemo(() => Math.min(...sessions.map((s) => new Date(s.started_at).getTime())), [sessions]);
  const offsets = useMemo(() => sessions.map((s) => (new Date(s.started_at).getTime() - anchor) / 60000), [sessions, anchor]);
  // Each session's own (possibly redosed) dose stack, evaluated on the shared
  // wall-clock timeline.
  const stacks = useMemo(() => sessions.map((s) => sessionDoseStack(s)), [sessions]);
  const chartEnd = useMemo(
    () => Math.max(60, ...sessions.map((s, i) => offsets[i] + stackChartEnd(s.profile, stacks[i]))),
    [sessions, offsets, stacks]
  );
  const hourStep = chartEnd <= 150 ? 30 : chartEnd > 720 ? 120 : 60;
  const hourTicks = useMemo(() => {
    const out = [];
    for (let m = 0; m <= chartEnd; m += hourStep) out.push(m);
    return out;
  }, [chartEnd, hourStep]);
  const sampleStep = Math.max(5, Math.round(chartEnd / 96 / 5) * 5);
  const data = useMemo(() => {
    const points = [];
    for (let t = 0; t <= chartEnd; t += sampleStep) {
      const row = { t: Math.round(t) };
      sessions.forEach((s, i) => { row[s.id] = Math.round(stackedIntensityAt(t - offsets[i], s.profile, stacks[i])); });
      points.push(row);
    }
    return points;
  }, [sessions, offsets, stacks, chartEnd, sampleStep]);
  // Fit the y-axis to the tallest curve actually drawn (redoses/strong doses
  // can exceed 100%).
  const yMax = useMemo(() => {
    let mx = 100;
    for (const row of data) for (const s of sessions) mx = Math.max(mx, row[s.id] || 0);
    return Math.min(300, Math.ceil(mx / 25) * 25);
  }, [data, sessions]);
  const yTicks = useMemo(() => (yMax <= 100 ? [0, 25, 50, 75, 100] : Array.from(new Set([0, 50, 100, yMax])).sort((a, b) => a - b)), [yMax]);
  const clockAt = (mins) => fmtDate(new Date(anchor + mins * 60000), "h:mm a");
  const nowMin = (now - anchor) / 60000;

  return (
    <div className="card-soft p-4" data-testid="combined-effects-chart">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="h-4 w-4 text-primary" />
        <p className="font-semibold text-sm">Combined view</p>
        <span className="text-xs text-muted-foreground">· {sessions.length} active</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-2">
        {sessions.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colors[i] }} />
            {s.medication_name}
          </div>
        ))}
      </div>
      <div className="-mx-1">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 6, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.55} strokeDasharray="2 4" horizontalValues={yTicks.filter((v) => v > 0)} verticalValues={hourTicks} />
            <XAxis dataKey="t" type="number" domain={[0, chartEnd]} ticks={hourTicks} interval={0} tickFormatter={clockAt} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, yMax + 5]} ticks={yTicks} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9 }} width={38} tickMargin={4} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              formatter={(v, name) => [`${Math.round(v)}%`, sessions.find((s) => s.id === name)?.medication_name || name]}
              labelFormatter={clockAt}
            />
            {sessions.map((s, i) => (
              <Area key={s.id} type="monotone" dataKey={s.id} name={s.id} stroke={colors[i]} strokeWidth={2.5} fill={colors[i]} fillOpacity={0.12} dot={false} isAnimationActive={false} />
            ))}
            {nowMin >= 0 && nowMin <= chartEnd && (
              <ReferenceLine x={Math.round(nowMin)} stroke="hsl(var(--warning))" strokeDasharray="4 3" strokeWidth={2} label={{ value: "now", position: "insideTopRight", fontSize: 9, fill: "hsl(var(--warning))" }} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ActiveEffectsDetail() {
  const now = useNow(30000);
  const qc = useQueryClient();
  const { data: sessions = [] } = useActiveSessions();
  const { data: logs = [] } = useQuery({ queryKey: ["logs"], queryFn: () => getLogs({ limit: 200 }) });
  const { data: meds = [] } = useQuery({ queryKey: ["medications"], queryFn: () => getMedications() });

  // Recent consuming doses (last 8 h) without an active session → offer to track,
  // backdated to when the dose was actually taken.
  const offers = useMemo(() => {
    const activeMedIds = new Set(sessions.map((s) => s.medication_id));
    const cutoff = now - 8 * 3600000;
    const seen = new Set();
    return logs.filter((l) => {
      if (!["taken", "partial"].includes(l.status)) return false;
      if (new Date(l.timestamp).getTime() < cutoff) return false;
      if (activeMedIds.has(l.medication_id) || seen.has(l.medication_id)) return false;
      seen.add(l.medication_id);
      return true;
    }).slice(0, 3);
  }, [logs, sessions, now]);

  const start = useMutation({
    mutationFn: (log) => startEffectSession({ medication_id: log.medication_id, dose: log.dose_taken, unit: log.unit, log_id: log.id, started_at: log.timestamp }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["effectSessions"] }); toast.success("Effects tracking started"); },
    onError: (e) => toast.error(e?.message || "Could not start tracking"),
  });

  // Cross-reference concurrently active substances against the interaction
  // matrix — this is where it matters in real time, not the user's whole
  // medication list, since risk depends on what's actually active together.
  const interactionFindings = useMemo(() => {
    const items = sessions.map((s) => {
      const m = meds.find((x) => x.id === s.medication_id);
      return { id: s.id, name: s.medication_name, generic_name: m?.generic_name, category: m?.category };
    });
    return checkInteractions(items);
  }, [sessions, meds]);

  if (!sessions.length && !offers.length) return null;
  const medName = (id) => meds.find((m) => m.id === id)?.name || "Medication";

  return (
    <div className="space-y-3" data-testid="active-effects-detail">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Active effects</p>
      <InteractionWarnings findings={interactionFindings} />
      {sessions.length > 1 && <CombinedEffectsChart sessions={sessions} now={now} />}
      {sessions.map((s) => <SessionDetail key={s.id} session={s} now={now} />)}
      {offers.map((l) => (
        <button key={l.id} onClick={() => start.mutate(l)} data-testid="effect-track-offer" className="w-full text-left card-soft p-3 pressable border-dashed">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center"><Play className="h-5 w-5" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">Track effects of {medName(l.medication_id)}</p>
              <p className="text-xs text-muted-foreground">Taken {relativeTime(l.timestamp)}{l.dose_taken != null ? ` · ${doseLabel(l.dose_taken, l.unit)}` : ""}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
}
