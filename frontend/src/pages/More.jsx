import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { CalendarDays, TrendingDown, RefreshCw, Package, BookOpen, Sparkles, Activity, Bell, User, Settings as SettingsIcon, ChevronRight, ShieldCheck, FileText, Stethoscope, FlaskConical } from "lucide-react";

const ITEMS = [
  { to: "/calendar", label: "Calendar", desc: "Adherence history", icon: CalendarDays, testid: "more-calendar" },
  { to: "/taper", label: "Taper Planner", desc: "Plan dose reductions", icon: TrendingDown, testid: "more-taper" },
  { to: "/cyclic", label: "Cyclic Dosing", desc: "On/off cycles", icon: RefreshCw, testid: "more-cyclic" },
  { to: "/inventory", label: "Inventory", desc: "Stock & refills", icon: Package, testid: "more-inventory" },
  { to: "/capsules", label: "Capsule Calculator", desc: "Fill capsules from bulk powder", icon: FlaskConical, testid: "more-capsules" },
  { to: "/knowledge", label: "Knowledge Base", desc: "Medication library", icon: BookOpen, testid: "more-knowledge" },
  { to: "/assistant", label: "AI Assistant", desc: "Ask anything", icon: Sparkles, testid: "more-assistant" },
  { to: "/effects", label: "Effects & Journal", desc: "Mood & effectiveness", icon: Activity, testid: "more-effects" },
  { to: "/reminders", label: "Reminders", desc: "Dose reminders", icon: Bell, testid: "more-reminders" },
  { to: "/profile", label: "Health Profile", desc: "Your details", icon: User, testid: "more-profile" },
  { to: "/settings", label: "Settings", desc: "Theme, notifications, data", icon: SettingsIcon, testid: "more-settings" },
];

const LEGAL_ITEMS = [
  { to: "/legal/privacy", label: "Privacy Policy", desc: "Your data stays on your device", icon: ShieldCheck, testid: "more-privacy" },
  { to: "/legal/terms", label: "Terms of Use", desc: "Terms of service for the app", icon: FileText, testid: "more-terms" },
  { to: "/legal/disclaimer", label: "Medical Disclaimer", desc: "Educational info, not medical advice", icon: Stethoscope, testid: "more-disclaimer" },
];

export default function More() {
  return (
    <div>
      <PageHeader title="More" subtitle="Everything Meditrax can do" />
      <div className="px-4 pb-24">
        <div className="card-soft divide-y divide-border overflow-hidden">
          {ITEMS.map((it) => {
            const Icon = it.icon;
            return (
              <Link key={it.to} to={it.to} data-testid={it.testid} className="flex items-center gap-3 px-4 py-3.5 pressable">
                <div className="h-10 w-10 rounded-xl bg-primary/12 text-primary flex items-center justify-center"><Icon className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0"><p className="font-semibold">{it.label}</p><p className="text-xs text-muted-foreground">{it.desc}</p></div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6 mb-2">Legal</p>
        <div className="card-soft divide-y divide-border overflow-hidden">
          {LEGAL_ITEMS.map((it) => {
            const Icon = it.icon;
            return (
              <Link key={it.to} to={it.to} data-testid={it.testid} className="flex items-center gap-3 px-4 py-3.5 pressable">
                <div className="h-10 w-10 rounded-xl bg-muted text-muted-foreground flex items-center justify-center"><Icon className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0"><p className="font-semibold">{it.label}</p><p className="text-xs text-muted-foreground">{it.desc}</p></div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">Meditrax · a calmer way to manage medications</p>
      </div>
    </div>
  );
}
