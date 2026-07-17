import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import MedColorDot from "@/components/MedColorDot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getActiveEffectSessions, addEffectEvent, endEffectSession, startEffectSession, updateEffectSession, resetEffectModel, getLogs, getMedications } from "@/lib/api";
import { intensityAt, phaseAt, curveSeries, fmtMins } from "@/lib/effectsEngine";
import { fmtDate, doseLabel, relativeTime, toDatetimeLocal } from "@/lib/format";
import { Activity, ChevronRight, X, Zap, TrendingUp, TrendingDown, CheckCircle2, Play, Pencil } from "lucide-react";
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
        const phase = phaseAt(t, p);
        const intensity = Math.round(intensityAt(t, p) * (p.intensity_scale || 1));
        const pct = Math.min(100, (t / p.duration_min) * 100);
        const remaining = Math.max(0, p.duration_min - t);
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
                  {phase.key === "complete" ? "Effects complete" : phase.key === "waiting" ? `Onset ~${fmtMins(Math.max(0, p.onset_min - t))}` : `~${fmtMins(remaining)} left`}
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
  const t = elapsedMin(session, now);
  const p = session.profile;
  const phase = phaseAt(t, p);
  const intensity = Math.round(intensityAt(t, p) * (p.intensity_scale || 1));
  const series = useMemo(() => curveSeries(p), [p]);
  const startMs = new Date(session.started_at).getTime();
  const clockAt = (mins) => fmtDate(new Date(startMs + mins * 60000), "h:mm a");
  const given = (kind) => session.events?.some((e) => e.kind === kind);

  // Hourly gridline positions across the curve (denser for short sessions).
  const chartEnd = p.duration_min * 1.25;
  const hourTicks = useMemo(() => {
    const step = chartEnd <= 150 ? 30 : chartEnd > 720 ? 120 : 60;
    const out = [];
    for (let m = 0; m <= chartEnd; m += step) out.push(m);
    return out;
  }, [chartEnd]);

  // Feedback events plotted on the chart: phase reports sit on the curve,
  // intensity reports at the strength the user actually felt.
  const eventDots = useMemo(() => (session.events || []).map((e, i) => {
    const m = Math.max(0, (new Date(e.t).getTime() - startMs) / 60000);
    if (m > chartEnd) return null;
    const y = e.kind === "intensity" && e.intensity != null ? e.intensity * 10 : intensityAt(m, p);
    return { key: `${e.kind}-${i}`, x: Math.round(m), y, kind: e.kind };
  }).filter(Boolean), [session.events, startMs, chartEnd, p]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["effectSessions"] });
  const feedback = useMutation({
    mutationFn: (payload) => addEffectEvent(session.id, payload),
    onSuccess: (s, vars) => {
      invalidate();
      toast.success(vars.kind === "gone" ? "Session complete — your model was updated" : "Noted — this tunes your personal curve");
    },
    onError: (e) => toast.error(e?.message || "Could not record feedback"),
  });
  const finish = useMutation({
    mutationFn: (opts) => endEffectSession(session.id, opts),
    onSuccess: (_s, opts) => { invalidate(); toast.success(opts?.discard ? "Session discarded" : "Session ended"); },
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
            <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.55} strokeDasharray="2 4" horizontalValues={[25, 50, 75, 100]} verticalValues={hourTicks} />
            <XAxis dataKey="t" type="number" domain={[0, "dataMax"]} ticks={hourTicks} interval={0} tickFormatter={(m) => (m === 0 ? "0" : m % 60 === 0 ? `${m / 60}h` : `${m}m`)} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 105]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9 }} width={38} tickMargin={4} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
              formatter={(v) => [`${Math.round(v * (p.intensity_scale || 1))}%`, "Intensity"]}
              labelFormatter={(m) => `${fmtMins(m)} after dose · ${clockAt(m)}`}
            />
            {/* predicted phase boundaries */}
            <ReferenceLine x={p.onset_min} stroke="hsl(var(--info))" strokeOpacity={0.6} strokeDasharray="3 3" />
            <ReferenceLine x={p.peak_min} stroke="hsl(var(--success))" strokeOpacity={0.6} strokeDasharray="3 3" />
            <ReferenceLine x={p.duration_min} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} strokeDasharray="3 3" />
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

      <div className="mt-3 flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1 rounded-xl" onClick={() => finish.mutate({ learn: true })} data-testid="effect-end-button">End session</Button>
        <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground" onClick={() => finish.mutate({ discard: true })} data-testid="effect-discard-button"><X className="h-4 w-4 mr-1" />Discard</Button>
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

  if (!sessions.length && !offers.length) return null;
  const medName = (id) => meds.find((m) => m.id === id)?.name || "Medication";

  return (
    <div className="space-y-3" data-testid="active-effects-detail">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />Active effects</p>
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
