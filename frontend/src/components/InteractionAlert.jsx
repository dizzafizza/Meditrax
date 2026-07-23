import { AlertTriangle } from "lucide-react";
import { SEVERE, severityMeta } from "@/lib/interactions";

// Compact red interaction-warning box shown on medication cards (home screen)
// and in the log-dose sheet when the medication interacts with something the
// user has active (recently taken or an active effect session).
export default function InteractionAlert({ findings, className = "" }) {
  if (!findings?.length) return null;
  return (
    <div className={`rounded-xl border border-destructive/40 bg-destructive/5 p-2.5 ${className}`} data-testid="interaction-alert">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-destructive">
            {findings.some((f) => f.severity === SEVERE) ? "High-risk interaction" : "Interaction — use caution"}
          </p>
          <ul className="mt-1 space-y-1">
            {findings.map((f, i) => (
              <li key={i} className="text-[11px] text-muted-foreground leading-snug">
                <span className="font-medium text-foreground">With {f.otherName} ({severityMeta(f.severity).label.toLowerCase()}):</span> {f.reason}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
