import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { getMedications, adjustInventory } from "@/lib/api";
import {
  CAPSULE_SIZES,
  CAPSULE_SIZE_ORDER,
  DENSITY_PRESETS,
  MASS_UNIT_ORDER,
  bagToCapsules,
  capsulesToPowder,
  fillerPlan,
  capsuleCapacityMg,
  costPer,
  formatMass,
} from "@/lib/capsuleCalc";
import { CAPSULE } from "@/constants/testIds";
import { cn } from "@/lib/utils";
import { FlaskConical, Copy, PackagePlus, AlertTriangle, ShieldAlert, Pill } from "lucide-react";

const STORAGE_KEY = "meditrax:capsuleCalc";

const DEFAULTS = {
  totalAmount: 10,
  totalUnit: "g",
  fillPerCapsule: 250,
  purity: 100,
  densityPreset: "typical",
  customDensity: "",
  sizeKey: "0",
  // reverse
  numCapsules: 100,
  revFill: 200,
  revPurity: 100,
  // filler
  fillerSize: "0",
  fillerDose: 10,
  fillerBatch: 30,
  // cost
  bagCost: "",
  dosesPerDay: "",
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore corrupt storage */
  }
  return { ...DEFAULTS };
}

// Small labelled field used throughout the calculator.
function Field({ label, hint, children }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Stat({ label, value, big }) {
  return (
    <div className="text-center">
      <p className={cn("font-display font-semibold tabular-nums", big ? "text-4xl leading-none" : "text-xl")}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

export default function CapsuleCalculator() {
  const [s, setS] = useState(loadState);
  const [saveOpen, setSaveOpen] = useState(false);
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));
  const setNum = (k) => (e) => set({ [k]: e.target.value === "" ? "" : Number(e.target.value) });

  // Persist inputs so the calculator remembers where you left off.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  }, [s]);

  const density = useMemo(() => {
    const custom = Number(s.customDensity);
    if (s.customDensity !== "" && Number.isFinite(custom) && custom > 0) return custom;
    return DENSITY_PRESETS[s.densityPreset] ?? 0.6;
  }, [s.customDensity, s.densityPreset]);

  const bag = useMemo(
    () => bagToCapsules({ totalAmount: s.totalAmount, totalUnit: s.totalUnit, fillPerCapsuleMg: s.fillPerCapsule, purityPct: s.purity }),
    [s.totalAmount, s.totalUnit, s.fillPerCapsule, s.purity]
  );
  const reverse = useMemo(
    () => capsulesToPowder({ numCapsules: s.numCapsules, fillPerCapsuleMg: s.revFill, purityPct: s.revPurity }),
    [s.numCapsules, s.revFill, s.revPurity]
  );
  const filler = useMemo(
    () => fillerPlan({ sizeKey: s.fillerSize, densityGPerMl: density, activeDoseMg: s.fillerDose, numCapsules: s.fillerBatch }),
    [s.fillerSize, density, s.fillerDose, s.fillerBatch]
  );
  const cost = useMemo(() => costPer({ bagCost: s.bagCost, capsules: bag.capsules, dosesPerDay: s.dosesPerDay }), [s.bagCost, bag.capsules, s.dosesPerDay]);

  const selectedCapacity = capsuleCapacityMg(s.sizeKey, density);
  const bagFillExceeds = selectedCapacity > 0 && bag.materialPerCapsuleMg > selectedCapacity;

  const copySummary = async () => {
    const lines = [
      "Capsule Calculator — Meditrax",
      `Bag: ${s.totalAmount} ${s.totalUnit}${s.purity < 100 ? ` @ ${s.purity}% potency` : ""}`,
      `Fill: ${s.fillPerCapsule} mg active/capsule (${formatMass(bag.materialPerCapsuleMg)} powder/capsule)`,
      `→ ${bag.capsules} capsules, ${formatMass(bag.leftoverMg)} left over`,
      cost.perCapsule > 0 ? `Cost: ${cost.perCapsule.toFixed(4)}/capsule${cost.perDay != null ? `, ${cost.perDay.toFixed(4)}/day` : ""}` : null,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Summary copied");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <div>
      <PageHeader title="Capsule Calculator" subtitle="Hand-fill capsules from bulk powder" back />
      <div className="px-4 space-y-3 pb-tabbar">
        {/* Safety note */}
        <div className="card-soft p-3 flex gap-2.5 items-start bg-amber-500/5 border-amber-500/30">
          <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Estimates only — hand-filled capsules are as accurate as your scale. Weigh with a milligram scale, never eyeball potent
            substances. Educational tool, not medical advice.{" "}
            <Link to="/legal/disclaimer" className="text-primary underline underline-offset-2">
              Read the disclaimer
            </Link>
            .
          </p>
        </div>

        <Tabs defaultValue="bag" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="bag" className="text-xs py-2">Bag → Capsules</TabsTrigger>
            <TabsTrigger value="reverse" className="text-xs py-2">Capsules → Powder</TabsTrigger>
            <TabsTrigger value="filler" className="text-xs py-2">Filler / Dilution</TabsTrigger>
          </TabsList>

          {/* ---- Bag → Capsules ---- */}
          <TabsContent value="bag" className="mt-3 space-y-3">
            <div className="card-soft p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Field label="Bag / total powder">
                    <Input type="number" min="0" value={s.totalAmount} onChange={setNum("totalAmount")} data-testid={CAPSULE.totalInput} className="h-11 rounded-xl" />
                  </Field>
                </div>
                <Field label="Unit">
                  <Select value={s.totalUnit} onValueChange={(v) => set({ totalUnit: v })}>
                    <SelectTrigger data-testid={CAPSULE.totalUnitSelect} className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{MASS_UNIT_ORDER.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Active dose / capsule (mg)">
                  <Input type="number" min="0" value={s.fillPerCapsule} onChange={setNum("fillPerCapsule")} data-testid={CAPSULE.fillInput} className="h-11 rounded-xl" />
                </Field>
                <Field label="Potency / purity (%)" hint="100 = pure active">
                  <Input type="number" min="0" max="100" value={s.purity} onChange={setNum("purity")} data-testid={CAPSULE.purityInput} className="h-11 rounded-xl" />
                </Field>
              </div>

              {/* Capsule-size helper: auto-fill dose from capacity */}
              <div className="grid grid-cols-2 gap-2">
                <Field label="Capsule size (optional)">
                  <Select
                    value={s.sizeKey}
                    onValueChange={(v) => set({ sizeKey: v, fillPerCapsule: Math.round(capsuleCapacityMg(v, density) * (Number(s.purity) || 100) / 100) })}
                  >
                    <SelectTrigger data-testid={CAPSULE.sizeSelect} className="h-11 rounded-xl"><SelectValue placeholder="Size" /></SelectTrigger>
                    <SelectContent>
                      {CAPSULE_SIZE_ORDER.map((k) => <SelectItem key={k} value={k}>Size {k} · {CAPSULE_SIZES[k]} mL</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Powder density" hint={`≈ ${density} g/mL · capacity ${formatMass(selectedCapacity)}`}>
                  <Select value={s.densityPreset} onValueChange={(v) => set({ densityPreset: v, customDensity: "" })}>
                    <SelectTrigger data-testid={CAPSULE.densitySelect} className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(DENSITY_PRESETS).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>

              <p className="text-[11px] text-muted-foreground -mt-1">
                Tip: picking a size fills the dose with the max powder that size holds. Override the density with a measured value below.
              </p>
              <Input
                type="number" min="0" step="0.05" placeholder="Custom density g/mL (optional)"
                value={s.customDensity} onChange={(e) => set({ customDensity: e.target.value })}
                data-testid={CAPSULE.densityCustomInput} className="h-10 rounded-xl"
              />
            </div>

            {/* Result */}
            <div className="card-soft p-4">
              <div className="grid grid-cols-3 gap-2 items-end">
                <Stat label="capsules" value={<span data-testid={CAPSULE.resultCount}>{bag.capsules}</span>} big />
                <Stat label="powder / capsule" value={formatMass(bag.materialPerCapsuleMg)} />
                <Stat label="left over" value={formatMass(bag.leftoverMg)} />
              </div>
              <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total active</span><span className="font-medium">{formatMass(bag.totalActiveMg)}</span></div>
                {cost.perCapsule > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Per capsule</span><span className="font-medium">{cost.perCapsule.toFixed(4)}</span></div>
                )}
              </div>

              {bagFillExceeds && (
                <div className="mt-3 flex gap-2 items-start rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{formatMass(bag.materialPerCapsuleMg)} won't fit a size {s.sizeKey} capsule ({formatMass(selectedCapacity)}). Use a larger capsule or split the dose.</span>
                </div>
              )}

              <div className="mt-3 flex gap-2">
                <Button variant="secondary" className="flex-1 h-11 rounded-xl" onClick={copySummary} data-testid={CAPSULE.copyButton}>
                  <Copy className="h-4 w-4 mr-1.5" />Copy
                </Button>
                <Button className="flex-1 h-11 rounded-xl" onClick={() => setSaveOpen(true)} disabled={bag.capsules <= 0} data-testid={CAPSULE.saveInventoryButton}>
                  <PackagePlus className="h-4 w-4 mr-1.5" />To inventory
                </Button>
              </div>
            </div>

            {/* Cost inputs */}
            <div className="card-soft p-4">
              <p className="text-sm font-semibold mb-2">Cost (optional)</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Bag cost">
                  <Input type="number" min="0" step="0.01" placeholder="e.g. 24.99" value={s.bagCost} onChange={(e) => set({ bagCost: e.target.value })} data-testid={CAPSULE.bagCostInput} className="h-11 rounded-xl" />
                </Field>
                <Field label="Capsules / day" hint="for cost-per-day">
                  <Input type="number" min="0" placeholder="e.g. 2" value={s.dosesPerDay} onChange={(e) => set({ dosesPerDay: e.target.value })} className="h-11 rounded-xl" />
                </Field>
              </div>
              {cost.perCapsule > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  ≈ <span className="font-medium text-foreground">{cost.perCapsule.toFixed(4)}</span> per capsule
                  {cost.perDay != null && <> · <span className="font-medium text-foreground">{cost.perDay.toFixed(2)}</span> per day</>}
                </p>
              )}
            </div>
          </TabsContent>

          {/* ---- Capsules → Powder ---- */}
          <TabsContent value="reverse" className="mt-3 space-y-3">
            <div className="card-soft p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Capsules wanted">
                  <Input type="number" min="0" value={s.numCapsules} onChange={setNum("numCapsules")} data-testid={CAPSULE.capsulesInput} className="h-11 rounded-xl" />
                </Field>
                <Field label="Active / capsule (mg)">
                  <Input type="number" min="0" value={s.revFill} onChange={setNum("revFill")} className="h-11 rounded-xl" />
                </Field>
                <Field label="Purity (%)">
                  <Input type="number" min="0" max="100" value={s.revPurity} onChange={setNum("revPurity")} className="h-11 rounded-xl" />
                </Field>
              </div>
            </div>
            <div className="card-soft p-4 grid grid-cols-2 gap-2">
              <Stat label="powder needed" value={formatMass(reverse.totalMaterialMg)} big />
              <Stat label="total active" value={formatMass(reverse.totalActiveMg)} />
            </div>
          </TabsContent>

          {/* ---- Filler / Dilution ---- */}
          <TabsContent value="filler" className="mt-3 space-y-3">
            <div className="card-soft p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                For small doses: blend the active with an inert filler (e.g. rice flour, microcrystalline cellulose) so each capsule fills
                evenly and doses uniformly.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Capsule size">
                  <Select value={s.fillerSize} onValueChange={(v) => set({ fillerSize: v })}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{CAPSULE_SIZE_ORDER.map((k) => <SelectItem key={k} value={k}>Size {k} · {CAPSULE_SIZES[k]} mL</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Density" hint={`≈ ${density} g/mL`}>
                  <Select value={s.densityPreset} onValueChange={(v) => set({ densityPreset: v, customDensity: "" })}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(DENSITY_PRESETS).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Active dose / capsule (mg)">
                  <Input type="number" min="0" value={s.fillerDose} onChange={setNum("fillerDose")} className="h-11 rounded-xl" />
                </Field>
                <Field label="Batch size (capsules)">
                  <Input type="number" min="0" value={s.fillerBatch} onChange={setNum("fillerBatch")} className="h-11 rounded-xl" />
                </Field>
              </div>
            </div>

            {filler.warning ? (
              <div className="card-soft p-4 flex gap-2 items-start bg-amber-500/10 border-amber-500/30">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">{filler.warning}</p>
              </div>
            ) : (
              <div className="card-soft p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="filler / capsule" value={formatMass(filler.fillerPerCapsuleMg)} big />
                  <Stat label="active / capsule" value={formatMass(filler.materialPerCapsuleMg)} />
                  <Stat label="capacity" value={formatMass(filler.capacityMg)} />
                </div>
                <div className="pt-3 border-t border-border grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total filler</span><span className="font-medium">{formatMass(filler.totalFillerMg)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total active</span><span className="font-medium">{formatMass(filler.totalActiveMg)}</span></div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Mix {formatMass(filler.totalActiveMg)} active with {formatMass(filler.totalFillerMg)} filler thoroughly, then fill {s.fillerBatch} capsules.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Capsule size reference */}
        <div className="card-soft overflow-hidden">
          <p className="px-4 pt-3 pb-2 text-sm font-semibold">Capsule size reference</p>
          <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground px-4 pb-1">
            <span>Size</span><span className="text-right">Volume</span><span className="text-right">Capacity ≈</span>
          </div>
          <div className="divide-y divide-border">
            {CAPSULE_SIZE_ORDER.map((k) => (
              <div key={k} className={cn("grid grid-cols-3 px-4 py-2 text-sm", k === s.sizeKey && "bg-primary/5")}>
                <span className="font-medium">{k}</span>
                <span className="text-right tabular-nums">{CAPSULE_SIZES[k]} mL</span>
                <span className="text-right tabular-nums">{formatMass(capsuleCapacityMg(k, density))}</span>
              </div>
            ))}
          </div>
          <p className="px-4 py-2 text-[11px] text-muted-foreground">Capacity shown at ≈ {density} g/mL (from the density you selected).</p>
        </div>
      </div>

      <SaveToInventoryDrawer open={saveOpen} onClose={() => setSaveOpen(false)} capsules={bag.capsules} />
    </div>
  );
}

function SaveToInventoryDrawer({ open, onClose, capsules }) {
  const qc = useQueryClient();
  const { data: meds = [] } = useQuery({ queryKey: ["medications"], queryFn: () => getMedications() });
  const capsuleMeds = useMemo(() => meds.filter((m) => m.form === "capsule"), [meds]);
  const [medId, setMedId] = useState("");
  const [mode, setMode] = useState("set"); // set | add

  useEffect(() => { if (open) { setMedId(capsuleMeds[0]?.id || ""); setMode("set"); } }, [open]); // eslint-disable-line

  const save = useMutation({
    mutationFn: () => adjustInventory(medId, mode === "set" ? { set: capsules } : { delta: capsules }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["medications"] });
      toast.success(`Saved ${capsules} capsules to inventory`);
      onClose();
    },
    onError: () => toast.error("Could not update inventory"),
  });

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-w-2xl mx-auto">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <DrawerHeader className="text-left"><DrawerTitle className="font-display text-2xl">Save to inventory</DrawerTitle></DrawerHeader>
        <div className="px-4 pb-2">
          {capsuleMeds.length === 0 ? (
            <EmptyState
              icon={Pill}
              title="No capsule medications"
              description="Add a medication with the “capsule” form first, then you can push this count to its inventory."
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                Applying <span className="font-semibold text-foreground">{capsules}</span> capsules.
              </p>
              <Label className="text-xs text-muted-foreground">Medication</Label>
              <Select value={medId} onValueChange={setMedId}>
                <SelectTrigger data-testid={CAPSULE.medSelect} className="h-11 rounded-xl mt-1"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{capsuleMeds.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setMode("set")} className={cn("h-11 rounded-xl border text-sm font-medium", mode === "set" ? "border-primary bg-primary/10 text-primary" : "border-border")}>Set to {capsules}</button>
                <button onClick={() => setMode("add")} className={cn("h-11 rounded-xl border text-sm font-medium", mode === "add" ? "border-primary bg-primary/10 text-primary" : "border-border")}>Add {capsules}</button>
              </div>
            </>
          )}
        </div>
        <div className="p-4 safe-bottom flex gap-3">
          <Button variant="secondary" className="flex-1 h-12 rounded-xl" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 h-12 rounded-xl"
            disabled={!medId || save.isPending || capsuleMeds.length === 0}
            onClick={() => save.mutate()}
            data-testid={CAPSULE.saveInventoryConfirm}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
