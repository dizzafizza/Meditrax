import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSettings, updateSettings, exportData, importData, testPush, getAiConfig, updateAiConfig } from "@/lib/api";
import { testConnection, CURATED_MODELS, TASK_TIER_DEFAULTS, TIER_LABELS } from "@/lib/ai";
import { useTheme } from "@/context/ThemeContext";
import { pushStatus, enablePush, disablePush, isIOS, isStandalone, showLocalNotification } from "@/lib/push";
import { cn } from "@/lib/utils";
import { Bell, Sun, Moon, Monitor, Download, Upload, ShieldCheck, Smartphone, Send, Sparkles, KeyRound, Eye, EyeOff, Bot, Wand2, CheckCircle2 } from "lucide-react";

const PERSONAS = [
  { v: "supportive", l: "Supportive companion" },
  { v: "clinical", l: "Clinical pharmacist" },
  { v: "friend", l: "Caring friend" },
  { v: "coach", l: "Health coach" },
  { v: "concise", l: "No-nonsense" },
];
const VERBOSITY = [
  { v: "brief", l: "Brief" },
  { v: "balanced", l: "Balanced" },
  { v: "detailed", l: "Detailed" },
];

export default function Settings() {
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const { data: aiConfig } = useQuery({ queryKey: ["aiConfig"], queryFn: getAiConfig });
  const [push, setPush] = useState({ supported: false, permission: "default", subscribed: false });
  const fileRef = useRef(null);

  // local AI form state
  const [ai, setAi] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  useEffect(() => { if (aiConfig && !ai) setAi(aiConfig); }, [aiConfig]); // eslint-disable-line

  useEffect(() => { pushStatus().then(setPush); }, []);

  const setAiField = (patch) => setAi((a) => ({ ...a, ...patch }));
  const setPersona = (patch) => setAi((a) => ({ ...a, personality: { ...a.personality, ...patch } }));

  const saveAi = useMutation({
    mutationFn: () => updateAiConfig(ai),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["aiConfig"] }); toast.success("Assistant settings saved"); },
    onError: () => toast.error("Could not save settings"),
  });

  async function runTest() {
    setTesting(true);
    try {
      await testConnection(ai);
      toast.success("Connection works — your key is valid");
    } catch (e) {
      toast.error(e?.message || "Connection failed");
    } finally { setTesting(false); }
  }

  async function togglePush(on) {
    try {
      if (on) { await enablePush(); toast.success("Notifications enabled"); }
      else { await disablePush(); toast.success("Notifications disabled"); }
      setPush(await pushStatus());
    } catch (e) {
      if (e.message === "denied") toast.error("Permission denied. Enable notifications in your device settings.");
      else if (isIOS() && !isStandalone()) toast.error("On iPhone, add Meditrax to your Home Screen first, then enable notifications.");
      else toast.error("Notifications aren't available here.");
    }
  }

  async function sendTest() {
    try { const r = await testPush({ title: "Meditrax", body: "Test reminder — notifications work!" }); if (r.sent) toast.success("Test notification sent"); else { const ok = await showLocalNotification("Meditrax", "Test reminder — notifications work!"); if (!ok) toast.error("Enable notifications first"); } }
    catch { toast.error("Enable notifications first"); }
  }

  async function doExport() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `meditrax-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    toast.success("Backup downloaded");
  }
  async function doImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    try { const text = await file.text(); const json = JSON.parse(text); await importData(json); ["medications", "today", "tapers", "cyclic", "reminders", "inventory", "analytics", "profile", "aiConfig", "settings"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast.success("Data imported"); }
    catch { toast.error("Invalid backup file"); }
  }

  const themes = [{ v: "light", l: "Light", icon: Sun }, { v: "dark", l: "Dark", icon: Moon }, { v: "system", l: "Auto", icon: Monitor }];

  return (
    <div>
      <PageHeader back title="Settings" />
      <div className="px-4 space-y-4 pb-8">
        {/* Appearance */}
        <div className="card-soft p-4">
          <p className="font-semibold mb-3">Appearance</p>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => { const Icon = t.icon; return (
              <button key={t.v} onClick={() => setTheme(t.v)} data-testid={`theme-${t.v}`} className={cn("rounded-xl border py-3 flex flex-col items-center gap-1 text-sm transition-[background-color,border-color] duration-150", theme === t.v ? "border-primary bg-accent" : "border-border bg-card")}><Icon className="h-5 w-5" />{t.l}</button>
            ); })}
          </div>
        </div>

        {/* AI Assistant */}
        <div className="card-soft p-4 space-y-4">
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><p className="font-semibold">AI Assistant</p></div>

          {/* API key */}
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" />OpenRouter API key</Label>
            <div className="relative mt-1">
              <Input
                data-testid="ai-key-input"
                type={showKey ? "text" : "password"}
                value={ai?.apiKeys?.openrouter || ""}
                onChange={(e) => setAi((a) => ({ ...a, apiKeys: { ...a.apiKeys, openrouter: e.target.value } }))}
                placeholder="sk-or-v1-…"
                className="h-11 rounded-xl pr-11 font-mono text-sm"
                autoComplete="off"
              />
              <button onClick={() => setShowKey((s) => !s)} aria-label="Toggle key visibility" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Stored only on this device. Get a key at <a className="text-primary underline underline-offset-2" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>.</p>
          </div>

          {/* Auto-route + model */}
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Automatic model routing</p><p className="text-xs text-muted-foreground">Let OpenRouter pick the best model</p></div>
            <Switch data-testid="ai-autoroute-switch" checked={!!ai?.autoRoute} onCheckedChange={(v) => setAiField({ autoRoute: v, model: v ? "openrouter/auto" : (ai?.model && ai.model !== "openrouter/auto" ? ai.model : "anthropic/claude-sonnet-4.5") })} />
          </div>
          {!ai?.autoRoute && (
            <div>
              <Label className="text-xs text-muted-foreground">Model</Label>
              <Select value={ai?.model || "anthropic/claude-sonnet-4.5"} onValueChange={(v) => setAiField({ model: v })}>
                <SelectTrigger data-testid="ai-model-select" className="h-11 rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURATED_MODELS.filter((m) => m.id !== "openrouter/auto").map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Task-tier models (cost-effective routing) */}
          <details className="rounded-xl border border-border p-3">
            <summary className="text-sm font-medium cursor-pointer select-none">Task models (advanced)</summary>
            <p className="text-[11px] text-muted-foreground mt-1.5 mb-2">Cheaper models handle simple tasks automatically; heavier reports use a stronger one. Override per task if you like.</p>
            {["light", "standard"].map((tier) => (
              <div key={tier} className="mt-2">
                <Label className="text-[11px] text-muted-foreground">{TIER_LABELS[tier]}</Label>
                <Select
                  value={ai?.modelTiers?.[tier] || "recommended"}
                  onValueChange={(v) => setAi((a) => ({ ...a, modelTiers: { ...(a.modelTiers || {}), [tier]: v === "recommended" ? null : v } }))}
                >
                  <SelectTrigger data-testid={`ai-tier-${tier}-select`} className="h-10 rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">Recommended ({TASK_TIER_DEFAULTS[tier]})</SelectItem>
                    {CURATED_MODELS.filter((m) => m.id !== "openrouter/auto").map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </details>

          {/* Agent mode */}
          <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
            <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /><div><p className="text-sm font-medium">Agent mode</p><p className="text-xs text-muted-foreground">Let the assistant change the app for you</p></div></div>
            <Switch data-testid="ai-agent-switch" checked={ai?.advanced !== false} onCheckedChange={(v) => setAiField({ advanced: v })} />
          </div>

          {/* Personality */}
          <div className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Personality</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">Name</Label>
                <Input data-testid="ai-name-input" value={ai?.personality?.name || ""} onChange={(e) => setPersona({ name: e.target.value })} placeholder="Meditrax" className="h-10 rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Persona</Label>
                <Select value={ai?.personality?.persona || "supportive"} onValueChange={(v) => setPersona({ persona: v })}>
                  <SelectTrigger data-testid="ai-persona-select" className="h-10 rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PERSONAS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Warmth: {ai?.personality?.warmth ?? 70}</Label>
              <Slider data-testid="ai-warmth-slider" value={[ai?.personality?.warmth ?? 70]} onValueChange={(v) => setPersona({ warmth: v[0] })} min={0} max={100} step={5} className="mt-2.5" />
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label className="text-[11px] text-muted-foreground">Verbosity</Label>
                <Select value={ai?.personality?.verbosity || "balanced"} onValueChange={(v) => setPersona({ verbosity: v })}>
                  <SelectTrigger data-testid="ai-verbosity-select" className="h-10 rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{VERBOSITY.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 h-10">
                <span className="text-sm">Emojis</span>
                <Switch data-testid="ai-emoji-switch" checked={!!ai?.personality?.emoji} onCheckedChange={(v) => setPersona({ emoji: v })} />
              </div>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Custom instructions</Label>
              <Textarea data-testid="ai-instructions-input" value={ai?.personality?.customInstructions || ""} onChange={(e) => setPersona({ customInstructions: e.target.value })} placeholder="e.g. Always remind me to check with my doctor; call me by my first name." className="rounded-xl mt-1" />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1 h-11 rounded-xl" onClick={runTest} disabled={testing || !ai?.apiKeys?.openrouter} data-testid="ai-test-button">
              {testing ? "Testing…" : <><CheckCircle2 className="h-4 w-4 mr-1" />Test</>}
            </Button>
            <Button className="flex-1 h-11 rounded-xl" onClick={() => saveAi.mutate()} disabled={saveAi.isPending || !ai} data-testid="ai-save-button">
              {saveAi.isPending ? "Saving…" : "Save assistant"}
            </Button>
          </div>
        </div>

        {/* Notifications */}
        <div className="card-soft p-4">
          <div className="flex items-center gap-2 mb-3"><Bell className="h-4 w-4 text-primary" /><p className="font-semibold">Notifications</p></div>
          {isIOS() && !isStandalone() && (
            <div className="rounded-xl bg-[hsl(var(--info-surface))] text-[hsl(var(--info))] p-3 text-xs mb-3 flex gap-2"><Smartphone className="h-4 w-4 shrink-0" />Add Meditrax to your Home Screen (Share → Add to Home Screen) to enable notifications on iOS.</div>
          )}
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium">Dose reminders</p><p className="text-xs text-muted-foreground">{!push.supported ? "Not supported on this browser" : push.permission === "denied" ? "Blocked in browser settings" : push.subscribed ? "On — scheduled while app is open" : "Off"}</p></div>
            <Switch checked={push.subscribed} disabled={!push.supported || push.permission === "denied"} onCheckedChange={togglePush} data-testid="push-enable-cta" />
          </div>
          <Button variant="secondary" className="w-full rounded-xl mt-3" onClick={sendTest} data-testid="push-test-button"><Send className="h-4 w-4 mr-1" />Send test notification</Button>
          <p className="text-[11px] text-muted-foreground mt-2">Reminders fire while the app is open or installed. Background delivery varies by device (especially on iOS).</p>
        </div>

        {/* Data */}
        <div className="card-soft p-4">
          <p className="font-semibold mb-3">Your data</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" className="rounded-xl" onClick={doExport} data-testid="export-button"><Download className="h-4 w-4 mr-1" />Export</Button>
            <Button variant="secondary" className="rounded-xl" onClick={() => fileRef.current?.click()} data-testid="import-button"><Upload className="h-4 w-4 mr-1" />Import</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={doImport} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Everything is stored locally on this device. Export regularly to back up across profiles.</p>
        </div>

        {/* Disclaimer */}
        <div className="rounded-2xl bg-muted/50 border border-border p-4">
          <div className="flex items-center gap-2 mb-1"><ShieldCheck className="h-4 w-4 text-primary" /><p className="font-semibold text-sm">Medical disclaimer</p></div>
          <p className="text-xs text-muted-foreground">Meditrax is for personal tracking and education only. It is not medical advice. Always consult a licensed clinician or pharmacist, and never change or stop a medication abruptly without professional guidance.</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            <Link to="/legal/privacy" className="text-xs text-primary underline underline-offset-2" data-testid="settings-privacy-link">Privacy Policy</Link>
            <Link to="/legal/terms" className="text-xs text-primary underline underline-offset-2" data-testid="settings-terms-link">Terms of Use</Link>
            <Link to="/legal/disclaimer" className="text-xs text-primary underline underline-offset-2" data-testid="settings-disclaimer-link">Medical Disclaimer</Link>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground pb-2">Meditrax · offline-first · v2.0</p>
      </div>
    </div>
  );
}
