import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useUI } from "@/context/UIContext";
import { createCheckin } from "@/lib/api";
import { cn } from "@/lib/utils";

const MOODS = [
  { v: 5, e: "😊", l: "Great" },
  { v: 4, e: "🙂", l: "Good" },
  { v: 3, e: "😐", l: "Okay" },
  { v: 2, e: "😕", l: "Low" },
  { v: 1, e: "😟", l: "Bad" },
];

const DIMENSIONS = [
  { k: "energy", l: "Energy", low: "Drained", high: "Energized" },
  { k: "sleep", l: "Sleep quality", low: "Poor", high: "Great" },
  { k: "pain", l: "Pain", low: "None", high: "Severe" },
  { k: "anxiety", l: "Anxiety", low: "Calm", high: "Very anxious" },
];

export default function CheckinSheet() {
  const ui = useUI();
  const qc = useQueryClient();
  const [mood, setMood] = useState(null);
  const [dims, setDims] = useState({});
  const [notes, setNotes] = useState("");
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (ui.checkinSheet.open) { setMood(null); setDims({}); setNotes(""); setShowMore(false); }
  }, [ui.checkinSheet.open]);

  const mutation = useMutation({
    mutationFn: createCheckin,
    onSuccess: () => {
      ["checkins", "logs", "analytics"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success("Check-in saved");
      ui.closeCheckin();
      if (navigator.vibrate) try { navigator.vibrate(12); } catch {}
    },
    onError: () => toast.error("Could not save check-in"),
  });

  function save() {
    if (!mood) { toast.error("Pick a mood first"); return; }
    mutation.mutate({ mood, notes: notes || null, ...dims });
  }

  return (
    <Drawer open={ui.checkinSheet.open} onOpenChange={(o) => !o && ui.closeCheckin()}>
      <DrawerContent className="max-w-2xl mx-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-xl">How are you feeling?</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-2">
          <div className="flex gap-2" data-testid="checkin-mood-row">
            {MOODS.map((m) => (
              <button key={m.v} onClick={() => setMood(mood === m.v ? null : m.v)} data-testid={`checkin-mood-${m.v}`}
                className={cn("flex-1 rounded-xl border py-3 text-center pressable", mood === m.v ? "bg-accent border-primary" : "bg-card border-border")}>
                <span className="text-2xl">{m.e}</span>
                <span className="block text-[10px] text-muted-foreground mt-0.5">{m.l}</span>
              </button>
            ))}
          </div>

          <button onClick={() => setShowMore((s) => !s)} className="mt-4 text-sm font-medium text-primary">
            {showMore ? "Hide details" : "Add energy, sleep, pain & notes"}
          </button>

          {showMore && (
            <div className="mt-3 space-y-4 animate-rise">
              {DIMENSIONS.map((d) => (
                <div key={d.k}>
                  <div className="flex justify-between">
                    <Label className="text-xs text-muted-foreground">{d.l}{dims[d.k] ? `: ${dims[d.k]}/5` : ""}</Label>
                    {dims[d.k] && <button className="text-[10px] text-muted-foreground underline" onClick={() => setDims((s) => { const n = { ...s }; delete n[d.k]; return n; })}>clear</button>}
                  </div>
                  <Slider value={[dims[d.k] || 3]} onValueChange={(v) => setDims((s) => ({ ...s, [d.k]: v[0] }))} min={1} max={5} step={1} className="mt-2" />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>{d.low}</span><span>{d.high}</span></div>
                </div>
              ))}
              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything notable today…" className="rounded-xl mt-1" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 safe-bottom">
          <Button data-testid="checkin-save-button" className="w-full h-12 rounded-xl" onClick={save} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save check-in"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
