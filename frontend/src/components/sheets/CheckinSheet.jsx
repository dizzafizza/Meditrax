import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useUI } from "@/context/UIContext";
import { createCheckin, updateCheckin, deleteCheckin } from "@/lib/api";
import { toDatetimeLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

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
  const editEntry = ui.checkinSheet.checkin; // present = editing an existing check-in
  const [mood, setMood] = useState(null);
  const [dims, setDims] = useState({});
  const [notes, setNotes] = useState("");
  const [when, setWhen] = useState("");
  const [whenTouched, setWhenTouched] = useState(false);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!ui.checkinSheet.open) return;
    const c = ui.checkinSheet.checkin;
    if (c) {
      setMood(c.mood || null);
      const d = {};
      ["energy", "sleep", "pain", "anxiety"].forEach((k) => { if (c[k] != null) d[k] = c[k]; });
      setDims(d);
      setNotes(c.notes || "");
      setWhen(toDatetimeLocal(c.timestamp));
      setShowMore(!!(c.notes || Object.keys(d).length));
    } else {
      setMood(null); setDims({}); setNotes(""); setWhen(toDatetimeLocal()); setShowMore(false);
    }
    setWhenTouched(false);
  }, [ui.checkinSheet.open]); // eslint-disable-line

  const invalidate = () => ["checkins", "logs", "analytics"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const mutation = useMutation({
    mutationFn: (payload) => (editEntry ? updateCheckin(editEntry.id, payload) : createCheckin(payload)),
    onSuccess: () => {
      invalidate();
      toast.success(editEntry ? "Check-in updated" : "Check-in saved");
      ui.closeCheckin();
      if (navigator.vibrate) try { navigator.vibrate(12); } catch {}
    },
    onError: (err) => toast.error(err?.message || "Could not save check-in"),
  });

  const delMutation = useMutation({
    mutationFn: () => deleteCheckin(editEntry.id),
    onSuccess: () => { invalidate(); toast.success("Check-in deleted"); ui.closeCheckin(); },
    onError: () => toast.error("Could not delete check-in"),
  });

  function save() {
    if (!mood) { toast.error("Pick a mood first"); return; }
    const payload = { mood, notes: notes || null };
    ["energy", "sleep", "pain", "anxiety"].forEach((k) => { payload[k] = dims[k] ?? null; });
    if (editEntry || whenTouched) {
      const d = new Date(when);
      if (!when || isNaN(d.getTime())) { toast.error("Enter a valid date and time"); return; }
      if (d.getTime() > Date.now() + 60000) { toast.error("Check-ins can't be in the future"); return; }
      payload.timestamp = d.toISOString();
    }
    mutation.mutate(payload);
  }

  return (
    <Drawer open={ui.checkinSheet.open} onOpenChange={(o) => !o && ui.closeCheckin()}>
      <DrawerContent className="max-w-2xl mx-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-xl">{editEntry ? "Edit check-in" : "How are you feeling?"}</DrawerTitle>
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

          <div className="mt-4">
            <Label className="text-xs text-muted-foreground">When</Label>
            <Input
              type="datetime-local"
              value={when}
              max={toDatetimeLocal()}
              onChange={(e) => { setWhen(e.target.value); setWhenTouched(true); }}
              className="h-11 rounded-xl mt-1"
              data-testid="checkin-when-input"
            />
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

        <div className="p-4 safe-bottom space-y-2">
          <Button data-testid="checkin-save-button" className="w-full h-12 rounded-xl" onClick={save} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : editEntry ? "Save changes" : "Save check-in"}
          </Button>
          {editEntry && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" data-testid="checkin-delete-button">
                  <Trash2 className="h-4 w-4 mr-2" />Delete this check-in
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this check-in?</AlertDialogTitle>
                  <AlertDialogDescription>The entry is removed from your journal and trends. This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => delMutation.mutate()} className="bg-destructive text-destructive-foreground" data-testid="checkin-confirm-delete">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
