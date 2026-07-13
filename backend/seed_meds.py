"""
Extensive curated medication catalog for Meditrax.

Serves three purposes:
  1. "Add medication" autocomplete / pre-fill.
  2. Knowledge Base / Wiki articles.
  3. RAG context for the AI assistant (MongoDB text search over name/class/content).

risk_level: minimal | low | moderate | high
dependency_risk_category: none | low | moderate | high | extreme
"""

MEDICATION_CATALOG = [
    # ---------------- Antidepressants (SSRIs / SNRIs) ----------------
    {
        "name": "Sertraline", "generic_name": "sertraline", "brand_names": ["Zoloft", "Lustral"],
        "drug_class": "SSRI antidepressant", "category": "antidepressant", "default_unit": "mg",
        "common_dosages": [25, 50, 100], "typical_dosing": "50-200 mg once daily",
        "max_daily_dose": 200, "half_life": "~26 hours", "risk_level": "low",
        "dependency_risk_category": "moderate",
        "mechanism": "Selectively inhibits serotonin reuptake, increasing synaptic serotonin.",
        "common_side_effects": ["nausea", "diarrhea", "insomnia", "headache", "sexual dysfunction"],
        "serious_side_effects": ["serotonin syndrome", "suicidal thoughts in young adults", "hyponatremia"],
        "interactions": ["MAOIs", "other serotonergic drugs", "NSAIDs (bleeding risk)", "warfarin"],
        "warnings": ["Do not stop abruptly — taper to avoid discontinuation syndrome.", "Black box: suicidality in <25 yrs."],
        "content": "Sertraline is a widely prescribed SSRI for depression, anxiety, panic disorder, OCD and PTSD. It is generally well tolerated. Abrupt discontinuation can cause dizziness, flu-like symptoms and 'brain zaps', so a gradual hyperbolic taper is recommended, especially after long-term use."
    },
    {
        "name": "Escitalopram", "generic_name": "escitalopram", "brand_names": ["Lexapro", "Cipralex"],
        "drug_class": "SSRI antidepressant", "category": "antidepressant", "default_unit": "mg",
        "common_dosages": [5, 10, 20], "typical_dosing": "10-20 mg once daily",
        "max_daily_dose": 20, "half_life": "27-32 hours", "risk_level": "low",
        "dependency_risk_category": "moderate",
        "mechanism": "Highly selective serotonin reuptake inhibitor.",
        "common_side_effects": ["nausea", "fatigue", "insomnia", "sexual dysfunction"],
        "serious_side_effects": ["QT prolongation at high dose", "serotonin syndrome", "hyponatremia"],
        "interactions": ["MAOIs", "QT-prolonging drugs", "NSAIDs"],
        "warnings": ["Taper gradually when stopping.", "Black box: suicidality in <25 yrs."],
        "content": "Escitalopram is the most selective SSRI and a first-line option for major depression and generalized anxiety disorder. Discontinuation effects are common; a slow taper reduces withdrawal."
    },
    {
        "name": "Fluoxetine", "generic_name": "fluoxetine", "brand_names": ["Prozac", "Sarafem"],
        "drug_class": "SSRI antidepressant", "category": "antidepressant", "default_unit": "mg",
        "common_dosages": [10, 20, 40], "typical_dosing": "20-60 mg once daily",
        "max_daily_dose": 80, "half_life": "1-3 days (active metabolite 4-16 days)", "risk_level": "low",
        "dependency_risk_category": "low",
        "mechanism": "SSRI with long half-life.",
        "common_side_effects": ["insomnia", "anxiety", "nausea", "decreased appetite"],
        "serious_side_effects": ["serotonin syndrome", "suicidality in youth"],
        "interactions": ["MAOIs", "thioridazine", "serotonergic agents"],
        "warnings": ["Long half-life makes discontinuation milder but interactions persist for weeks."],
        "content": "Fluoxetine's very long half-life makes it self-tapering and a useful bridge for stopping shorter-acting SSRIs/SNRIs. Common for depression, OCD and bulimia."
    },
    {
        "name": "Venlafaxine", "generic_name": "venlafaxine", "brand_names": ["Effexor", "Effexor XR"],
        "drug_class": "SNRI antidepressant", "category": "antidepressant", "default_unit": "mg",
        "common_dosages": [37.5, 75, 150], "typical_dosing": "75-225 mg daily",
        "max_daily_dose": 375, "half_life": "5 hours (XR 15 h)", "risk_level": "moderate",
        "dependency_risk_category": "high",
        "mechanism": "Inhibits serotonin and norepinephrine reuptake (dose-dependent).",
        "common_side_effects": ["nausea", "sweating", "dry mouth", "increased blood pressure"],
        "serious_side_effects": ["hypertension", "serotonin syndrome", "severe discontinuation syndrome"],
        "interactions": ["MAOIs", "serotonergic drugs", "NSAIDs"],
        "warnings": ["Notorious for severe withdrawal — requires very slow hyperbolic taper.", "Monitor blood pressure."],
        "content": "Venlafaxine is an SNRI for depression and anxiety. It has one of the most difficult discontinuation profiles of any antidepressant; hyperbolic tapering with small final-step reductions is strongly advised."
    },
    {
        "name": "Duloxetine", "generic_name": "duloxetine", "brand_names": ["Cymbalta"],
        "drug_class": "SNRI antidepressant", "category": "antidepressant", "default_unit": "mg",
        "common_dosages": [20, 30, 60], "typical_dosing": "30-60 mg daily",
        "max_daily_dose": 120, "half_life": "~12 hours", "risk_level": "moderate",
        "dependency_risk_category": "high",
        "mechanism": "Serotonin-norepinephrine reuptake inhibitor.",
        "common_side_effects": ["nausea", "dry mouth", "constipation", "fatigue"],
        "serious_side_effects": ["hepatotoxicity", "serotonin syndrome", "withdrawal"],
        "interactions": ["MAOIs", "CYP1A2/2D6 inhibitors", "serotonergic drugs"],
        "warnings": ["Taper slowly.", "Avoid in heavy alcohol use / liver disease."],
        "content": "Duloxetine treats depression, anxiety, diabetic neuropathy and fibromyalgia. Discontinuation symptoms are common, so gradual dose reduction is recommended."
    },
    {
        "name": "Bupropion", "generic_name": "bupropion", "brand_names": ["Wellbutrin", "Zyban"],
        "drug_class": "NDRI antidepressant", "category": "antidepressant", "default_unit": "mg",
        "common_dosages": [75, 100, 150, 300], "typical_dosing": "150-300 mg daily",
        "max_daily_dose": 450, "half_life": "~21 hours", "risk_level": "moderate",
        "dependency_risk_category": "low",
        "mechanism": "Norepinephrine-dopamine reuptake inhibitor.",
        "common_side_effects": ["insomnia", "dry mouth", "headache", "agitation"],
        "serious_side_effects": ["seizures (dose-related)", "hypertension"],
        "interactions": ["MAOIs", "drugs lowering seizure threshold"],
        "warnings": ["Avoid in seizure or eating disorders.", "Activating — dose earlier in day."],
        "content": "Bupropion is an activating antidepressant also used for smoking cessation. It does not cause sexual dysfunction or weight gain but lowers the seizure threshold."
    },
    {
        "name": "Mirtazapine", "generic_name": "mirtazapine", "brand_names": ["Remeron"],
        "drug_class": "Tetracyclic antidepressant", "category": "antidepressant", "default_unit": "mg",
        "common_dosages": [15, 30, 45], "typical_dosing": "15-45 mg at bedtime",
        "max_daily_dose": 45, "half_life": "20-40 hours", "risk_level": "low",
        "dependency_risk_category": "moderate",
        "mechanism": "Alpha-2 antagonist increasing noradrenergic & serotonergic transmission.",
        "common_side_effects": ["sedation", "increased appetite", "weight gain", "dry mouth"],
        "serious_side_effects": ["agranulocytosis (rare)", "serotonin syndrome"],
        "interactions": ["MAOIs", "CNS depressants", "alcohol"],
        "warnings": ["Sedation strongest at low doses.", "Taper to stop."],
        "content": "Mirtazapine is useful when insomnia and poor appetite accompany depression. Lower doses are often more sedating than higher ones."
    },

    # ---------------- Benzodiazepines ----------------
    {
        "name": "Alprazolam", "generic_name": "alprazolam", "brand_names": ["Xanax"],
        "drug_class": "Benzodiazepine", "category": "benzodiazepine", "default_unit": "mg",
        "common_dosages": [0.25, 0.5, 1, 2], "typical_dosing": "0.25-0.5 mg up to 3x daily",
        "max_daily_dose": 4, "half_life": "11-16 hours", "risk_level": "high",
        "dependency_risk_category": "extreme",
        "mechanism": "Enhances GABA-A receptor activity (CNS depressant).",
        "common_side_effects": ["drowsiness", "dizziness", "memory impairment", "fatigue"],
        "serious_side_effects": ["respiratory depression with opioids", "severe withdrawal seizures", "dependence"],
        "interactions": ["opioids", "alcohol", "other CNS depressants", "CYP3A4 inhibitors"],
        "warnings": ["High dependence and abuse potential.", "Never stop abruptly — risk of seizures.", "Slow hyperbolic taper required."],
        "content": "Alprazolam is a short-acting, high-potency benzodiazepine for panic and anxiety. Its short half-life makes inter-dose withdrawal and dependence especially likely; many clinicians switch to diazepam for tapering."
    },
    {
        "name": "Lorazepam", "generic_name": "lorazepam", "brand_names": ["Ativan"],
        "drug_class": "Benzodiazepine", "category": "benzodiazepine", "default_unit": "mg",
        "common_dosages": [0.5, 1, 2], "typical_dosing": "0.5-2 mg 2-3x daily",
        "max_daily_dose": 10, "half_life": "10-20 hours", "risk_level": "high",
        "dependency_risk_category": "extreme",
        "mechanism": "GABA-A receptor positive modulator.",
        "common_side_effects": ["sedation", "dizziness", "weakness", "unsteadiness"],
        "serious_side_effects": ["respiratory depression", "dependence", "withdrawal seizures"],
        "interactions": ["opioids", "alcohol", "CNS depressants"],
        "warnings": ["High dependency risk.", "Taper slowly; do not stop abruptly."],
        "content": "Lorazepam is an intermediate-acting benzodiazepine used for anxiety, insomnia, seizures and procedural sedation. Long-term use causes tolerance and dependence; a slow, proportionate taper is essential."
    },
    {
        "name": "Clonazepam", "generic_name": "clonazepam", "brand_names": ["Klonopin", "Rivotril"],
        "drug_class": "Benzodiazepine", "category": "benzodiazepine", "default_unit": "mg",
        "common_dosages": [0.5, 1, 2], "typical_dosing": "0.5-2 mg daily",
        "max_daily_dose": 4, "half_life": "30-40 hours", "risk_level": "high",
        "dependency_risk_category": "extreme",
        "mechanism": "Long-acting GABA-A modulator.",
        "common_side_effects": ["drowsiness", "coordination problems", "fatigue"],
        "serious_side_effects": ["dependence", "withdrawal seizures", "respiratory depression"],
        "interactions": ["opioids", "alcohol", "CNS depressants"],
        "warnings": ["High dependency risk.", "Slow taper required."],
        "content": "Clonazepam is a longer-acting benzodiazepine for seizures and panic disorder. Its longer half-life makes tapering somewhat smoother than alprazolam, but dependence is still a major concern."
    },
    {
        "name": "Diazepam", "generic_name": "diazepam", "brand_names": ["Valium"],
        "drug_class": "Benzodiazepine", "category": "benzodiazepine", "default_unit": "mg",
        "common_dosages": [2, 5, 10], "typical_dosing": "2-10 mg 2-4x daily",
        "max_daily_dose": 40, "half_life": "20-100 hours (active metabolites)", "risk_level": "high",
        "dependency_risk_category": "extreme",
        "mechanism": "Long-acting GABA-A modulator.",
        "common_side_effects": ["drowsiness", "muscle weakness", "ataxia"],
        "serious_side_effects": ["dependence", "respiratory depression", "withdrawal"],
        "interactions": ["opioids", "alcohol", "CNS depressants"],
        "warnings": ["Often the preferred agent for benzodiazepine tapering due to long half-life.", "Slow taper to a low floor dose."],
        "content": "Diazepam's very long half-life provides smooth blood levels, making it the standard for benzodiazepine substitution and tapering. Final taper steps are typically to 0.5-1 mg before stopping."
    },
    {
        "name": "Zolpidem", "generic_name": "zolpidem", "brand_names": ["Ambien", "Stilnox"],
        "drug_class": "Z-drug (non-benzodiazepine hypnotic)", "category": "sleep-aid", "default_unit": "mg",
        "common_dosages": [5, 10], "typical_dosing": "5-10 mg at bedtime",
        "max_daily_dose": 10, "half_life": "~2.5 hours", "risk_level": "moderate",
        "dependency_risk_category": "high",
        "mechanism": "Selective GABA-A (omega-1) agonist.",
        "common_side_effects": ["drowsiness", "dizziness", "headache"],
        "serious_side_effects": ["complex sleep behaviors (sleep-driving)", "dependence"],
        "interactions": ["alcohol", "CNS depressants", "CYP3A4 inhibitors"],
        "warnings": ["Take only when able to get 7-8 h sleep.", "Risk of next-day impairment, esp. women."],
        "content": "Zolpidem is a short-acting hypnotic for insomnia. It carries warnings about complex sleep behaviors and can cause rebound insomnia and dependence with prolonged use."
    },

    # ---------------- Opioids ----------------
    {
        "name": "Oxycodone", "generic_name": "oxycodone", "brand_names": ["OxyContin", "Roxicodone", "Percocet (with APAP)"],
        "drug_class": "Opioid analgesic", "category": "opioid", "default_unit": "mg",
        "common_dosages": [5, 10, 15, 20], "typical_dosing": "5-15 mg every 4-6 h as needed",
        "max_daily_dose": None, "half_life": "3-4.5 hours", "risk_level": "high",
        "dependency_risk_category": "extreme",
        "mechanism": "Mu-opioid receptor agonist.",
        "common_side_effects": ["constipation", "nausea", "drowsiness", "itching"],
        "serious_side_effects": ["respiratory depression", "overdose", "physical dependence", "addiction"],
        "interactions": ["benzodiazepines", "alcohol", "other CNS depressants", "MAOIs"],
        "warnings": ["High overdose & addiction risk.", "Combining with benzodiazepines can be fatal.", "Taper to avoid withdrawal."],
        "content": "Oxycodone is a potent opioid for moderate-to-severe pain. Tolerance, dependence and addiction can develop quickly. Discontinuation after regular use should be gradual to limit withdrawal."
    },
    {
        "name": "Tramadol", "generic_name": "tramadol", "brand_names": ["Ultram", "ConZip"],
        "drug_class": "Opioid analgesic (atypical)", "category": "opioid", "default_unit": "mg",
        "common_dosages": [50, 100], "typical_dosing": "50-100 mg every 4-6 h",
        "max_daily_dose": 400, "half_life": "6-8 hours", "risk_level": "high",
        "dependency_risk_category": "high",
        "mechanism": "Weak mu-opioid agonist plus serotonin/norepinephrine reuptake inhibition.",
        "common_side_effects": ["nausea", "dizziness", "constipation", "headache"],
        "serious_side_effects": ["seizures", "serotonin syndrome", "respiratory depression", "dependence"],
        "interactions": ["SSRIs/SNRIs", "MAOIs", "other serotonergic drugs", "CNS depressants"],
        "warnings": ["Lowers seizure threshold.", "Serotonin syndrome risk with antidepressants.", "Taper to stop."],
        "content": "Tramadol provides moderate pain relief with dual opioid and monoaminergic action. It carries seizure and serotonin syndrome risks and produces both opioid and SSRI-like withdrawal."
    },
    {
        "name": "Codeine", "generic_name": "codeine", "brand_names": ["Tylenol #3 (with APAP)"],
        "drug_class": "Opioid analgesic", "category": "opioid", "default_unit": "mg",
        "common_dosages": [15, 30, 60], "typical_dosing": "15-60 mg every 4-6 h",
        "max_daily_dose": 360, "half_life": "~3 hours", "risk_level": "high",
        "dependency_risk_category": "high",
        "mechanism": "Prodrug metabolized to morphine via CYP2D6.",
        "common_side_effects": ["constipation", "drowsiness", "nausea"],
        "serious_side_effects": ["respiratory depression (esp. ultra-rapid metabolizers)", "dependence"],
        "interactions": ["CNS depressants", "CYP2D6 inhibitors"],
        "warnings": ["Avoid in children and breastfeeding.", "Variable effect by metabolism."],
        "content": "Codeine is a mild opioid often combined with acetaminophen for pain and cough. Effectiveness varies with CYP2D6 genetics."
    },
    {
        "name": "Buprenorphine", "generic_name": "buprenorphine", "brand_names": ["Suboxone (with naloxone)", "Subutex", "Belbuca"],
        "drug_class": "Partial opioid agonist", "category": "opioid", "default_unit": "mg",
        "common_dosages": [2, 4, 8, 12], "typical_dosing": "Induction/maintenance per protocol",
        "max_daily_dose": 24, "half_life": "24-42 hours", "risk_level": "high",
        "dependency_risk_category": "high",
        "mechanism": "Partial mu-opioid agonist with high receptor affinity; ceiling effect on respiratory depression.",
        "common_side_effects": ["headache", "constipation", "sweating", "insomnia"],
        "serious_side_effects": ["precipitated withdrawal", "respiratory depression with benzodiazepines"],
        "interactions": ["benzodiazepines", "CNS depressants", "CYP3A4 inhibitors"],
        "warnings": ["Used for opioid use disorder and pain.", "Taper under specialist supervision."],
        "content": "Buprenorphine is a partial agonist central to opioid use disorder treatment. Its long action and ceiling effect improve safety, but tapering should be slow and supervised."
    },

    # ---------------- Stimulants (ADHD) ----------------
    {
        "name": "Methylphenidate", "generic_name": "methylphenidate", "brand_names": ["Ritalin", "Concerta", "Medikinet"],
        "drug_class": "CNS stimulant", "category": "stimulant", "default_unit": "mg",
        "common_dosages": [5, 10, 18, 27, 36, 54], "typical_dosing": "18-54 mg daily (ER) or 5-20 mg 2-3x (IR)",
        "max_daily_dose": 72, "half_life": "2-3 hours (IR)", "risk_level": "moderate",
        "dependency_risk_category": "high",
        "mechanism": "Blocks dopamine and norepinephrine reuptake.",
        "common_side_effects": ["decreased appetite", "insomnia", "increased heart rate", "anxiety"],
        "serious_side_effects": ["cardiovascular events", "psychosis", "dependence"],
        "interactions": ["MAOIs", "vasopressors", "other stimulants"],
        "warnings": ["Controlled substance.", "Monitor blood pressure, growth in children."],
        "content": "Methylphenidate is a first-line ADHD stimulant. It is a controlled substance with abuse potential; structured 'drug holidays' (cyclic dosing) are sometimes used."
    },
    {
        "name": "Lisdexamfetamine", "generic_name": "lisdexamfetamine", "brand_names": ["Vyvanse", "Elvanse"],
        "drug_class": "CNS stimulant (prodrug)", "category": "stimulant", "default_unit": "mg",
        "common_dosages": [20, 30, 40, 50, 60, 70], "typical_dosing": "30-70 mg each morning",
        "max_daily_dose": 70, "half_life": "<1 h (prodrug); dexamfetamine ~10-13 h", "risk_level": "moderate",
        "dependency_risk_category": "high",
        "mechanism": "Prodrug converted to dexamfetamine, increasing dopamine/norepinephrine.",
        "common_side_effects": ["appetite loss", "insomnia", "dry mouth", "irritability"],
        "serious_side_effects": ["cardiovascular risk", "psychosis", "dependence"],
        "interactions": ["MAOIs", "serotonergic drugs", "acidifying agents"],
        "warnings": ["Controlled substance.", "Lower abuse potential than IR amphetamine but still significant."],
        "content": "Lisdexamfetamine is a long-acting prodrug stimulant for ADHD and binge-eating disorder. Its prodrug design gives a smoother profile and somewhat lower abuse liability."
    },
    {
        "name": "Amphetamine/Dextroamphetamine", "generic_name": "amphetamine-dextroamphetamine", "brand_names": ["Adderall", "Adderall XR"],
        "drug_class": "CNS stimulant", "category": "stimulant", "default_unit": "mg",
        "common_dosages": [5, 10, 20, 30], "typical_dosing": "5-30 mg daily",
        "max_daily_dose": 40, "half_life": "9-14 hours", "risk_level": "moderate",
        "dependency_risk_category": "high",
        "mechanism": "Releases and blocks reuptake of dopamine and norepinephrine.",
        "common_side_effects": ["appetite loss", "insomnia", "increased heart rate", "anxiety"],
        "serious_side_effects": ["cardiovascular events", "psychosis", "dependence"],
        "interactions": ["MAOIs", "serotonergic drugs", "acidic foods reduce absorption"],
        "warnings": ["High abuse potential — controlled substance.", "Monitor cardiovascular status."],
        "content": "Adderall is a mixed amphetamine salt stimulant for ADHD and narcolepsy with significant abuse potential and a notable comedown when stopped."
    },

    # ---------------- Gabapentinoids ----------------
    {
        "name": "Gabapentin", "generic_name": "gabapentin", "brand_names": ["Neurontin", "Gralise"],
        "drug_class": "Gabapentinoid anticonvulsant", "category": "anticonvulsant", "default_unit": "mg",
        "common_dosages": [100, 300, 400, 600, 800], "typical_dosing": "300-1200 mg 3x daily",
        "max_daily_dose": 3600, "half_life": "5-7 hours", "risk_level": "moderate",
        "dependency_risk_category": "moderate",
        "mechanism": "Binds alpha-2-delta subunit of voltage-gated calcium channels.",
        "common_side_effects": ["dizziness", "drowsiness", "peripheral edema", "ataxia"],
        "serious_side_effects": ["respiratory depression with opioids", "withdrawal", "mood changes"],
        "interactions": ["opioids", "CNS depressants", "antacids (reduce absorption)"],
        "warnings": ["Taper to avoid withdrawal/seizures.", "Increasing misuse potential."],
        "content": "Gabapentin treats neuropathic pain and seizures and is used off-label for anxiety and sleep. Withdrawal can occur after prolonged use; taper gradually."
    },
    {
        "name": "Pregabalin", "generic_name": "pregabalin", "brand_names": ["Lyrica"],
        "drug_class": "Gabapentinoid anticonvulsant", "category": "anticonvulsant", "default_unit": "mg",
        "common_dosages": [25, 50, 75, 150, 300], "typical_dosing": "75-300 mg twice daily",
        "max_daily_dose": 600, "half_life": "~6 hours", "risk_level": "moderate",
        "dependency_risk_category": "high",
        "mechanism": "Alpha-2-delta calcium channel ligand.",
        "common_side_effects": ["dizziness", "somnolence", "weight gain", "edema"],
        "serious_side_effects": ["dependence", "respiratory depression with opioids"],
        "interactions": ["opioids", "alcohol", "CNS depressants"],
        "warnings": ["Schedule V controlled (US).", "Taper to discontinue."],
        "content": "Pregabalin treats neuropathic pain, fibromyalgia and generalized anxiety. It has clearer abuse potential than gabapentin and should be tapered when stopping."
    },

    # ---------------- NSAIDs / Analgesics ----------------
    {
        "name": "Ibuprofen", "generic_name": "ibuprofen", "brand_names": ["Advil", "Motrin", "Nurofen"],
        "drug_class": "NSAID", "category": "nsaid", "default_unit": "mg",
        "common_dosages": [200, 400, 600, 800], "typical_dosing": "200-400 mg every 4-6 h",
        "max_daily_dose": 3200, "half_life": "~2 hours", "risk_level": "low",
        "dependency_risk_category": "none",
        "mechanism": "Non-selective COX inhibitor reducing prostaglandins.",
        "common_side_effects": ["stomach upset", "heartburn", "nausea"],
        "serious_side_effects": ["GI bleeding", "kidney injury", "cardiovascular risk"],
        "interactions": ["anticoagulants", "SSRIs (bleeding)", "ACE inhibitors", "lithium"],
        "warnings": ["Take with food.", "Avoid in kidney disease, ulcers, late pregnancy."],
        "content": "Ibuprofen is a common over-the-counter NSAID for pain, fever and inflammation. It has no dependence potential but can cause GI and kidney harm with overuse."
    },
    {
        "name": "Naproxen", "generic_name": "naproxen", "brand_names": ["Aleve", "Naprosyn"],
        "drug_class": "NSAID", "category": "nsaid", "default_unit": "mg",
        "common_dosages": [220, 250, 375, 500], "typical_dosing": "250-500 mg twice daily",
        "max_daily_dose": 1250, "half_life": "12-17 hours", "risk_level": "low",
        "dependency_risk_category": "none",
        "mechanism": "Non-selective COX inhibitor.",
        "common_side_effects": ["stomach upset", "heartburn", "dizziness"],
        "serious_side_effects": ["GI bleeding", "kidney injury", "cardiovascular events"],
        "interactions": ["anticoagulants", "antihypertensives", "lithium"],
        "warnings": ["Take with food.", "Longer half-life than ibuprofen."],
        "content": "Naproxen is a longer-acting NSAID useful for sustained pain and inflammation, with a comparatively lower cardiovascular risk among NSAIDs."
    },
    {
        "name": "Acetaminophen", "generic_name": "acetaminophen (paracetamol)", "brand_names": ["Tylenol", "Panadol"],
        "drug_class": "Analgesic / antipyretic", "category": "other", "default_unit": "mg",
        "common_dosages": [325, 500, 650], "typical_dosing": "500-1000 mg every 4-6 h",
        "max_daily_dose": 3000, "half_life": "2-3 hours", "risk_level": "low",
        "dependency_risk_category": "none",
        "mechanism": "Central inhibition of prostaglandin synthesis (mechanism not fully understood).",
        "common_side_effects": ["generally well tolerated"],
        "serious_side_effects": ["hepatotoxicity in overdose"],
        "interactions": ["warfarin (high doses)", "alcohol (liver risk)"],
        "warnings": ["Do not exceed 3-4 g/day.", "Check combination products for hidden acetaminophen."],
        "content": "Acetaminophen relieves pain and fever without anti-inflammatory or GI effects. Overdose is the leading cause of acute liver failure; respect daily limits."
    },
    {
        "name": "Aspirin", "generic_name": "acetylsalicylic acid", "brand_names": ["Bayer", "Ecotrin"],
        "drug_class": "NSAID / antiplatelet", "category": "nsaid", "default_unit": "mg",
        "common_dosages": [81, 325], "typical_dosing": "81 mg daily (cardio) or 325-650 mg (pain)",
        "max_daily_dose": 4000, "half_life": "dose-dependent", "risk_level": "low",
        "dependency_risk_category": "none",
        "mechanism": "Irreversible COX inhibition; antiplatelet at low dose.",
        "common_side_effects": ["stomach upset", "heartburn"],
        "serious_side_effects": ["GI bleeding", "Reye's syndrome in children"],
        "interactions": ["anticoagulants", "other NSAIDs", "methotrexate"],
        "warnings": ["Avoid in children with viral illness.", "Bleeding risk."],
        "content": "Low-dose aspirin is used for cardiovascular protection; higher doses relieve pain and fever. Its irreversible antiplatelet effect lasts the platelet lifespan."
    },

    # ---------------- Antihypertensives / Cardiac ----------------
    {
        "name": "Lisinopril", "generic_name": "lisinopril", "brand_names": ["Prinivil", "Zestril"],
        "drug_class": "ACE inhibitor", "category": "antihypertensive", "default_unit": "mg",
        "common_dosages": [5, 10, 20, 40], "typical_dosing": "10-40 mg once daily",
        "max_daily_dose": 80, "half_life": "12 hours", "risk_level": "low",
        "dependency_risk_category": "none",
        "mechanism": "Inhibits angiotensin-converting enzyme, lowering blood pressure.",
        "common_side_effects": ["dry cough", "dizziness", "headache"],
        "serious_side_effects": ["angioedema", "hyperkalemia", "kidney injury"],
        "interactions": ["potassium supplements", "NSAIDs", "lithium", "ARBs"],
        "warnings": ["Stop if angioedema.", "Avoid in pregnancy."],
        "content": "Lisinopril is a first-line agent for hypertension and heart failure. A persistent dry cough is the most common reason patients switch to an ARB."
    },
    {
        "name": "Amlodipine", "generic_name": "amlodipine", "brand_names": ["Norvasc"],
        "drug_class": "Calcium channel blocker", "category": "antihypertensive", "default_unit": "mg",
        "common_dosages": [2.5, 5, 10], "typical_dosing": "5-10 mg once daily",
        "max_daily_dose": 10, "half_life": "30-50 hours", "risk_level": "low",
        "dependency_risk_category": "none",
        "mechanism": "Dihydropyridine CCB causing vasodilation.",
        "common_side_effects": ["ankle swelling", "flushing", "headache"],
        "serious_side_effects": ["hypotension", "reflex tachycardia"],
        "interactions": ["simvastatin (limit dose)", "CYP3A4 inhibitors"],
        "warnings": ["Peripheral edema is dose-related."],
        "content": "Amlodipine is a long-acting calcium channel blocker for hypertension and angina, valued for once-daily dosing and smooth blood-pressure control."
    },
    {
        "name": "Metoprolol", "generic_name": "metoprolol", "brand_names": ["Lopressor", "Toprol XL"],
        "drug_class": "Beta-blocker", "category": "antihypertensive", "default_unit": "mg",
        "common_dosages": [25, 50, 100], "typical_dosing": "50-100 mg 1-2x daily",
        "max_daily_dose": 400, "half_life": "3-7 hours", "risk_level": "low",
        "dependency_risk_category": "low",
        "mechanism": "Selective beta-1 adrenergic blocker.",
        "common_side_effects": ["fatigue", "dizziness", "bradycardia", "cold extremities"],
        "serious_side_effects": ["severe bradycardia", "rebound tachycardia/angina if stopped abruptly"],
        "interactions": ["other rate-lowering drugs", "CYP2D6 inhibitors"],
        "warnings": ["Do not stop abruptly — taper to avoid rebound.", "Caution in asthma."],
        "content": "Metoprolol treats hypertension, angina, arrhythmias and heart failure. Abrupt discontinuation can cause rebound hypertension and angina, so taper over 1-2 weeks."
    },
    {
        "name": "Atorvastatin", "generic_name": "atorvastatin", "brand_names": ["Lipitor"],
        "drug_class": "Statin (HMG-CoA reductase inhibitor)", "category": "statin", "default_unit": "mg",
        "common_dosages": [10, 20, 40, 80], "typical_dosing": "10-80 mg once daily",
        "max_daily_dose": 80, "half_life": "~14 hours", "risk_level": "low",
        "dependency_risk_category": "none",
        "mechanism": "Inhibits cholesterol synthesis in the liver.",
        "common_side_effects": ["muscle aches", "headache", "digestive upset"],
        "serious_side_effects": ["rhabdomyolysis (rare)", "liver enzyme elevation"],
        "interactions": ["grapefruit juice", "CYP3A4 inhibitors", "fibrates"],
        "warnings": ["Report unexplained muscle pain.", "Avoid grapefruit in large amounts."],
        "content": "Atorvastatin lowers LDL cholesterol and cardiovascular risk. Muscle symptoms are the most common complaint; serious muscle injury is rare."
    },

    # ---------------- Diabetes ----------------
    {
        "name": "Metformin", "generic_name": "metformin", "brand_names": ["Glucophage", "Fortamet"],
        "drug_class": "Biguanide", "category": "diabetes", "default_unit": "mg",
        "common_dosages": [500, 850, 1000], "typical_dosing": "500-1000 mg twice daily",
        "max_daily_dose": 2550, "half_life": "~6 hours", "risk_level": "low",
        "dependency_risk_category": "none",
        "mechanism": "Reduces hepatic glucose production and improves insulin sensitivity.",
        "common_side_effects": ["diarrhea", "nausea", "metallic taste", "B12 deficiency"],
        "serious_side_effects": ["lactic acidosis (rare)"],
        "interactions": ["iodinated contrast", "alcohol", "cimetidine"],
        "warnings": ["Hold around contrast imaging.", "Take with food to reduce GI upset."],
        "content": "Metformin is the first-line drug for type 2 diabetes, improving glucose control without causing hypoglycemia or weight gain."
    },
    {
        "name": "Semaglutide", "generic_name": "semaglutide", "brand_names": ["Ozempic", "Wegovy", "Rybelsus"],
        "drug_class": "GLP-1 receptor agonist", "category": "diabetes", "default_unit": "mg",
        "common_dosages": [0.25, 0.5, 1, 2], "typical_dosing": "weekly injection, titrated",
        "max_daily_dose": None, "half_life": "~7 days", "risk_level": "moderate",
        "dependency_risk_category": "none",
        "mechanism": "Mimics GLP-1, enhancing insulin secretion, slowing gastric emptying, reducing appetite.",
        "common_side_effects": ["nausea", "vomiting", "diarrhea", "constipation"],
        "serious_side_effects": ["pancreatitis", "gallbladder disease", "thyroid C-cell tumors (animal)"],
        "interactions": ["insulin/sulfonylureas (hypoglycemia)", "oral drugs (delayed absorption)"],
        "warnings": ["Titrate slowly to limit nausea.", "Contraindicated with MEN-2 / medullary thyroid cancer."],
        "content": "Semaglutide is a once-weekly GLP-1 agonist for type 2 diabetes and chronic weight management. Slow dose escalation minimizes gastrointestinal side effects."
    },
    {
        "name": "Insulin glargine", "generic_name": "insulin glargine", "brand_names": ["Lantus", "Basaglar", "Toujeo"],
        "drug_class": "Long-acting insulin", "category": "diabetes", "default_unit": "units",
        "common_dosages": [10, 20, 30], "typical_dosing": "individualized once daily",
        "max_daily_dose": None, "half_life": "n/a (flat ~24 h profile)", "risk_level": "moderate",
        "dependency_risk_category": "none",
        "mechanism": "Basal insulin providing steady glucose-lowering.",
        "common_side_effects": ["injection-site reactions", "weight gain"],
        "serious_side_effects": ["hypoglycemia", "hypokalemia"],
        "interactions": ["other glucose-lowering agents", "beta-blockers (mask hypoglycemia)"],
        "warnings": ["Never skip meals after dosing.", "Rotate injection sites."],
        "content": "Insulin glargine is a long-acting basal insulin giving a relatively flat 24-hour profile. Hypoglycemia is the main safety concern."
    },

    # ---------------- GI / PPIs / Antihistamines ----------------
    {
        "name": "Omeprazole", "generic_name": "omeprazole", "brand_names": ["Prilosec", "Losec"],
        "drug_class": "Proton pump inhibitor", "category": "ppi", "default_unit": "mg",
        "common_dosages": [10, 20, 40], "typical_dosing": "20-40 mg once daily",
        "max_daily_dose": 40, "half_life": "0.5-1 hour", "risk_level": "low",
        "dependency_risk_category": "low",
        "mechanism": "Irreversibly inhibits gastric H+/K+ ATPase (acid pump).",
        "common_side_effects": ["headache", "diarrhea", "abdominal pain"],
        "serious_side_effects": ["C. difficile infection", "B12/magnesium deficiency", "rebound acid hypersecretion"],
        "interactions": ["clopidogrel", "drugs needing acid for absorption"],
        "warnings": ["Long-term use linked to fractures, deficiencies.", "Taper if used long-term to avoid rebound."],
        "content": "Omeprazole reduces stomach acid for reflux and ulcers. Rebound acid hypersecretion can make stopping difficult after prolonged use, so step down gradually."
    },
    {
        "name": "Cetirizine", "generic_name": "cetirizine", "brand_names": ["Zyrtec", "Reactine"],
        "drug_class": "Second-generation antihistamine", "category": "antihistamine", "default_unit": "mg",
        "common_dosages": [5, 10], "typical_dosing": "10 mg once daily",
        "max_daily_dose": 10, "half_life": "~8 hours", "risk_level": "minimal",
        "dependency_risk_category": "none",
        "mechanism": "Selective peripheral H1-receptor antagonist.",
        "common_side_effects": ["mild drowsiness", "dry mouth"],
        "serious_side_effects": ["rare; pruritus on abrupt withdrawal after long use"],
        "interactions": ["alcohol", "other sedatives"],
        "warnings": ["Less sedating than first-generation antihistamines."],
        "content": "Cetirizine relieves allergic rhinitis and urticaria with minimal sedation. Some long-term users report intense itching when stopping abruptly."
    },
    {
        "name": "Diphenhydramine", "generic_name": "diphenhydramine", "brand_names": ["Benadryl"],
        "drug_class": "First-generation antihistamine", "category": "antihistamine", "default_unit": "mg",
        "common_dosages": [25, 50], "typical_dosing": "25-50 mg every 4-6 h",
        "max_daily_dose": 300, "half_life": "~8 hours", "risk_level": "low",
        "dependency_risk_category": "low",
        "mechanism": "H1 antagonist with strong anticholinergic and sedative effects.",
        "common_side_effects": ["drowsiness", "dry mouth", "constipation", "blurred vision"],
        "serious_side_effects": ["delirium in elderly", "anticholinergic toxicity"],
        "interactions": ["alcohol", "other anticholinergics", "CNS depressants"],
        "warnings": ["Avoid chronic use in older adults (dementia risk).", "Tolerance to sedation develops."],
        "content": "Diphenhydramine is a sedating antihistamine used for allergies and as a sleep aid. Regular use for sleep leads to tolerance and is discouraged in older adults."
    },

    # ---------------- Thyroid / Hormonal ----------------
    {
        "name": "Levothyroxine", "generic_name": "levothyroxine", "brand_names": ["Synthroid", "Levoxyl", "Euthyrox"],
        "drug_class": "Thyroid hormone", "category": "thyroid", "default_unit": "mcg",
        "common_dosages": [25, 50, 75, 100, 125, 150], "typical_dosing": "individualized once daily, empty stomach",
        "max_daily_dose": None, "half_life": "~7 days", "risk_level": "low",
        "dependency_risk_category": "none",
        "mechanism": "Synthetic T4 replacing deficient thyroid hormone.",
        "common_side_effects": ["usually none at correct dose"],
        "serious_side_effects": ["palpitations / bone loss if over-replaced", "fatigue if under-replaced"],
        "interactions": ["calcium", "iron", "PPIs", "soy (absorption)"],
        "warnings": ["Take on empty stomach, 30-60 min before food.", "Consistent brand recommended."],
        "content": "Levothyroxine replaces thyroid hormone in hypothyroidism. Dose is titrated by TSH; absorption is sensitive to timing and other medications/foods."
    },

    # ---------------- Anticonvulsants / Mood ----------------
    {
        "name": "Lamotrigine", "generic_name": "lamotrigine", "brand_names": ["Lamictal"],
        "drug_class": "Anticonvulsant / mood stabilizer", "category": "anticonvulsant", "default_unit": "mg",
        "common_dosages": [25, 50, 100, 200], "typical_dosing": "slowly titrated to 100-200 mg",
        "max_daily_dose": 400, "half_life": "~25 hours", "risk_level": "moderate",
        "dependency_risk_category": "low",
        "mechanism": "Stabilizes neuronal membranes via sodium channel blockade.",
        "common_side_effects": ["headache", "dizziness", "nausea", "rash"],
        "serious_side_effects": ["Stevens-Johnson syndrome", "DRESS"],
        "interactions": ["valproate (raises levels)", "oral contraceptives (lower levels)"],
        "warnings": ["MUST titrate slowly to reduce rash risk.", "Seek care for any rash."],
        "content": "Lamotrigine treats epilepsy and bipolar depression. The titration schedule is critical because rapid increases raise the risk of life-threatening rash."
    },
    {
        "name": "Lithium", "generic_name": "lithium carbonate", "brand_names": ["Lithobid", "Eskalith"],
        "drug_class": "Mood stabilizer", "category": "other", "default_unit": "mg",
        "common_dosages": [150, 300, 600], "typical_dosing": "600-1200 mg daily in divided doses",
        "max_daily_dose": 1800, "half_life": "18-36 hours", "risk_level": "high",
        "dependency_risk_category": "low",
        "mechanism": "Multiple CNS effects; modulates neurotransmission and second messengers.",
        "common_side_effects": ["thirst", "tremor", "increased urination", "weight gain"],
        "serious_side_effects": ["lithium toxicity", "hypothyroidism", "kidney impairment"],
        "interactions": ["NSAIDs", "ACE inhibitors/ARBs", "diuretics", "dehydration"],
        "warnings": ["Narrow therapeutic index — regular blood levels required.", "Maintain hydration & salt intake."],
        "content": "Lithium is a gold-standard mood stabilizer for bipolar disorder with strong anti-suicidal effects. It requires careful monitoring of blood levels, kidney and thyroid function."
    },
    {
        "name": "Quetiapine", "generic_name": "quetiapine", "brand_names": ["Seroquel"],
        "drug_class": "Atypical antipsychotic", "category": "antipsychotic", "default_unit": "mg",
        "common_dosages": [25, 50, 100, 200, 300], "typical_dosing": "varies widely by indication",
        "max_daily_dose": 800, "half_life": "~6 hours", "risk_level": "moderate",
        "dependency_risk_category": "low",
        "mechanism": "Dopamine D2 and serotonin 5-HT2A antagonist.",
        "common_side_effects": ["sedation", "weight gain", "dry mouth", "dizziness"],
        "serious_side_effects": ["metabolic syndrome", "QT prolongation", "tardive dyskinesia"],
        "interactions": ["CNS depressants", "CYP3A4 inhibitors", "QT-prolonging drugs"],
        "warnings": ["Taper to avoid withdrawal/rebound insomnia.", "Monitor weight & glucose."],
        "content": "Quetiapine treats schizophrenia, bipolar disorder and (low dose, off-label) insomnia. Discontinuation can cause rebound insomnia and nausea; taper gradually."
    },

    # ---------------- Muscle relaxants / misc ----------------
    {
        "name": "Cyclobenzaprine", "generic_name": "cyclobenzaprine", "brand_names": ["Flexeril", "Amrix"],
        "drug_class": "Skeletal muscle relaxant", "category": "muscle-relaxant", "default_unit": "mg",
        "common_dosages": [5, 7.5, 10], "typical_dosing": "5-10 mg three times daily",
        "max_daily_dose": 30, "half_life": "18 hours", "risk_level": "low",
        "dependency_risk_category": "low",
        "mechanism": "Centrally acting muscle relaxant structurally related to TCAs.",
        "common_side_effects": ["drowsiness", "dry mouth", "dizziness"],
        "serious_side_effects": ["serotonin syndrome with serotonergic drugs", "arrhythmia"],
        "interactions": ["MAOIs", "SSRIs/SNRIs", "CNS depressants"],
        "warnings": ["Short-term use only (2-3 weeks).", "Avoid in elderly."],
        "content": "Cyclobenzaprine relieves muscle spasm from acute musculoskeletal conditions and is intended for short-term use."
    },
    {
        "name": "Prednisone", "generic_name": "prednisone", "brand_names": ["Deltasone", "Rayos"],
        "drug_class": "Corticosteroid", "category": "other", "default_unit": "mg",
        "common_dosages": [5, 10, 20, 50], "typical_dosing": "varies; often tapered",
        "max_daily_dose": None, "half_life": "2-3 hours (biologic 18-36 h)", "risk_level": "moderate",
        "dependency_risk_category": "low",
        "mechanism": "Synthetic glucocorticoid with broad anti-inflammatory/immunosuppressive effects.",
        "common_side_effects": ["increased appetite", "insomnia", "mood changes", "fluid retention"],
        "serious_side_effects": ["adrenal suppression", "hyperglycemia", "osteoporosis", "infection risk"],
        "interactions": ["NSAIDs", "vaccines", "diabetes medications"],
        "warnings": ["Do NOT stop abruptly after >2-3 weeks — taper to avoid adrenal crisis."],
        "content": "Prednisone is a versatile corticosteroid. After more than a couple of weeks of use the adrenal glands suppress, so the dose must be tapered to allow recovery."
    },

    # ---------------- Cannabis / Supplements ----------------
    {
        "name": "Melatonin", "generic_name": "melatonin", "brand_names": ["various OTC"],
        "drug_class": "Hormone / sleep supplement", "category": "supplement", "default_unit": "mg",
        "common_dosages": [0.5, 1, 3, 5, 10], "typical_dosing": "0.5-5 mg 30-60 min before bed",
        "max_daily_dose": 10, "half_life": "~45 minutes", "risk_level": "minimal",
        "dependency_risk_category": "none",
        "mechanism": "Supplemental pineal hormone regulating circadian rhythm.",
        "common_side_effects": ["drowsiness", "vivid dreams", "morning grogginess"],
        "serious_side_effects": ["rare"],
        "interactions": ["sedatives", "anticoagulants", "immunosuppressants"],
        "warnings": ["Lower doses often as effective as higher.", "Quality varies between brands."],
        "content": "Melatonin helps with circadian rhythm disorders and jet lag more than classic insomnia. It is non-habit-forming; low doses taken early in the evening work best."
    },
    {
        "name": "Vitamin D3", "generic_name": "cholecalciferol", "brand_names": ["various OTC"],
        "drug_class": "Vitamin / supplement", "category": "supplement", "default_unit": "iu",
        "common_dosages": [1000, 2000, 5000], "typical_dosing": "1000-2000 IU daily",
        "max_daily_dose": 4000, "half_life": "weeks (stored in fat)", "risk_level": "minimal",
        "dependency_risk_category": "none",
        "mechanism": "Supports calcium absorption and bone, immune and muscle function.",
        "common_side_effects": ["usually none"],
        "serious_side_effects": ["hypercalcemia with chronic high doses"],
        "interactions": ["thiazides", "high-dose calcium"],
        "warnings": ["Very high chronic doses can cause toxicity."],
        "content": "Vitamin D3 corrects deficiency and supports bone and immune health. Toxicity only occurs at sustained very high intake."
    },
    {
        "name": "Magnesium glycinate", "generic_name": "magnesium glycinate", "brand_names": ["various OTC"],
        "drug_class": "Mineral supplement", "category": "supplement", "default_unit": "mg",
        "common_dosages": [100, 200, 400], "typical_dosing": "200-400 mg daily",
        "max_daily_dose": 400, "half_life": "n/a", "risk_level": "minimal",
        "dependency_risk_category": "none",
        "mechanism": "Replenishes magnesium; cofactor in hundreds of enzymatic reactions.",
        "common_side_effects": ["loose stools at high doses"],
        "serious_side_effects": ["rare; caution in kidney disease"],
        "interactions": ["certain antibiotics", "bisphosphonates"],
        "warnings": ["Glycinate form is gentler on the gut."],
        "content": "Magnesium glycinate is a well-absorbed, gentle magnesium form used for deficiency, muscle cramps and sleep support."
    },
    {
        "name": "Cannabidiol (CBD)", "generic_name": "cannabidiol", "brand_names": ["Epidiolex (Rx)", "various OTC"],
        "drug_class": "Cannabinoid", "category": "supplement", "default_unit": "mg CBD",
        "common_dosages": [10, 25, 50], "typical_dosing": "varies; titrate to effect",
        "max_daily_dose": None, "half_life": "18-32 hours", "risk_level": "low",
        "dependency_risk_category": "none",
        "mechanism": "Non-intoxicating cannabinoid; complex modulation of endocannabinoid and other receptors.",
        "common_side_effects": ["drowsiness", "diarrhea", "appetite changes"],
        "serious_side_effects": ["liver enzyme elevation at high doses"],
        "interactions": ["warfarin", "CYP450 substrates", "sedatives"],
        "warnings": ["Can interact with many medications via CYP enzymes."],
        "content": "CBD is a non-intoxicating cannabinoid studied for seizures, anxiety and pain. It can meaningfully interact with other drugs through liver enzyme inhibition."
    },
    {
        "name": "Caffeine", "generic_name": "caffeine", "brand_names": ["NoDoz", "Vivarin"],
        "drug_class": "CNS stimulant (xanthine)", "category": "stimulant", "default_unit": "mg",
        "common_dosages": [50, 100, 200], "typical_dosing": "up to 400 mg/day for most adults",
        "max_daily_dose": 400, "half_life": "3-5 hours", "risk_level": "low",
        "dependency_risk_category": "moderate",
        "mechanism": "Adenosine receptor antagonist increasing alertness.",
        "common_side_effects": ["jitteriness", "insomnia", "increased heart rate"],
        "serious_side_effects": ["arrhythmia at very high doses", "anxiety exacerbation"],
        "interactions": ["stimulants", "some antibiotics", "theophylline"],
        "warnings": ["Withdrawal causes headache and fatigue.", "Taper to reduce withdrawal."],
        "content": "Caffeine is the world's most used stimulant. Regular use produces tolerance and a withdrawal syndrome (headache, fatigue, low mood); tapering eases stopping."
    },
    {
        "name": "Nicotine", "generic_name": "nicotine", "brand_names": ["Nicorette", "NicoDerm"],
        "drug_class": "Cholinergic stimulant", "category": "other", "default_unit": "mg",
        "common_dosages": [2, 4, 7, 14, 21], "typical_dosing": "patch/gum per cessation protocol",
        "max_daily_dose": None, "half_life": "1-2 hours", "risk_level": "moderate",
        "dependency_risk_category": "extreme",
        "mechanism": "Nicotinic acetylcholine receptor agonist; strong dopamine reward.",
        "common_side_effects": ["nausea", "dizziness", "increased heart rate", "skin irritation (patch)"],
        "serious_side_effects": ["cardiovascular strain", "high dependence"],
        "interactions": ["affects metabolism of several drugs (CYP1A2)"],
        "warnings": ["Highly addictive.", "Replacement therapy is tapered down stepwise."],
        "content": "Nicotine is highly addictive. Nicotine replacement therapy uses a stepped, tapering schedule (e.g., 21 -> 14 -> 7 mg patches) to ease cessation."
    },
]
