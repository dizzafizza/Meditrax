import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import MedColorDot from "@/components/MedColorDot";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getReminders, createReminder, updateReminder, deleteReminder, getMedications } from "@/lib/api";
import { fmtTime12, WEEKDAYS, WEEKDAY_LABELS } from "@/lib/format";
import { Bell, Plus, Trash2 } from "lucide-react";

export default function Reminders() {
  const qc = useQueryClient();
  const { data: reminders = [] } = useQuery({ queryKey: ["reminders"], queryFn: () => getReminders() });
  const { data: meds = [] } = useQuery({ queryKey: ["medications"], queryFn: () => getMedications(true) });
  const medMap = Object.fromEntries(meds.map((m) => [m.id, m]));
  const [open, setOpen] = useState(false);

  const toggle = useMutation({ mutationFn: ({ id, r }) => updateReminder(id, r), onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }) });
  const del = useMutation({ mutationFn: deleteReminder, onSuccess: () => { qc.invalidateQueries({ queryKey: ["reminders"] }); toast.success("Reminder removed"); } });

  return (
    <div>
      <PageHeader title="Reminders" subtitle="Dose reminders"
        right={<button onClick={() => setOpen(true)} data-testid="reminder-add-button" className="pressable h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Plus className="h-5 w-5" /></button>} />
      <div className="px-4 space-y-3">
        <div className="card-soft p-4 text-sm text-muted-foreground">Reminders fire as push notifications on your installed app. Enable notifications in <span className="text-foreground font-medium">Settings</span> first.</div>
        {reminders.length === 0 ? (
          <EmptyState icon={Bell} title="No reminders" description="Add a reminder so you never miss a dose."
            action={<Button onClick={() => setOpen(true)} className="rounded-xl"><Plus className="h-4 w-4 mr-1" />Add reminder</Button>} />
        ) : reminders.map((r) => {
          const med = medMap[r.medication_id];
          return (
            <div key={r.id} className="card-soft p-3 flex items-center gap-3">
              <MedColorDot color={med?.color} size={42} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{med?.name || "Medication"}</p>
                <p className="text-xs text-muted-foreground">{fmtTime12(r.time)} · {r.days_of_week?.length === 7 ? "Every day" : r.days_of_week.map((d) => WEEKDAY_LABELS[d]).join(", ")}</p>
              </div>
              <Switch checked={r.is_active} onCheckedChange={(v) => toggle.mutate({ id: r.id, r: { ...r, is_active: v } })} />
              <button onClick={() => del.mutate(r.id)} className="h-9 w-9 rounded-full hover:bg-destructive/10 text-destructive flex items-center justify-center"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
      <ReminderBuilder open={open} onClose={() => setOpen(false)} meds={meds} onCreated={() => { qc.invalidateQueries({ queryKey: ["reminders"] }); setOpen(false); }} />
    </div>
  );
}

function ReminderBuilder({ open, onClose, meds, onCreated }) {
  const [medId, setMedId] = useState("");
  const [time, setTime] = useState("09:00");
  const [days, setDays] = useState([...WEEKDAYS]);
  const create = useMutation({
    mutationFn: () => createReminder({ medication_id: medId, time, days_of_week: days, is_active: true }),
    onSuccess: onCreated, onError: () => toast.error("Could not create reminder"),
  });
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-w-2xl mx-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <DrawerHeader className="text-left"><DrawerTitle className="font-display text-2xl">New reminder</DrawerTitle></DrawerHeader>
        <div className="px-4 pb-2">
          {meds.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Add a medication first.</p> : (
            <>
              <Label className="text-xs text-muted-foreground">Medication</Label>
              <Select value={medId} onValueChange={setMedId}><SelectTrigger className="h-11 rounded-xl mt-1"><SelectValue placeholder="Choose" /></SelectTrigger><SelectContent>{meds.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
              <Label className="text-xs text-muted-foreground mt-4 block">Time</Label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-border bg-card px-3" />
              <Label className="text-xs text-muted-foreground mt-4 block">Days</Label>
              <ToggleGroup type="multiple" value={days} onValueChange={(v) => v.length && setDays(v)} className="flex flex-wrap gap-1.5 mt-2 justify-start">
                {WEEKDAYS.map((d) => <ToggleGroupItem key={d} value={d} className="rounded-full h-9 w-12 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border border-border">{WEEKDAY_LABELS[d]}</ToggleGroupItem>)}
              </ToggleGroup>
            </>
          )}
        </div>
        <div className="p-4 safe-bottom flex gap-3">
          <Button variant="secondary" className="flex-1 h-12 rounded-xl" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 h-12 rounded-xl" disabled={!medId || create.isPending} onClick={() => create.mutate()}>Add reminder</Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
