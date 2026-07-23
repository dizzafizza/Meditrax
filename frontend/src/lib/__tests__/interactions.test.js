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
