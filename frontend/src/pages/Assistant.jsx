import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import Markdown from "@/components/Markdown";
import { getAiConfig, getChat, addChatMessage, clearChat, getProfile, getMedications, getToday } from "@/lib/api";
import { runAssistantLoop, buildSystemPrompt, hasKey, resolveModel } from "@/lib/ai";
import { useAITools } from "@/context/AIToolsContext";
import { useProfiles } from "@/context/ProfileContext";
import { Sparkles, Send, Info, Trash2, Settings as SettingsIcon, Wrench, Check, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

function sessionId() {
  let s = localStorage.getItem("meditrax-ai-session");
  if (!s) { s = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()); localStorage.setItem("meditrax-ai-session", s); }
  return s;
}

const TOOL_LABELS = {
  set_theme: "Changing theme", switch_profile: "Switching profile", create_profile: "Creating profile",
  list_profiles: "Reading profiles", list_medications: "Reading medications", add_medication: "Adding medication",
  update_medication: "Updating medication", delete_medication: "Deleting medication", log_dose: "Logging dose",
  create_taper_plan: "Building taper plan", get_today: "Checking today", get_inventory: "Checking inventory",
  get_analytics: "Reading analytics", navigate: "Opening page",
};

export default function Assistant() {
  const sid = useRef(sessionId());
  const scrollRef = useRef(null);
  const { tools, executeTool } = useAITools();
  const { activeId } = useProfiles();
  const { data: config } = useQuery({ queryKey: ["aiConfig"], queryFn: getAiConfig });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [toolEvents, setToolEvents] = useState([]);
  const [modelUsed, setModelUsed] = useState(null);

  useEffect(() => {
    getChat(sid.current).then((h) => setMessages(h.map((m) => ({ role: m.role, content: m.content }))));
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming, toolEvents]);

  const keyReady = hasKey(config);
  const agentMode = config?.advanced !== false;

  async function send(text) {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    if (!keyReady) return;
    setInput("");
    setToolEvents([]);
    const priorHistory = messages.map((m) => ({ role: m.role, content: m.content })).filter((m) => m.content);
    setMessages((m) => [...m, { role: "user", content: msg }, { role: "assistant", content: "" }]);
    setStreaming(true);
    await addChatMessage(sid.current, "user", msg);

    try {
      const [prof, meds, today] = await Promise.all([getProfile(), getMedications(), getToday()]);
      const active = (meds || []).filter((m) => m.is_active !== false);
      const medsSummary = active.length
        ? active.map((m) => `${m.name}${m.strength ? ` ${m.strength}${m.unit || ""}` : ""}`).join(", ")
        : "none yet";
      const todaySummary = today?.summary
        ? `${today.summary.taken}/${today.summary.total} doses taken (${today.summary.adherence}% adherence)`
        : "";
      const system = buildSystemPrompt({
        personality: config.personality,
        context: { profileName: prof?.name, medsSummary, todaySummary },
        toolsEnabled: agentMode,
      });
      const apiMessages = [{ role: "system", content: system }, ...priorHistory, { role: "user", content: msg }];

      const { content } = await runAssistantLoop({
        config,
        messages: apiMessages,
        tools: agentMode ? tools : [],
        executeTool,
        onDelta: (d) =>
          setMessages((m) => {
            const c = [...m];
            c[c.length - 1] = { role: "assistant", content: c[c.length - 1].content + d };
            return c;
          }),
        onEvent: (e) => {
          if (e.type === "model") setModelUsed(e.model);
          else if (e.type === "tool_start") setToolEvents((t) => [...t, { name: e.name, status: "running" }]);
          else if (e.type === "tool_end")
            setToolEvents((t) => {
              const c = [...t];
              for (let i = c.length - 1; i >= 0; i--) if (c[i].status === "running") { c[i] = { ...c[i], status: e.result?.error ? "error" : "done" }; break; }
              return c;
            });
        },
      });

      const finalText = content || "Done.";
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "assistant", content: finalText };
        return c;
      });
      await addChatMessage(sid.current, "assistant", finalText);
    } catch (e) {
      const errText = `${e?.message || "Something went wrong. Please try again."}`;
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "assistant", content: `\u26A0\uFE0F ${errText}` };
        return c;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function handleClear() {
    await clearChat(sid.current);
    setMessages([]);
    setToolEvents([]);
    setModelUsed(null);
  }

  const empty = messages.length === 0;
  const personaName = config?.personality?.name || "Meditrax";
  const suggestions = [
    "Add Sertraline 50mg once daily",
    "How do I taper off a benzodiazepine safely?",
    "Switch to dark mode",
    "Summarize my adherence this month",
  ];

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>
      <PageHeader
        title={personaName}
        subtitle={modelUsed ? `via ${modelUsed}` : "Your AI medication companion"}
        right={
          <div className="flex items-center gap-1">
            <Link to="/settings" data-testid="assistant-settings-link" aria-label="Assistant settings" className="pressable h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground">
              <SettingsIcon className="h-5 w-5" />
            </Link>
            <button onClick={handleClear} data-testid="assistant-clear" aria-label="Clear chat" className="pressable h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground">
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        }
      />

      <div className="px-4">
        <div className="rounded-xl bg-[hsl(var(--info-surface))] text-[hsl(var(--info))] px-3 py-2 text-xs flex items-center gap-2">
          <Info className="h-4 w-4 shrink-0" />
          Educational info only — not a substitute for professional medical advice.
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-y px-4 py-4 space-y-3" style={{ paddingBottom: keyReady ? "180px" : "24px" }}>
        {!keyReady && (
          <div className="card-soft p-5 text-center mt-6" data-testid="assistant-setup-card">
            <div className="h-16 w-16 mx-auto rounded-3xl bg-primary/12 text-primary flex items-center justify-center"><KeyRound className="h-8 w-8" /></div>
            <h2 className="font-display text-2xl font-semibold mt-4">Connect the assistant</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              The assistant runs entirely in your browser using your own OpenRouter API key. Add a key to start chatting and let it help manage your medications.
            </p>
            <Link to="/settings" data-testid="assistant-add-key" className="inline-flex items-center gap-2 mt-4 h-11 px-5 rounded-xl bg-primary text-primary-foreground font-medium pressable">
              <KeyRound className="h-4 w-4" />Add your API key
            </Link>
            <p className="text-[11px] text-muted-foreground mt-3">Get a free key at openrouter.ai · your key is stored only on this device.</p>
          </div>
        )}

        {keyReady && empty && (
          <div className="flex flex-col items-center text-center pt-8">
            <div className="h-16 w-16 rounded-3xl bg-primary/12 text-primary flex items-center justify-center"><Sparkles className="h-8 w-8" /></div>
            <h2 className="font-display text-2xl font-semibold mt-4">How can I help?</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Ask about your medications, adherence or tapering — or tell me to add a med, log a dose, or change a setting.
            </p>
          </div>
        )}

        {messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          return (
            <div key={i}>
              <div data-testid="ai-chat-message" className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[88%] rounded-2xl px-4 py-2.5", m.role === "user" ? "bg-secondary text-foreground rounded-tr-md" : "bg-accent text-accent-foreground rounded-tl-md")}>
                  {m.role === "assistant" ? (
                    m.content ? (
                      <Markdown>{m.content}</Markdown>
                    ) : streaming && isLast ? (
                      <span className="inline-flex gap-1 py-1">
                        <span className="typing-dot">●</span>
                        <span className="typing-dot" style={{ animationDelay: "0.2s" }}>●</span>
                        <span className="typing-dot" style={{ animationDelay: "0.4s" }}>●</span>
                      </span>
                    ) : ""
                  ) : (
                    <span className="text-[15px] leading-6 whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
              {m.role === "assistant" && isLast && toolEvents.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 ml-1" data-testid="assistant-tool-activity">
                  {toolEvents.map((t, j) => (
                    <span key={j} className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 h-7 text-[11px] font-medium",
                      t.status === "error" ? "border-destructive/40 text-destructive bg-destructive/5"
                        : t.status === "done" ? "border-[hsl(var(--success))]/30 text-[hsl(var(--success))] bg-[hsl(var(--success-surface))]"
                          : "border-border text-muted-foreground bg-card")}>
                      {t.status === "done" ? <Check className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                      {TOOL_LABELS[t.name] || t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {keyReady && (
        <div className="fixed left-0 right-0 z-30" style={{ bottom: "calc(var(--tabbar-h) + var(--sab))" }}>
          <div className="mx-auto max-w-2xl px-3 pb-2">
            {empty && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {suggestions.map((s, i) => (
                  <button key={i} data-testid="ai-chat-suggestion" onClick={() => send(s)} className="shrink-0 rounded-full border border-border bg-card px-3 h-9 text-xs text-foreground pressable">{s}</button>
                ))}
              </div>
            )}
            <div className="glass rounded-2xl border border-border p-1.5 flex items-end gap-2">
              <textarea
                data-testid="ai-chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                placeholder={agentMode ? "Ask anything, or tell me to do it…" : "Ask anything…"}
                className="flex-1 resize-none bg-transparent outline-none px-2 py-2 text-[15px] max-h-28"
              />
              <button data-testid="ai-chat-send" onClick={() => send()} disabled={streaming || !input.trim()} className="pressable h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50">
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
