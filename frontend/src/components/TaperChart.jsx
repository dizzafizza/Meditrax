import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot } from "recharts";

export default function TaperChart({ steps = [], unit = "mg", currentStep = null, height = 200 }) {
  const data = steps.map((s) => ({ day: s.start_day, dose: s.dose, date: s.date, step: s.step }));
  return (
    <div data-testid="taper-curve-chart">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ left: -18, right: 10, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="taperLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" />
              <stop offset="100%" stopColor="hsl(var(--chart-2))" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 6" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(d) => `d${d}`} />
          <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
            formatter={(v) => [`${v} ${unit}`, "Dose"]}
            labelFormatter={(d) => `Day ${d}`}
          />
          <Line type="monotone" dataKey="dose" stroke="url(#taperLine)" strokeWidth={3} dot={{ r: 3, fill: "hsl(var(--chart-1))" }} activeDot={{ r: 5 }} />
          {currentStep != null && data[currentStep] && (
            <ReferenceDot x={data[currentStep].day} y={data[currentStep].dose} r={6} fill="hsl(var(--warning))" stroke="hsl(var(--card))" strokeWidth={2} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
