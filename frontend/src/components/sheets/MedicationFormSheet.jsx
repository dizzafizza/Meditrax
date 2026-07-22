import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUI } from "@/context/UIContext";
import { createMedication, updateMedication, searchCatalog } from "@/lib/api";
import { MED_COLORS, CATEGORY_LABELS, FREQUENCY_LABELS, FREQUENCY_TIMES, WEEKDAYS, WEEKDAY_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Plus, X, Search, Check } from "lucide-react";

const UNITS = ["mg", "mcg", "g", "ml", "units", "iu", "tablets", "capsules", "puffs", "drops", "patches", "mg THC", "mg CBD"];
const FORMS = ["tablet", "capsule", "liquid", "injection", "patch", "drops", "spray", "inhaler", "cream", "smoked/vaporized", "insufflated", "edible", "other"];

const empty = {
  name: "", generic_name: "", drug_class: "", category: "other", color: MED_COLORS[0],
  strength: "", unit: "mg", form: "tablet", frequency: "once_daily", times: ["09:00"],
  days_of_week: [...WEEKDAYS], is_prn: false, instructions: "", notes: "",
  risk_level: "low", dependency_risk_category: "none", dose_quantity: 1,
  track_inventory: false, inventory: { current_count: 30, unit: "tablets", units_per_dose: 1, refill_threshold: 10 },
  side_effects: [], interactions: [], warnings: [], catalog_id: null,
};

export default function MedicationFormSheet() {
  const ui = useUI();
  const qc = useQueryClient();
  const editing = ui.medSheet.med;
  const [form, setForm] = useState(empty);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!ui.medSheet.open) return;
    if (editing) {
      setForm({
        ...empty, ...editing,
        strength: editing.strength ?? "",
        times: editing.times?.length ? editing.times : ["09:00"],
        days_of_week: editing.days_of_week?.length ? editing.days_of_week : [...WEEKDAYS],
        dose_quantity: editing.dose_quantity ?? editing.inventory?.units_per_dose ?? 1,
        track_inventory: !!editing.inventory,
        inventory: editing.inventory || empty.inventory,
      });
    } else if (ui.medSheet.prefill) {
      applyCatalog(ui.medSheet.prefill, true);
    } else {
      setForm(empty);
    }
    setQuery(""); setResults([]); setShowResults(false);
    // eslint-disable-next-line
  }, [ui.medSheet.open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function applyCatalog(c, replace = false) {
    setForm((f) => ({
      ...(replace ? empty : f),
      name: c.name || f.name,
      generic_name: c.generic_name || "",
      drug_class: c.drug_class || "",
      category: c.category || "other",
      unit: c.default_unit || "mg",
      strength: c.common_dosages?.[0] ?? "",
      risk_level: c.risk_level || "low",
      dependency_risk_category: c.dependency_risk_category || "none",
      side_effects: c.common_side_effects || [],
      interactions: c.interactions || [],
      warnings: c.warnings || [],
      catalog_id: c.id || null,
      color: f.color || MED_COLORS[0],
      times: f.times || ["09:00"], days_of_week: f.days_of_week || [...WEEKDAYS],
      inventory: f.inventory || empty.inventory,
    }));
    setShowResults(false); setQuery("");
  }

  function onQuery(v) {
    setQuery(v);
    set("name", v);
    clearTimeout(debounceRef.current);
    if (!v.trim()) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchCatalog(v, 6);
        setResults(r); setShowResults(true);
      } catch { setResults([]); }
    }, 250);
  }

  function setFrequency(v) {
    setForm((f) => ({
      ...f, frequency: v,
      is_prn: v === "as_needed",
      times: v === "as_needed" ? [] : (FREQUENCY_TIMES[v] || ["09:00"]),
    }));
  }

  const updateTime = (i, val) => setForm((f) => ({ ...f, times: f.times.map((t, idx) => (idx === i ? val : t)) }));
  const addTime = () => setForm((f) => ({ ...f, times: [...f.times, "12:00"] }));
  const removeTime = (i) => setForm((f) => ({ ...f, times: f.times.filter((_, idx) => idx !== i) }));
  const toggleDay = (days) => set("days_of_week", days);

  const mutation = useMutation({
    mutationFn: (payload) => (editing ? updateMedication(editing.id, payload) : createMedication(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medications"] });
      qc.invalidateQueries({ queryKey: ["today"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(editing ? "Medication updated" : "Medication added");
      ui.closeMed();
    },
    onError: () => toast.error("Could not save medication"),
  });

  function submit() {
    if (!form.name.trim()) { toast.error("Please enter a medication name"); return; }
    const doseQty = Number(form.dose_quantity) || 1;
    const payload = {
      ...form,
      strength: form.strength === "" ? null : Number(form.strength),
      dose_quantity: doseQty,
      inventory: form.track_inventory ? {
        current_count: Number(form.inventory.current_count) || 0,
        unit: form.inventory.unit || "tablets",
        units_per_dose: doseQty, // kept in sync with dose_quantity
        refill_threshold: Number(form.inventory.refill_threshold) || 10,
      } : null,
    };
    delete payload.track_inventory;
    mutation.mutate(payload);
  }

  return (
    <Drawer open={ui.medSheet.open} onOpenChange={(o) => !o && ui.closeMed()}>
      <DrawerContent className="max-w-2xl mx-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="font-display text-2xl">{editing ? "Edit medication" : "Add medication"}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 overflow-y-auto scroll-y" style={{ maxHeight: "68vh" }}>
          {/* Name + catalog search */}
          <div className="relative">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input data-testid="med-name-input" value={form.name} onChange={(e) => onQuery(e.target.value)} placeholder="e.g. Sertraline" className="pl-9 h-11 rounded-xl" onFocus={() => results.length && setShowResults(true)} />
            </div>
            {showResults && results.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 card-soft p-1 max-h-60 overflow-auto">
                {results.map((r) => (
                  <button key={r.id} onClick={() => applyCatalog(r)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted flex items-center justify-between">
                    <span><span className="font-medium">{r.name}</span> <span className="text-xs text-muted-foreground">{r.drug_class}</span></span>
                    {r.source === "ai" && <span className="text-[10px] text-primary">AI</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Color */}
          <div className="mt-4">
            <Label className="text-xs text-muted-foreground">Color</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {MED_COLORS.map((c) => (
                <button key={c} onClick={() => set("color", c)} className="h-8 w-8 rounded-full flex items-center justify-center border" style={{ backgroundColor: c, borderColor: c }} aria-label={c}>
                  {form.color === c && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Strength + unit + form + pills per dose */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div>
              <Label className="text-xs text-muted-foreground">Strength</Label>
              <Input data-testid="med-strength-input" type="number" value={form.strength} onChange={(e) => set("strength", e.target.value)} placeholder="50" className="h-11 rounded-xl mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                <SelectTrigger className="h-11 rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Form</Label>
              <Select value={form.form} onValueChange={(v) => set("form", v)}>
                <SelectTrigger className="h-11 rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{FORMS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-xs text-muted-foreground">Pills per dose</Label>
            <Input data-testid="med-dose-quantity-input" type="number" min="0.25" step="0.25" value={form.dose_quantity} onChange={(e) => set("dose_quantity", e.target.value)} className="h-11 rounded-xl mt-1" />
            <p className="text-[11px] text-muted-foreground mt-1">How many pills/units make up one dose (e.g. 2 × {form.strength || "50"}{form.unit}). Used for inventory and refill math.</p>
          </div>

          {/* Category */}
          <div className="mt-4">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger className="h-11 rounded-xl mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Frequency */}
          <div className="mt-4">
            <Label className="text-xs text-muted-foreground">Frequency</Label>
            <Select value={form.frequency} onValueChange={setFrequency}>
              <SelectTrigger data-testid="med-frequency-select" className="h-11 rounded-xl mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(FREQUENCY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Times */}
          {!form.is_prn && (
            <div className="mt-4">
              <Label className="text-xs text-muted-foreground">Times</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {form.times.map((t, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-xl border border-border bg-card pl-2">
                    <input type="time" value={t} onChange={(e) => updateTime(i, e.target.value)} className="bg-transparent py-2 text-sm outline-none" />
                    {form.times.length > 1 && <button onClick={() => removeTime(i)} className="px-2 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>}
                  </div>
                ))}
                <button onClick={addTime} className="h-10 px-3 rounded-xl border border-dashed border-border text-sm text-primary flex items-center gap-1"><Plus className="h-4 w-4" />Time</button>
              </div>
            </div>
          )}

          {/* Days */}
          {!form.is_prn && (
            <div className="mt-4">
              <Label className="text-xs text-muted-foreground">Days</Label>
              <ToggleGroup type="multiple" value={form.days_of_week} onValueChange={(v) => v.length && toggleDay(v)} className="flex flex-wrap gap-1.5 mt-2 justify-start">
                {WEEKDAYS.map((d) => (
                  <ToggleGroupItem key={d} value={d} className="rounded-full h-9 w-12 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border border-border">{WEEKDAY_LABELS[d]}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}

          {/* PRN switch */}
          <div className="mt-4 flex items-center justify-between card-soft px-4 py-3">
            <div><p className="font-medium text-sm">As needed (PRN)</p><p className="text-xs text-muted-foreground">No fixed schedule</p></div>
            <Switch checked={form.is_prn} onCheckedChange={(v) => setFrequency(v ? "as_needed" : "once_daily")} data-testid="med-prn-switch" />
          </div>

          {/* Risk */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <Label className="text-xs text-muted-foreground">Risk level</Label>
              <Select value={form.risk_level} onValueChange={(v) => set("risk_level", v)}>
                <SelectTrigger className="h-11 rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["minimal", "low", "moderate", "high"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Dependency risk</Label>
              <Select value={form.dependency_risk_category} onValueChange={(v) => set("dependency_risk_category", v)}>
                <SelectTrigger className="h-11 rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["none", "low", "moderate", "high", "extreme"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Inventory */}
          <div className="mt-4 card-soft px-4 py-3">
            <div className="flex items-center justify-between">
              <div><p className="font-medium text-sm">Track inventory</p><p className="text-xs text-muted-foreground">Refill projections &amp; alerts</p></div>
              <Switch checked={form.track_inventory} onCheckedChange={(v) => set("track_inventory", v)} data-testid="med-inventory-switch" />
            </div>
            {form.track_inventory && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><Label className="text-[11px] text-muted-foreground">Count on hand</Label><Input type="number" value={form.inventory.current_count} onChange={(e) => set("inventory", { ...form.inventory, current_count: e.target.value })} className="h-10 rounded-xl mt-1" /></div>
                <div><Label className="text-[11px] text-muted-foreground">Refill at (count)</Label><Input type="number" value={form.inventory.refill_threshold} onChange={(e) => set("inventory", { ...form.inventory, refill_threshold: e.target.value })} className="h-10 rounded-xl mt-1" /></div>
              </div>
            )}
          </div>

          {/* Instructions + notes */}
          <div className="mt-4">
            <Label className="text-xs text-muted-foreground">Instructions</Label>
            <Input value={form.instructions || ""} onChange={(e) => set("instructions", e.target.value)} placeholder="e.g. Take with food" className="h-11 rounded-xl mt-1" />
          </div>
          <div className="mt-4 mb-2">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Anything to remember…" className="rounded-xl mt-1" />
          </div>
        </div>

        <div className="p-4 flex gap-3 safe-bottom border-t border-border/60">
          <Button variant="secondary" className="flex-1 h-12 rounded-xl" onClick={ui.closeMed}>Cancel</Button>
          <Button data-testid="med-save-button" className="flex-1 h-12 rounded-xl" onClick={submit} disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : editing ? "Save changes" : "Add medication"}</Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
