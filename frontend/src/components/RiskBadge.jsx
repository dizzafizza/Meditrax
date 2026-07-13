import { cn } from "@/lib/utils";
import { ShieldAlert, AlertTriangle, ShieldCheck } from "lucide-react";

const toneClass = {
  low: "bg-[hsl(var(--risk-low-bg))] text-[hsl(var(--risk-low-fg))] border-[hsl(var(--risk-low-border))]",
  medium: "bg-[hsl(var(--risk-medium-bg))] text-[hsl(var(--risk-medium-fg))] border-[hsl(var(--risk-medium-border))]",
  high: "bg-[hsl(var(--risk-high-bg))] text-[hsl(var(--risk-high-fg))] border-[hsl(var(--risk-high-border))]",
  dependency: "bg-[hsl(var(--risk-dependency-bg))] text-[hsl(var(--risk-dependency-fg))] border-[hsl(var(--risk-dependency-border))]",
};

export function RiskBadge({ tone = "low", label, icon = true, className }) {
  if (!label) return null;
  const Icon = tone === "high" ? ShieldAlert : tone === "medium" ? AlertTriangle : ShieldCheck;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", toneClass[tone], className)}>
      {icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}
