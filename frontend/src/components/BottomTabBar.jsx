import { NavLink, useLocation } from "react-router-dom";
import { Home, Pill, BarChart3, LayoutGrid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Today", icon: Home, testid: "bottom-tab-today", exact: true },
  { to: "/medications", label: "Meds", icon: Pill, testid: "bottom-tab-medications" },
  { to: "/insights", label: "Insights", icon: BarChart3, testid: "bottom-tab-insights" },
  { to: "/more", label: "More", icon: LayoutGrid, testid: "bottom-tab-more" },
];

export default function BottomTabBar({ onQuickAdd }) {
  const loc = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/70"
      style={{ height: "calc(var(--tabbar-h) + var(--sab))", paddingBottom: "var(--sab)" }}
    >
      <div className="mx-auto max-w-2xl h-[76px] grid grid-cols-5 items-center px-2">
        {tabs.slice(0, 2).map((t) => (
          <TabItem key={t.to} tab={t} active={t.exact ? loc.pathname === "/" : loc.pathname.startsWith(t.to)} />
        ))}
        <div className="flex items-center justify-center">
          <button
            data-testid="bottom-tab-quick-add"
            onClick={onQuickAdd}
            aria-label="Quick add"
            className="pressable -mt-7 h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_14px_34px_-10px_hsl(var(--primary)/0.7)] border-4 border-background"
          >
            <Plus className="h-7 w-7" strokeWidth={2.4} />
          </button>
        </div>
        {tabs.slice(2).map((t) => (
          <TabItem key={t.to} tab={t} active={loc.pathname.startsWith(t.to)} />
        ))}
      </div>
    </nav>
  );
}

function TabItem({ tab, active }) {
  const Icon = tab.icon;
  return (
    <NavLink
      to={tab.to}
      data-testid={tab.testid}
      className="flex flex-col items-center justify-center gap-1 h-full"
    >
      <Icon
        className={cn("h-[22px] w-[22px] transition-colors", active ? "text-primary" : "text-muted-foreground")}
        strokeWidth={active ? 2.4 : 2}
      />
      <span className={cn("text-[11px] font-medium transition-colors", active ? "text-primary" : "text-muted-foreground")}>
        {tab.label}
      </span>
    </NavLink>
  );
}
