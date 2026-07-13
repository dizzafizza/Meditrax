import { cn } from "@/lib/utils";

export default function EmptyState({ icon: Icon, title, description, action, className, testid = "empty-state" }) {
  return (
    <div data-testid={testid} className={cn("rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center flex flex-col items-center", className)}>
      {Icon && (
        <div className="mb-3 h-14 w-14 rounded-2xl bg-accent/70 text-accent-foreground flex items-center justify-center">
          <Icon className="h-7 w-7" />
        </div>
      )}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
