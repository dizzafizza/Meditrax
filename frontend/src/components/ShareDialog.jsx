import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { shareNode } from "@/lib/share";
import { Share2 } from "lucide-react";

export default function ShareDialog({ open, onOpenChange, filename = "meditrax.png", title = "Meditrax", children }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function doShare() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const result = await shareNode(cardRef.current, { filename, title });
      if (result === "downloaded") toast.success("Image saved to your device");
      else if (result === "shared") toast.success("Shared");
    } catch (e) {
      toast.error("Couldn't generate the image");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Share</DialogTitle></DialogHeader>
        <div className="overflow-auto max-h-[58vh] rounded-2xl bg-muted/40 p-3 flex justify-center">
          <div ref={cardRef}>{children}</div>
        </div>
        <Button onClick={doShare} disabled={busy} className="w-full h-12 rounded-xl" data-testid="share-action-button">
          <Share2 className="h-4 w-4 mr-2" />{busy ? "Preparing…" : "Share or save image"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

const CARD = {
  width: 360,
  background: "#FBF8F2",
  color: "#1f2a28",
  fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif",
  padding: 24,
  borderRadius: 24,
  border: "1px solid #ece4d6",
  boxSizing: "border-box",
};
const ACCENT = "#2A767B";
const SERIF = "Fraunces, ui-serif, Georgia, serif";

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 18, color: ACCENT, fontWeight: 700, fontSize: 13 }}>
      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 999, background: ACCENT }} />
      Meditrax
    </div>
  );
}
function Disclaimer() {
  return (
    <p style={{ marginTop: 6, fontSize: 10, lineHeight: "14px", color: "#7a8482" }}>
      For personal tracking and education only — not medical advice. Always consult a clinician or pharmacist.
    </p>
  );
}

export function MedicationShareCard({ med }) {
  if (!med) return null;
  const dose = med.strength != null && med.strength !== "" ? `${med.strength} ${med.unit || ""}`.trim() : (med.unit || "");
  const warnings = (med.warnings || []).slice(0, 2);
  const interactions = (med.interactions || []).slice(0, 2);
  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 14, background: med.color || ACCENT, display: "inline-block" }} />
        <div>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, lineHeight: "26px" }}>{med.name}</div>
          {dose && <div style={{ fontSize: 13, color: "#5b6664" }}>{dose}</div>}
        </div>
      </div>

      {med.drug_class && <div style={{ marginTop: 14, fontSize: 12, color: "#5b6664" }}>{med.drug_class}</div>}

      {!med.is_prn && med.times?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa3a1", marginBottom: 4 }}>Schedule</div>
          <div style={{ fontSize: 14 }}>{med.times.join(" · ")}{med.instructions ? ` — ${med.instructions}` : ""}</div>
        </div>
      )}
      {med.is_prn && (
        <div style={{ marginTop: 12, fontSize: 14 }}>As needed (PRN)</div>
      )}

      {warnings.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa3a1", marginBottom: 4 }}>Warnings</div>
          {warnings.map((w, i) => <div key={i} style={{ fontSize: 12, color: "#8a4b2f" }}>• {w}</div>)}
        </div>
      )}
      {interactions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa3a1", marginBottom: 4 }}>Interactions</div>
          {interactions.map((w, i) => <div key={i} style={{ fontSize: 12, color: "#5b6664" }}>• {w}</div>)}
        </div>
      )}

      <Brand />
      <Disclaimer />
    </div>
  );
}

export function TaperShareCard({ taper, medName }) {
  if (!taper) return null;
  const steps = (taper.schedule?.steps || taper.steps || []).slice(0, 12);
  return (
    <div style={CARD}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#9aa3a1" }}>Taper plan</div>
      <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, marginTop: 2 }}>{medName || taper.medication?.name || "Medication"}</div>
      <div style={{ fontSize: 13, color: "#5b6664", marginTop: 2, textTransform: "capitalize" }}>
        {taper.method} · {taper.initial_dose} → {taper.final_dose} {taper.unit} over {taper.total_days} days
      </div>

      <div style={{ marginTop: 14, borderTop: "1px solid #ece4d6" }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f0eadf", fontSize: 13 }}>
            <span style={{ color: "#5b6664" }}>{s.date}</span>
            <span style={{ fontWeight: 600 }}>{s.dose} {taper.unit}{s.is_final ? " · final" : ""}</span>
          </div>
        ))}
      </div>

      <Brand />
      <Disclaimer />
    </div>
  );
}
