import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import AdherenceRing from "@/components/AdherenceRing";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { getAnalytics, getInventory, getMedications, getLogs, getCheckins, getTapers, getKnowledge, getAiConfig } from "@/lib/api";
import { analyzeAll, SAFETY_COPY } from "@/lib/behavior";
import { usageFrequency } from "@/lib/usageStats";
import { unifyMoodEntries, moodDailySeries, moodTrend, dimensionSeries, MOOD_EMOJI } from "@/lib/moodAnalytics";
import { buildInsightsPayload, generateOverviewInsights, getCachedOverview } from "@/lib/aiInsights";
import { hasKey } from "@/lib/ai";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BarChart3, Flame, CheckCircle2, Pill, Smile, ShieldAlert, Sparkles, RefreshCw, ChevronRight, TrendingUp, TrendingDown, Minus as MinusIcon, LifeBuoy } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const RANGES = [{ v: 7, l: "7d" }, { v: 30, l: "30d" }, { v: 90, l: "90d" }];
const TABS = [
  { v: "adherence", l: "Adherence", icon: BarChart3 },
  { v: "mood", l: "Mood", icon: Smile },
  { v: "behaviour", l: "Behaviour", icon: ShieldAlert },
];

const LEVEL_STYLES = {
  watch: { l: "Watch", c: "bg-[hsl(var(--info-surface))] text-[hsl(var(--info))]" },
  elevated: { l: "Elevated", c: "bg-[hsl(var(--warning-surface))] text-[hsl(var(--warning))]" },
  high: { l: "High", c: "bg-destructive/12 text-destructive" },
  none: { l: "No signals", c: "bg-muted text-muted-foreground" },
};

export default function Insights() {
  const [range, setRange] = useState(30);
  const [tab, setTab] = useState("adherence");

  const { data, isLoading } = useQuery({ queryKey: ["analytics", range], queryFn: () => getAnalytics(range) });
  const { data: meds = [] } = useQuery({ queryKey: ["medications"], queryFn: () => getMedications() });
  const { data: logs = [] } = useQuery({ queryKey: ["logs", "insights"], queryFn: () => getLogs({ limit: 1000 }) });
  const { data: checkins = [] } = useQuery({ queryKey: ["checkins"], queryFn: () => getCheckins({ limit: 500 }) });
  const { data: tapers = [] } = useQuery({ queryKey: ["tapers"], queryFn: getTapers });
  const { data: catalog = [] } = useQuery({ queryKey: ["knowledge", "all"], queryFn: () => getKnowledge() });
  const { data: inventory = [] } = useQuery({ queryKey: ["inventory"], queryFn: getInventory });

  const mood = useMemo(() => {
    const entries = unifyMoodEntries(checkins, logs);
    const series = moodDailySeries(entries, { days: range });
    return { entries, series, trend: moodTrend(series) };
  }, [checkins, logs, range]);

  const behavior = useMemo(
    () => analyzeAll({ meds, logs, checkins, catalog, tapers }),
    [meds, logs, checkins, catalog, tapers]
  );

  return (
    <div>
      <PageHeader title="Insights" subtitle="Adherence, mood & behaviour" />
      <div className="px-4 space-y-4">
        <AiInsightsCard analytics={data} inventory={inventory} behaviorReport={behavior} mood={mood} meds={meds} />

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.v} data-testid={`insights-tab-${t.v}`} onClick={() => setTab(t.v)}
                className={cn("flex-1 rounded-xl h-10 text-sm font-medium border flex items-center justify-center gap-1.5", tab === t.v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>
                <Icon className="h-4 w-4" />{t.l}
              </button>
            );
          })}
        </div>

        {/* Range picker (adherence + mood) */}
        {tab !== "behaviour" && (
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <button key={r.v} data-testid="analytics-timeframe-toggle" onClick={() => setRange(r.v)}
                className={cn("flex-1 rounded-xl h-9 text-sm font-medium border", range === r.v ? "bg-accent border-primary text-foreground" : "bg-card border-border text-muted-foreground")}>{r.l}</button>
            ))}
          </div>
        )}

        {tab === "adherence" && <AdherenceTab data={data} range={range} />}
        {tab === "adherence" && <UsageFrequencyCard logs={logs} meds={meds} />}
        {tab === "mood" && <MoodTab mood={mood} checkins={checkins} range={range} />}
        {tab === "behaviour" && <BehaviourTab report={behavior} />}
      </div>
    </div>
  );
}

/* ---------------- AI insights card ---------------- */

function AiInsightsCard({ analytics, inventory, behaviorReport, mood, meds }) {
  const { data: aiConfig } = useQuery({ queryKey: ["aiConfig"], queryFn: getAiConfig });
  const { data: cached } = useQuery({ queryKey: ["aiInsights", "overview"], queryFn: getCachedOverview });
  const qc = useQueryClient();
  const keyed = hasKey(aiConfig);

  const refresh = useMutation({
    mutationFn: () => {
      const payload = buildInsightsPayload({
        analytics, inventory, behaviorReport,
        moodTrend: mood.trend, moodSeries: mood.series, meds,
      });
      return generateOverviewInsights({ config: aiConfig, payload });
    },
    onSuccess: (r) => {
      qc.setQueryData(["aiInsights", "overview"], r);
      toast.success(r._cached ? "Insights are up to date" : "Insights refreshed");
    },
    onError: (e) => toast.error(e?.message || "Could not generate insights"),
  });

  const r = refresh.data || cached;
  const bullets = r ? [...(r.adherence || []), ...(r.mood || []), ...(r.refills || []), ...(r.risk_observations || [])] : [];

  return (
    <div className="card-soft p-4" data-testid="ai-insights-card">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><p className="font-semibold">AI insights</p></div>
        <Button size="sm" variant="secondary" className="rounded-xl" disabled={!keyed || refresh.isPending} onClick={() => refresh.mutate()} data-testid="ai-insights-refresh">
          <RefreshCw className={cn("h-4 w-4 mr-1", refresh.isPending && "animate-spin")} />{refresh.isPending ? "Analyzing…" : "Refresh"}
        </Button>
      </div>
      {!r && <p className="text-sm text-muted-foreground">{keyed ? "Tap Refresh for a personalized read on your adherence, mood, refills and usage patterns." : "Add an OpenRouter API key in Settings to enable AI insights. Everything else on this page works offline."}</p>}
      {r && (
        <div className="space-y-2">
          {r.summary && <p className="text-sm">{r.summary}</p>}
          {bullets.length > 0 && (
            <ul className="space-y-1">
              {bullets.slice(0, 6).map((b, i) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-primary">•</span><span>{b}</span></li>)}
            </ul>
          )}
          {(r.suggestions || []).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {r.suggestions.slice(0, 3).map((s, i) => s.link ? (
                <Link key={i} to={s.link} className="text-xs rounded-full border border-border px-3 py-1.5 text-primary flex items-center gap-1">{s.text}<ChevronRight className="h-3 w-3" /></Link>
              ) : (
                <span key={i} className="text-xs rounded-full border border-border px-3 py-1.5 text-muted-foreground">{s.text}</span>
              ))}
            </div>
          )}
          {r._generated_at && <p className="text-[10px] text-muted-foreground">Generated {fmtDate(r._generated_at, "MMM d, h:mm a")}{r._model ? ` · ${r._model}` : ""}{r._cached ? " · cached" : ""}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------------- Adherence (existing content) ---------------- */

function AdherenceTab({ data, range }) {
  const chartData = (data?.trend || []).map((t) => ({ date: t.date, adherence: t.adherence ?? null, label: fmtDate(t.date, "MMM d") }));
  const breakdown = data?.status_breakdown || {};
  const statusItems = [
    { k: "taken", l: "Taken", c: "hsl(var(--success))" },
    { k: "partial", l: "Partial", c: "hsl(var(--warning))" },
    { k: "skipped", l: "Skipped", c: "hsl(var(--muted-foreground))" },
    { k: "missed", l: "Missed", c: "hsl(var(--destructive))" },
  ];
  const totalLogs = statusItems.reduce((a, s) => a + (breakdown[s.k] || 0), 0);

  return (
    <>
      <div className="card-soft hero-wash p-5">
        <div className="flex items-center gap-5">
          <AdherenceRing value={data?.overall_adherence ?? 100} label={`${data?.overall_adherence ?? 100}%`} sublabel={`${range}d`} />
          <div className="flex-1 space-y-3">
            <Stat icon={Flame} color="hsl(var(--warning))" label="Current streak" value={`${data?.current_streak || 0} days`} />
            <Stat icon={CheckCircle2} color="hsl(var(--success))" label="Doses taken" value={`${data?.total_taken || 0} / ${data?.total_expected || 0}`} />
            <Stat icon={Pill} color="hsl(var(--primary))" label="Active meds" value={data?.active_medications || 0} />
          </div>
        </div>
      </div>

      <div className="card-soft p-4" data-testid="analytics-chart">
        <p className="font-semibold mb-3">Adherence trend</p>
        {totalLogs === 0 ? (
          <EmptyState icon={BarChart3} title="No data yet" description="Log some doses to see your trends here." className="border-0 bg-transparent p-4" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="adh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={28} stroke="hsl(var(--muted-foreground))" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v) => [`${v}%`, "Adherence"]} />
              <Area type="monotone" dataKey="adherence" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#adh)" connectNulls dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {totalLogs > 0 && (
        <div className="card-soft p-4">
          <p className="font-semibold mb-3">Dose breakdown</p>
          <div className="space-y-2.5">
            {statusItems.map((s) => {
              const n = breakdown[s.k] || 0; const pct = totalLogs ? Math.round((n / totalLogs) * 100) : 0;
              return (
                <div key={s.k}>
                  <div className="flex justify-between text-sm mb-1"><span>{s.l}</span><span className="text-muted-foreground">{n} ({pct}%)</span></div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: s.c }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(data?.per_medication || []).length > 0 && (
        <div className="card-soft p-4">
          <p className="font-semibold mb-3">By medication</p>
          <div className="space-y-3">
            {data.per_medication.map((m) => (
              <div key={m.medication_id}>
                <div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />{m.name}</span><span className="text-muted-foreground">{m.adherence}%</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${m.adherence}%`, backgroundColor: m.color }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Usage frequency ---------------- */

function UsageFrequencyCard({ logs, meds }) {
  const rows = useMemo(() => usageFrequency(logs, meds), [logs, meds]);
  if (!rows.length) return null;
  const TrendIcon = { up: TrendingUp, down: TrendingDown, flat: MinusIcon };
  const trendColor = { up: "text-[hsl(var(--warning))]", down: "text-[hsl(var(--success))]", flat: "text-muted-foreground" };
  return (
    <div className="card-soft p-4" data-testid="usage-frequency-card">
      <div className="flex items-center gap-2 mb-1"><RefreshCw className="h-4 w-4 text-primary" /><p className="font-semibold">How often you're using</p></div>
      <p className="text-xs text-muted-foreground mb-3">Times taken recently. Frequency, not just dose, shapes tolerance and dependence.</p>
      <div className="space-y-3">
        {rows.map((r) => {
          const Icon = TrendIcon[r.trend];
          return (
            <div key={r.id} data-testid="usage-frequency-row" className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{r.name}</p>
                  {r.flagged && <span className="text-[10px] rounded-full bg-destructive/12 text-destructive px-1.5 py-0.5 shrink-0">higher risk</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{r.week}×</span> this week · <span className="font-semibold text-foreground">{r.month}×</span> in 30 days
                </p>
              </div>
              <span className={cn("inline-flex items-center gap-0.5 text-xs shrink-0", trendColor[r.trend])} title={`Last week: ${r.prevWeek}×`}>
                <Icon className="h-3.5 w-3.5" />
                {r.trend === "up" ? "rising" : r.trend === "down" ? "easing" : "steady"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground mt-3">Descriptive only — not a diagnosis. A rising trend on a higher-risk medication is worth discussing with a clinician.</p>
    </div>
  );
}

/* ---------------- Mood ---------------- */

const DIMS = [
  { k: "energy", l: "Energy" }, { k: "sleep", l: "Sleep" },
  { k: "pain", l: "Pain" }, { k: "anxiety", l: "Anxiety" },
];

function MoodTab({ mood, checkins, range }) {
  const TrendIcon = mood.trend.direction === "improving" ? TrendingUp : mood.trend.direction === "declining" ? TrendingDown : MinusIcon;
  const chartData = mood.series.map((p) => ({ ...p, label: fmtDate(p.date, "MMM d") }));
  const dimStats = DIMS.map((d) => {
    const series = dimensionSeries(checkins, d.k, { days: range });
    const t = moodTrend(series);
    return { ...d, ...t };
  }).filter((d) => d.n > 0);

  if (mood.trend.n === 0) {
    return <EmptyState icon={Smile} title="No mood data yet" description="Do a quick check-in from the Today page, or add a mood when logging a dose." />;
  }

  return (
    <>
      <div className="card-soft p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold">Mood trend</p>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground capitalize"><TrendIcon className="h-4 w-4" />{mood.trend.direction} · avg {mood.trend.avg} {MOOD_EMOJI[Math.round(mood.trend.avg)] || ""}</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ left: -30, right: 8, top: 8 }}>
            <defs>
              <linearGradient id="moodfull" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={28} stroke="hsl(var(--muted-foreground))" />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v) => [`${v} ${MOOD_EMOJI[Math.round(v)] || ""}`, "Mood"]} />
            <Area type="monotone" dataKey="mood" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#moodfull)" connectNulls dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <p className="text-[11px] text-muted-foreground mt-1">{mood.trend.n} day{mood.trend.n === 1 ? "" : "s"} with mood data in the last {range}.</p>
      </div>

      {dimStats.length > 0 && (
        <div className="card-soft p-4">
          <p className="font-semibold mb-3">Check-in dimensions</p>
          <div className="grid grid-cols-2 gap-3">
            {dimStats.map((d) => {
              const Icon = d.direction === "improving" ? TrendingUp : d.direction === "declining" ? TrendingDown : MinusIcon;
              return (
                <div key={d.k} className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">{d.l}</p>
                  <p className="font-semibold text-lg">{d.avg}<span className="text-xs text-muted-foreground font-normal">/5</span></p>
                  <p className="text-[11px] text-muted-foreground capitalize flex items-center gap-1"><Icon className="h-3 w-3" />{d.direction}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Behaviour ---------------- */

function BehaviourTab({ report }) {
  const anyHigh = report.flagged.some((r) => r.level === "high");

  return (
    <>
      <div className="card-soft p-4 text-xs text-muted-foreground flex gap-2 items-start">
        <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p>{SAFETY_COPY.framing}</p>
      </div>

      {anyHigh && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3 items-start" data-testid="crisis-callout">
          <LifeBuoy className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">{SAFETY_COPY.crisis}</p>
        </div>
      )}

      {report.per_med.length === 0 && (
        <EmptyState icon={ShieldAlert} title="Nothing to analyze" description="Behaviour analysis covers as-needed medications and those with a known dependency risk. None of your current medications qualify — that's a good thing." />
      )}

      {report.per_med.map((r) => <BehaviourCard key={r.medication_id} r={r} />)}

      {report.per_med.length > 0 && (
        <p className="text-[11px] text-muted-foreground px-1 pb-2">{SAFETY_COPY.disclaimer}</p>
      )}
    </>
  );
}

function BehaviourCard({ r }) {
  const st = LEVEL_STYLES[r.level] || LEVEL_STYLES.none;
  return (
    <div className="card-soft p-4" data-testid="behaviour-card">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">{r.name}</p>
            <span className={cn("text-[11px] rounded-full px-2 py-0.5 font-medium", st.c)}>{st.l}</span>
          </div>
          <p className="text-xs text-muted-foreground capitalize">Dependency risk on file: {r.dependency_risk_category}</p>
        </div>
        {r.score != null && (
          <div className="text-right">
            <p className="font-display text-2xl font-semibold">{r.score}</p>
            <p className="text-[10px] text-muted-foreground -mt-1">signal score</p>
          </div>
        )}
      </div>

      {r.data_quality === "insufficient" && (
        <p className="text-xs text-muted-foreground mt-2">Not enough logged history yet — keep logging doses and this analysis will activate (needs ~2 weeks of data).</p>
      )}

      {(r.signals || []).length > 0 && (
        <div className="mt-3 space-y-2">
          {r.signals.slice(0, 3).map((s) => (
            <div key={s.id} className="rounded-xl bg-muted/40 px-3 py-2">
              <p className="text-sm font-medium">{s.label}</p>
              {s.detail && <p className="text-xs text-muted-foreground mt-0.5">{s.detail}</p>}
            </div>
          ))}
        </div>
      )}

      {r.score != null && (r.signals || []).length === 0 && (
        <p className="text-xs text-muted-foreground mt-2">No concerning usage patterns detected in your recent logs.</p>
      )}

      {(r.suggested_actions || []).length > 0 && (
        <div className="mt-3 space-y-1.5">
          {r.suggested_actions.map((a, i) => a.link ? (
            <Link key={i} to={a.link} className="block text-xs text-primary">{a.text} →</Link>
          ) : (
            <p key={i} className="text-xs text-muted-foreground">{a.text}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, color, label, value }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "22", color }}><Icon className="h-4 w-4" /></div>
      <div><p className="text-xs text-muted-foreground leading-none">{label}</p><p className="font-semibold text-sm mt-0.5">{value}</p></div>
    </div>
  );
}
