import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PageHeader({ title, subtitle, back, right, large = true, className }) {
  const navigate = useNavigate();
  return (
    <header className={cn("safe-top px-4 pt-4 pb-2 sticky top-0 z-30 glass", className)}>
      <div className="flex items-center justify-between gap-2 min-h-[44px]">
        <div className="flex items-center gap-1.5 min-w-0">
          {back && (
            <button
              onClick={() => navigate(-1)}
              data-testid="page-back"
              className="pressable -ml-2 h-10 w-10 rounded-full flex items-center justify-center text-primary hover:bg-muted"
              aria-label="Back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className={cn("font-display font-semibold tracking-[-0.02em] truncate", large ? "text-[28px] leading-tight" : "text-xl")}>{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="flex items-center gap-1 shrink-0">{right}</div>}
      </div>
    </header>
  );
}
