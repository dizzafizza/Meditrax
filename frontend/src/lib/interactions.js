// Cross-substance interaction checking for the effects tracker — flags
// pharmacologically well-established risky combinations between
// concurrently-active substances. Category-level rules are mechanism-based
// (e.g. "these are all CNS depressants") rather than an exhaustive per-drug
// database, so unfamiliar substances are still covered as long as their
// category is set correctly. A small set of name-specific overrides adds
// precision for particularly well-known pairs the category rules alone
// would otherwise under- or mis-state.
//
// This is a harm-reduction heuristic, not a clinical interaction checker —
// it deliberately errs toward flagging plausible risk from mechanism
// overlap rather than requiring a documented case report for every pair.

export const SEVERE = "severe";
export const CAUTION = "caution";

// Categories that act as CNS/respiratory depressants — combining any two
// (including two of the same category, e.g. two different benzodiazepines)
// compounds sedation and respiratory depression, the leading mechanism of
// overdose death.
const DEPRESSANT_CLUSTER = new Set([
  "benzodiazepine", "opioid", "sleep-aid", "depressant", "antihistamine",
  "muscle-relaxant", "antipsychotic", "dissociative", "anticonvulsant",
]);
// Categories with meaningful serotonergic activity — combining raises
// serotonin syndrome risk.
const SEROTONERGIC_CLUSTER = new Set(["antidepressant", "empathogen", "psychedelic"]);
// Stimulant categories — combining compounds cardiovascular strain.
const STIMULANT_CLUSTER = new Set(["stimulant", "stimulant-fast"]);

const inCluster = (cluster, catA, catB) => cluster.has(catA) && cluster.has(catB);

// Specific substance pairs (matched on name/generic_name, case-insensitive,
// substring match) that warrant a sharper or more specific warning than the
// category rules below would give on their own.
const NAME_OVERRIDES = [
  {
    match: ["lithium"], other: ["lsd", "psilocybin"], severity: SEVERE,
    reason: "Case reports link lithium combined with classic psychedelics (LSD, psilocybin) to seizures.",
  },
  {
    match: ["cocaine"], other: ["alcohol", "ethanol"], severity: SEVERE,
    reason: "Combines in the liver to form cocaethylene, which is more cardiotoxic than either substance alone and lasts longer.",
  },
];

function nameOverride(a, b) {
  const an = `${a.name || ""} ${a.generic_name || ""}`.toLowerCase();
  const bn = `${b.name || ""} ${b.generic_name || ""}`.toLowerCase();
  for (const rule of NAME_OVERRIDES) {
    const matchesA = rule.match.some((m) => an.includes(m));
    const matchesB = rule.match.some((m) => bn.includes(m));
    const otherA = rule.other.some((m) => an.includes(m));
    const otherB = rule.other.some((m) => bn.includes(m));
    if ((matchesA && otherB) || (matchesB && otherA)) return { severity: rule.severity, reason: rule.reason };
  }
  return null;
}

function categoryRisk(catA, catB) {
  if (!catA || !catB) return null;
  if (inCluster(DEPRESSANT_CLUSTER, catA, catB)) {
    return { severity: SEVERE, reason: "Both act as CNS/respiratory depressants — combining sedatives, opioids, alcohol or similar drugs is a leading cause of overdose death." };
  }
  if (inCluster(SEROTONERGIC_CLUSTER, catA, catB)) {
    return { severity: SEVERE, reason: "Both increase serotonergic activity — combining raises the risk of serotonin syndrome (agitation, fever, rapid heart rate)." };
  }
  if (inCluster(STIMULANT_CLUSTER, catA, catB)) {
    return { severity: CAUTION, reason: "Both are stimulants — combining compounds cardiovascular strain (heart rate, blood pressure)." };
  }
  const stimVsDepressant = (STIMULANT_CLUSTER.has(catA) && DEPRESSANT_CLUSTER.has(catB)) || (STIMULANT_CLUSTER.has(catB) && DEPRESSANT_CLUSTER.has(catA));
  if (stimVsDepressant) {
    return { severity: CAUTION, reason: "The stimulant can mask the depressant's sedation, tempting redosing to a dangerous level." };
  }
  const cannabisVsDepressant = (catA === "cannabis" && DEPRESSANT_CLUSTER.has(catB)) || (catB === "cannabis" && DEPRESSANT_CLUSTER.has(catA));
  if (cannabisVsDepressant) {
    return { severity: CAUTION, reason: "Additive sedation and impairment when cannabis is combined with a CNS depressant." };
  }
  const cannabisVsStimulant = (catA === "cannabis" && STIMULANT_CLUSTER.has(catB)) || (catB === "cannabis" && STIMULANT_CLUSTER.has(catA));
  if (cannabisVsStimulant) {
    return { severity: CAUTION, reason: "Added cardiovascular strain (increased heart rate) when cannabis is combined with a stimulant." };
  }
  return null;
}

// items: [{ id, name, generic_name, category }]. Returns findings for every
// pair with a known risk, most severe first.
export function checkInteractions(items) {
  const findings = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      const hit = nameOverride(a, b) || categoryRisk(a.category, b.category);
      if (hit) findings.push({ aId: a.id, bId: b.id, aName: a.name, bName: b.name, severity: hit.severity, reason: hit.reason });
    }
  }
  return findings.sort((x, y) => (x.severity === y.severity ? 0 : x.severity === SEVERE ? -1 : 1));
}

export function severityMeta(severity) {
  return severity === SEVERE
    ? { label: "High-risk combination", tone: "high" }
    : { label: "Use caution", tone: "medium" };
}
