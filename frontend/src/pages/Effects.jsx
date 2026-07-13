import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import MedColorDot from "@/components/MedColorDot";
import { Button } from "@/components/ui/button";
import { getLogs, getMedications, getCheckins } from "@/lib/api";
import { unifyMoodEntries, moodDailySeries, moodTrend, MOOD_EMOJI } from "@/lib/moodAnalytics";
import { timestampToLocalDate } from "@/lib/dates";
import { relativeTime, fmtDate } from "@/lib/format";
import { useUI } from "@/context/UIContext";
import { Activity, Smile, TrendingUp, TrendingDown, Minus as MinusIcon, Plus } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

const MOOD_WORD_EMOJI = { great: "😊", good: "🙂", okay: "😐", low: "😕", bad: "😟" };
const DIM_LABELS = { energy: "Energy", sleep: "Sleep", pain: "Pain", anxiety: "Anxiety" };

export default function Effects() {
  const ui = useUI();
  const { data: logs = [], isLoading } = useQuery({ queryKey: ["logs"], queryFn: () => getLogs({ limit: 200 }) });
  const { data: checkins = [] } = useQuery({ queryKey: ["checkins"], queryFn: () => getCheckins({ limit: 200 }) });
  const { data: meds = [] } = useQuery({ queryKey: ["medications"], queryFn: () => getMedications(true) });
  const medMap = useMemo(() => Object.fromEntries(meds.map((m) => [m.id, m])), [meds]);

  const trend = useMemo(() => {
    const series = moodDailySeries(unifyMoodEntries(checkins, logs), { days: 14 });
    return { series, ...moodTrend(series) };
  }, [checkins, logs]);

  const journal = useMemo(() => {
    const items = [
      ...logs.filter((l) => l.mood || l.effectiveness || l.notes).map((l) => ({ ...l, _kind: "log" })),
      ...checkins.map((c) => ({ ...c, _kind: "checkin" })),
    ];
    items.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
    return items;
  }, [logs, checkins]);

  const grouped = useMemo(() => {
    const g = {};
    journal.forEach((l) => { const d = timestampToLocalDate(l.timestamp); (g[d] = g[d] || []).push(l); });
    return g;
  }, [journal]);

  const TrendIcon = trend.direction === "improving" ? TrendingUp : trend.direction === "declining" ? TrendingDown : MinusIcon;
  const chartData = trend.series.map((p) => ({ ...p, label: fmtDate(p.date, "MMM d") }));

  return (
    <div>
      <PageHeader title="Effects & Journal" subtitle="Mood, effectiveness & notes"
        right={<Button size="sm" className="rounded-xl" onClick={ui.openCheckin} data-testid="effects-checkin-button"><Plus className="h-4 w-4 mr-1" />Check in</Button>} />
      <div className="px-4 space-y-4">
        {/* 14-day mood trend */}
        {trend.n > 0 && (
          <div className="card-soft p-4" data-testid="mood-trend-card">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold">Mood — last 14 days</p>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground capitalize"><TrendIcon className="h-4 w-4" />{trend.direction} · avg {trend.avg}</span>
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="moodg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" hide />
                <YAxis domain={[1, 5]} hide />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v) => [`${v} ${MOOD_EMOJI[Math.round(v)] || ""}`, "Mood"]} labelFormatter={(l) => l} />
                <Area type="monotone" dataKey="mood" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#moodg)" connectNulls dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card-soft p-4 flex gap-3 items-start">
          <Activity className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">Log how you feel any time with a check-in, or add mood, effectiveness and notes when logging a dose. Everything lands here as your journal and powers the Insights page.</p>
        </div>
        {isLoading && [0, 1].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted/60 animate-pulse" />)}
        {!isLoading && journal.length === 0 && (
          <EmptyState icon={Smile} title="No journal entries yet" description="Do a quick mood check-in, or add a mood/effectiveness rating when logging a dose."
            action={<Button onClick={ui.openCheckin} className="rounded-xl">Check in now</Button>} />
        )}
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{fmtDate(date, "EEEE, MMM d")}</p>
            <div className="space-y-2.5">
              {items.map((l) => (l._kind === "checkin" ? <CheckinRow key={l.id} entry={l} /> : <LogRow key={l.id} log={l} med={medMap[l.medication_id]} />))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckinRow({ entry }) {
  const dims = ["energy", "sleep", "pain", "anxiety"].filter((k) => entry[k] != null);
  return (
    <div className="card-soft p-3" data-testid="checkin-entry">
      <div className="flex items-center gap-3">
        <div className="h-[38px] w-[38px] rounded-full bg-primary/12 text-primary flex items-center justify-center"><Smile className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">Mood check-in</p>
          <p className="text-xs text-muted-foreground">{relativeTime(entry.timestamp)}</p>
        </div>
        <span className="text-2xl">{MOOD_EMOJI[entry.mood]}</span>
      </div>
      {dims.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {dims.map((k) => (
            <span key={k} className="text-[11px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{DIM_LABELS[k]} {entry[k]}/5</span>
          ))}
        </div>
      )}
      {entry.notes && <p className="text-sm text-muted-foreground mt-2">{entry.notes}</p>}
    </div>
  );
}

function LogRow({ log, med }) {
  return (
    <div className="card-soft p-3">
      <div className="flex items-center gap-3">
        <MedColorDot color={med?.color} size={38} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{med?.name || "Medication"}</p>
          <p className="text-xs text-muted-foreground">{relativeTime(log.timestamp)} · <span className="capitalize">{log.status}</span></p>
        </div>
        {log.mood && <span className="text-2xl">{MOOD_WORD_EMOJI[log.mood]}</span>}
      </div>
      {log.effectiveness != null && (
        <div className="mt-2"><div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Effectiveness</span><span>{log.effectiveness}/10</span></div><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${log.effectiveness * 10}%` }} /></div></div>
      )}
      {log.notes && <p className="text-sm text-muted-foreground mt-2">{log.notes}</p>}
    </div>
  );
}
