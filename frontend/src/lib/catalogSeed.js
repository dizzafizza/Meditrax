// Auto-generated curated medication catalog (offline knowledge base + add-medication prefill + RAG).
// 58 entries. Includes common recreational/psychoactive substances alongside
// prescription and OTC medications — the app already tracks controlled
// substances (benzodiazepines, opioids, stimulants) with harm-reduction
// framing (dependency risk, tapering guidance), and these entries extend the
// same treatment to substances used outside a prescription, so the effects
// tracker and knowledge base can support real-world harm reduction rather
// than only modeling prescribed use.
export const CATALOG_SEED = [
{
"name": "Acetaminophen",
"generic_name": "acetaminophen (paracetamol)",
"brand_names": [
"Tylenol",
"Panadol"
],
"drug_class": "Analgesic / antipyretic",
"category": "other",
"default_unit": "mg",
"common_dosages": [
325,
500,
650
],
"typical_dosing": "500-1000 mg every 4-6 h",
"max_daily_dose": 3000,
"common_side_effects": [
"generally well tolerated"
],
"serious_side_effects": [
"hepatotoxicity in overdose"
],
"interactions": [
"warfarin (high doses)",
"alcohol (liver risk)"
],
"warnings": [
"Do not exceed 3-4 g/day.",
"Check combination products for hidden acetaminophen."
],
"risk_level": "low",
"dependency_risk_category": "none",
"mechanism": "Central inhibition of prostaglandin synthesis (mechanism not fully understood).",
"half_life": "2-3 hours",
"content": "Acetaminophen relieves pain and fever without anti-inflammatory or GI effects. Overdose is the leading cause of acute liver failure; respect daily limits.",
"source": "curated"
},
{
"name": "Alcohol",
"generic_name": "ethanol",
"brand_names": [],
"drug_class": "CNS depressant (sedative)",
"category": "depressant",
"default_unit": "units",
"common_dosages": [
1,
2,
3,
4
],
"typical_dosing": "Effects are dose- and tolerance-dependent; roughly 1 standard drink (14 g / ~0.6 oz pure alcohol) raises blood alcohol by about 0.02-0.03%. Many jurisdictions set legal driving limits at 0.05-0.08% BAC.",
"max_daily_dose": null,
"common_side_effects": [
"impaired coordination",
"slowed reaction time",
"nausea",
"drowsiness"
],
"serious_side_effects": [
"alcohol poisoning (vomiting, unresponsiveness, slow or irregular breathing)",
"aspiration",
"blackouts / memory loss",
"life-threatening withdrawal (seizures, delirium tremens) after heavy regular use"
],
"interactions": [
"benzodiazepines and other sedatives (respiratory depression)",
"opioids (respiratory depression, often fatal in combination)",
"acetaminophen (liver toxicity with regular heavy use)",
"stimulants (masks intoxication, raises cardiovascular strain)"
],
"warnings": [
"Never combine with opioids, benzodiazepines, GHB, or other sedatives — combined CNS/respiratory depression is a leading cause of overdose death.",
"Withdrawal after heavy, regular use can be medically dangerous (seizures, delirium tremens); seek medical support to stop rather than quitting abruptly if you drink daily.",
"Pace drinks and alternate with water; blood alcohol keeps rising for 30-60+ minutes after your last drink."
],
"risk_level": "high",
"dependency_risk_category": "extreme",
"mechanism": "Potentiates GABA-A receptor activity and inhibits NMDA glutamate receptors, producing broad CNS depression.",
"half_life": "metabolized at a roughly constant rate (~1 standard drink/hour), not a fixed half-life",
"content": "Alcohol is the most widely used psychoactive substance in the world and, despite its legality, carries some of the highest acute and chronic health risks in this catalog, including a well-documented and potentially fatal withdrawal syndrome. Tracking here is meant to support harm reduction — pacing, hydration, and recognizing your own tolerance.",
"source": "curated"
},
{
"name": "Alprazolam",
"generic_name": "alprazolam",
"brand_names": [
"Xanax"
],
"drug_class": "Benzodiazepine",
"category": "benzodiazepine",
"default_unit": "mg",
"common_dosages": [
0.25,
0.5,
1,
2
],
"typical_dosing": "0.25-0.5 mg up to 3x daily",
"max_daily_dose": 4,
"common_side_effects": [
"drowsiness",
"dizziness",
"memory impairment",
"fatigue"
],
"serious_side_effects": [
"respiratory depression with opioids",
"severe withdrawal seizures",
"dependence"
],
"interactions": [
"opioids",
"alcohol",
"other CNS depressants",
"CYP3A4 inhibitors"
],
"warnings": [
"High dependence and abuse potential.",
"Never stop abruptly — risk of seizures.",
"Slow hyperbolic taper required."
],
"risk_level": "high",
"dependency_risk_category": "extreme",
"mechanism": "Enhances GABA-A receptor activity (CNS depressant).",
"half_life": "11-16 hours",
"content": "Alprazolam is a short-acting, high-potency benzodiazepine for panic and anxiety. Its short half-life makes inter-dose withdrawal and dependence especially likely; many clinicians switch to diazepam for tapering.",
"source": "curated"
},
{
"name": "Amlodipine",
"generic_name": "amlodipine",
"brand_names": [
"Norvasc"
],
"drug_class": "Calcium channel blocker",
"category": "antihypertensive",
"default_unit": "mg",
"common_dosages": [
2.5,
5,
10
],
"typical_dosing": "5-10 mg once daily",
"max_daily_dose": 10,
"common_side_effects": [
"ankle swelling",
"flushing",
"headache"
],
"serious_side_effects": [
"hypotension",
"reflex tachycardia"
],
"interactions": [
"simvastatin (limit dose)",
"CYP3A4 inhibitors"
],
"warnings": [
"Peripheral edema is dose-related."
],
"risk_level": "low",
"dependency_risk_category": "none",
"mechanism": "Dihydropyridine CCB causing vasodilation.",
"half_life": "30-50 hours",
"content": "Amlodipine is a long-acting calcium channel blocker for hypertension and angina, valued for once-daily dosing and smooth blood-pressure control.",
"source": "curated"
},
{
"name": "Amphetamine/Dextroamphetamine",
"generic_name": "amphetamine-dextroamphetamine",
"brand_names": [
"Adderall",
"Adderall XR"
],
"drug_class": "CNS stimulant",
"category": "stimulant",
"default_unit": "mg",
"common_dosages": [
5,
10,
20,
30
],
"typical_dosing": "5-30 mg daily",
"max_daily_dose": 40,
"common_side_effects": [
"appetite loss",
"insomnia",
"increased heart rate",
"anxiety"
],
"serious_side_effects": [
"cardiovascular events",
"psychosis",
"dependence"
],
"interactions": [
"MAOIs",
"serotonergic drugs",
"acidic foods reduce absorption"
],
"warnings": [
"High abuse potential — controlled substance.",
"Monitor cardiovascular status."
],
"risk_level": "moderate",
"dependency_risk_category": "high",
"mechanism": "Releases and blocks reuptake of dopamine and norepinephrine.",
"half_life": "9-14 hours",
"content": "Adderall is a mixed amphetamine salt stimulant for ADHD and narcolepsy with significant abuse potential and a notable comedown when stopped.",
"source": "curated"
},
{
"name": "Aspirin",
"generic_name": "acetylsalicylic acid",
"brand_names": [
"Bayer",
"Ecotrin"
],
"drug_class": "NSAID / antiplatelet",
"category": "nsaid",
"default_unit": "mg",
"common_dosages": [
81,
325
],
"typical_dosing": "81 mg daily (cardio) or 325-650 mg (pain)",
"max_daily_dose": 4000,
"common_side_effects": [
"stomach upset",
"heartburn"
],
"serious_side_effects": [
"GI bleeding",
"Reye's syndrome in children"
],
"interactions": [
"anticoagulants",
"other NSAIDs",
"methotrexate"
],
"warnings": [
"Avoid in children with viral illness.",
"Bleeding risk."
],
"risk_level": "low",
"dependency_risk_category": "none",
"mechanism": "Irreversible COX inhibition; antiplatelet at low dose.",
"half_life": "dose-dependent",
"content": "Low-dose aspirin is used for cardiovascular protection; higher doses relieve pain and fever. Its irreversible antiplatelet effect lasts the platelet lifespan.",
"source": "curated"
},
{
"name": "Atorvastatin",
"generic_name": "atorvastatin",
"brand_names": [
"Lipitor"
],
"drug_class": "Statin (HMG-CoA reductase inhibitor)",
"category": "statin",
"default_unit": "mg",
"common_dosages": [
10,
20,
40,
80
],
"typical_dosing": "10-80 mg once daily",
"max_daily_dose": 80,
"common_side_effects": [
"muscle aches",
"headache",
"digestive upset"
],
"serious_side_effects": [
"rhabdomyolysis (rare)",
"liver enzyme elevation"
],
"interactions": [
"grapefruit juice",
"CYP3A4 inhibitors",
"fibrates"
],
"warnings": [
"Report unexplained muscle pain.",
"Avoid grapefruit in large amounts."
],
"risk_level": "low",
"dependency_risk_category": "none",
"mechanism": "Inhibits cholesterol synthesis in the liver.",
"half_life": "~14 hours",
"content": "Atorvastatin lowers LDL cholesterol and cardiovascular risk. Muscle symptoms are the most common complaint; serious muscle injury is rare.",
"source": "curated"
},
{
"name": "Buprenorphine",
"generic_name": "buprenorphine",
"brand_names": [
"Suboxone (with naloxone)",
"Subutex",
"Belbuca"
],
"drug_class": "Partial opioid agonist",
"category": "opioid",
"default_unit": "mg",
"common_dosages": [
2,
4,
8,
12
],
"typical_dosing": "Induction/maintenance per protocol",
"max_daily_dose": 24,
"common_side_effects": [
"headache",
"constipation",
"sweating",
"insomnia"
],
"serious_side_effects": [
"precipitated withdrawal",
"respiratory depression with benzodiazepines"
],
"interactions": [
"benzodiazepines",
"CNS depressants",
"CYP3A4 inhibitors"
],
"warnings": [
"Used for opioid use disorder and pain.",
"Taper under specialist supervision."
],
"risk_level": "high",
"dependency_risk_category": "high",
"mechanism": "Partial mu-opioid agonist with high receptor affinity; ceiling effect on respiratory depression.",
"half_life": "24-42 hours",
"content": "Buprenorphine is a partial agonist central to opioid use disorder treatment. Its long action and ceiling effect improve safety, but tapering should be slow and supervised.",
"source": "curated"
},
{
"name": "Bupropion",
"generic_name": "bupropion",
"brand_names": [
"Wellbutrin",
"Zyban"
],
"drug_class": "NDRI antidepressant",
"category": "antidepressant",
"default_unit": "mg",
"common_dosages": [
75,
100,
150,
300
],
"typical_dosing": "150-300 mg daily",
"max_daily_dose": 450,
"common_side_effects": [
"insomnia",
"dry mouth",
"headache",
"agitation"
],
"serious_side_effects": [
"seizures (dose-related)",
"hypertension"
],
"interactions": [
"MAOIs",
"drugs lowering seizure threshold"
],
"warnings": [
"Avoid in seizure or eating disorders.",
"Activating — dose earlier in day."
],
"risk_level": "moderate",
"dependency_risk_category": "low",
"mechanism": "Norepinephrine-dopamine reuptake inhibitor.",
"half_life": "~21 hours",
"content": "Bupropion is an activating antidepressant also used for smoking cessation. It does not cause sexual dysfunction or weight gain but lowers the seizure threshold.",
"source": "curated"
},
{
"name": "Caffeine",
"generic_name": "caffeine",
"brand_names": [
"NoDoz",
"Vivarin"
],
"drug_class": "CNS stimulant (xanthine)",
"category": "stimulant",
"default_unit": "mg",
"common_dosages": [
50,
100,
200
],
"typical_dosing": "up to 400 mg/day for most adults",
"max_daily_dose": 400,
"common_side_effects": [
"jitteriness",
"insomnia",
"increased heart rate"
],
"serious_side_effects": [
"arrhythmia at very high doses",
"anxiety exacerbation"
],
"interactions": [
"stimulants",
"some antibiotics",
"theophylline"
],
"warnings": [
"Withdrawal causes headache and fatigue.",
"Taper to reduce withdrawal."
],
"risk_level": "low",
"dependency_risk_category": "moderate",
"mechanism": "Adenosine receptor antagonist increasing alertness.",
"half_life": "3-5 hours",
"content": "Caffeine is the world's most used stimulant. Regular use produces tolerance and a withdrawal syndrome (headache, fatigue, low mood); tapering eases stopping.",
"source": "curated"
},
{
"name": "Cannabidiol (CBD)",
"generic_name": "cannabidiol",
"brand_names": [
"Epidiolex (Rx)",
"various OTC"
],
"drug_class": "Cannabinoid",
"category": "supplement",
"default_unit": "mg CBD",
"common_dosages": [
10,
25,
50
],
"typical_dosing": "varies; titrate to effect",
"max_daily_dose": null,
"common_side_effects": [
"drowsiness",
"diarrhea",
"appetite changes"
],
"serious_side_effects": [
"liver enzyme elevation at high doses"
],
"interactions": [
"warfarin",
"CYP450 substrates",
"sedatives"
],
"warnings": [
"Can interact with many medications via CYP enzymes."
],
"risk_level": "low",
"dependency_risk_category": "none",
"mechanism": "Non-intoxicating cannabinoid; complex modulation of endocannabinoid and other receptors.",
"half_life": "18-32 hours",
"content": "CBD is a non-intoxicating cannabinoid studied for seizures, anxiety and pain. It can meaningfully interact with other drugs through liver enzyme inhibition.",
"source": "curated"
},
{
"name": "Cannabis (THC)",
"generic_name": "delta-9-tetrahydrocannabinol",
"street_names": [
"Weed",
"Marijuana",
"Pot",
"Bud"
],
"drug_class": "Cannabinoid",
"category": "cannabis",
"default_unit": "mg THC",
"common_dosages": [
2.5,
5,
10,
20
],
"typical_dosing": "Inhaled (smoked/vaporized): effects are felt within minutes, so it's easy to titrate — wait a few minutes between inhalations. Edibles: start with 2.5-5 mg THC and wait at least 2 hours before considering more; onset is slow and easy to over-shoot.",
"max_daily_dose": null,
"common_side_effects": [
"dry mouth",
"red eyes",
"increased appetite",
"impaired short-term memory and coordination",
"anxiety at higher doses"
],
"serious_side_effects": [
"panic attacks / acute anxiety, especially with high-THC edibles",
"cannabinoid hyperemesis syndrome with prolonged heavy use",
"psychosis risk in predisposed individuals, especially with high-potency products used young or frequently"
],
"interactions": [
"sedatives/alcohol (added impairment)",
"stimulants (masks perceived intoxication)",
"many CYP450-metabolized medications (check specific drug interactions)"
],
"warnings": [
"Edible onset can take 30-120+ minutes — the most common bad experience is redosing before the first dose has even peaked; wait it out.",
"Set the medication's Form to 'smoked/vaporized' or 'edible' so the effects-tracker curve matches your actual route — the two absorb at very different speeds.",
"Potency of illicit/unregulated products is often unknown; start low, especially with concentrates.",
"Regular heavy use, especially starting in adolescence, is linked to elevated psychosis risk in susceptible individuals."
],
"risk_level": "moderate",
"dependency_risk_category": "moderate",
"mechanism": "THC is a partial agonist at CB1 cannabinoid receptors in the brain, altering dopamine, GABA and glutamate signaling.",
"half_life": "~1-3 days (much longer with regular heavy use, due to fat storage)",
"content": "Cannabis's psychoactive effects and duration differ enormously by route — smoked or vaporized cannabis acts within minutes and fades in 2-4 hours, while edibles take much longer to start and last considerably longer, which is the single most common cause of accidental overconsumption. About 1 in 10 regular users develop a diagnosable cannabis use disorder, with withdrawal (irritability, insomnia, appetite loss) more common than most people expect.",
"source": "curated"
},
{
"name": "Cetirizine",
"generic_name": "cetirizine",
"brand_names": [
"Zyrtec",
"Reactine"
],
"drug_class": "Second-generation antihistamine",
"category": "antihistamine",
"default_unit": "mg",
"common_dosages": [
5,
10
],
"typical_dosing": "10 mg once daily",
"max_daily_dose": 10,
"common_side_effects": [
"mild drowsiness",
"dry mouth"
],
"serious_side_effects": [
"rare; pruritus on abrupt withdrawal after long use"
],
"interactions": [
"alcohol",
"other sedatives"
],
"warnings": [
"Less sedating than first-generation antihistamines."
],
"risk_level": "minimal",
"dependency_risk_category": "none",
"mechanism": "Selective peripheral H1-receptor antagonist.",
"half_life": "~8 hours",
"content": "Cetirizine relieves allergic rhinitis and urticaria with minimal sedation. Some long-term users report intense itching when stopping abruptly.",
"source": "curated"
},
{
"name": "Clonazepam",
"generic_name": "clonazepam",
"brand_names": [
"Klonopin",
"Rivotril"
],
"drug_class": "Benzodiazepine",
"category": "benzodiazepine",
"default_unit": "mg",
"common_dosages": [
0.5,
1,
2
],
"typical_dosing": "0.5-2 mg daily",
"max_daily_dose": 4,
"common_side_effects": [
"drowsiness",
"coordination problems",
"fatigue"
],
"serious_side_effects": [
"dependence",
"withdrawal seizures",
"respiratory depression"
],
"interactions": [
"opioids",
"alcohol",
"CNS depressants"
],
"warnings": [
"High dependency risk.",
"Slow taper required."
],
"risk_level": "high",
"dependency_risk_category": "extreme",
"mechanism": "Long-acting GABA-A modulator.",
"half_life": "30-40 hours",
"content": "Clonazepam is a longer-acting benzodiazepine for seizures and panic disorder. Its longer half-life makes tapering somewhat smoother than alprazolam, but dependence is still a major concern.",
"source": "curated"
},
{
"name": "Cocaine",
"generic_name": "cocaine",
"street_names": [
"Coke",
"Blow",
"Crack (freebase form)"
],
"drug_class": "CNS stimulant (tropane alkaloid)",
"category": "stimulant-fast",
"default_unit": "mg",
"common_dosages": [
30,
50,
75
],
"typical_dosing": "Recreational insufflated ('snorted') lines are commonly reported around 20-40 mg, felt within a few minutes and fading over 30-60 minutes — the short duration strongly encourages redosing, which drives escalating cardiovascular strain.",
"max_daily_dose": null,
"common_side_effects": [
"increased heart rate and blood pressure",
"elevated body temperature",
"reduced appetite",
"increased alertness/energy",
"jaw clenching",
"nasal irritation (insufflated)"
],
"serious_side_effects": [
"cardiac arrhythmia, chest pain, heart attack — possible even in young, healthy users",
"stroke",
"seizures",
"hyperthermia",
"severe anxiety, paranoia or psychosis with heavy or repeated use"
],
"interactions": [
"alcohol (forms cocaethylene, more cardiotoxic than either drug alone and longer-lasting)",
"other stimulants (compounded cardiovascular strain)",
"MAOIs (dangerous hypertensive reaction)"
],
"warnings": [
"Cardiac risk is present even in young, healthy, first-time users — chest pain or a racing/irregular heartbeat after use is a medical emergency.",
"The short high strongly tempts redosing every 20-30 minutes; each redose compounds cardiovascular load rather than restoring the original effect.",
"Avoid combining with alcohol — the cocaethylene produced is more toxic to the heart than cocaine alone.",
"Illicit supply is frequently adulterated (including with fentanyl in some markets); fentanyl test strips are a minimal precaution where legally available.",
"Set the medication's Form to 'insufflated' or 'smoked/vaporized' to match your route for a more accurate effects-tracker curve — smoked ('crack') hits faster and fades faster than snorted powder."
],
"risk_level": "high",
"dependency_risk_category": "high",
"mechanism": "Blocks reuptake of dopamine, norepinephrine and serotonin, causing a rapid surge in synaptic dopamine.",
"half_life": "~1 hour (metabolite benzoylecgonine detectable much longer)",
"content": "Cocaine produces a short, intense stimulant high with real cardiovascular risk at any dose and in any user — one reason it differs from prescription stimulants of similar pharmacology but longer, steadier profiles. Its brief duration is the main driver of binge redosing patterns, so tracking sessions here is meant to make that pattern visible rather than to normalize frequent use.",
"source": "curated"
},
{
"name": "Codeine",
"generic_name": "codeine",
"brand_names": [
"Tylenol #3 (with APAP)"
],
"drug_class": "Opioid analgesic",
"category": "opioid",
"default_unit": "mg",
"common_dosages": [
15,
30,
60
],
"typical_dosing": "15-60 mg every 4-6 h",
"max_daily_dose": 360,
"common_side_effects": [
"constipation",
"drowsiness",
"nausea"
],
"serious_side_effects": [
"respiratory depression (esp. ultra-rapid metabolizers)",
"dependence"
],
"interactions": [
"CNS depressants",
"CYP2D6 inhibitors"
],
"warnings": [
"Avoid in children and breastfeeding.",
"Variable effect by metabolism."
],
"risk_level": "high",
"dependency_risk_category": "high",
"mechanism": "Prodrug metabolized to morphine via CYP2D6.",
"half_life": "~3 hours",
"content": "Codeine is a mild opioid often combined with acetaminophen for pain and cough. Effectiveness varies with CYP2D6 genetics.",
"source": "curated"
},
{
"name": "Cyclobenzaprine",
"generic_name": "cyclobenzaprine",
"brand_names": [
"Flexeril",
"Amrix"
],
"drug_class": "Skeletal muscle relaxant",
"category": "muscle-relaxant",
"default_unit": "mg",
"common_dosages": [
5,
7.5,
10
],
"typical_dosing": "5-10 mg three times daily",
"max_daily_dose": 30,
"common_side_effects": [
"drowsiness",
"dry mouth",
"dizziness"
],
"serious_side_effects": [
"serotonin syndrome with serotonergic drugs",
"arrhythmia"
],
"interactions": [
"MAOIs",
"SSRIs/SNRIs",
"CNS depressants"
],
"warnings": [
"Short-term use only (2-3 weeks).",
"Avoid in elderly."
],
"risk_level": "low",
"dependency_risk_category": "low",
"mechanism": "Centrally acting muscle relaxant structurally related to TCAs.",
"half_life": "18 hours",
"content": "Cyclobenzaprine relieves muscle spasm from acute musculoskeletal conditions and is intended for short-term use.",
"source": "curated"
},
{
"name": "Diazepam",
"generic_name": "diazepam",
"brand_names": [
"Valium"
],
"drug_class": "Benzodiazepine",
"category": "benzodiazepine",
"default_unit": "mg",
"common_dosages": [
2,
5,
10
],
"typical_dosing": "2-10 mg 2-4x daily",
"max_daily_dose": 40,
"common_side_effects": [
"drowsiness",
"muscle weakness",
"ataxia"
],
"serious_side_effects": [
"dependence",
"respiratory depression",
"withdrawal"
],
"interactions": [
"opioids",
"alcohol",
"CNS depressants"
],
"warnings": [
"Often the preferred agent for benzodiazepine tapering due to long half-life.",
"Slow taper to a low floor dose."
],
"risk_level": "high",
"dependency_risk_category": "extreme",
"mechanism": "Long-acting GABA-A modulator.",
"half_life": "20-100 hours (active metabolites)",
"content": "Diazepam's very long half-life provides smooth blood levels, making it the standard for benzodiazepine substitution and tapering. Final taper steps are typically to 0.5-1 mg before stopping.",
"source": "curated"
},
{
"name": "Diphenhydramine",
"generic_name": "diphenhydramine",
"brand_names": [
"Benadryl"
],
"drug_class": "First-generation antihistamine",
"category": "antihistamine",
"default_unit": "mg",
"common_dosages": [
25,
50
],
"typical_dosing": "25-50 mg every 4-6 h",
"max_daily_dose": 300,
"common_side_effects": [
"drowsiness",
"dry mouth",
"constipation",
"blurred vision"
],
"serious_side_effects": [
"delirium in elderly",
"anticholinergic toxicity"
],
"interactions": [
"alcohol",
"other anticholinergics",
"CNS depressants"
],
"warnings": [
"Avoid chronic use in older adults (dementia risk).",
"Tolerance to sedation develops."
],
"risk_level": "low",
"dependency_risk_category": "low",
"mechanism": "H1 antagonist with strong anticholinergic and sedative effects.",
"half_life": "~8 hours",
"content": "Diphenhydramine is a sedating antihistamine used for allergies and as a sleep aid. Regular use for sleep leads to tolerance and is discouraged in older adults.",
"source": "curated"
},
{
"name": "Duloxetine",
"generic_name": "duloxetine",
"brand_names": [
"Cymbalta"
],
"drug_class": "SNRI antidepressant",
"category": "antidepressant",
"default_unit": "mg",
"common_dosages": [
20,
30,
60
],
"typical_dosing": "30-60 mg daily",
"max_daily_dose": 120,
"common_side_effects": [
"nausea",
"dry mouth",
"constipation",
"fatigue"
],
"serious_side_effects": [
"hepatotoxicity",
"serotonin syndrome",
"withdrawal"
],
"interactions": [
"MAOIs",
"CYP1A2/2D6 inhibitors",
"serotonergic drugs"
],
"warnings": [
"Taper slowly.",
"Avoid in heavy alcohol use / liver disease."
],
"risk_level": "moderate",
"dependency_risk_category": "high",
"mechanism": "Serotonin-norepinephrine reuptake inhibitor.",
"half_life": "~12 hours",
"content": "Duloxetine treats depression, anxiety, diabetic neuropathy and fibromyalgia. Discontinuation symptoms are common, so gradual dose reduction is recommended.",
"source": "curated"
},
{
"name": "Escitalopram",
"generic_name": "escitalopram",
"brand_names": [
"Lexapro",
"Cipralex"
],
"drug_class": "SSRI antidepressant",
"category": "antidepressant",
"default_unit": "mg",
"common_dosages": [
5,
10,
20
],
"typical_dosing": "10-20 mg once daily",
"max_daily_dose": 20,
"common_side_effects": [
"nausea",
"fatigue",
"insomnia",
"sexual dysfunction"
],
"serious_side_effects": [
"QT prolongation at high dose",
"serotonin syndrome",
"hyponatremia"
],
"interactions": [
"MAOIs",
"QT-prolonging drugs",
"NSAIDs"
],
"warnings": [
"Taper gradually when stopping.",
"Black box: suicidality in <25 yrs."
],
"risk_level": "low",
"dependency_risk_category": "moderate",
"mechanism": "Highly selective serotonin reuptake inhibitor.",
"half_life": "27-32 hours",
"content": "Escitalopram is the most selective SSRI and a first-line option for major depression and generalized anxiety disorder. Discontinuation effects are common; a slow taper reduces withdrawal.",
"source": "curated"
},
{
"name": "Fluoxetine",
"generic_name": "fluoxetine",
"brand_names": [
"Prozac",
"Sarafem"
],
"drug_class": "SSRI antidepressant",
"category": "antidepressant",
"default_unit": "mg",
"common_dosages": [
10,
20,
40
],
"typical_dosing": "20-60 mg once daily",
"max_daily_dose": 80,
"common_side_effects": [
"insomnia",
"anxiety",
"nausea",
"decreased appetite"
],
"serious_side_effects": [
"serotonin syndrome",
"suicidality in youth"
],
"interactions": [
"MAOIs",
"thioridazine",
"serotonergic agents"
],
"warnings": [
"Long half-life makes discontinuation milder but interactions persist for weeks."
],
"risk_level": "low",
"dependency_risk_category": "low",
"mechanism": "SSRI with long half-life.",
"half_life": "1-3 days (active metabolite 4-16 days)",
"content": "Fluoxetine's very long half-life makes it self-tapering and a useful bridge for stopping shorter-acting SSRIs/SNRIs. Common for depression, OCD and bulimia.",
"source": "curated"
},
{
"name": "Gabapentin",
"generic_name": "gabapentin",
"brand_names": [
"Neurontin",
"Gralise"
],
"drug_class": "Gabapentinoid anticonvulsant",
"category": "anticonvulsant",
"default_unit": "mg",
"common_dosages": [
100,
300,
400,
600,
800
],
"typical_dosing": "300-1200 mg 3x daily",
"max_daily_dose": 3600,
"common_side_effects": [
"dizziness",
"drowsiness",
"peripheral edema",
"ataxia"
],
"serious_side_effects": [
"respiratory depression with opioids",
"withdrawal",
"mood changes"
],
"interactions": [
"opioids",
"CNS depressants",
"antacids (reduce absorption)"
],
"warnings": [
"Taper to avoid withdrawal/seizures.",
"Increasing misuse potential."
],
"risk_level": "moderate",
"dependency_risk_category": "moderate",
"mechanism": "Binds alpha-2-delta subunit of voltage-gated calcium channels.",
"half_life": "5-7 hours",
"content": "Gabapentin treats neuropathic pain and seizures and is used off-label for anxiety and sleep. Withdrawal can occur after prolonged use; taper gradually.",
"source": "curated"
},
{
"name": "GHB / GBL",
"generic_name": "gamma-hydroxybutyrate / gamma-butyrolactone",
"street_names": [
"G",
"Liquid ecstasy",
"Gina"
],
"drug_class": "CNS depressant (GABA-B agonist)",
"category": "depressant",
"default_unit": "ml",
"common_dosages": [
1,
1.5,
2
],
"typical_dosing": "The gap between a typical recreational dose and one that causes unconsciousness or fatal respiratory depression is unusually small, and concentration varies between batches — this is one of the least forgiving substances to dose by volume.",
"max_daily_dose": null,
"common_side_effects": [
"euphoria",
"relaxation/sedation",
"reduced inhibition",
"nausea",
"dizziness"
],
"serious_side_effects": [
"sudden loss of consciousness ('G-out')",
"respiratory depression and death, especially combined with alcohol or other depressants",
"severe, medically dangerous withdrawal (tremor, agitation, seizures, delirium) with regular frequent use"
],
"interactions": [
"alcohol (sharply increased overdose/respiratory-depression risk — a leading cause of GHB deaths)",
"other sedatives/depressants (opioids, benzodiazepines — compounded respiratory depression)",
"stimulants (masks sedation, encourages redosing)"
],
"warnings": [
"Measure doses precisely with a proper oral syringe, never by cap or 'swig' — the difference between a normal dose and an overdose can be less than 1 ml.",
"Never combine with alcohol or other depressants; this combination is responsible for the large majority of GHB-related deaths.",
"Wait at least 2-3 hours before any redose and never 'top up' to chase a fading effect — this is how overdoses happen.",
"If someone is unresponsive but breathing after GHB, put them in the recovery position and monitor continuously; if breathing is slow, shallow, or they can't be woken, call emergency services.",
"Regular use every few hours around the clock can create physical dependence with a withdrawal syndrome that is medically dangerous to stop unsupervised."
],
"risk_level": "high",
"dependency_risk_category": "high",
"mechanism": "Acts as a GABA-B receptor agonist (and is metabolized toward GABA-A activity), producing broad CNS depression with a steep dose-response curve.",
"half_life": "~20-60 minutes",
"content": "GHB (and its precursor GBL, which converts to GHB in the body) has one of the narrowest margins of safety of any commonly used recreational drug — a small increase in dose or combining with alcohol can be the difference between a pleasant evening and a life-threatening overdose. Tracking here is meant to support precise, spaced dosing and awareness of your own tolerance, not to suggest frequent use is safe.",
"source": "curated"
},
{
"name": "Ibuprofen",
"generic_name": "ibuprofen",
"brand_names": [
"Advil",
"Motrin",
"Nurofen"
],
"drug_class": "NSAID",
"category": "nsaid",
"default_unit": "mg",
"common_dosages": [
200,
400,
600,
800
],
"typical_dosing": "200-400 mg every 4-6 h",
"max_daily_dose": 3200,
"common_side_effects": [
"stomach upset",
"heartburn",
"nausea"
],
"serious_side_effects": [
"GI bleeding",
"kidney injury",
"cardiovascular risk"
],
"interactions": [
"anticoagulants",
"SSRIs (bleeding)",
"ACE inhibitors",
"lithium"
],
"warnings": [
"Take with food.",
"Avoid in kidney disease, ulcers, late pregnancy."
],
"risk_level": "low",
"dependency_risk_category": "none",
"mechanism": "Non-selective COX inhibitor reducing prostaglandins.",
"half_life": "~2 hours",
"content": "Ibuprofen is a common over-the-counter NSAID for pain, fever and inflammation. It has no dependence potential but can cause GI and kidney harm with overuse.",
"source": "curated"
},
{
"name": "Insulin glargine",
"generic_name": "insulin glargine",
"brand_names": [
"Lantus",
"Basaglar",
"Toujeo"
],
"drug_class": "Long-acting insulin",
"category": "diabetes",
"default_unit": "units",
"common_dosages": [
10,
20,
30
],
"typical_dosing": "individualized once daily",
"max_daily_dose": null,
"common_side_effects": [
"injection-site reactions",
"weight gain"
],
"serious_side_effects": [
"hypoglycemia",
"hypokalemia"
],
"interactions": [
"other glucose-lowering agents",
"beta-blockers (mask hypoglycemia)"
],
"warnings": [
"Never skip meals after dosing.",
"Rotate injection sites."
],
"risk_level": "moderate",
"dependency_risk_category": "none",
"mechanism": "Basal insulin providing steady glucose-lowering.",
"half_life": "n/a (flat ~24 h profile)",
"content": "Insulin glargine is a long-acting basal insulin giving a relatively flat 24-hour profile. Hypoglycemia is the main safety concern.",
"source": "curated"
},
{
"name": "Ketamine",
"generic_name": "ketamine",
"street_names": [
"K",
"Special K"
],
"drug_class": "Dissociative anesthetic (NMDA antagonist)",
"category": "dissociative",
"default_unit": "mg",
"common_dosages": [
20,
40,
75
],
"typical_dosing": "Insufflated 'bump' doses of roughly 15-30 mg produce mild dissociation; 75 mg+ risks a 'K-hole' (profound dissociation, immobility, and inability to respond) — the dose-response curve is steep and individually variable.",
"max_daily_dose": null,
"common_side_effects": [
"dissociation / feeling detached from your body",
"numbness",
"impaired coordination and balance",
"confusion",
"increased blood pressure and heart rate",
"nausea"
],
"serious_side_effects": [
"complete immobility / inability to respond to danger while dissociated ('K-hole')",
"vomiting while unable to protect the airway (aspiration risk)",
"bladder and urinary tract damage (ketamine cystitis) with frequent, heavy use",
"cognitive/memory problems with chronic heavy use"
],
"interactions": [
"alcohol and other CNS depressants (compounded sedation, higher aspiration/immobility risk)",
"stimulants (increased cardiovascular strain, may mask dissociation and encourage overuse)"
],
"warnings": [
"Never use alone or near roads/water/stairs — the main danger is being unable to move or respond while dissociated, not the drug's direct toxicity.",
"Always have a sober person present who knows what you've taken and can respond if you vomit or don't respond.",
"Frequent, heavy use is strongly linked to painful bladder damage (ketamine cystitis) that can require surgery — this is dose- and frequency-dependent, not rare.",
"Set the medication's Form to 'insufflated' for a more accurate effects-tracker curve if that's your route."
],
"risk_level": "high",
"dependency_risk_category": "moderate",
"mechanism": "Antagonizes NMDA glutamate receptors, producing dissociative anesthesia; also interacts with opioid and monoaminergic systems at higher doses.",
"half_life": "~2.5-3 hours",
"content": "Ketamine's central danger is behavioral rather than purely toxicological — the dissociation and immobility it produces make physical accidents and aspiration the leading real-world risks, which is why using with a sober, attentive companion matters more here than for most other substances in this catalog. Frequent heavy use also carries a well-documented risk of serious bladder damage.",
"source": "curated"
},
{
"name": "Kratom",
"generic_name": "mitragynine (Mitragyna speciosa)",
"brand_names": [],
"drug_class": "Opioid receptor agonist (plant alkaloid)",
"category": "opioid",
"default_unit": "g",
"common_dosages": [
2,
4,
6
],
"typical_dosing": "Low doses (~1-5 g) are commonly reported as mildly stimulating; higher doses (~5-15 g) produce more sedating, opioid-like effects. Potency varies significantly between vendors and strains.",
"max_daily_dose": null,
"common_side_effects": [
"nausea",
"dizziness",
"dry mouth",
"constipation",
"drowsiness at higher doses"
],
"serious_side_effects": [
"respiratory depression, especially combined with other depressants",
"liver toxicity (reported with regular heavy use)",
"physical dependence and opioid-like withdrawal with frequent use",
"seizures (rare, more often reported with adulterated products)"
],
"interactions": [
"opioids and other CNS depressants (compounded respiratory depression)",
"benzodiazepines/alcohol (compounded sedation)",
"CYP450-metabolized medications (kratom affects several liver enzymes)"
],
"warnings": [
"Regular daily use can produce genuine opioid-like physical dependence and withdrawal (aches, anxiety, insomnia) — treat it with the same tapering caution as a prescription opioid, not as a benign supplement.",
"Potency and alkaloid content vary widely and are unregulated between vendors — start low with an unfamiliar product.",
"Avoid combining with opioids, benzodiazepines or alcohol due to compounded sedation/respiratory-depression risk.",
"Legal status varies by country and even by state/province — confirm local law."
],
"risk_level": "moderate",
"dependency_risk_category": "high",
"mechanism": "Mitragynine and 7-hydroxymitragynine act as partial agonists at mu-opioid receptors, with additional effects on other receptor systems at higher doses.",
"half_life": "~3-9 hours",
"content": "Kratom is a plant-derived substance often marketed as a natural supplement, but its dominant alkaloids act on the same opioid receptors as prescription opioids and it carries a real risk of physical dependence and opioid-like withdrawal with regular use. It sits in the 'opioid' category here deliberately, because that reflects its actual mechanism, not its legal status.",
"source": "curated"
},
{
"name": "Lamotrigine",
"generic_name": "lamotrigine",
"brand_names": [
"Lamictal"
],
"drug_class": "Anticonvulsant / mood stabilizer",
"category": "anticonvulsant",
"default_unit": "mg",
"common_dosages": [
25,
50,
100,
200
],
"typical_dosing": "slowly titrated to 100-200 mg",
"max_daily_dose": 400,
"common_side_effects": [
"headache",
"dizziness",
"nausea",
"rash"
],
"serious_side_effects": [
"Stevens-Johnson syndrome",
"DRESS"
],
"interactions": [
"valproate (raises levels)",
"oral contraceptives (lower levels)"
],
"warnings": [
"MUST titrate slowly to reduce rash risk.",
"Seek care for any rash."
],
"risk_level": "moderate",
"dependency_risk_category": "low",
"mechanism": "Stabilizes neuronal membranes via sodium channel blockade.",
"half_life": "~25 hours",
"content": "Lamotrigine treats epilepsy and bipolar depression. The titration schedule is critical because rapid increases raise the risk of life-threatening rash.",
"source": "curated"
},
{
"name": "Levothyroxine",
"generic_name": "levothyroxine",
"brand_names": [
"Synthroid",
"Levoxyl",
"Euthyrox"
],
"drug_class": "Thyroid hormone",
"category": "thyroid",
"default_unit": "mcg",
"common_dosages": [
25,
50,
75,
100,
125,
150
],
"typical_dosing": "individualized once daily, empty stomach",
"max_daily_dose": null,
"common_side_effects": [
"usually none at correct dose"
],
"serious_side_effects": [
"palpitations / bone loss if over-replaced",
"fatigue if under-replaced"
],
"interactions": [
"calcium",
"iron",
"PPIs",
"soy (absorption)"
],
"warnings": [
"Take on empty stomach, 30-60 min before food.",
"Consistent brand recommended."
],
"risk_level": "low",
"dependency_risk_category": "none",
"mechanism": "Synthetic T4 replacing deficient thyroid hormone.",
"half_life": "~7 days",
"content": "Levothyroxine replaces thyroid hormone in hypothyroidism. Dose is titrated by TSH; absorption is sensitive to timing and other medications/foods.",
"source": "curated"
},
{
"name": "Lisdexamfetamine",
"generic_name": "lisdexamfetamine",
"brand_names": [
"Vyvanse",
"Elvanse"
],
"drug_class": "CNS stimulant (prodrug)",
"category": "stimulant",
"default_unit": "mg",
"common_dosages": [
20,
30,
40,
50,
60,
70
],
"typical_dosing": "30-70 mg each morning",
"max_daily_dose": 70,
"common_side_effects": [
"appetite loss",
"insomnia",
"dry mouth",
"irritability"
],
"serious_side_effects": [
"cardiovascular risk",
"psychosis",
"dependence"
],
"interactions": [
"MAOIs",
"serotonergic drugs",
"acidifying agents"
],
"warnings": [
"Controlled substance.",
"Lower abuse potential than IR amphetamine but still significant."
],
"risk_level": "moderate",
"dependency_risk_category": "high",
"mechanism": "Prodrug converted to dexamfetamine, increasing dopamine/norepinephrine.",
"half_life": "<1 h (prodrug); dexamfetamine ~10-13 h",
"content": "Lisdexamfetamine is a long-acting prodrug stimulant for ADHD and binge-eating disorder. Its prodrug design gives a smoother profile and somewhat lower abuse liability.",
"source": "curated"
},
{
"name": "Lisinopril",
"generic_name": "lisinopril",
"brand_names": [
"Prinivil",
"Zestril"
],
"drug_class": "ACE inhibitor",
"category": "antihypertensive",
"default_unit": "mg",
"common_dosages": [
5,
10,
20,
40
],
"typical_dosing": "10-40 mg once daily",
"max_daily_dose": 80,
"common_side_effects": [
"dry cough",
"dizziness",
"headache"
],
"serious_side_effects": [
"angioedema",
"hyperkalemia",
"kidney injury"
],
"interactions": [
"potassium supplements",
"NSAIDs",
"lithium",
"ARBs"
],
"warnings": [
"Stop if angioedema.",
"Avoid in pregnancy."
],
"risk_level": "low",
"dependency_risk_category": "none",
"mechanism": "Inhibits angiotensin-converting enzyme, lowering blood pressure.",
"half_life": "12 hours",
"content": "Lisinopril is a first-line agent for hypertension and heart failure. A persistent dry cough is the most common reason patients switch to an ARB.",
"source": "curated"
},
{
"name": "Lithium",
"generic_name": "lithium carbonate",
"brand_names": [
"Lithobid",
"Eskalith"
],
"drug_class": "Mood stabilizer",
"category": "other",
"default_unit": "mg",
"common_dosages": [
150,
300,
600
],
"typical_dosing": "600-1200 mg daily in divided doses",
"max_daily_dose": 1800,
"common_side_effects": [
"thirst",
"tremor",
"increased urination",
"weight gain"
],
"serious_side_effects": [
"lithium toxicity",
"hypothyroidism",
"kidney impairment"
],
"interactions": [
"NSAIDs",
"ACE inhibitors/ARBs",
"diuretics",
"dehydration"
],
"warnings": [
"Narrow therapeutic index — regular blood levels required.",
"Maintain hydration & salt intake."
],
"risk_level": "high",
"dependency_risk_category": "low",
"mechanism": "Multiple CNS effects; modulates neurotransmission and second messengers.",
"half_life": "18-36 hours",
"content": "Lithium is a gold-standard mood stabilizer for bipolar disorder with strong anti-suicidal effects. It requires careful monitoring of blood levels, kidney and thyroid function.",
"source": "curated"
},
{
"name": "Lorazepam",
"generic_name": "lorazepam",
"brand_names": [
"Ativan"
],
"drug_class": "Benzodiazepine",
"category": "benzodiazepine",
"default_unit": "mg",
"common_dosages": [
0.5,
1,
2
],
"typical_dosing": "0.5-2 mg 2-3x daily",
"max_daily_dose": 10,
"common_side_effects": [
"sedation",
"dizziness",
"weakness",
"unsteadiness"
],
"serious_side_effects": [
"respiratory depression",
"dependence",
"withdrawal seizures"
],
"interactions": [
"opioids",
"alcohol",
"CNS depressants"
],
"warnings": [
"High dependency risk.",
"Taper slowly; do not stop abruptly."
],
"risk_level": "high",
"dependency_risk_category": "extreme",
"mechanism": "GABA-A receptor positive modulator.",
"half_life": "10-20 hours",
"content": "Lorazepam is an intermediate-acting benzodiazepine used for anxiety, insomnia, seizures and procedural sedation. Long-term use causes tolerance and dependence; a slow, proportionate taper is essential.",
"source": "curated"
},
{
"name": "LSD",
"generic_name": "lysergic acid diethylamide",
"street_names": [
"Acid",
"Tabs",
"Blotter"
],
"drug_class": "Classic psychedelic (lysergamide)",
"category": "psychedelic",
"default_unit": "mcg",
"common_dosages": [
50,
100,
150
],
"typical_dosing": "A 'microdose' is roughly 5-15 mcg; a common full recreational dose is 75-150 mcg. Actual blotter/tab content varies widely and is rarely known precisely.",
"max_daily_dose": null,
"common_side_effects": [
"visual distortions",
"altered sense of time",
"dilated pupils",
"elevated heart rate and blood pressure",
"jaw tension",
"nausea near onset"
],
"serious_side_effects": [
"overwhelming anxiety or panic ('bad trip')",
"psychosis in people predisposed to it",
"risky behavior from impaired judgment",
"rare prolonged perception changes (HPPD)"
],
"interactions": [
"lithium (case reports of seizures — avoid combining)",
"other serotonergic drugs / stimulants (added physiological load)",
"tramadol (lowers seizure threshold)"
],
"warnings": [
"No reagent kit confirms LSD dose or purity the way it can identify MDMA — start with a low dose if the source or blotter strength is unfamiliar.",
"Effects last 8-12 hours and cannot be cut short chemically — do not redose mid-trip out of impatience.",
"Use with a sober, trusted person present ('trip sitter') and in a calm, familiar setting, especially your first few times.",
"Avoid if you or close family have a history of psychosis or bipolar disorder.",
"Physiologically low acute toxicity, but psychological risk (panic, unsafe decisions) is real and dose-dependent."
],
"risk_level": "moderate",
"dependency_risk_category": "none",
"mechanism": "Partial agonist at serotonin 5-HT2A receptors (plus other serotonin/dopamine receptor activity), altering sensory processing and cortical connectivity.",
"half_life": "~3-5 hours",
"content": "LSD is a long-duration classic psychedelic with very low physiological toxicity but significant psychological variability — the same dose can feel completely different depending on mindset and environment ('set and setting'). Tolerance builds almost immediately with repeated use, which naturally limits daily use.",
"source": "curated"
},
{
"name": "Magnesium glycinate",
"generic_name": "magnesium glycinate",
"brand_names": [
"various OTC"
],
"drug_class": "Mineral supplement",
"category": "supplement",
"default_unit": "mg",
"common_dosages": [
100,
200,
400
],
"typical_dosing": "200-400 mg daily",
"max_daily_dose": 400,
"common_side_effects": [
"loose stools at high doses"
],
"serious_side_effects": [
"rare; caution in kidney disease"
],
"interactions": [
"certain antibiotics",
"bisphosphonates"
],
"warnings": [
"Glycinate form is gentler on the gut."
],
"risk_level": "minimal",
"dependency_risk_category": "none",
"mechanism": "Replenishes magnesium; cofactor in hundreds of enzymatic reactions.",
"half_life": "n/a",
"content": "Magnesium glycinate is a well-absorbed, gentle magnesium form used for deficiency, muscle cramps and sleep support.",
"source": "curated"
},
{
"name": "MDMA",
"generic_name": "3,4-methylenedioxymethamphetamine",
"street_names": [
"Ecstasy",
"Molly",
"E",
"X"
],
"drug_class": "Empathogen-entactogen (substituted amphetamine)",
"category": "empathogen",
"default_unit": "mg",
"common_dosages": [
75,
100,
125
],
"typical_dosing": "Commonly reported oral range is about 75-125 mg for a first dose, occasionally with a single smaller top-up (40-60 mg) after 90-120 min; redosing further raises neurotoxicity and comedown severity with little added euphoria.",
"max_daily_dose": 150,
"common_side_effects": [
"jaw clenching / teeth grinding",
"elevated heart rate and blood pressure",
"sweating",
"nausea",
"loss of appetite",
"difficulty regulating body temperature"
],
"serious_side_effects": [
"hyperthermia / heatstroke",
"hyponatremia (overhydration, especially with excess plain water)",
"serotonin syndrome, especially combined with other serotonergic drugs",
"cardiac arrhythmia",
"severe mood dip / depression in the days after use ('comedown')"
],
"interactions": [
"MAOIs (potentially fatal serotonin syndrome — never combine)",
"SSRIs/SNRIs/other serotonergic drugs (serotonin syndrome risk; may also blunt MDMA's effects)",
"stimulants (added cardiovascular strain)",
"alcohol (increases dehydration and impairs judgment)"
],
"warnings": [
"Purity and actual content of illicit tablets/powder are never guaranteed — use a reagent test kit and consider a fentanyl/adulterant test where available.",
"Drink water only to thirst (roughly 250-500 ml/hour while active) — overhydration causes fatal hyponatremia, a bigger real-world risk than dehydration.",
"Take breaks from dancing/exertion in warm environments to avoid overheating.",
"Avoid redosing beyond one small top-up; more does not mean better and sharply raises risk.",
"Space uses at least 4-6 weeks apart to reduce neurotoxicity and let serotonin stores recover."
],
"risk_level": "high",
"dependency_risk_category": "moderate",
"mechanism": "Triggers massive release of serotonin (and, to a lesser extent, dopamine and norepinephrine) from presynaptic neurons, with some reuptake inhibition.",
"half_life": "~8 hours",
"content": "MDMA produces strong feelings of empathy, emotional openness and euphoria. Its main acute dangers are overheating and overhydration rather than direct organ toxicity at typical doses, but illicit supply purity is highly unpredictable and serotonin-syndrome risk with other serotonergic drugs is serious. This entry supports harm-reduction tracking (dose, timing, comedown pattern), not endorsement of use.",
"source": "curated"
},
{
"name": "Melatonin",
"generic_name": "melatonin",
"brand_names": [
"various OTC"
],
"drug_class": "Hormone / sleep supplement",
"category": "supplement",
"default_unit": "mg",
"common_dosages": [
0.5,
1,
3,
5,
10
],
"typical_dosing": "0.5-5 mg 30-60 min before bed",
"max_daily_dose": 10,
"common_side_effects": [
"drowsiness",
"vivid dreams",
"morning grogginess"
],
"serious_side_effects": [
"rare"
],
"interactions": [
"sedatives",
"anticoagulants",
"immunosuppressants"
],
"warnings": [
"Lower doses often as effective as higher.",
"Quality varies between brands."
],
"risk_level": "minimal",
"dependency_risk_category": "none",
"mechanism": "Supplemental pineal hormone regulating circadian rhythm.",
"half_life": "~45 minutes",
"content": "Melatonin helps with circadian rhythm disorders and jet lag more than classic insomnia. It is non-habit-forming; low doses taken early in the evening work best.",
"source": "curated"
},
{
"name": "Metformin",
"generic_name": "metformin",
"brand_names": [
"Glucophage",
"Fortamet"
],
"drug_class": "Biguanide",
"category": "diabetes",
"default_unit": "mg",
"common_dosages": [
500,
850,
1000
],
"typical_dosing": "500-1000 mg twice daily",
"max_daily_dose": 2550,
"common_side_effects": [
"diarrhea",
"nausea",
"metallic taste",
"B12 deficiency"
],
"serious_side_effects": [
"lactic acidosis (rare)"
],
"interactions": [
"iodinated contrast",
"alcohol",
"cimetidine"
],
"warnings": [
"Hold around contrast imaging.",
"Take with food to reduce GI upset."
],
"risk_level": "low",
"dependency_risk_category": "none",
"mechanism": "Reduces hepatic glucose production and improves insulin sensitivity.",
"half_life": "~6 hours",
"content": "Metformin is the first-line drug for type 2 diabetes, improving glucose control without causing hypoglycemia or weight gain.",
"source": "curated"
},
{
"name": "Methamphetamine",
"generic_name": "methamphetamine",
"street_names": [
"Meth",
"Crystal",
"Ice"
],
"drug_class": "CNS stimulant (substituted amphetamine)",
"category": "stimulant",
"default_unit": "mg",
"common_dosages": [
10,
20,
30
],
"typical_dosing": "Recreational doses are commonly reported in the 10-30 mg range; smoked or injected routes produce a much faster, more intense onset than oral or insufflated use of the same amount.",
"max_daily_dose": null,
"common_side_effects": [
"increased heart rate and blood pressure",
"reduced appetite",
"insomnia",
"jaw clenching / teeth grinding",
"elevated body temperature",
"anxiety"
],
"serious_side_effects": [
"cardiac arrhythmia, hypertensive crisis, stroke",
"hyperthermia",
"psychosis (paranoia, hallucinations) with heavy or repeated use",
"significant dental and skin damage with chronic use",
"pronounced depression and fatigue during the 'crash' after use"
],
"interactions": [
"other stimulants (compounded cardiovascular strain)",
"MAOIs (dangerous hypertensive reaction)",
"alcohol (masks intoxication, increases dehydration)"
],
"warnings": [
"Much longer-acting than cocaine (hours rather than minutes), so redosing before the first dose has worn off compounds heavily and raises psychosis risk.",
"Binge patterns (repeated dosing over hours or days without sleep or food) carry sharply higher cardiac and psychiatric risk than a single isolated dose.",
"Illicit supply purity and actual content are unverified; consider testing where legally available.",
"The post-use 'crash' (exhaustion, low mood, intense hunger) is a normal pharmacological rebound, not a sign something is uniquely wrong — but it is a common relapse trigger.",
"Set the medication's Form to 'smoked/vaporized' or 'insufflated' if that's your route, for a more accurate effects-tracker curve."
],
"risk_level": "high",
"dependency_risk_category": "extreme",
"mechanism": "Releases and blocks reuptake of dopamine and norepinephrine, and inhibits monoamine oxidase, producing a stronger and longer dopamine surge than amphetamine.",
"half_life": "~10-12 hours",
"content": "Methamphetamine is pharmacologically similar to prescription amphetamines but is typically used at higher doses, via faster routes, and in binge patterns that carry substantially higher cardiovascular, psychiatric and dependence risk. Its long duration relative to cocaine means a single dose's effects — and any adverse cardiac symptoms — can persist for many hours.",
"source": "curated"
},
{
"name": "Methylphenidate",
"generic_name": "methylphenidate",
"brand_names": [
"Ritalin",
"Concerta",
"Medikinet"
],
"drug_class": "CNS stimulant",
"category": "stimulant",
"default_unit": "mg",
"common_dosages": [
5,
10,
18,
27,
36,
54
],
"typical_dosing": "18-54 mg daily (ER) or 5-20 mg 2-3x (IR)",
"max_daily_dose": 72,
"common_side_effects": [
"decreased appetite",
"insomnia",
"increased heart rate",
"anxiety"
],
"serious_side_effects": [
"cardiovascular events",
"psychosis",
"dependence"
],
"interactions": [
"MAOIs",
"vasopressors",
"other stimulants"
],
"warnings": [
"Controlled substance.",
"Monitor blood pressure, growth in children."
],
"risk_level": "moderate",
"dependency_risk_category": "high",
"mechanism": "Blocks dopamine and norepinephrine reuptake.",
"half_life": "2-3 hours (IR)",
"content": "Methylphenidate is a first-line ADHD stimulant. It is a controlled substance with abuse potential; structured 'drug holidays' (cyclic dosing) are sometimes used.",
"source": "curated"
},
{
"name": "Metoprolol",
"generic_name": "metoprolol",
"brand_names": [
"Lopressor",
"Toprol XL"
],
"drug_class": "Beta-blocker",
"category": "antihypertensive",
"default_unit": "mg",
"common_dosages": [
25,
50,
100
],
"typical_dosing": "50-100 mg 1-2x daily",
"max_daily_dose": 400,
"common_side_effects": [
"fatigue",
"dizziness",
"bradycardia",
"cold extremities"
],
"serious_side_effects": [
"severe bradycardia",
"rebound tachycardia/angina if stopped abruptly"
],
"interactions": [
"other rate-lowering drugs",
"CYP2D6 inhibitors"
],
"warnings": [
"Do not stop abruptly — taper to avoid rebound.",
"Caution in asthma."
],
"risk_level": "low",
"dependency_risk_category": "low",
"mechanism": "Selective beta-1 adrenergic blocker.",
"half_life": "3-7 hours",
"content": "Metoprolol treats hypertension, angina, arrhythmias and heart failure. Abrupt discontinuation can cause rebound hypertension and angina, so taper over 1-2 weeks.",
"source": "curated"
},
{
"name": "Mirtazapine",
"generic_name": "mirtazapine",
"brand_names": [
"Remeron"
],
"drug_class": "Tetracyclic antidepressant",
"category": "antidepressant",
"default_unit": "mg",
"common_dosages": [
15,
30,
45
],
"typical_dosing": "15-45 mg at bedtime",
"max_daily_dose": 45,
"common_side_effects": [
"sedation",
"increased appetite",
"weight gain",
"dry mouth"
],
"serious_side_effects": [
"agranulocytosis (rare)",
"serotonin syndrome"
],
"interactions": [
"MAOIs",
"CNS depressants",
"alcohol"
],
"warnings": [
"Sedation strongest at low doses.",
"Taper to stop."
],
"risk_level": "low",
"dependency_risk_category": "moderate",
"mechanism": "Alpha-2 antagonist increasing noradrenergic & serotonergic transmission.",
"half_life": "20-40 hours",
"content": "Mirtazapine is useful when insomnia and poor appetite accompany depression. Lower doses are often more sedating than higher ones.",
"source": "curated"
},
{
"name": "Modafinil",
"generic_name": "modafinil",
"brand_names": [
"Provigil",
"Alertec",
"Modavigil"
],
"drug_class": "wakefulness-promoting agent",
"category": "stimulant",
"default_unit": "mg",
"common_dosages": [
100,
200
],
"typical_dosing": "Typically 200 mg once daily in the morning for narcolepsy or obstructive sleep apnea-related sleepiness; 200 mg taken about 1 hour before work shift for shift work sleep disorder. Some patients may use 100 mg daily or divided dosing based on tolerability and clinical response.",
"max_daily_dose": 400,
"common_side_effects": [
"headache",
"nausea",
"decreased appetite",
"nervousness",
"anxiety",
"insomnia",
"dry mouth",
"dizziness"
],
"serious_side_effects": [
"serious rash including Stevens-Johnson syndrome",
"angioedema",
"anaphylaxis",
"chest pain",
"psychiatric symptoms such as mania or hallucinations",
"severe hypertension",
"arrhythmia",
"liver injury"
],
"interactions": [
"hormonal contraceptives may be less effective",
"CYP3A4 substrates may have reduced levels",
"CYP2C19 substrates may have increased levels",
"warfarin may require closer monitoring",
"MAO inhibitors may increase adverse effects",
"other stimulants may increase cardiovascular or psychiatric risks"
],
"warnings": [
"may impair judgment or coordination despite improved wakefulness",
"use caution in patients with heart disease or hypertension",
"use caution in patients with psychiatric disorders",
"may reduce effectiveness of hormonal birth control during use and for 1 month after stopping",
"discontinue immediately if rash or hypersensitivity occurs",
"dose adjustment may be needed in severe hepatic impairment"
],
"risk_level": "moderate",
"dependency_risk_category": "low",
"mechanism": "Modafinil promotes wakefulness through effects on central neurotransmitter systems, including inhibition of dopamine reuptake, with downstream effects on norepinephrine, histamine, orexin, and other pathways.",
"half_life": "Approximately 12 to 15 hours in adults, variable with liver function and interacting drugs.",
"content": "Modafinil is a prescription wakefulness-promoting medication used for narcolepsy, obstructive sleep apnea-related excessive sleepiness, and shift work sleep disorder. It is generally taken once daily and may improve alertness, but it can cause insomnia, anxiety, and important drug interactions, including reduced effectiveness of hormonal contraceptives.",
"source": "ai"
},
{
"name": "Naproxen",
"generic_name": "naproxen",
"brand_names": [
"Aleve",
"Naprosyn"
],
"drug_class": "NSAID",
"category": "nsaid",
"default_unit": "mg",
"common_dosages": [
220,
250,
375,
500
],
"typical_dosing": "250-500 mg twice daily",
"max_daily_dose": 1250,
"common_side_effects": [
"stomach upset",
"heartburn",
"dizziness"
],
"serious_side_effects": [
"GI bleeding",
"kidney injury",
"cardiovascular events"
],
"interactions": [
"anticoagulants",
"antihypertensives",
"lithium"
],
"warnings": [
"Take with food.",
"Longer half-life than ibuprofen."
],
"risk_level": "low",
"dependency_risk_category": "none",
"mechanism": "Non-selective COX inhibitor.",
"half_life": "12-17 hours",
"content": "Naproxen is a longer-acting NSAID useful for sustained pain and inflammation, with a comparatively lower cardiovascular risk among NSAIDs.",
"source": "curated"
},
{
"name": "Nicotine",
"generic_name": "nicotine",
"brand_names": [
"Nicorette",
"NicoDerm"
],
"drug_class": "Cholinergic stimulant",
"category": "other",
"default_unit": "mg",
"common_dosages": [
2,
4,
7,
14,
21
],
"typical_dosing": "patch/gum per cessation protocol",
"max_daily_dose": null,
"common_side_effects": [
"nausea",
"dizziness",
"increased heart rate",
"skin irritation (patch)"
],
"serious_side_effects": [
"cardiovascular strain",
"high dependence"
],
"interactions": [
"affects metabolism of several drugs (CYP1A2)"
],
"warnings": [
"Highly addictive.",
"Replacement therapy is tapered down stepwise."
],
"risk_level": "moderate",
"dependency_risk_category": "extreme",
"mechanism": "Nicotinic acetylcholine receptor agonist; strong dopamine reward.",
"half_life": "1-2 hours",
"content": "Nicotine is highly addictive. Nicotine replacement therapy uses a stepped, tapering schedule (e.g., 21 -> 14 -> 7 mg patches) to ease cessation.",
"source": "curated"
},
{
"name": "Omeprazole",
"generic_name": "omeprazole",
"brand_names": [
"Prilosec",
"Losec"
],
"drug_class": "Proton pump inhibitor",
"category": "ppi",
"default_unit": "mg",
"common_dosages": [
10,
20,
40
],
"typical_dosing": "20-40 mg once daily",
"max_daily_dose": 40,
"common_side_effects": [
"headache",
"diarrhea",
"abdominal pain"
],
"serious_side_effects": [
"C. difficile infection",
"B12/magnesium deficiency",
"rebound acid hypersecretion"
],
"interactions": [
"clopidogrel",
"drugs needing acid for absorption"
],
"warnings": [
"Long-term use linked to fractures, deficiencies.",
"Taper if used long-term to avoid rebound."
],
"risk_level": "low",
"dependency_risk_category": "low",
"mechanism": "Irreversibly inhibits gastric H+/K+ ATPase (acid pump).",
"half_life": "0.5-1 hour",
"content": "Omeprazole reduces stomach acid for reflux and ulcers. Rebound acid hypersecretion can make stopping difficult after prolonged use, so step down gradually.",
"source": "curated"
},
{
"name": "Oxycodone",
"generic_name": "oxycodone",
"brand_names": [
"OxyContin",
"Roxicodone",
"Percocet (with APAP)"
],
"drug_class": "Opioid analgesic",
"category": "opioid",
"default_unit": "mg",
"common_dosages": [
5,
10,
15,
20
],
"typical_dosing": "5-15 mg every 4-6 h as needed",
"max_daily_dose": null,
"common_side_effects": [
"constipation",
"nausea",
"drowsiness",
"itching"
],
"serious_side_effects": [
"respiratory depression",
"overdose",
"physical dependence",
"addiction"
],
"interactions": [
"benzodiazepines",
"alcohol",
"other CNS depressants",
"MAOIs"
],
"warnings": [
"High overdose & addiction risk.",
"Combining with benzodiazepines can be fatal.",
"Taper to avoid withdrawal."
],
"risk_level": "high",
"dependency_risk_category": "extreme",
"mechanism": "Mu-opioid receptor agonist.",
"half_life": "3-4.5 hours",
"content": "Oxycodone is a potent opioid for moderate-to-severe pain. Tolerance, dependence and addiction can develop quickly. Discontinuation after regular use should be gradual to limit withdrawal.",
"source": "curated"
},
{
"name": "Prednisone",
"generic_name": "prednisone",
"brand_names": [
"Deltasone",
"Rayos"
],
"drug_class": "Corticosteroid",
"category": "other",
"default_unit": "mg",
"common_dosages": [
5,
10,
20,
50
],
"typical_dosing": "varies; often tapered",
"max_daily_dose": null,
"common_side_effects": [
"increased appetite",
"insomnia",
"mood changes",
"fluid retention"
],
"serious_side_effects": [
"adrenal suppression",
"hyperglycemia",
"osteoporosis",
"infection risk"
],
"interactions": [
"NSAIDs",
"vaccines",
"diabetes medications"
],
"warnings": [
"Do NOT stop abruptly after >2-3 weeks — taper to avoid adrenal crisis."
],
"risk_level": "moderate",
"dependency_risk_category": "low",
"mechanism": "Synthetic glucocorticoid with broad anti-inflammatory/immunosuppressive effects.",
"half_life": "2-3 hours (biologic 18-36 h)",
"content": "Prednisone is a versatile corticosteroid. After more than a couple of weeks of use the adrenal glands suppress, so the dose must be tapered to allow recovery.",
"source": "curated"
},
{
"name": "Pregabalin",
"generic_name": "pregabalin",
"brand_names": [
"Lyrica"
],
"drug_class": "Gabapentinoid anticonvulsant",
"category": "anticonvulsant",
"default_unit": "mg",
"common_dosages": [
25,
50,
75,
150,
300
],
"typical_dosing": "75-300 mg twice daily",
"max_daily_dose": 600,
"common_side_effects": [
"dizziness",
"somnolence",
"weight gain",
"edema"
],
"serious_side_effects": [
"dependence",
"respiratory depression with opioids"
],
"interactions": [
"opioids",
"alcohol",
"CNS depressants"
],
"warnings": [
"Schedule V controlled (US).",
"Taper to discontinue."
],
"risk_level": "moderate",
"dependency_risk_category": "high",
"mechanism": "Alpha-2-delta calcium channel ligand.",
"half_life": "~6 hours",
"content": "Pregabalin treats neuropathic pain, fibromyalgia and generalized anxiety. It has clearer abuse potential than gabapentin and should be tapered when stopping.",
"source": "curated"
},
{
"name": "Psilocybin mushrooms",
"generic_name": "psilocybin / psilocin",
"street_names": [
"Mushrooms",
"Shrooms",
"Magic mushrooms"
],
"drug_class": "Classic psychedelic (tryptamine)",
"category": "psychedelic",
"default_unit": "g",
"common_dosages": [
1,
1.5,
2,
3.5
],
"typical_dosing": "Dried mushroom doses are commonly described as: ~0.5-1 g microdose, ~1-2 g mild/'museum' dose, ~2-3.5 g common recreational dose, 3.5 g+ a strong dose. Potency varies enormously by species and growing conditions, so any gram figure is an estimate, not a guarantee.",
"max_daily_dose": null,
"common_side_effects": [
"nausea near onset",
"visual/perceptual changes",
"altered sense of time",
"yawning",
"mild pupil dilation"
],
"serious_side_effects": [
"overwhelming anxiety or panic ('bad trip')",
"psychosis in people predisposed to it",
"risky behavior from impaired judgment",
"accidental ingestion of a misidentified toxic mushroom species"
],
"interactions": [
"MAOIs / serotonergic antidepressants (unpredictable intensity and serotonin syndrome risk)",
"lithium (case reports of seizures — avoid combining)",
"stimulants (added physiological load)"
],
"warnings": [
"Never forage or use unidentified wild mushrooms — toxic look-alikes can cause organ failure or death; sourcing certainty matters more than dose here.",
"Potency is highly variable between species and even between batches of the same species — start low if the source/strain is unfamiliar.",
"Use with a sober, trusted person present and in a calm setting, especially the first few times.",
"Avoid if you or close family have a history of psychosis or bipolar disorder.",
"Effects typically last 4-6 hours and build gradually — wait the full onset window before considering more."
],
"risk_level": "moderate",
"dependency_risk_category": "none",
"mechanism": "Psilocybin is dephosphorylated to psilocin, a serotonin 5-HT2A receptor partial agonist, producing psychedelic effects similar to LSD but shorter-acting.",
"half_life": "psilocin ~2-3 hours",
"content": "Psilocybin mushrooms produce a shorter, somewhat gentler psychedelic experience than LSD, with similarly low physiological toxicity and similar psychological risks. Species and growing conditions cause large potency swings, so dose tracking here is necessarily approximate — treat gram amounts as a rough guide, not a precise dose.",
"source": "curated"
},
{
"name": "Quetiapine",
"generic_name": "quetiapine",
"brand_names": [
"Seroquel"
],
"drug_class": "Atypical antipsychotic",
"category": "antipsychotic",
"default_unit": "mg",
"common_dosages": [
25,
50,
100,
200,
300
],
"typical_dosing": "varies widely by indication",
"max_daily_dose": 800,
"common_side_effects": [
"sedation",
"weight gain",
"dry mouth",
"dizziness"
],
"serious_side_effects": [
"metabolic syndrome",
"QT prolongation",
"tardive dyskinesia"
],
"interactions": [
"CNS depressants",
"CYP3A4 inhibitors",
"QT-prolonging drugs"
],
"warnings": [
"Taper to avoid withdrawal/rebound insomnia.",
"Monitor weight & glucose."
],
"risk_level": "moderate",
"dependency_risk_category": "low",
"mechanism": "Dopamine D2 and serotonin 5-HT2A antagonist.",
"half_life": "~6 hours",
"content": "Quetiapine treats schizophrenia, bipolar disorder and (low dose, off-label) insomnia. Discontinuation can cause rebound insomnia and nausea; taper gradually.",
"source": "curated"
},
{
"name": "Semaglutide",
"generic_name": "semaglutide",
"brand_names": [
"Ozempic",
"Wegovy",
"Rybelsus"
],
"drug_class": "GLP-1 receptor agonist",
"category": "diabetes",
"default_unit": "mg",
"common_dosages": [
0.25,
0.5,
1,
2
],
"typical_dosing": "weekly injection, titrated",
"max_daily_dose": null,
"common_side_effects": [
"nausea",
"vomiting",
"diarrhea",
"constipation"
],
"serious_side_effects": [
"pancreatitis",
"gallbladder disease",
"thyroid C-cell tumors (animal)"
],
"interactions": [
"insulin/sulfonylureas (hypoglycemia)",
"oral drugs (delayed absorption)"
],
"warnings": [
"Titrate slowly to limit nausea.",
"Contraindicated with MEN-2 / medullary thyroid cancer."
],
"risk_level": "moderate",
"dependency_risk_category": "none",
"mechanism": "Mimics GLP-1, enhancing insulin secretion, slowing gastric emptying, reducing appetite.",
"half_life": "~7 days",
"content": "Semaglutide is a once-weekly GLP-1 agonist for type 2 diabetes and chronic weight management. Slow dose escalation minimizes gastrointestinal side effects.",
"source": "curated"
},
{
"name": "Sertraline",
"generic_name": "sertraline",
"brand_names": [
"Zoloft",
"Lustral"
],
"drug_class": "SSRI antidepressant",
"category": "antidepressant",
"default_unit": "mg",
"common_dosages": [
25,
50,
100
],
"typical_dosing": "50-200 mg once daily",
"max_daily_dose": 200,
"common_side_effects": [
"nausea",
"diarrhea",
"insomnia",
"headache",
"sexual dysfunction"
],
"serious_side_effects": [
"serotonin syndrome",
"suicidal thoughts in young adults",
"hyponatremia"
],
"interactions": [
"MAOIs",
"other serotonergic drugs",
"NSAIDs (bleeding risk)",
"warfarin"
],
"warnings": [
"Do not stop abruptly — taper to avoid discontinuation syndrome.",
"Black box: suicidality in <25 yrs."
],
"risk_level": "low",
"dependency_risk_category": "moderate",
"mechanism": "Selectively inhibits serotonin reuptake, increasing synaptic serotonin.",
"half_life": "~26 hours",
"content": "Sertraline is a widely prescribed SSRI for depression, anxiety, panic disorder, OCD and PTSD. It is generally well tolerated. Abrupt discontinuation can cause dizziness, flu-like symptoms and 'brain zaps', so a gradual hyperbolic taper is recommended, especially after long-term use.",
"source": "curated"
},
{
"name": "Tramadol",
"generic_name": "tramadol",
"brand_names": [
"Ultram",
"ConZip"
],
"drug_class": "Opioid analgesic (atypical)",
"category": "opioid",
"default_unit": "mg",
"common_dosages": [
50,
100
],
"typical_dosing": "50-100 mg every 4-6 h",
"max_daily_dose": 400,
"common_side_effects": [
"nausea",
"dizziness",
"constipation",
"headache"
],
"serious_side_effects": [
"seizures",
"serotonin syndrome",
"respiratory depression",
"dependence"
],
"interactions": [
"SSRIs/SNRIs",
"MAOIs",
"other serotonergic drugs",
"CNS depressants"
],
"warnings": [
"Lowers seizure threshold.",
"Serotonin syndrome risk with antidepressants.",
"Taper to stop."
],
"risk_level": "high",
"dependency_risk_category": "high",
"mechanism": "Weak mu-opioid agonist plus serotonin/norepinephrine reuptake inhibition.",
"half_life": "6-8 hours",
"content": "Tramadol provides moderate pain relief with dual opioid and monoaminergic action. It carries seizure and serotonin syndrome risks and produces both opioid and SSRI-like withdrawal.",
"source": "curated"
},
{
"name": "Venlafaxine",
"generic_name": "venlafaxine",
"brand_names": [
"Effexor",
"Effexor XR"
],
"drug_class": "SNRI antidepressant",
"category": "antidepressant",
"default_unit": "mg",
"common_dosages": [
37.5,
75,
150
],
"typical_dosing": "75-225 mg daily",
"max_daily_dose": 375,
"common_side_effects": [
"nausea",
"sweating",
"dry mouth",
"increased blood pressure"
],
"serious_side_effects": [
"hypertension",
"serotonin syndrome",
"severe discontinuation syndrome"
],
"interactions": [
"MAOIs",
"serotonergic drugs",
"NSAIDs"
],
"warnings": [
"Notorious for severe withdrawal — requires very slow hyperbolic taper.",
"Monitor blood pressure."
],
"risk_level": "moderate",
"dependency_risk_category": "high",
"mechanism": "Inhibits serotonin and norepinephrine reuptake (dose-dependent).",
"half_life": "5 hours (XR 15 h)",
"content": "Venlafaxine is an SNRI for depression and anxiety. It has one of the most difficult discontinuation profiles of any antidepressant; hyperbolic tapering with small final-step reductions is strongly advised.",
"source": "curated"
},
{
"name": "Vitamin D3",
"generic_name": "cholecalciferol",
"brand_names": [
"various OTC"
],
"drug_class": "Vitamin / supplement",
"category": "supplement",
"default_unit": "iu",
"common_dosages": [
1000,
2000,
5000
],
"typical_dosing": "1000-2000 IU daily",
"max_daily_dose": 4000,
"common_side_effects": [
"usually none"
],
"serious_side_effects": [
"hypercalcemia with chronic high doses"
],
"interactions": [
"thiazides",
"high-dose calcium"
],
"warnings": [
"Very high chronic doses can cause toxicity."
],
"risk_level": "minimal",
"dependency_risk_category": "none",
"mechanism": "Supports calcium absorption and bone, immune and muscle function.",
"half_life": "weeks (stored in fat)",
"content": "Vitamin D3 corrects deficiency and supports bone and immune health. Toxicity only occurs at sustained very high intake.",
"source": "curated"
},
{
"name": "Zolpidem",
"generic_name": "zolpidem",
"brand_names": [
"Ambien",
"Stilnox"
],
"drug_class": "Z-drug (non-benzodiazepine hypnotic)",
"category": "sleep-aid",
"default_unit": "mg",
"common_dosages": [
5,
10
],
"typical_dosing": "5-10 mg at bedtime",
"max_daily_dose": 10,
"common_side_effects": [
"drowsiness",
"dizziness",
"headache"
],
"serious_side_effects": [
"complex sleep behaviors (sleep-driving)",
"dependence"
],
"interactions": [
"alcohol",
"CNS depressants",
"CYP3A4 inhibitors"
],
"warnings": [
"Take only when able to get 7-8 h sleep.",
"Risk of next-day impairment, esp. women."
],
"risk_level": "moderate",
"dependency_risk_category": "high",
"mechanism": "Selective GABA-A (omega-1) agonist.",
"half_life": "~2.5 hours",
"content": "Zolpidem is a short-acting hypnotic for insomnia. It carries warnings about complex sleep behaviors and can cause rebound insomnia and dependence with prolonged use.",
"source": "curated"
}
];
