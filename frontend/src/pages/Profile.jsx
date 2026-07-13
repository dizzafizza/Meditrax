import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getProfile, updateProfile } from "@/lib/api";
import { useProfiles } from "@/context/ProfileContext";
import { X, Plus, User, Phone, HeartPulse, Users, Check, Trash2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || name[0].toUpperCase();
}

export default function Profile() {
  const qc = useQueryClient();
  const { profiles, activeId, switchProfile, addProfile, removeProfile } = useProfiles();
  const { data } = useQuery({ queryKey: ["profile"], queryFn: getProfile });

  const [form, setForm] = useState({ name: "", date_of_birth: "", allergies: [], conditions: [], emergency_contact: { name: "", relationship: "", phone: "" } });
  const [allergyInput, setAllergyInput] = useState("");
  const [conditionInput, setConditionInput] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (data) setForm({
      name: data.name || "", date_of_birth: data.date_of_birth || "",
      allergies: data.allergies || [], conditions: data.conditions || [],
      emergency_contact: data.emergency_contact || { name: "", relationship: "", phone: "" },
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateProfile(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Profile saved"); },
  });

  const addChip = (key, val, setVal) => { if (val.trim()) { setForm((f) => ({ ...f, [key]: [...f[key], val.trim()] })); setVal(""); } };
  const removeChip = (key, i) => setForm((f) => ({ ...f, [key]: f[key].filter((_, idx) => idx !== i) }));

  async function handleAddProfile() {
    const name = newProfileName.trim();
    if (!name) return;
    await addProfile({ name });
    setNewProfileName("");
    toast.success(`Added ${name}`);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try { await removeProfile(deleteTarget.id); toast.success(`Removed ${deleteTarget.name}`); }
    catch (e) { toast.error(e?.message || "Could not delete profile"); }
    setDeleteTarget(null);
  }

  return (
    <div>
      <PageHeader back title="Profiles" subtitle="Track meds for the whole family" />
      <div className="px-4 space-y-4 pb-8">
        {/* Family profiles manager */}
        <div className="card-soft p-4">
          <div className="flex items-center gap-2 mb-3"><Users className="h-4 w-4 text-primary" /><p className="font-semibold">Family profiles</p></div>
          <div className="space-y-2">
            {profiles.map((p) => {
              const active = p.id === activeId;
              return (
                <div key={p.id} data-testid="profile-row" className={cn("flex items-center gap-3 rounded-xl border p-2.5 transition-[border-color,background-color] duration-150", active ? "border-primary bg-accent/60" : "border-border bg-card")}>
                  <span className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style={{ backgroundColor: p.color || "#2A767B" }}>{initials(p.name)}</span>
                  <button onClick={() => switchProfile(p.id)} className="flex-1 min-w-0 text-left" data-testid="profile-select">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{active ? "Active profile" : "Tap to switch"}</p>
                  </button>
                  {active && <Check className="h-5 w-5 text-primary shrink-0" />}
                  {profiles.length > 1 && (
                    <button onClick={() => setDeleteTarget(p)} aria-label={`Delete ${p.name}`} data-testid="profile-delete" className="pressable h-9 w-9 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-3">
            <Input value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddProfile()} placeholder="Add a family member…" className="h-11 rounded-xl" data-testid="profile-new-input" />
            <Button onClick={handleAddProfile} disabled={!newProfileName.trim()} className="h-11 rounded-xl shrink-0" data-testid="profile-add-button"><UserPlus className="h-4 w-4 mr-1" />Add</Button>
          </div>
        </div>

        {/* Active profile health details */}
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Health details · {form.name || "Active profile"}</p>

        <div className="card-soft p-4 space-y-3">
          <div className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /><p className="font-semibold">About</p></div>
          <div><Label className="text-xs text-muted-foreground">Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-xl mt-1" data-testid="profile-name-input" /></div>
          <div><Label className="text-xs text-muted-foreground">Date of birth</Label><input type="date" value={form.date_of_birth ? form.date_of_birth.slice(0, 10) : ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-border bg-card px-3" /></div>
        </div>

        <ChipCard title="Allergies" icon={HeartPulse} items={form.allergies} input={allergyInput} setInput={setAllergyInput} onAdd={() => addChip("allergies", allergyInput, setAllergyInput)} onRemove={(i) => removeChip("allergies", i)} placeholder="e.g. Penicillin" />
        <ChipCard title="Conditions" icon={HeartPulse} items={form.conditions} input={conditionInput} setInput={setConditionInput} onAdd={() => addChip("conditions", conditionInput, setConditionInput)} onRemove={(i) => removeChip("conditions", i)} placeholder="e.g. Hypertension" />

        <div className="card-soft p-4 space-y-3">
          <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /><p className="font-semibold">Emergency contact</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Name</Label><Input value={form.emergency_contact.name} onChange={(e) => setForm({ ...form, emergency_contact: { ...form.emergency_contact, name: e.target.value } })} className="h-11 rounded-xl mt-1" /></div>
            <div><Label className="text-xs text-muted-foreground">Relationship</Label><Input value={form.emergency_contact.relationship} onChange={(e) => setForm({ ...form, emergency_contact: { ...form.emergency_contact, relationship: e.target.value } })} className="h-11 rounded-xl mt-1" /></div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Phone</Label><Input value={form.emergency_contact.phone} onChange={(e) => setForm({ ...form, emergency_contact: { ...form.emergency_contact, phone: e.target.value } })} className="h-11 rounded-xl mt-1" /></div>
        </div>

        <Button className="w-full h-12 rounded-xl" onClick={() => save.mutate()} disabled={save.isPending} data-testid="profile-save-button">{save.isPending ? "Saving…" : "Save profile"}</Button>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes this profile and all of its medications, logs, reminders and taper plans. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground" data-testid="profile-delete-confirm">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChipCard({ title, icon: Icon, items, input, setInput, onAdd, onRemove, placeholder }) {
  return (
    <div className="card-soft p-4">
      <div className="flex items-center gap-2 mb-2"><Icon className="h-4 w-4 text-primary" /><p className="font-semibold">{title}</p></div>
      <div className="flex flex-wrap gap-2 mb-2">
        {items.map((it, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-3 py-1 text-sm">{it}<button onClick={() => onRemove(i)}><X className="h-3.5 w-3.5" /></button></span>
        ))}
        {items.length === 0 && <span className="text-sm text-muted-foreground">None added</span>}
      </div>
      <div className="flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onAdd()} placeholder={placeholder} className="h-10 rounded-xl" />
        <button onClick={onAdd} className="h-10 w-10 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
