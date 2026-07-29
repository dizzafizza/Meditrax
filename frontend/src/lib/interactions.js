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
// Two categories above are genuinely mixed buckets, and treating every member
// as a respiratory depressant states something false about specific drugs:
//   - "anticonvulsant" covers gabapentinoids (pregabalin/gabapentin, which
//     carry a real FDA warning about respiratory depression with opioids)
//     *and* sodium-channel agents like lamotrigine, which are not sedating and
//     do not depress respiration.
//   - "antihistamine" covers strongly sedating first-generation agents
//     (diphenhydramine) *and* second-generation ones (cetirizine, loratadine,
//     fexofenadine) selected precisely for minimal CNS penetration.
// Naming the non-sedating members keeps the severe warning for the drugs it's
// actually true of. They still warrant a milder, accurate note rather than
// silence, since additive CNS effects are plausible even where respiratory
// depression isn't. Matched as substrings on name/generic_name.
const NON_SEDATING_DEPRESSANT_MEMBERS = [
  "lamotrigine", "levetiracetam", "topiramate", "carbamazepine", "oxcarbazepine",
  "cetirizine", "loratadine", "fexofenadine", "levocetirizine", "desloratadine",
];
// Categories with meaningful serotonergic activity — combining raises
// serotonin syndrome risk.
const SEROTONERGIC_CLUSTER = new Set(["antidepressant", "empathogen", "psychedelic"]);
// Serotonergic drugs whose *category* doesn't reveal it. Tramadol is the
// important one: it's an opioid by category (so it already flags against
// sedatives) but it is also a serotonin-norepinephrine reuptake inhibitor,
// which is why its own label warns about SSRIs/SNRIs and why it lowers the
// seizure threshold. Without this, tramadol + an SSRI — a genuinely dangerous
// and very common pairing — produced no warning at all.
// (Lithium is deliberately absent: it raises serotonergic tone, but lithium
// augmentation of an antidepressant is standard psychiatric practice, so
// flagging that pair as serotonin syndrome would be a false alarm. Its one
// genuinely dangerous pairing — with classic psychedelics — is a name
// override below.)
const SEROTONERGIC_SUBSTANCES = [
  "tramadol", "meperidine", "pethidine", "dextromethorphan", "tapentadol",
  "linezolid", "triptan", "sumatriptan", "st john", "5-htp",
];
// Stimulant categories — combining compounds cardiovascular strain. MDMA and
// its analogues are substituted amphetamines with genuine stimulant activity
// on top of their serotonergic action, so they belong here as well as in the
// serotonergic cluster.
const STIMULANT_CLUSTER = new Set(["stimulant", "stimulant-fast", "empathogen"]);
// Stimulants whose category doesn't say so — nicotine sits in "other" (a
// bucket otherwise full of chronic-condition medications) but is a
// cardiovascular stimulant.
const STIMULANT_SUBSTANCES = ["nicotine"];

const inCluster = (cluster, catA, catB) => cluster.has(catA) && cluster.has(catB);

const substanceText = (x) => `${x?.name || ""} ${x?.generic_name || ""}`.toLowerCase();
const matchesAny = (item, list) => {
  const t = substanceText(item);
  return list.some((m) => t.includes(m));
};

const isSerotonergic = (item) =>
  SEROTONERGIC_CLUSTER.has(item?.category) || matchesAny(item, SEROTONERGIC_SUBSTANCES);
const isStimulant = (item) =>
  STIMULANT_CLUSTER.has(item?.category) || matchesAny(item, STIMULANT_SUBSTANCES);
const isDepressant = (item) => DEPRESSANT_CLUSTER.has(item?.category);
const isNonSedatingMember = (item) => matchesAny(item, NON_SEDATING_DEPRESSANT_MEMBERS);

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
  {
    // More specific than the generic serotonin-syndrome text, because
    // tramadol's other liability — a lowered seizure threshold — compounds
    // with the same drugs.
    match: ["tramadol"], other: ["sertraline", "fluoxetine", "escitalopram", "citalopram", "paroxetine", "venlafaxine", "duloxetine", "bupropion", "mirtazapine"],
    severity: SEVERE,
    reason: "Tramadol is both an opioid and a serotonin-norepinephrine reuptake inhibitor — combining with an antidepressant raises serotonin syndrome risk and lowers the seizure threshold further.",
  },
  {
    match: ["acetaminophen", "paracetamol"], other: ["alcohol", "ethanol"], severity: CAUTION,
    reason: "Regular alcohol use depletes the liver's capacity to clear acetaminophen safely — the combination raises the risk of liver injury at doses that would otherwise be tolerated.",
  },
  {
    // Lithium has a narrow therapeutic index and is cleared renally; both of
    // these reduce its clearance and can push a stable dose into toxicity.
    match: ["lithium"], other: ["ibuprofen", "naproxen", "aspirin", "lisinopril", "losartan", "valsartan", "hydrochlorothiazide", "diclofenac", "celecoxib"],
    severity: SEVERE,
    reason: "Reduces lithium clearance by the kidneys — lithium has a narrow therapeutic range, so a normally safe dose can rise into toxicity. Levels need monitoring.",
  },
  {
    // Serotonin reuptake inhibition depletes platelet serotonin, which
    // platelets need to aggregate; an NSAID adds direct COX inhibition and
    // gastric irritation on top. Well-established and easy to hit accidentally,
    // since the NSAID half is over the counter.
    match: ["sertraline", "fluoxetine", "escitalopram", "citalopram", "paroxetine", "venlafaxine", "duloxetine"],
    other: ["ibuprofen", "naproxen", "aspirin", "diclofenac", "celecoxib", "ketorolac"],
    severity: CAUTION,
    reason: "Both raise bleeding risk — SSRIs/SNRIs deplete platelet serotonin and NSAIDs irritate the stomach lining, so together they meaningfully increase the chance of GI bleeding.",
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

// Takes the whole item rather than a bare category, because several rules turn
// on the specific substance (a serotonergic opioid, a non-sedating
// anticonvulsant) rather than on its bucket alone.
function mechanismRisk(a, b) {
  if (!a?.category || !b?.category) return null;

  if (isDepressant(a) && isDepressant(b)) {
    // Only claim respiratory depression where it's actually true of both.
    if (isNonSedatingMember(a) || isNonSedatingMember(b)) {
      return { severity: CAUTION, reason: "Additive drowsiness, dizziness and impaired coordination are possible when these are combined." };
    }
    return { severity: SEVERE, reason: "Both act as CNS/respiratory depressants — combining sedatives, opioids, alcohol or similar drugs is a leading cause of overdose death." };
  }
  if (isSerotonergic(a) && isSerotonergic(b)) {
    return { severity: SEVERE, reason: "Both increase serotonergic activity — combining raises the risk of serotonin syndrome (agitation, fever, rapid heart rate)." };
  }
  if (isStimulant(a) && isStimulant(b)) {
    return { severity: CAUTION, reason: "Both are stimulants — combining compounds cardiovascular strain (heart rate, blood pressure)." };
  }
  if ((isStimulant(a) && isDepressant(b)) || (isStimulant(b) && isDepressant(a))) {
    return { severity: CAUTION, reason: "The stimulant can mask the depressant's sedation, tempting redosing to a dangerous level." };
  }
  // A classic psychedelic alongside a stimulant adds real physiological load
  // (heart rate, blood pressure, temperature) on top of an already activating
  // experience, and tends to sharpen anxiety.
  if ((a.category === "psychedelic" && isStimulant(b)) || (b.category === "psychedelic" && isStimulant(a))) {
    return { severity: CAUTION, reason: "A stimulant adds cardiovascular and temperature load on top of the psychedelic, and commonly increases anxiety." };
  }
  const cannabisVsDepressant = (a.category === "cannabis" && isDepressant(b)) || (b.category === "cannabis" && isDepressant(a));
  if (cannabisVsDepressant) {
    return { severity: CAUTION, reason: "Additive sedation and impairment when cannabis is combined with a CNS depressant." };
  }
  const cannabisVsStimulant = (a.category === "cannabis" && isStimulant(b)) || (b.category === "cannabis" && isStimulant(a));
  if (cannabisVsStimulant) {
    return { severity: CAUTION, reason: "Added cardiovascular strain (increased heart rate) when cannabis is combined with a stimulant." };
  }
  return null;
}

// Findings between one candidate substance and each of the `others` (a
// candidate being logged/considered vs. what's already active). Returns
// findings involving the candidate only, most severe first.
export function interactionsWith(candidate, others) {
  if (!candidate) return [];
  const findings = [];
  for (const o of others || []) {
    if (!o || o.id === candidate.id) continue;
    const hit = nameOverride(candidate, o) || mechanismRisk(candidate, o);
    if (hit) findings.push({ otherId: o.id, otherName: o.name, name: candidate.name, severity: hit.severity, reason: hit.reason });
  }
  return findings.sort((x, y) => (x.severity === y.severity ? 0 : x.severity === SEVERE ? -1 : 1));
}

// items: [{ id, name, generic_name, category }]. Returns findings for every
// pair with a known risk, most severe first.
export function checkInteractions(items) {
  const findings = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      const hit = nameOverride(a, b) || mechanismRisk(a, b);
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
