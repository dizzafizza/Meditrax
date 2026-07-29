import { checkInteractions, interactionsWith, severityMeta, SEVERE, CAUTION } from "../interactions";

const med = (id, name, category, generic_name) => ({ id, name, generic_name, category });

describe("checkInteractions", () => {
  test("two CNS depressants (even the same category) are flagged severe", () => {
    const findings = checkInteractions([med("1", "Alprazolam", "benzodiazepine"), med("2", "Oxycodone", "opioid")]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(SEVERE);
    expect(findings[0].reason).toMatch(/respiratory depress/i);

    const twoBenzos = checkInteractions([med("1", "Alprazolam", "benzodiazepine"), med("2", "Diazepam", "benzodiazepine")]);
    expect(twoBenzos).toHaveLength(1);
    expect(twoBenzos[0].severity).toBe(SEVERE);
  });

  test("serotonergic combinations (MDMA + antidepressant, LSD + psilocybin) are flagged severe", () => {
    const mdmaSsri = checkInteractions([med("1", "MDMA", "empathogen"), med("2", "Sertraline", "antidepressant")]);
    expect(mdmaSsri).toHaveLength(1);
    expect(mdmaSsri[0].severity).toBe(SEVERE);
    expect(mdmaSsri[0].reason).toMatch(/serotonin/i);

    const lsdPsilo = checkInteractions([med("1", "LSD", "psychedelic"), med("2", "Psilocybin mushrooms", "psychedelic")]);
    expect(lsdPsilo).toHaveLength(1);
    expect(lsdPsilo[0].severity).toBe(SEVERE);
  });

  test("two stimulants are flagged caution (cardiovascular strain), not severe", () => {
    const findings = checkInteractions([med("1", "Cocaine", "stimulant-fast"), med("2", "Amphetamine/Dextroamphetamine", "stimulant")]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(CAUTION);
  });

  test("stimulant + depressant is flagged caution (masked intoxication)", () => {
    const findings = checkInteractions([med("1", "Methamphetamine", "stimulant"), med("2", "Alcohol", "depressant")]);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(CAUTION);
    expect(findings[0].reason).toMatch(/mask/i);
  });

  test("cannabis pairs with depressants and stimulants as caution", () => {
    expect(checkInteractions([med("1", "Cannabis (THC)", "cannabis"), med("2", "Lorazepam", "benzodiazepine")])[0].severity).toBe(CAUTION);
    expect(checkInteractions([med("1", "Cannabis (THC)", "cannabis"), med("2", "Cocaine", "stimulant-fast")])[0].severity).toBe(CAUTION);
  });

  test("name-specific overrides: lithium + psychedelics and cocaine + alcohol upgrade to a specific severe reason", () => {
    const li = checkInteractions([med("1", "Lithium", "other", "lithium carbonate"), med("2", "LSD", "psychedelic")]);
    expect(li).toHaveLength(1);
    expect(li[0].severity).toBe(SEVERE);
    expect(li[0].reason).toMatch(/seizure/i);

    const cocEtoh = checkInteractions([med("1", "Cocaine", "stimulant-fast", "cocaine"), med("2", "Alcohol", "depressant", "ethanol")]);
    expect(cocEtoh).toHaveLength(1);
    expect(cocEtoh[0].reason).toMatch(/cocaethylene/i);
    // the specific reason replaces (rather than duplicates) the generic stimulant+depressant caution
    expect(cocEtoh[0].severity).toBe(SEVERE);
  });

  test("no known-risk pairing returns no findings", () => {
    expect(checkInteractions([med("1", "Levothyroxine", "thyroid"), med("2", "Metformin", "diabetes")])).toHaveLength(0);
    expect(checkInteractions([med("1", "Ibuprofen", "nsaid")])).toHaveLength(0); // single item, no pairs
  });

  test("three concurrently active substances surface every pairwise risk, most severe first", () => {
    const findings = checkInteractions([
      med("1", "Oxycodone", "opioid"),
      med("2", "Alcohol", "depressant"),
      med("3", "Cocaine", "stimulant-fast"),
    ]);
    // opioid+depressant (severe), opioid+cocaine (caution), alcohol+cocaine (severe, cocaethylene override)
    expect(findings).toHaveLength(3);
    expect(findings[0].severity).toBe(SEVERE);
    expect(findings[findings.length - 1].severity === CAUTION || findings[findings.length - 1].severity === SEVERE).toBe(true);
    expect(findings.filter((f) => f.severity === SEVERE).length).toBe(2);
    expect(findings.filter((f) => f.severity === CAUTION).length).toBe(1);
  });
});

describe("interactionsWith (one candidate vs. active others)", () => {
  const active = [
    med("a", "Oxycodone", "opioid"),
    med("b", "Alcohol", "depressant", "ethanol"),
    med("c", "Levothyroxine", "thyroid"),
  ];

  test("returns only findings involving the candidate, most severe first", () => {
    const f = interactionsWith(med("x", "Cocaine", "stimulant-fast", "cocaine"), active);
    // cocaine+opioid (caution: stim masks depressant), cocaine+alcohol (severe: cocaethylene)
    expect(f).toHaveLength(2);
    expect(f[0].severity).toBe(SEVERE);
    expect(f[0].otherName).toBe("Alcohol");
    expect(f.every((x) => x.name === "Cocaine")).toBe(true);
  });

  test("excludes the candidate itself when it's also in the active list", () => {
    const f = interactionsWith(med("a", "Oxycodone", "opioid"), active);
    // oxycodone vs alcohol (severe) only; not vs itself, not vs thyroid
    expect(f).toHaveLength(1);
    expect(f[0].otherName).toBe("Alcohol");
  });

  test("no candidate, empty others, or no interactions → empty", () => {
    expect(interactionsWith(null, active)).toEqual([]);
    expect(interactionsWith(med("x", "Ibuprofen", "nsaid"), [])).toEqual([]);
    expect(interactionsWith(med("x", "Levothyroxine", "thyroid"), active)).toEqual([]);
  });
});

describe("severityMeta", () => {
  test("maps severity to a badge tone", () => {
    expect(severityMeta(SEVERE)).toEqual({ label: "High-risk combination", tone: "high" });
    expect(severityMeta(CAUTION)).toEqual({ label: "Use caution", tone: "medium" });
  });
});

// Cases where the drug's *category* alone gives the wrong answer, so the rules
// have to look at the substance itself.
describe("substance-level pharmacology the category bucket doesn't capture", () => {
  const first = (a, b) => checkInteractions([{ ...a, id: "1" }, { ...b, id: "2" }])[0] || null;

  test("tramadol + an SSRI/SNRI is severe — it's an opioid by category but also a serotonin reuptake inhibitor", () => {
    const hit = first(med("1", "Tramadol", "opioid", "tramadol"), med("2", "Sertraline", "antidepressant", "sertraline"));
    expect(hit.severity).toBe(SEVERE);
    expect(hit.reason).toMatch(/seizure threshold/i);
    // and the plain depressant rule still applies to tramadol + a sedative
    expect(first(med("1", "Tramadol", "opioid", "tramadol"), med("2", "Alcohol", "depressant", "ethanol")).severity).toBe(SEVERE);
  });

  test("a non-sedating anticonvulsant/antihistamine is not called a respiratory depressant", () => {
    const lamo = first(med("1", "Lamotrigine", "anticonvulsant", "lamotrigine"), med("2", "Oxycodone", "opioid", "oxycodone"));
    expect(lamo.severity).toBe(CAUTION);
    expect(lamo.reason).not.toMatch(/respiratory|overdose death/i);

    const cet = first(med("1", "Cetirizine", "antihistamine", "cetirizine"), med("2", "Oxycodone", "opioid", "oxycodone"));
    expect(cet.severity).toBe(CAUTION);

    // ...but the members that genuinely are depressants keep the severe warning
    expect(first(med("1", "Gabapentin", "anticonvulsant", "gabapentin"), med("2", "Oxycodone", "opioid", "oxycodone")).severity).toBe(SEVERE);
    expect(first(med("1", "Pregabalin", "anticonvulsant", "pregabalin"), med("2", "Alcohol", "depressant", "ethanol")).severity).toBe(SEVERE);
    expect(first(med("1", "Diphenhydramine", "antihistamine", "diphenhydramine"), med("2", "Oxycodone", "opioid", "oxycodone")).severity).toBe(SEVERE);
  });

  test("MDMA counts as a stimulant as well as a serotonergic — but serotonin syndrome still wins where both apply", () => {
    expect(first(med("1", "MDMA", "empathogen"), med("2", "Cocaine", "stimulant-fast")).severity).toBe(CAUTION);
    expect(first(med("1", "MDMA", "empathogen"), med("2", "Methamphetamine", "stimulant")).severity).toBe(CAUTION);
    expect(first(med("1", "MDMA", "empathogen"), med("2", "Sertraline", "antidepressant")).reason).toMatch(/serotonin/i);
  });

  test("a classic psychedelic plus a stimulant is flagged", () => {
    const hit = first(med("1", "LSD", "psychedelic"), med("2", "Caffeine", "stimulant"));
    expect(hit.severity).toBe(CAUTION);
    expect(hit.reason).toMatch(/cardiovascular|anxiety/i);
  });

  test("nicotine is treated as a stimulant despite sitting in the 'other' category", () => {
    expect(first(med("1", "Nicotine", "other", "nicotine"), med("2", "Cocaine", "stimulant-fast")).severity).toBe(CAUTION);
  });

  test("lithium: renal-clearance interactions flagged, psychedelics flagged, SSRI augmentation not", () => {
    expect(first(med("1", "Lithium", "other", "lithium carbonate"), med("2", "Ibuprofen", "nsaid", "ibuprofen")).severity).toBe(SEVERE);
    expect(first(med("1", "Lithium", "other", "lithium carbonate"), med("2", "Lisinopril", "antihypertensive", "lisinopril")).severity).toBe(SEVERE);
    expect(first(med("1", "Lithium", "other", "lithium carbonate"), med("2", "LSD", "psychedelic")).reason).toMatch(/seizure/i);
    // lithium augmentation of an antidepressant is standard practice, not a warning
    expect(first(med("1", "Lithium", "other", "lithium carbonate"), med("2", "Sertraline", "antidepressant", "sertraline"))).toBeNull();
  });

  test("SSRI/SNRI + NSAID raises bleeding risk; an NDRI antidepressant does not", () => {
    expect(first(med("1", "Sertraline", "antidepressant", "sertraline"), med("2", "Ibuprofen", "nsaid", "ibuprofen")).reason).toMatch(/bleed/i);
    expect(first(med("1", "Bupropion", "antidepressant", "bupropion"), med("2", "Ibuprofen", "nsaid", "ibuprofen"))).toBeNull();
  });

  test("acetaminophen + alcohol is flagged for liver risk", () => {
    const hit = first(med("1", "Acetaminophen", "other", "acetaminophen (paracetamol)"), med("2", "Alcohol", "depressant", "ethanol"));
    expect(hit.severity).toBe(CAUTION);
    expect(hit.reason).toMatch(/liver/i);
  });

  test("unrelated medications still produce nothing", () => {
    expect(first(med("1", "Levothyroxine", "thyroid"), med("2", "Metformin", "diabetes"))).toBeNull();
    expect(first(med("1", "Atorvastatin", "statin"), med("2", "Lisinopril", "antihypertensive"))).toBeNull();
  });
});
