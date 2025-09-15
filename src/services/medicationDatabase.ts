import { MedicationCategory, DependencyRiskCategory, RiskLevel } from '@/types';

export interface MedicationDatabaseEntry {
  name: string;
  genericName?: string;
  brandNames?: string[];
  category: MedicationCategory;
  dependencyRiskCategory: DependencyRiskCategory;
  riskLevel: RiskLevel;
  commonDosages: string[];
  commonUnits: string[];
  commonFrequencies: string[];
  description?: string;
  commonSideEffects?: string[];
  commonInteractions?: string[];
  withdrawalRisk: 'none' | 'low' | 'moderate' | 'high' | 'severe';
  taperingRequired: boolean;
  taperingRecommendations?: {
    method: 'linear' | 'exponential' | 'hyperbolic' | 'custom';
    durationWeeks: number;
    reductionPercent: number;
    daysBetweenReductions?: number; // Research-based interval between dose reductions
    notes?: string;
  };
  psychologicalSupport?: {
    adherenceFactors: string[];
    motivationalMessages: string[];
    riskTriggers: string[];
  };
}

export const MEDICATION_DATABASE: MedicationDatabaseEntry[] = [
  // PRESCRIPTION MEDICATIONS - High Risk (Opioids)
  {
    name: "Oxycodone",
    brandNames: ["OxyContin", "Percocet", "Roxicodone"],
    category: "prescription",
    dependencyRiskCategory: "opioid",
    riskLevel: "high",
    commonDosages: ["5", "10", "15", "20", "30"],
    commonUnits: ["mg"],
    commonFrequencies: ["every-4-hours", "every-6-hours", "twice-daily"],
    description: "Strong opioid pain medication for moderate to severe pain",
    commonSideEffects: ["drowsiness", "constipation", "nausea", "dizziness", "respiratory depression"],
    commonInteractions: ["alcohol", "benzodiazepines", "muscle relaxants", "sleep aids"],
    withdrawalRisk: "severe",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 8,
      reductionPercent: 10,
      daysBetweenReductions: 10, // 10 days between reductions for opioids per AAFP guidelines
      notes: "Use hyperbolic tapering: 10% reduction of current dose every 1-2 weeks. Monitor for withdrawal symptoms. Medical supervision essential."
    },
    psychologicalSupport: {
      adherenceFactors: ["pain management goals", "withdrawal fear", "tolerance concerns"],
      motivationalMessages: [
        "Taking your medication as prescribed helps manage pain safely",
        "Consistent dosing prevents withdrawal while managing pain",
        "You're taking an important step in your pain management journey"
      ],
      riskTriggers: ["dose escalation", "early refills", "frequent breakthrough pain"]
    }
  },
  {
    name: "Morphine",
    brandNames: ["MS Contin", "Kadian", "Avinza"],
    category: "prescription",
    dependencyRiskCategory: "opioid",
    riskLevel: "high",
    commonDosages: ["15", "30", "60", "100"],
    commonUnits: ["mg"],
    commonFrequencies: ["twice-daily", "every-12-hours"],
    description: "Strong opioid for severe pain management",
    commonSideEffects: ["constipation", "drowsiness", "nausea", "confusion"],
    withdrawalRisk: "severe",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 12,
      reductionPercent: 10,
      notes: "Very slow hyperbolic tapering required. Consider switching to longer-acting formulation first. 10% of current dose every 2 weeks."
    }
  },
  {
    name: "Tramadol",
    brandNames: ["Ultram", "ConZip"],
    category: "prescription",
    dependencyRiskCategory: "opioid",
    riskLevel: "moderate",
    commonDosages: ["50", "100"],
    commonUnits: ["mg"],
    commonFrequencies: ["every-6-hours", "every-8-hours"],
    description: "Atypical opioid for moderate pain",
    withdrawalRisk: "moderate",
    taperingRequired: true,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 2,
      reductionPercent: 50,
      notes: "Can cause seizures if stopped abruptly. Gradual reduction recommended."
    }
  },

  // PRESCRIPTION MEDICATIONS - High Risk (Benzodiazepines)
  {
    name: "Alprazolam",
    brandNames: ["Xanax", "Niravam"],
    category: "prescription",
    dependencyRiskCategory: "benzodiazepine",
    riskLevel: "high",
    commonDosages: ["0.25", "0.5", "1", "2"],
    commonUnits: ["mg"],
    commonFrequencies: ["as-needed", "twice-daily", "three-times-daily"],
    description: "Short-acting benzodiazepine for anxiety and panic disorders",
    commonSideEffects: ["drowsiness", "memory problems", "confusion", "coordination problems"],
    commonInteractions: ["alcohol", "opioids", "muscle relaxants", "antihistamines"],
    withdrawalRisk: "severe",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 16,
      reductionPercent: 10,
      daysBetweenReductions: 14, // 14 days minimum for alprazolam due to severe withdrawal risk
      notes: "Extremely slow hyperbolic taper required following Ashton Manual principles. Consider switching to diazepam first. 10% of current dose every 2-3 weeks. Medical supervision essential."
    },
    psychologicalSupport: {
      adherenceFactors: ["anxiety management", "withdrawal fear", "rebound anxiety"],
      motivationalMessages: [
        "Taking your anxiety medication consistently helps maintain emotional balance",
        "Gradual, consistent dosing prevents rebound anxiety",
        "You're managing your anxiety responsibly"
      ],
      riskTriggers: ["dose increases", "taking extra doses", "rebound anxiety", "tolerance"]
    }
  },
  {
    name: "Lorazepam",
    brandNames: ["Ativan"],
    category: "prescription",
    dependencyRiskCategory: "benzodiazepine",
    riskLevel: "high",
    commonDosages: ["0.5", "1", "2"],
    commonUnits: ["mg"],
    commonFrequencies: ["as-needed", "twice-daily"],
    description: "Intermediate-acting benzodiazepine for anxiety",
    withdrawalRisk: "severe",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 12,
      reductionPercent: 10,
      daysBetweenReductions: 12, // 12 days for lorazepam intermediate half-life
      notes: "Gradual hyperbolic reduction essential. Risk of seizures if stopped abruptly. 10% of current dose every 2 weeks."
    }
  },
  {
    name: "Clonazepam",
    brandNames: ["Klonopin"],
    category: "prescription",
    dependencyRiskCategory: "benzodiazepine",
    riskLevel: "high",
    commonDosages: ["0.5", "1", "2"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Long-acting benzodiazepine for anxiety and seizures",
    withdrawalRisk: "severe",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 20,
      reductionPercent: 10,
      daysBetweenReductions: 21, // 21 days for clonazepam due to long half-life
      notes: "Very long hyperbolic taper due to long half-life and high potency. 10% of current dose every 3-4 weeks. Monitor for seizure risk."
    }
  },

  // PRESCRIPTION MEDICATIONS - High Risk (Stimulants)
  {
    name: "Amphetamine/Dextroamphetamine",
    brandNames: ["Adderall", "Adderall XR"],
    category: "prescription",
    dependencyRiskCategory: "stimulant",
    riskLevel: "high",
    commonDosages: ["5", "10", "15", "20", "25", "30"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Stimulant medication for ADHD",
    commonSideEffects: ["decreased appetite", "insomnia", "mood changes", "increased heart rate"],
    withdrawalRisk: "moderate",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["ADHD symptom management", "academic/work performance", "side effect tolerance"],
      motivationalMessages: [
        "Your ADHD medication helps you stay focused and organized",
        "Consistent dosing maintains stable symptom control",
        "You're taking charge of your ADHD management"
      ],
      riskTriggers: ["dose increases for performance", "taking extra doses", "using for energy"]
    }
  },
  {
    name: "Methylphenidate",
    brandNames: ["Ritalin", "Concerta", "Metadate"],
    category: "prescription",
    dependencyRiskCategory: "stimulant",
    riskLevel: "high",
    commonDosages: ["5", "10", "18", "27", "36", "54"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Stimulant medication for ADHD",
    withdrawalRisk: "moderate",
    taperingRequired: false
  },

  // PRESCRIPTION MEDICATIONS - Moderate Risk (Sleep Aids)
  {
    name: "Zolpidem",
    brandNames: ["Ambien", "Edluar"],
    category: "prescription",
    dependencyRiskCategory: "sleep-aid",
    riskLevel: "moderate",
    commonDosages: ["5", "10"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Non-benzodiazepine sleep medication",
    commonSideEffects: ["drowsiness", "dizziness", "memory problems", "complex behaviors"],
    withdrawalRisk: "moderate",
    taperingRequired: true,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 2,
      reductionPercent: 25,
      notes: "Gradual reduction to prevent rebound insomnia. May cause temporary sleep disturbance."
    }
  },
  {
    name: "Eszopiclone",
    brandNames: ["Lunesta"],
    category: "prescription",
    dependencyRiskCategory: "sleep-aid",
    riskLevel: "moderate",
    commonDosages: ["1", "2", "3"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Non-benzodiazepine sleep medication",
    withdrawalRisk: "moderate",
    taperingRequired: true,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 2,
      reductionPercent: 33,
      notes: "Reduce gradually to minimize rebound insomnia."
    }
  },

  // PRESCRIPTION MEDICATIONS - Low Risk (Antidepressants)
  {
    name: "Sertraline",
    brandNames: ["Zoloft"],
    category: "prescription",
    dependencyRiskCategory: "antidepressant",
    riskLevel: "low",
    commonDosages: ["25", "50", "100", "150", "200"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "SSRI antidepressant for depression and anxiety",
    commonSideEffects: ["nausea", "headache", "sexual side effects", "sleep changes"],
    withdrawalRisk: "low",
    taperingRequired: true,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 4,
      reductionPercent: 25,
      daysBetweenReductions: 14, // 14 days for SSRIs to prevent discontinuation syndrome
      notes: "Gradual reduction to prevent discontinuation syndrome."
    },
    psychologicalSupport: {
      adherenceFactors: ["mood stability", "symptom return fear", "side effect management"],
      motivationalMessages: [
        "Your antidepressant helps maintain emotional balance",
        "Consistent use supports long-term mental health",
        "You're investing in your mental wellness"
      ],
      riskTriggers: ["mood episodes", "missing doses frequently", "stopping abruptly"]
    }
  },
  {
    name: "Fluoxetine",
    brandNames: ["Prozac"],
    category: "prescription",
    dependencyRiskCategory: "antidepressant",
    riskLevel: "low",
    commonDosages: ["10", "20", "40"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "SSRI antidepressant with long half-life",
    withdrawalRisk: "low",
    taperingRequired: false,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 2,
      reductionPercent: 50,
      notes: "Long half-life makes withdrawal less likely. Still recommend gradual reduction."
    }
  },
  {
    name: "Escitalopram",
    brandNames: ["Lexapro"],
    category: "prescription",
    dependencyRiskCategory: "antidepressant",
    riskLevel: "low",
    commonDosages: ["5", "10", "20"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "SSRI antidepressant for depression and anxiety",
    withdrawalRisk: "low",
    taperingRequired: true,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 3,
      reductionPercent: 33,
      notes: "Monitor for discontinuation symptoms."
    }
  },

  // OVER-THE-COUNTER MEDICATIONS
  {
    name: "Ibuprofen",
    brandNames: ["Advil", "Motrin"],
    category: "over-the-counter",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["200", "400", "600", "800"],
    commonUnits: ["mg"],
    commonFrequencies: ["every-6-hours", "every-8-hours"],
    description: "NSAID for pain and inflammation",
    commonSideEffects: ["stomach upset", "kidney issues", "increased bleeding risk"],
    commonInteractions: ["blood thinners", "ACE inhibitors", "lithium"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Acetaminophen",
    brandNames: ["Tylenol"],
    category: "over-the-counter",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["325", "500", "650"],
    commonUnits: ["mg"],
    commonFrequencies: ["every-4-hours", "every-6-hours"],
    description: "Pain reliever and fever reducer",
    commonSideEffects: ["liver damage with overdose"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Diphenhydramine",
    brandNames: ["Benadryl"],
    category: "over-the-counter",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["12.5", "25", "50"],
    commonUnits: ["mg"],
    commonFrequencies: ["every-6-hours", "once-daily"],
    description: "Antihistamine for allergies and sleep",
    commonSideEffects: ["drowsiness", "dry mouth", "confusion in elderly"],
    withdrawalRisk: "none",
    taperingRequired: false
  },

  // VITAMINS AND SUPPLEMENTS
  {
    name: "Vitamin D3",
    brandNames: ["Cholecalciferol"],
    category: "vitamin",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["400", "800", "1000", "2000", "4000", "5000", "10000"],
    commonUnits: ["iu"],
    commonFrequencies: ["once-daily"],
    description: "Essential vitamin for bone health and immune function",
    commonSideEffects: ["nausea", "vomiting", "kidney stones with excess"],
    withdrawalRisk: "none",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["bone health goals", "mood support", "immune health"],
      motivationalMessages: [
        "Your Vitamin D supports strong bones and immune health",
        "Daily supplementation helps maintain optimal levels",
        "You're taking a proactive step for your long-term health"
      ],
      riskTriggers: []
    }
  },
  {
    name: "Vitamin B12",
    brandNames: ["Cyanocobalamin", "Methylcobalamin"],
    category: "vitamin",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["100", "250", "500", "1000", "2500"],
    commonUnits: ["mcg"],
    commonFrequencies: ["once-daily"],
    description: "Essential vitamin for nerve function and energy metabolism",
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Vitamin C",
    brandNames: ["Ascorbic Acid"],
    category: "vitamin",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["250", "500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Antioxidant vitamin for immune support",
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Multivitamin",
    category: "vitamin",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["1"],
    commonUnits: ["tablets"],
    commonFrequencies: ["once-daily"],
    description: "Comprehensive vitamin and mineral supplement",
    withdrawalRisk: "none",
    taperingRequired: false
  },

  // MINERAL SUPPLEMENTS
  {
    name: "Magnesium",
    brandNames: ["Magnesium Oxide", "Magnesium Glycinate", "Magnesium Citrate"],
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["200", "400", "500"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Essential mineral for muscle and nerve function",
    commonSideEffects: ["diarrhea", "stomach upset"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Calcium",
    brandNames: ["Calcium Carbonate", "Calcium Citrate"],
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "600", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Essential mineral for bone health",
    commonSideEffects: ["constipation", "kidney stones"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Iron",
    brandNames: ["Ferrous Sulfate", "Ferrous Gluconate"],
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["18", "25", "65"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Essential mineral for blood health",
    commonSideEffects: ["constipation", "stomach upset", "dark stools"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Zinc",
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["8", "15", "30", "50"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Essential mineral for immune function",
    commonSideEffects: ["nausea", "stomach upset"],
    withdrawalRisk: "none",
    taperingRequired: false
  },

  // OMEGA AND FATTY ACID SUPPLEMENTS
  {
    name: "Fish Oil",
    brandNames: ["Omega-3", "EPA/DHA"],
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "1000", "1200"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Omega-3 fatty acids for heart and brain health",
    commonSideEffects: ["fishy aftertaste", "stomach upset"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Flaxseed Oil",
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["1000", "1300"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Plant-based omega-3 fatty acids",
    withdrawalRisk: "none",
    taperingRequired: false
  },

  // PROBIOTICS
  {
    name: "Probiotics",
    brandNames: ["Lactobacillus", "Bifidobacterium"],
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["1", "5", "10", "50"],
    commonUnits: ["billion CFU"],
    commonFrequencies: ["once-daily"],
    description: "Beneficial bacteria for digestive health",
    commonSideEffects: ["gas", "bloating"],
    withdrawalRisk: "none",
    taperingRequired: false
  },

  // HERBAL SUPPLEMENTS
  {
    name: "St. John's Wort",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "low",
    commonDosages: ["300", "450", "600"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "three-times-daily"],
    description: "Herbal supplement traditionally used for mood support",
    commonSideEffects: ["photosensitivity", "drug interactions"],
    commonInteractions: ["antidepressants", "birth control", "blood thinners"],
    withdrawalRisk: "low",
    taperingRequired: true,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 2,
      reductionPercent: 50,
      notes: "Gradual reduction recommended to prevent mood changes."
    },
    psychologicalSupport: {
      adherenceFactors: ["mood support", "natural approach preference"],
      motivationalMessages: [
        "Your herbal supplement supports natural mood balance",
        "Consistent use helps maintain steady herbal benefits"
      ],
      riskTriggers: ["mood changes", "drug interactions"]
    }
  },
  {
    name: "Valerian Root",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "low",
    commonDosages: ["300", "450", "600"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Herbal supplement for sleep and relaxation",
    commonSideEffects: ["drowsiness", "headache", "stomach upset"],
    withdrawalRisk: "low",
    taperingRequired: false,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 1,
      reductionPercent: 50,
      notes: "May cause rebound insomnia if stopped abruptly."
    }
  },
  {
    name: "Ginkgo Biloba",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["40", "60", "120", "240"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Herbal supplement for cognitive support",
    commonSideEffects: ["headache", "dizziness", "stomach upset"],
    commonInteractions: ["blood thinners", "seizure medications"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Ginseng",
    brandNames: ["American Ginseng", "Asian Ginseng", "Panax Ginseng"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["100", "200", "400"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Herbal supplement for energy and immune support",
    commonSideEffects: ["insomnia", "headache", "digestive upset"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Echinacea",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["300", "400", "500"],
    commonUnits: ["mg"],
    commonFrequencies: ["three-times-daily"],
    description: "Herbal supplement for immune support",
    commonSideEffects: ["nausea", "dizziness", "allergic reactions"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Turmeric/Curcumin",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "750", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Anti-inflammatory herbal supplement",
    commonSideEffects: ["stomach upset", "increased bleeding risk"],
    commonInteractions: ["blood thinners", "diabetes medications"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Ashwagandha",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["250", "300", "500", "600"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Adaptogenic herb for stress support",
    commonSideEffects: ["drowsiness", "stomach upset", "diarrhea"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Rhodiola Rosea",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["200", "300", "400"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Adaptogenic herb for stress and fatigue",
    commonSideEffects: ["dizziness", "headache", "insomnia"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Milk Thistle",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["175", "200", "250"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Herbal supplement for liver support",
    commonSideEffects: ["nausea", "diarrhea", "bloating"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Saw Palmetto",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["160", "320"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Herbal supplement for prostate health",
    commonSideEffects: ["stomach upset", "headache", "dizziness"],
    withdrawalRisk: "none",
    taperingRequired: false
  },

  // PLANT-BASED DRUGS AND ETHNOBOTANICALS
  {
    name: "Kratom",
    brandNames: ["Mitragyna speciosa"],
    category: "recreational",
    dependencyRiskCategory: "opioid",
    riskLevel: "high",
    commonDosages: ["1", "2", "4", "7", "12"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki standards)
    commonUnits: ["g"],
    commonFrequencies: ["twice-daily", "three-times-daily", "as-needed"],
    description: "Tropical tree leaf with mu-opioid receptor activity; legal status varies by location. Duration: 2-4 hours onset, 3-6 hours total",
    commonSideEffects: ["nausea", "constipation", "dizziness", "drowsiness", "dependence", "tolerance"],
    commonInteractions: ["opioids", "alcohol", "benzodiazepines", "MAO inhibitors"],
    withdrawalRisk: "high",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 8,
      reductionPercent: 10,
      notes: "Can cause significant withdrawal symptoms including anxiety, muscle aches, and cravings. Use hyperbolic taper: 10% of current dose every 1-2 weeks. Medical supervision recommended."
    },
    psychologicalSupport: {
      adherenceFactors: ["withdrawal avoidance", "pain management", "mood regulation"],
      motivationalMessages: [
        "Start with 1-2g to assess tolerance - kratom potency varies greatly",
        "Rotate strains to prevent tolerance buildup",
        "Take on empty stomach for better effects, with food to reduce nausea",
        "Stay hydrated - kratom can be dehydrating",
        "Take tolerance breaks every few weeks to maintain effectiveness"
      ],
      riskTriggers: ["dose escalation", "multiple daily doses", "using for mood regulation"]
    }
  },
  {
    name: "Kava",
    brandNames: ["Piper methysticum", "Kava Kava"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "moderate",
    commonDosages: ["50", "100", "200", "300"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "as-needed"],
    description: "Pacific Island plant used for anxiety and relaxation",
    commonSideEffects: ["liver toxicity", "skin changes", "drowsiness", "nausea"],
    commonInteractions: ["alcohol", "hepatotoxic drugs", "benzodiazepines"],
    withdrawalRisk: "low",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["anxiety management", "sleep support", "natural preference"],
      motivationalMessages: [
        "Monitor liver function while using kava",
        "Natural anxiety support can be effective when used safely"
      ],
      riskTriggers: ["liver symptoms", "skin changes", "combining with alcohol"]
    }
  },
  {
    name: "Passionflower",
    brandNames: ["Passiflora incarnata"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["250", "500", "750"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Herbal supplement for anxiety and sleep support",
    commonSideEffects: ["drowsiness", "dizziness", "confusion"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Lemon Balm",
    brandNames: ["Melissa officinalis"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["300", "500", "600"],
    commonUnits: ["mg"],
    commonFrequencies: ["twice-daily", "three-times-daily"],
    description: "Calming herb for stress and sleep",
    commonSideEffects: ["drowsiness", "nausea"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Chamomile",
    brandNames: ["Matricaria chamomilla"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["220", "350", "400"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Gentle herb for relaxation and digestive support",
    commonSideEffects: ["allergic reactions", "drowsiness"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Skullcap",
    brandNames: ["Scutellaria lateriflora"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["300", "400", "500"],
    commonUnits: ["mg"],
    commonFrequencies: ["twice-daily", "three-times-daily"],
    description: "Nervine herb for anxiety and nervous tension",
    commonSideEffects: ["drowsiness", "giddiness"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Blue Lotus",
    brandNames: ["Nymphaea caerulea"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "as-needed"],
    description: "Traditional herb for relaxation and dream enhancement",
    commonSideEffects: ["drowsiness", "vivid dreams"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Wild Dagga",
    brandNames: ["Leonotis leonurus"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "as-needed"],
    description: "African herb with mild psychoactive properties",
    commonSideEffects: ["mild euphoria", "relaxation"],
    withdrawalRisk: "none",
    taperingRequired: false
  },

  // AMINO ACIDS AND PROTEINS
  {
    name: "L-Theanine",
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["100", "200", "400"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Amino acid for relaxation and focus",
    commonSideEffects: ["headache", "dizziness"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "5-HTP",
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "low",
    commonDosages: ["50", "100", "200"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Amino acid precursor to serotonin",
    commonSideEffects: ["nausea", "drowsiness", "muscle pain"],
    commonInteractions: ["antidepressants", "carbidopa"],
    withdrawalRisk: "low",
    taperingRequired: false
  },
  {
    name: "GABA",
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["250", "500", "750"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Neurotransmitter supplement for relaxation",
    commonSideEffects: ["drowsiness", "tingling sensation"],
    withdrawalRisk: "none",
    taperingRequired: false
  },

  // MORE PLANT-BASED DRUGS AND NOOTROPICS
  {
    name: "Phenibut",
    category: "recreational",
    dependencyRiskCategory: "benzodiazepine",
    riskLevel: "high",
    commonDosages: ["250", "500", "1000", "1500", "2500"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki)
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "GABA-B agonist with anxiolytic effects; extremely high addiction potential. Duration: 2-4 hours onset, 8-24 hours total",
    commonSideEffects: ["sedation", "tolerance", "dependence", "withdrawal"],
    withdrawalRisk: "severe",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 12,
      reductionPercent: 10,
      notes: "Extremely dangerous withdrawal similar to benzodiazepines. Medical supervision essential. Can cause seizures if stopped abruptly. Use hyperbolic taper: 10% of current dose every 2-3 weeks."
    },
    psychologicalSupport: {
      adherenceFactors: ["anxiety management", "withdrawal fear", "tolerance issues"],
      motivationalMessages: [
        "Use only 1-2x per week maximum to prevent physical dependence",
        "Start with 250-500mg - effects can take 2-4 hours to appear",
        "Never combine with alcohol or other GABAergic substances",
        "Take on empty stomach for consistent effects",
        "If daily use, seek medical help immediately for supervised withdrawal"
      ],
      riskTriggers: ["dose escalation", "daily use", "tolerance development"]
    }
  },
  {
    name: "CBD",
    brandNames: ["Cannabidiol"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["5", "10", "15", "20", "25", "50"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Non-psychoactive cannabinoid for anxiety, pain, and inflammation",
    commonSideEffects: ["fatigue", "diarrhea", "appetite changes"],
    commonInteractions: ["blood thinners", "seizure medications"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Lion's Mane",
    brandNames: ["Hericium erinaceus"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "1000", "1500"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Medicinal mushroom for cognitive support and nerve health",
    commonSideEffects: ["skin rash", "nausea"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Reishi",
    brandNames: ["Ganoderma lucidum"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "1000", "1500"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Adaptogenic mushroom for stress and immune support",
    commonSideEffects: ["dizziness", "skin rash", "upset stomach"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Cordyceps",
    brandNames: ["Cordyceps sinensis", "Cordyceps militaris"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Medicinal mushroom for energy and athletic performance",
    commonSideEffects: ["nausea", "diarrhea"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Bacopa Monnieri",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["300", "600", "900"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Ayurvedic herb for memory and cognitive enhancement",
    commonSideEffects: ["nausea", "cramping", "bloating", "fatigue"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Gotu Kola",
    brandNames: ["Centella asiatica"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["250", "500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["twice-daily"],
    description: "Traditional herb for cognitive function and circulation",
    commonSideEffects: ["headache", "stomach upset", "dizziness"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Mucuna Pruriens",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "low",
    commonDosages: ["500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "L-DOPA containing bean for mood and motor function",
    commonSideEffects: ["nausea", "bloating", "insomnia"],
    commonInteractions: ["MAO inhibitors", "antipsychotics"],
    withdrawalRisk: "low",
    taperingRequired: false
  },

  // ADDITIONAL PRESCRIPTION MEDICATIONS
  {
    name: "Gabapentin",
    brandNames: ["Neurontin"],
    category: "prescription",
    dependencyRiskCategory: "anticonvulsant",
    riskLevel: "moderate",
    commonDosages: ["100", "300", "400", "600", "800"],
    commonUnits: ["mg"],
    commonFrequencies: ["three-times-daily"],
    description: "Anticonvulsant for neuropathic pain and seizures",
    commonSideEffects: ["dizziness", "fatigue", "weight gain", "coordination problems"],
    withdrawalRisk: "moderate",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 6,
      reductionPercent: 10,
      notes: "Reduce gradually using hyperbolic taper to prevent withdrawal seizures and rebound symptoms. 10% of current dose every 1-2 weeks."
    }
  },
  {
    name: "Pregabalin",
    brandNames: ["Lyrica"],
    category: "prescription",
    dependencyRiskCategory: "anticonvulsant",
    riskLevel: "moderate",
    commonDosages: ["25", "50", "75", "100", "150", "225", "300"],
    commonUnits: ["mg"],
    commonFrequencies: ["twice-daily", "three-times-daily"],
    description: "Anticonvulsant for neuropathic pain and anxiety",
    commonSideEffects: ["dizziness", "drowsiness", "weight gain", "blurred vision"],
    withdrawalRisk: "moderate",
    taperingRequired: true,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 2,
      reductionPercent: 25,
      notes: "Gradual reduction recommended to prevent withdrawal symptoms."
    }
  },
  {
    name: "Venlafaxine",
    brandNames: ["Effexor", "Effexor XR"],
    category: "prescription",
    dependencyRiskCategory: "antidepressant",
    riskLevel: "moderate",
    commonDosages: ["37.5", "75", "150", "225"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "SNRI antidepressant for depression and anxiety",
    commonSideEffects: ["nausea", "dizziness", "insomnia", "sweating"],
    withdrawalRisk: "moderate",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 12,
      reductionPercent: 10,
      notes: "Known for severe discontinuation syndrome. Hyperbolic taper essential: 10% of current dose every 2-3 weeks. Consider tapering strips if available."
    }
  },
  {
    name: "Duloxetine",
    brandNames: ["Cymbalta"],
    category: "prescription",
    dependencyRiskCategory: "antidepressant",
    riskLevel: "moderate",
    commonDosages: ["20", "30", "40", "60"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "SNRI antidepressant for depression and pain",
    commonSideEffects: ["nausea", "dry mouth", "constipation", "fatigue"],
    withdrawalRisk: "moderate",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 8,
      reductionPercent: 10,
      notes: "Discontinuation syndrome common. Hyperbolic taper advised: 10% of current dose every 2 weeks."
    }
  },
  {
    name: "Paroxetine",
    brandNames: ["Paxil", "Pexeva"],
    category: "prescription",
    dependencyRiskCategory: "antidepressant",
    riskLevel: "moderate",
    commonDosages: ["10", "20", "30", "40"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "SSRI antidepressant with short half-life",
    commonSideEffects: ["nausea", "drowsiness", "sexual dysfunction", "weight gain"],
    withdrawalRisk: "high",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 16,
      reductionPercent: 5,
      daysBetweenReductions: 21, // 21 days for paroxetine due to notorious withdrawal symptoms
      notes: "Notorious for severe withdrawal. Extremely slow hyperbolic taper required due to short half-life. 5% of current dose every 2-3 weeks. Consider switching to fluoxetine first."
    }
  },

  // SPECIALTY SUPPLEMENTS
  {
    name: "Melatonin",
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["0.5", "1", "3", "5", "10"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Natural hormone for sleep regulation",
    commonSideEffects: ["daytime drowsiness", "headache", "dizziness"],
    withdrawalRisk: "none",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["sleep quality", "natural sleep aid preference"],
      motivationalMessages: [
        "Your melatonin supports natural sleep cycles",
        "Consistent timing helps regulate your sleep-wake cycle"
      ],
      riskTriggers: []
    }
  },
  {
    name: "CoQ10",
    brandNames: ["Coenzyme Q10", "Ubiquinone"],
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["30", "60", "100", "200"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Antioxidant supplement for cellular energy",
    commonSideEffects: ["stomach upset", "loss of appetite"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Glucosamine",
    brandNames: ["Glucosamine Sulfate", "Glucosamine HCl"],
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "750", "1000", "1500"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Joint health supplement",
    commonSideEffects: ["nausea", "heartburn", "diarrhea"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Chondroitin",
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["400", "600", "800", "1200"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Joint health supplement often combined with glucosamine",
    commonSideEffects: ["nausea", "stomach pain", "constipation"],
    withdrawalRisk: "none",
    taperingRequired: false
  },

  // MORE NOOTROPICS AND COGNITIVE ENHANCERS
  {
    name: "Modafinil",
    brandNames: ["Provigil"],
    category: "prescription",
    dependencyRiskCategory: "stimulant",
    riskLevel: "moderate",
    commonDosages: ["100", "200"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Wakefulness-promoting agent for narcolepsy and shift work",
    commonSideEffects: ["headache", "nausea", "nervousness", "insomnia"],
    withdrawalRisk: "low",
    taperingRequired: false
  },
  {
    name: "Piracetam",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["800", "1200", "1600"],
    commonUnits: ["mg"],
    commonFrequencies: ["twice-daily", "three-times-daily"],
    description: "Original nootropic compound for cognitive enhancement",
    commonSideEffects: ["nervousness", "insomnia", "depression"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Alpha-GPC",
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["300", "600"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Choline compound for cognitive function and acetylcholine",
    commonSideEffects: ["heartburn", "headache", "insomnia"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Huperzine A",
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["50", "100", "200"],
    commonUnits: ["mcg"],
    commonFrequencies: ["once-daily"],
    description: "Alkaloid from Chinese club moss for memory enhancement",
    commonSideEffects: ["nausea", "diarrhea", "vomiting"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Phosphatidylserine",
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["100", "200", "300"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Phospholipid for brain health and cognitive function",
    commonSideEffects: ["insomnia", "stomach upset"],
    withdrawalRisk: "none",
    taperingRequired: false
  },

  // TRADITIONAL ADAPTOGENS AND HERBS
  {
    name: "Holy Basil",
    brandNames: ["Ocimum sanctum", "Tulsi"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["300", "500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["twice-daily"],
    description: "Sacred herb for stress reduction and immune support",
    commonSideEffects: ["blood sugar changes", "bleeding risk"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Schisandra",
    brandNames: ["Schisandra chinensis"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Traditional Chinese herb for liver health and adaptation",
    commonSideEffects: ["heartburn", "stomach upset", "decreased appetite"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Eleuthero",
    brandNames: ["Eleutherococcus senticosus", "Siberian Ginseng"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["300", "400", "500"],
    commonUnits: ["mg"],
    commonFrequencies: ["twice-daily"],
    description: "Adaptogenic herb for energy and stress resistance",
    commonSideEffects: ["insomnia", "irritability", "melancholy"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "He Shou Wu",
    brandNames: ["Polygonum multiflorum", "Fo-Ti"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "low",
    commonDosages: ["500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Traditional Chinese herb for longevity and hair health",
    commonSideEffects: ["liver toxicity", "diarrhea", "nausea"],
    commonInteractions: ["hepatotoxic drugs"],
    withdrawalRisk: "none",
    taperingRequired: false
  },

  // MORE PRESCRIPTION MEDICATIONS
  {
    name: "Bupropion",
    brandNames: ["Wellbutrin", "Zyban"],
    category: "prescription",
    dependencyRiskCategory: "antidepressant",
    riskLevel: "low",
    commonDosages: ["75", "100", "150", "300"],
    commonUnits: ["mg"],
    commonFrequencies: ["twice-daily"],
    description: "Atypical antidepressant and smoking cessation aid",
    commonSideEffects: ["dry mouth", "insomnia", "headache", "nausea"],
    withdrawalRisk: "low",
    taperingRequired: false
  },
  {
    name: "Mirtazapine",
    brandNames: ["Remeron"],
    category: "prescription",
    dependencyRiskCategory: "antidepressant",
    riskLevel: "low",
    commonDosages: ["15", "30", "45"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Tetracyclic antidepressant with sedating properties",
    commonSideEffects: ["sedation", "weight gain", "increased appetite"],
    withdrawalRisk: "moderate",
    taperingRequired: true,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 3,
      reductionPercent: 33,
      notes: "Gradual reduction recommended to prevent rebound insomnia and flu-like symptoms."
    }
  },
  {
    name: "Quetiapine",
    brandNames: ["Seroquel"],
    category: "prescription",
    dependencyRiskCategory: "low-risk",
    riskLevel: "moderate",
    commonDosages: ["25", "50", "100", "200", "300", "400"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "twice-daily"],
    description: "Atypical antipsychotic for schizophrenia and bipolar disorder",
    commonSideEffects: ["sedation", "weight gain", "metabolic changes"],
    withdrawalRisk: "moderate",
    taperingRequired: true,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 6,
      reductionPercent: 25,
      notes: "Slow taper required to prevent rebound psychosis and withdrawal symptoms."
    }
  },

  // PLANT-BASED PSYCHOACTIVES (Educational purposes)
  {
    name: "Damiana",
    brandNames: ["Turnera diffusa"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["400", "800"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily", "as-needed"],
    description: "Traditional herb for mood and sexual health",
    commonSideEffects: ["mild euphoria", "relaxation"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Calea Zacatechichi",
    brandNames: ["Dream Herb"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Traditional Mexican herb for dream enhancement",
    commonSideEffects: ["vivid dreams", "nausea", "bitter taste"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Mulungu",
    brandNames: ["Erythrina mulungu"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Brazilian tree bark for anxiety and sleep",
    commonSideEffects: ["sedation", "muscle relaxation"],
    withdrawalRisk: "none",
    taperingRequired: false
  },

  // RECREATIONAL DRUGS & HARM REDUCTION
  {
    name: "Alcohol",
    brandNames: ["Ethanol", "Beer", "Wine", "Spirits"],
    category: "recreational",
    dependencyRiskCategory: "alcohol",
    riskLevel: "high",
    commonDosages: ["1", "2", "3", "4", "5"], // Standard drinks
    commonUnits: ["drinks"],
    commonFrequencies: ["as-needed", "daily", "weekly"],
    description: "Legal recreational depressant; high addiction potential with severe withdrawal risk",
    commonSideEffects: ["impaired coordination", "memory loss", "liver damage", "dehydration", "hangover"],
    commonInteractions: ["all medications", "benzodiazepines", "opioids", "acetaminophen", "antihistamines"],
    withdrawalRisk: "severe",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 4,
      reductionPercent: 25,
      notes: "Alcohol withdrawal can be life-threatening. Seek medical supervision for detox. Never stop suddenly if drinking daily. Use naltrexone or other medications under medical guidance."
    },
    psychologicalSupport: {
      adherenceFactors: ["social situations", "stress relief", "habit patterns"],
      motivationalMessages: [
        "Track your drinking to understand patterns and reduce harm",
        "Consider alcohol-free days to reset tolerance",
        "Hydrate between drinks and eat before drinking"
      ],
      riskTriggers: ["daily use", "binge drinking", "blackouts", "withdrawal symptoms"]
    }
  },
  {
    name: "Cannabis",
    brandNames: ["Marijuana", "THC", "CBD", "Weed"],
    category: "recreational",
    dependencyRiskCategory: "low-risk",
    riskLevel: "low",
    commonDosages: ["0.25", "0.5", "1", "2.5", "5", "10", "25", "50"],
    commonUnits: ["mg THC", "mg CBD", "grams", "ounces"],
    commonFrequencies: ["as-needed", "daily", "weekly"],
    description: "Cannabis with THC and CBD; legal status varies by location",
    commonSideEffects: ["euphoria", "dry mouth", "red eyes", "increased appetite", "anxiety", "paranoia"],
    commonInteractions: ["alcohol", "benzodiazepines", "blood thinners"],
    withdrawalRisk: "low",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["pain management", "anxiety relief", "recreational use"],
      motivationalMessages: [
        "Start low and go slow with edibles - effects can take 2+ hours",
        "Choose strains with balanced THC/CBD ratios for less anxiety",
        "Consider taking tolerance breaks to maintain effectiveness"
      ],
      riskTriggers: ["daily use", "high-potency products", "synthetic cannabinoids"]
    }
  },
  {
    name: "Psilocybin",
    brandNames: ["Magic Mushrooms", "Psilocybe", "Shrooms"],
    category: "recreational",
    dependencyRiskCategory: "low-risk",
    riskLevel: "moderate",
    commonDosages: ["0.1", "0.25", "1", "2.5", "5"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki standards)
    commonUnits: ["grams"],
    commonFrequencies: ["as-needed"],
    description: "Psychedelic compound found in certain mushrooms; illegal in most jurisdictions",
    commonSideEffects: ["visual/auditory hallucinations", "altered perception", "nausea", "anxiety", "confusion"],
    commonInteractions: ["MAOIs", "lithium", "antidepressants"],
    withdrawalRisk: "none",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["set and setting", "experience level", "mental state"],
      motivationalMessages: [
        "Start with 0.25g or less to assess sensitivity",
        "Set: Good mindset. Setting: Safe environment with trusted people",
        "Have a sober trip sitter for doses >1g",
        "Wait 2+ weeks between sessions for tolerance reset",
        "Avoid if you have mental health issues or are on SSRIs"
      ],
      riskTriggers: ["frequent use", "high doses", "unsafe environments", "mental health issues"]
    }
  },
  {
    name: "LSD",
    brandNames: ["Acid", "Lucy", "L"],
    category: "recreational",
    dependencyRiskCategory: "low-risk",
    riskLevel: "moderate",
    commonDosages: ["15", "50", "100", "200", "400"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki standards)
    commonUnits: ["mcg"],
    commonFrequencies: ["as-needed"],
    description: "Synthetic psychedelic; illegal in most jurisdictions",
    commonSideEffects: ["visual/auditory hallucinations", "altered perception", "increased heart rate", "anxiety"],
    commonInteractions: ["MAOIs", "lithium", "antidepressants"],
    withdrawalRisk: "none",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["set and setting", "experience level", "mental state"],
      motivationalMessages: [
        "Always test with Ehrlich reagent - never take untested tabs",
        "Start with 50mcg or less for first time",
        "Clear your schedule for 12+ hours minimum",
        "Wait 2+ weeks between sessions for tolerance reset",
        "Avoid if you're on psychiatric medications"
      ],
      riskTriggers: ["frequent use", "unknown dosage", "unsafe environments", "mental health issues"]
    }
  },
  {
    name: "MDMA",
    brandNames: ["Ecstasy", "Molly", "E"],
    category: "recreational",
    dependencyRiskCategory: "stimulant",
    riskLevel: "high",
    commonDosages: ["40", "75", "125", "180", "300"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki standards)
    commonUnits: ["mg"],
    commonFrequencies: ["as-needed"],
    description: "Empathogenic stimulant; illegal in most jurisdictions",
    commonSideEffects: ["euphoria", "increased empathy", "jaw clenching", "dehydration", "hyperthermia"],
    commonInteractions: ["MAOIs", "SSRIs", "alcohol", "stimulants"],
    withdrawalRisk: "moderate",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["therapeutic contexts", "social events", "emotional processing"],
      motivationalMessages: [
        "Test with Marquis, Mecke, and Simon's reagents",
        "Take 3+ month breaks to prevent neurotoxicity",
        "Stay cool and hydrated - sip water, don't chug",
        "Pre-load: Vitamin C, Magnesium. Post-load: 5-HTP (after 24h)",
        "Avoid redosing - it increases neurotoxicity without enhancing effects"
      ],
      riskTriggers: ["frequent use", "high doses", "hot environments", "polydrug use"]
    }
  },
  {
    name: "Cocaine",
    brandNames: ["Coke", "Blow", "Snow"],
    category: "recreational",
    dependencyRiskCategory: "stimulant",
    riskLevel: "high",
    commonDosages: ["10", "30", "60", "90", "150"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki)
    commonUnits: ["mg"],
    commonFrequencies: ["as-needed"],
    description: "Powerful stimulant with dopamine reuptake inhibition; illegal in most countries. Duration: 15-30min onset, 1-2 hours total",
    commonSideEffects: ["euphoria", "increased energy", "paranoia", "heart palpitations", "nose damage"],
    commonInteractions: ["alcohol", "MAOIs", "heart medications", "blood pressure medications"],
    withdrawalRisk: "moderate",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["energy boost", "confidence", "social situations"],
      motivationalMessages: [
        "Test every batch with fentanyl strips - contamination is common",
        "Never mix with alcohol - creates cardiotoxic cocaethylene",
        "Start with small bumps (10-20mg) and wait 30min between doses",
        "Have someone monitor you for cardiac symptoms",
        "Avoid daily use - highly psychologically addictive",
        "Use nasal spray/saline to reduce nasal damage"
      ],
      riskTriggers: ["binge use", "mixing with depressants", "frequent use", "injection use"]
    }
  },
  {
    name: "LSD",
    brandNames: ["Acid", "Lucy", "Tabs"],
    category: "recreational",
    dependencyRiskCategory: "low-risk",
    riskLevel: "moderate",
    commonDosages: ["25", "50", "100", "200"],
    commonUnits: ["mcg"],
    commonFrequencies: ["as-needed"],
    description: "Psychedelic compound; illegal in most jurisdictions",
    commonSideEffects: ["visual hallucinations", "altered perception", "anxiety", "confusion", "flashbacks"],
    commonInteractions: ["SSRIs", "MAOIs", "lithium", "tramadol"],
    withdrawalRisk: "none",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["therapeutic exploration", "spiritual experiences", "creativity"],
      motivationalMessages: [
        "Test your tabs - many contain NBOMe or other dangerous substances",
        "Use in a safe, comfortable environment with a trusted trip sitter",
        "Start with low doses - you can always take more next time",
        "Avoid if you have history of psychosis or are on psychiatric medications"
      ],
      riskTriggers: ["high doses", "unsafe settings", "mental health issues", "frequent use"]
    }
  },
  {
    name: "Psilocybin",
    brandNames: ["Magic Mushrooms", "Shrooms", "Mushrooms"],
    category: "herbal",
    dependencyRiskCategory: "low-risk",
    riskLevel: "moderate",
    commonDosages: ["0.5", "1", "2", "3.5"],
    commonUnits: ["g"],
    commonFrequencies: ["as-needed"],
    description: "Psychedelic mushrooms; legal status varies by location",
    commonSideEffects: ["visual hallucinations", "altered perception", "nausea", "anxiety", "spiritual experiences"],
    commonInteractions: ["SSRIs", "MAOIs", "lithium"],
    withdrawalRisk: "none",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["therapeutic use", "spiritual exploration", "personal growth"],
      motivationalMessages: [
        "Know your mushroom species - misidentification can be fatal",
        "Start with 0.5-1g to assess potency and sensitivity",
        "Fast 4-6 hours before use to reduce nausea",
        "Have a trip sitter present, especially for higher doses"
      ],
      riskTriggers: ["misidentified species", "high doses", "unsafe settings", "mental health conditions"]
    }
  },
  {
    name: "Ketamine",
    brandNames: ["K", "Special K", "Ket"],
    category: "recreational",
    dependencyRiskCategory: "dissociative",
    riskLevel: "high",
    commonDosages: ["15", "30", "75", "150", "300"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki)
    commonUnits: ["mg"],
    commonFrequencies: ["as-needed"],
    description: "NMDA receptor antagonist dissociative; medical anesthetic with recreational use. Duration: 15-30min onset, 1-3 hours total",
    commonSideEffects: ["dissociation", "nausea", "confusion", "bladder damage", "tolerance"],
    commonInteractions: ["alcohol", "benzodiazepines", "opioids", "stimulants"],
    withdrawalRisk: "moderate",
    taperingRequired: true,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 2,
      reductionPercent: 50,
      notes: "Ketamine can cause rapid tolerance and bladder damage. Seek medical guidance for therapeutic use."
    },
    psychologicalSupport: {
      adherenceFactors: ["depression treatment", "dissociative experiences", "pain management"],
      motivationalMessages: [
        "Use pharmaceutical grade when possible - street ketamine often adulterated",
        "Start with 15-30mg to assess sensitivity",
        "Never use alone - dissociation makes you vulnerable",
        "Limit to once per week maximum to prevent bladder damage",
        "Test with reagents - 2F-DCK and other analogs are common",
        "Stay hydrated but avoid excessive water intake"
      ],
      riskTriggers: ["daily use", "high doses", "bladder pain", "tolerance escalation"]
    }
  },
  {
    name: "DMT",
    brandNames: ["Dimethyltryptamine", "Deems", "The Spirit Molecule"],
    category: "recreational",
    dependencyRiskCategory: "low-risk",
    riskLevel: "moderate",
    commonDosages: ["10", "20", "30", "50", "80"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki)
    commonUnits: ["mg"],
    commonFrequencies: ["as-needed"],
    description: "Endogenous tryptamine psychedelic; short duration breakthrough experiences. Duration: Instant onset, 5-15min total (smoked)",
    commonSideEffects: ["intense hallucinations", "out-of-body experiences", "anxiety", "rapid heart rate"],
    commonInteractions: ["MAOIs", "SSRIs", "heart medications"],
    withdrawalRisk: "none",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["spiritual exploration", "intense experiences", "breakthrough experiences"],
      motivationalMessages: [
        "DMT experiences are extremely intense but brief (5-15 minutes)",
        "Use proper vaporization technique - don't burn the substance",
        "Have an experienced sitter present for safety",
        "Approach with respect and proper set/setting preparation"
      ],
      riskTriggers: ["heart conditions", "anxiety disorders", "improper administration", "unsafe settings"]
    }
  },
  {
    name: "Amphetamine",
    brandNames: ["Speed", "Amp", "Dextroamphetamine"],
    category: "recreational",
    dependencyRiskCategory: "stimulant",
    riskLevel: "high",
    commonDosages: ["5", "15", "30", "50", "80"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki)
    commonUnits: ["mg"],
    commonFrequencies: ["as-needed"],
    description: "CNS stimulant with dopamine/norepinephrine activity; illegal when unprescribed. Duration: 30-60min onset, 4-8 hours total",
    commonSideEffects: ["increased energy", "decreased appetite", "insomnia", "anxiety", "paranoia"],
    commonInteractions: ["MAOIs", "heart medications", "blood pressure medications"],
    withdrawalRisk: "moderate",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["productivity", "weight loss", "energy boost"],
      motivationalMessages: [
        "Test substance purity - street speed often contains caffeine or worse",
        "Start with 10-15mg oral to assess tolerance",
        "Stay hydrated and force yourself to eat regularly",
        "Avoid redosing - comedown leads to compulsive redosing cycle",
        "Monitor heart rate and blood pressure",
        "Take magnesium to reduce jaw clenching and muscle tension"
      ],
      riskTriggers: ["binge use", "injection use", "sleep deprivation", "paranoid thoughts"]
    }
  },
  {
    name: "Methamphetamine",
    brandNames: ["Crystal Meth", "Ice", "Glass"],
    category: "recreational",
    dependencyRiskCategory: "stimulant",
    riskLevel: "high",
    commonDosages: ["5", "15", "30", "50", "100"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki)
    commonUnits: ["mg"],
    commonFrequencies: ["as-needed"],
    description: "Highly neurotoxic amphetamine with extreme addiction potential; illegal. Duration: 30min-2h onset, 8-24 hours total",
    commonSideEffects: ["extreme euphoria", "hyperfocus", "paranoia", "psychosis", "dental problems"],
    commonInteractions: ["all medications", "MAOIs", "heart medications"],
    withdrawalRisk: "severe",
    taperingRequired: true,
    taperingRecommendations: {
      method: "linear",
      durationWeeks: 4,
      reductionPercent: 25,
      notes: "Methamphetamine withdrawal can cause severe depression and suicidal thoughts. Professional support strongly recommended."
    },
    psychologicalSupport: {
      adherenceFactors: ["extreme stimulation", "productivity", "euphoria"],
      motivationalMessages: [
        "Seek immediate professional help - meth is extremely addictive",
        "Never inject - extreme risk of HIV, hepatitis, abscesses",
        "Start extremely low (5mg) - purity varies drastically",
        "Maintain oral hygiene obsessively - meth mouth is severe",
        "Monitor for psychosis, paranoia, hyperthermia",
        "Stay hydrated and force yourself to eat regularly"
      ],
      riskTriggers: ["injection use", "binge use", "psychotic symptoms", "dental problems"]
    }
  },
  {
    name: "2C-B",
    brandNames: ["Nexus", "2C-B-FLY", "Bees"],
    category: "recreational",
    dependencyRiskCategory: "low-risk",
    riskLevel: "moderate",
    commonDosages: ["5", "12", "18", "25", "35"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki)
    commonUnits: ["mg"],
    commonFrequencies: ["as-needed"],
    description: "Phenethylamine psychedelic with visual and empathogenic effects. Duration: 30-90min onset, 4-8 hours total",
    commonSideEffects: ["visual hallucinations", "enhanced emotions", "nausea", "body load", "jaw tension"],
    commonInteractions: ["MAOIs", "lithium", "antidepressants"],
    withdrawalRisk: "none",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["visual experiences", "emotional enhancement", "creativity"],
      motivationalMessages: [
        "Test with reagents - 25x-NBOMe series is dangerous and common adulterant",
        "Start with 10-12mg for first time - dose-response curve is steep",
        "Take on empty stomach, eat small snack if nausea occurs",
        "Set timer - easy to lose track of time during experience",
        "Stay hydrated but avoid excessive water intake",
        "Wait 2+ weeks between uses for tolerance reset"
      ],
      riskTriggers: ["frequent use", "high doses", "unknown substance", "mental health issues"]
    }
  },
  {
    name: "4-AcO-DMT",
    brandNames: ["Psilacetin", "O-Acetylpsilocin"],
    category: "recreational",
    dependencyRiskCategory: "low-risk",
    riskLevel: "moderate",
    commonDosages: ["5", "10", "20", "35", "50"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki)
    commonUnits: ["mg"],
    commonFrequencies: ["as-needed"],
    description: "Synthetic psilocin analog; very similar effects to psilocybin mushrooms. Duration: 30-90min onset, 4-8 hours total",
    commonSideEffects: ["visual hallucinations", "altered perception", "nausea", "anxiety", "confusion"],
    commonInteractions: ["MAOIs", "lithium", "antidepressants"],
    withdrawalRisk: "none",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["spiritual exploration", "therapeutic experiences", "introspection"],
      motivationalMessages: [
        "Start with 10-15mg - more potent than expected",
        "Prepare for nausea during come-up - ginger can help",
        "Use accurate milligram scale - small dose differences matter",
        "Have trip sitter for doses above 20mg",
        "Clear schedule for 6-8 hours minimum",
        "Avoid if you have mental health conditions or take SSRIs"
      ],
      riskTriggers: ["frequent use", "high doses", "unsafe environments", "mental health issues"]
    }
  },
  {
    name: "GHB",
    brandNames: ["Gamma-Hydroxybutyrate", "G", "Liquid Ecstasy"],
    category: "recreational",
    dependencyRiskCategory: "benzodiazepine",
    riskLevel: "high",
    commonDosages: ["0.5", "1", "2", "3", "4"], // Threshold, Light, Common, Strong, Heavy (psychonaut wiki)
    commonUnits: ["g"],
    commonFrequencies: ["as-needed"],
    description: "GABA-B agonist depressant; extremely dangerous dose-response curve. Duration: 15-45min onset, 2-4 hours total",
    commonSideEffects: ["euphoria", "sedation", "dizziness", "nausea", "unconsciousness"],
    commonInteractions: ["alcohol", "benzodiazepines", "opioids", "all depressants"],
    withdrawalRisk: "severe",
    taperingRequired: true,
    taperingRecommendations: {
      method: "hyperbolic",
      durationWeeks: 6,
      reductionPercent: 10,
      notes: "GHB withdrawal can be life-threatening with seizures. Medical supervision absolutely essential. Never stop abruptly."
    },
    psychologicalSupport: {
      adherenceFactors: ["euphoria", "social disinhibition", "sexual enhancement"],
      motivationalMessages: [
        "NEVER mix with alcohol or other depressants - can be fatal",
        "Use oral syringe for accurate dosing - overdose margin is small",
        "Start with 0.5-1g maximum and wait 2+ hours before redosing",
        "Have sober person present - overdose causes unconsciousness",
        "Keep exact timing log - easy to forget previous doses",
        "Seek immediate medical help if daily use develops"
      ],
      riskTriggers: ["alcohol combination", "frequent redosing", "daily use", "unknown concentration"]
    }
  },
  {
    name: "Nitrous Oxide",
    brandNames: ["N2O", "Laughing Gas", "Whippits", "Nangs"],
    category: "recreational",
    dependencyRiskCategory: "low-risk",
    riskLevel: "moderate",
    commonDosages: ["1", "2", "4", "8", "12"], // cartridges - psychonaut wiki standard
    commonUnits: ["cartridges"],
    commonFrequencies: ["as-needed"],
    description: "NMDA receptor antagonist; short-acting dissociative gas. Duration: Immediate onset, 1-5 minutes total",
    commonSideEffects: ["euphoria", "dissociation", "vitamin B12 depletion", "dizziness", "hypoxia"],
    commonInteractions: ["oxygen deprivation risk with all substances"],
    withdrawalRisk: "low",
    taperingRequired: false,
    psychologicalSupport: {
      adherenceFactors: ["short duration", "ease of access", "social use"],
      motivationalMessages: [
        "Always use with adequate oxygen - hypoxia can cause brain damage",
        "Sit down before use - falling is common cause of injury",
        "Take vitamin B12 supplements if using regularly",
        "Use balloon or dispenser - never inhale directly from cartridge",
        "Wait several minutes between uses to reoxygenate",
        "Avoid daily use - B12 depletion causes nerve damage"
      ],
      riskTriggers: ["daily use", "direct inhalation", "standing use", "oxygen deprivation"]
    }
  },

  // ADDITIONAL SUPPLEMENTS
  {
    name: "NAD+",
    brandNames: ["Nicotinamide Adenine Dinucleotide"],
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["250", "500"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Cellular energy coenzyme for longevity and metabolism",
    commonSideEffects: ["nausea", "fatigue", "headache"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "NMN",
    brandNames: ["Nicotinamide Mononucleotide"],
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["250", "500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "NAD+ precursor for cellular health and aging",
    commonSideEffects: ["nausea", "flushing"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Resveratrol",
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["100", "250", "500"],
    commonUnits: ["mg"],
    commonFrequencies: ["once-daily"],
    description: "Polyphenol antioxidant for longevity and cardiovascular health",
    commonSideEffects: ["nausea", "diarrhea", "skin rash"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Quercetin",
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["250", "500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["twice-daily"],
    description: "Flavonoid with anti-inflammatory and antioxidant properties",
    commonSideEffects: ["headache", "nausea"],
    withdrawalRisk: "none",
    taperingRequired: false
  },
  {
    name: "Berberine",
    category: "supplement",
    dependencyRiskCategory: "low-risk",
    riskLevel: "minimal",
    commonDosages: ["500", "1000"],
    commonUnits: ["mg"],
    commonFrequencies: ["twice-daily"],
    description: "Plant alkaloid for blood sugar and metabolic health",
    commonSideEffects: ["diarrhea", "constipation", "gas"],
    commonInteractions: ["diabetes medications", "blood thinners"],
    withdrawalRisk: "none",
    taperingRequired: false
  }
];

// Search and filtering functions
export function searchMedicationDatabase(query: string): MedicationDatabaseEntry[] {
  if (!query.trim()) return MEDICATION_DATABASE;
  
  const searchTerm = query.toLowerCase();
  return MEDICATION_DATABASE.filter(med => 
    med.name.toLowerCase().includes(searchTerm) ||
    med.genericName?.toLowerCase().includes(searchTerm) ||
    med.brandNames?.some(brand => brand.toLowerCase().includes(searchTerm)) ||
    med.description?.toLowerCase().includes(searchTerm)
  );
}

export function getMedicationsByCategory(category: MedicationCategory): MedicationDatabaseEntry[] {
  return MEDICATION_DATABASE.filter(med => med.category === category);
}

export function getMedicationsByRisk(riskLevel: RiskLevel): MedicationDatabaseEntry[] {
  return MEDICATION_DATABASE.filter(med => med.riskLevel === riskLevel);
}

export function getMedicationsRequiringTapering(): MedicationDatabaseEntry[] {
  return MEDICATION_DATABASE.filter(med => med.taperingRequired);
}

export function getMedicationByName(name: string): MedicationDatabaseEntry | undefined {
  const searchName = name.toLowerCase();
  return MEDICATION_DATABASE.find(med => 
    med.name.toLowerCase() === searchName ||
    med.genericName?.toLowerCase() === searchName ||
    med.brandNames?.some(brand => brand.toLowerCase() === searchName)
  );
}

export function generateTaperingPlan(medicationName: string, currentDose: number, currentUnit: string) {
  const medication = getMedicationByName(medicationName);
  
  if (!medication?.taperingRequired || !medication.taperingRecommendations) {
    return null;
  }
  
  const tapering = medication.taperingRecommendations;
  const totalDays = tapering.durationWeeks * 7;
  const steps: Array<{day: number, dose: number, notes: string}> = [];
  
  // Add initial dose as first step
  steps.push({
    day: 0,
    dose: currentDose,
    notes: `Day 0: Starting dose ${currentDose} ${currentUnit}`
  });
  
  if (tapering.method === 'linear') {
    // Linearly reduce from currentDose to 0 over the duration
    
    for (let week = 1; week <= tapering.durationWeeks; week++) {
      const progress = week / tapering.durationWeeks;
      const newDose = Math.max(0, currentDose * (1 - progress));
      steps.push({
        day: week * 7,
        dose: Math.round(newDose * 1000) / 1000,
        notes: `Week ${week}: Reduce to ${Math.round(newDose * 1000) / 1000} ${currentUnit}`
      });
    }
  } else if (tapering.method === 'exponential') {
    // Front-loaded reductions that reach 0 at the end. Use reductionPercent to tune aggressiveness.
    
    const aggressiveness = Math.max(1.2, Math.min(3.0, tapering.reductionPercent / 15));
    for (let week = 1; week <= tapering.durationWeeks; week++) {
      const progress = week / tapering.durationWeeks;
      const exponentialProgress = 1 - Math.pow(1 - progress, aggressiveness);
      const newDose = Math.max(0, currentDose * (1 - exponentialProgress));
      steps.push({
        day: week * 7,
        dose: Math.round(newDose * 1000) / 1000,
        notes: `Week ${week}: Reduce to ${Math.round(newDose * 1000) / 1000} ${currentUnit}`
      });
    }
  } else if (tapering.method === 'hyperbolic') {
    // Hyperbolic tapering: reduce by percentage of current dose each step
    let currentStepDose = currentDose;
    const reductionFactor = tapering.reductionPercent / 100;
    const stepsPerWeek = medication.dependencyRiskCategory === 'benzodiazepine' ? 0.5 : 1; // Slower for benzos
    const daysBetween = Math.round(7 / stepsPerWeek);
    
    let stepCount = 0;
    let currentDay = 0;
    
    // Continue until we reach zero
    while (currentStepDose > 0) {
      stepCount++;
      currentDay = stepCount * daysBetween;
      
      // Use smaller reductions when dose gets very low
      let adjustedReductionFactor = reductionFactor;
      if (currentStepDose < 1) {
        adjustedReductionFactor = reductionFactor / 2;
      }
      if (currentStepDose < 0.1) {
        adjustedReductionFactor = reductionFactor / 4;
      }
      
      currentStepDose = currentStepDose * (1 - adjustedReductionFactor);
      
      // Round based on dose size
      if (currentStepDose >= 1) {
        currentStepDose = Math.round(currentStepDose * 100) / 100;
      } else if (currentStepDose >= 0.1) {
        currentStepDose = Math.round(currentStepDose * 1000) / 1000;
      } else {
        currentStepDose = Math.round(currentStepDose * 10000) / 10000;
      }
      
      // When dose gets extremely small, go to zero
      if (currentStepDose < 0.001) {
        steps.push({
          day: currentDay,
          dose: 0,
          notes: `Day ${currentDay}: Complete discontinuation`
        });
        break;
      } else {
        const actualReduction = adjustedReductionFactor * 100;
        steps.push({
          day: currentDay,
          dose: currentStepDose,
          notes: `Day ${currentDay}: Reduce to ${currentStepDose} ${currentUnit} (${Math.round(actualReduction * 10) / 10}% reduction from previous)`
        });
      }
      
      // Safety check to prevent infinite loops
      if (stepCount > 100) break;
    }
  }
  
  
  // Enhanced warnings based on medication type and risk level
  const baseWarnings = [
    "Consult with your healthcare provider before starting any tapering schedule",
    "Monitor for withdrawal symptoms and adjust pace if necessary", 
    "Never stop abruptly if experiencing severe withdrawal symptoms"
  ];
  
  const riskSpecificWarnings = [];
  if (medication.dependencyRiskCategory === 'benzodiazepine') {
    riskSpecificWarnings.push(
      "Risk of seizures - medical supervision essential",
      "Consider switching to longer-acting benzodiazepine first",
      "Be prepared to pause or slow the taper if withdrawal symptoms are severe"
    );
  }
  if (medication.dependencyRiskCategory === 'opioid') {
    riskSpecificWarnings.push(
      "Monitor for pain flares and have backup pain management plan",
      "Watch for signs of psychological distress during taper"
    );
  }
  if (medication.dependencyRiskCategory === 'antidepressant') {
    riskSpecificWarnings.push(
      "Monitor mood carefully during taper",
      "Consider postponing taper during times of high stress",
      "Discontinuation syndrome can mimic flu-like symptoms"
    );
  }
  
  return {
    medicationName: medication.name,
    method: tapering.method,
    totalDuration: totalDays,
    steps,
    warnings: [
      ...baseWarnings,
      ...riskSpecificWarnings,
      ...(tapering.notes ? [tapering.notes] : [])
    ],
    riskLevel: medication.withdrawalRisk,
    canPause: true, // All modern tapering schedules should allow pausing
    flexibilityNotes: "This schedule can be paused or slowed at any point if withdrawal symptoms become problematic. Patient comfort and safety should always take priority over adherence to timeline."
  };
}

// Intelligent tapering recommendation based on user history and medication factors
export function generateIntelligentTaperingRecommendation(
  medicationName: string, 
  currentDose: number, 
  currentUnit: string,
  userMedication: any // The user's medication object with history
): any {
  const medication = getMedicationByName(medicationName);
  
  if (!medication?.taperingRequired || !medication.taperingRecommendations) {
    return null;
  }

  // Calculate how long the user has been taking this medication
  const startDate = new Date(userMedication.startDate);
  const currentDate = new Date();
  const monthsOnMedication = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  
  // Base tapering recommendations
  const baseTapering = { ...medication.taperingRecommendations };
  
  // Adjust duration based on usage history
  let adjustedDurationWeeks = baseTapering.durationWeeks;
  let adjustedReductionPercent = baseTapering.reductionPercent;
  let suggestedMethod = baseTapering.method;
  
  // History-based adjustments
  if (monthsOnMedication >= 12) {
    // Long-term use (1+ years) - much slower taper
    adjustedDurationWeeks = Math.ceil(adjustedDurationWeeks * 1.5);
    adjustedReductionPercent = Math.max(5, adjustedReductionPercent * 0.7);
  } else if (monthsOnMedication >= 6) {
    // Medium-term use (6+ months) - slower taper
    adjustedDurationWeeks = Math.ceil(adjustedDurationWeeks * 1.3);
    adjustedReductionPercent = Math.max(5, adjustedReductionPercent * 0.8);
  } else if (monthsOnMedication >= 3) {
    // Short-medium term use (3+ months) - slightly slower
    adjustedDurationWeeks = Math.ceil(adjustedDurationWeeks * 1.1);
  }
  
  // Dose-based adjustments - higher doses need slower tapers
  const averageDose = medication.commonDosages.length > 0 ? 
    medication.commonDosages.reduce((sum, dose) => sum + parseFloat(dose), 0) / medication.commonDosages.length : 
    currentDose;
  
  if (currentDose > averageDose * 1.5) {
    // High dose - slower taper
    adjustedDurationWeeks = Math.ceil(adjustedDurationWeeks * 1.2);
    adjustedReductionPercent = Math.max(5, adjustedReductionPercent * 0.9);
  }
  
  // Risk category specific adjustments
  if (medication.dependencyRiskCategory === 'benzodiazepine') {
    // Always use hyperbolic for benzos
    suggestedMethod = 'hyperbolic';
    // Extra safety for benzos
    if (monthsOnMedication >= 6) {
      adjustedDurationWeeks = Math.ceil(adjustedDurationWeeks * 1.3);
      adjustedReductionPercent = Math.min(adjustedReductionPercent, 10);
    }
  } else if (medication.dependencyRiskCategory === 'antidepressant' && 
             (medication.name.toLowerCase().includes('paroxetine') || 
              medication.name.toLowerCase().includes('venlafaxine'))) {
    // Extra slow for notorious withdrawal medications
    suggestedMethod = 'hyperbolic';
    adjustedReductionPercent = Math.min(adjustedReductionPercent, 5);
  }
  
  return {
    originalPlan: baseTapering,
    adjustedPlan: {
      method: suggestedMethod,
      durationWeeks: adjustedDurationWeeks,
      reductionPercent: adjustedReductionPercent,
      notes: baseTapering.notes
    },
    adjustmentReasons: [
      monthsOnMedication >= 12 ? `Extended taper recommended: You've been taking ${medicationName} for ${monthsOnMedication} months` :
      monthsOnMedication >= 6 ? `Slower taper suggested: ${monthsOnMedication} months of use requires more gradual reduction` :
      monthsOnMedication >= 3 ? `Moderately slower taper: ${monthsOnMedication} months of use` : null,
      
      currentDose > averageDose * 1.5 ? `Higher dose detected: ${currentDose}${currentUnit} is above average, slower taper recommended` : null,
      
      medication.dependencyRiskCategory === 'benzodiazepine' ? 'Benzodiazepine detected: Extra-slow hyperbolic taper essential for safety' : null,
      
      medication.withdrawalRisk === 'severe' ? 'High withdrawal risk: Extended timeline prioritizes safety' : null
    ].filter(Boolean),
    monthsOnMedication,
    riskFactors: {
      longTermUse: monthsOnMedication >= 6,
      highDose: currentDose > averageDose * 1.5,
      highRiskMedication: medication.withdrawalRisk === 'severe',
      benzodiazepine: medication.dependencyRiskCategory === 'benzodiazepine'
    }
  };
}

// Generate custom tapering plan with user-specified parameters
export function generateCustomTaperingPlan(
  medicationName: string,
  currentDose: number,
  currentUnit: string,
  method: 'linear' | 'exponential' | 'hyperbolic' | 'custom',
  durationWeeks: number,
  reductionPercent: number,
  includeStabilizationPeriods: boolean = false,
  daysBetweenReductions: number = 7
) {
  const medication = getMedicationByName(medicationName);
  
  // Always use the user-provided value - no more automatic overrides
  const effectiveDaysBetweenReductions = daysBetweenReductions;
  
  const totalDays = durationWeeks * 7;
  const steps: Array<{day: number, dose: number, notes: string}> = [];
  
  // For most tapering, the target is complete elimination (0)
  const finalTargetDose = 0;
  
  // Initialize warnings array early so it can be used in method logic
  const baseWarnings = [
    "Custom tapering plan - consult with your healthcare provider",
    "Monitor for withdrawal symptoms and adjust pace if necessary", 
    "Never stop abruptly if experiencing severe withdrawal symptoms"
  ];
  
  // Always add the starting dose as day 0
  steps.push({
    day: 0,
    dose: currentDose,
    notes: `Day 0: Starting dose ${currentDose} ${currentUnit}`
  });
  
  if (method === 'linear') {
    // Linear tapering: equal dose reductions at each step
    const totalSteps = Math.floor(totalDays / effectiveDaysBetweenReductions);
    
    // Calculate safe step reduction based on number of steps
    // More steps = smaller reductions to avoid doses changing too fast
    let stepReduction = currentDose / totalSteps;
    
    // Apply safety limits based on step count to prevent too-fast changes
    const maxReductionPerStep = currentDose * 0.25; // Never reduce more than 25% per step
    const minReductionPerStep = currentDose * 0.05; // Never reduce less than 5% per step
    stepReduction = Math.min(maxReductionPerStep, Math.max(minReductionPerStep, stepReduction));
    
    let currentStepDose = currentDose;
    
    for (let step = 1; step <= totalSteps; step++) {
      const stepDay = step * effectiveDaysBetweenReductions;
      
      if (includeStabilizationPeriods && step > 1 && step % 2 === 0) {
        steps.push({
          day: stepDay,
          dose: Math.round(currentStepDose * 1000) / 1000,
          notes: `Day ${stepDay}: Stabilization period - maintain ${Math.round(currentStepDose * 1000) / 1000} ${currentUnit}`
        });
        continue;
      }
      
      const previousDose = currentStepDose;
      currentStepDose = previousDose - stepReduction;
      
      // Ensure final step goes to zero and no negative doses
      if (step === totalSteps || currentStepDose <= 0) {
        currentStepDose = 0;
      }
      
      const actualReduction = previousDose - currentStepDose;
      const reductionPercent = previousDose > 0 ? Math.round((actualReduction / previousDose) * 100 * 10) / 10 : 0;
      
      steps.push({
        day: stepDay,
        dose: Math.round(currentStepDose * 1000) / 1000,
        notes: `Day ${stepDay}: Reduce to ${Math.round(currentStepDose * 1000) / 1000} ${currentUnit} (-${Math.round(actualReduction * 1000) / 1000} ${currentUnit}, ${reductionPercent}% reduction)${currentStepDose === 0 ? ' - complete discontinuation' : ''}`
      });
    }
  } else if (method === 'exponential') {
    // Exponential tapering: high reduction rates early, low rates later
    const totalSteps = Math.floor(totalDays / effectiveDaysBetweenReductions);
    let currentStepDose = currentDose;
    
    // Calculate safe max reduction based on number of steps
    // More steps = smaller max reduction to avoid doses changing too fast
    let maxReduction, minReduction;
    if (totalSteps <= 5) {
      maxReduction = 0.4; // 40% max for very short tapers
      minReduction = 0.1; // 10% min
    } else if (totalSteps <= 10) {
      maxReduction = 0.3; // 30% max for medium tapers
      minReduction = 0.08; // 8% min
    } else if (totalSteps <= 15) {
      maxReduction = 0.25; // 25% max for longer tapers
      minReduction = 0.06; // 6% min
    } else {
      maxReduction = 0.2; // 20% max for very long tapers
      minReduction = 0.05; // 5% min
    }
    
    for (let step = 1; step <= totalSteps; step++) {
      const stepDay = step * effectiveDaysBetweenReductions;
      
      if (includeStabilizationPeriods && step > 1 && step % 2 === 0) {
        steps.push({
          day: stepDay,
          dose: Math.round(currentStepDose * 1000) / 1000,
          notes: `Day ${stepDay}: Stabilization period - maintain ${Math.round(currentStepDose * 1000) / 1000} ${currentUnit}`
        });
        continue;
      }
      
      const previousDose = currentStepDose;
      
      if (step === totalSteps) {
        currentStepDose = 0;
      } else {
        // Calculate reduction percentage for this step (high early, low later)
        const stepProgress = (step - 1) / (totalSteps - 1); // 0 to 1
        const reductionPercent = maxReduction * Math.pow(1 - stepProgress, 2) + minReduction;
        
        currentStepDose = previousDose * (1 - reductionPercent);
        currentStepDose = Math.round(currentStepDose * 1000) / 1000;
      }
      
      const reduction = previousDose - currentStepDose;
      const actualReductionPercent = previousDose > 0 ? Math.round((reduction / previousDose) * 100 * 10) / 10 : 0;
      
      steps.push({
        day: stepDay,
        dose: currentStepDose,
        notes: `Day ${stepDay}: Reduce to ${currentStepDose} ${currentUnit} (-${Math.round(reduction * 1000) / 1000} ${currentUnit}, ${actualReductionPercent}% reduction)${currentStepDose === 0 ? ' - complete discontinuation' : ''}`
      });
    }
  } else if (method === 'hyperbolic') {
    // Hyperbolic tapering: consistent percentage reduction each step
    const totalSteps = Math.floor(totalDays / effectiveDaysBetweenReductions);
    let currentStepDose = currentDose;
    
    // Calculate the reduction percentage needed to get close to zero
    // We want to reach about 1% of original dose by the second-to-last step
    const targetRemainingPercent = 0.01; // 1% of original
    const reductionPercent = totalSteps > 1 ? 1 - Math.pow(targetRemainingPercent, 1 / (totalSteps - 1)) : 0.5;
    
    for (let step = 1; step <= totalSteps; step++) {
      const stepDay = step * effectiveDaysBetweenReductions;
      
      if (includeStabilizationPeriods && step > 1 && step % 2 === 0) {
        steps.push({
          day: stepDay,
          dose: Math.round(currentStepDose * 1000) / 1000,
          notes: `Day ${stepDay}: Stabilization period - maintain ${Math.round(currentStepDose * 1000) / 1000} ${currentUnit}`
        });
        continue;
      }
      
      const previousDose = currentStepDose;
      
      if (step === totalSteps) {
        currentStepDose = 0;
      } else {
        currentStepDose = previousDose * (1 - reductionPercent);
        currentStepDose = Math.round(currentStepDose * 1000) / 1000;
      }
      
      const reduction = previousDose - currentStepDose;
      const actualReductionPercent = previousDose > 0 ? Math.round((reduction / previousDose) * 100 * 10) / 10 : 0;
      
      steps.push({
        day: stepDay,
        dose: currentStepDose,
        notes: `Day ${stepDay}: Reduce to ${currentStepDose} ${currentUnit} (-${Math.round(reduction * 1000) / 1000} ${currentUnit}, ${actualReductionPercent}% reduction)${currentStepDose === 0 ? ' - complete discontinuation' : ''}`
      });
    }
  } else if (method === 'custom') {
    // Custom method: hybrid approach - moderate reductions early, then gentle linear finish
    const totalReductionSteps = Math.max(1, Math.floor(totalDays / effectiveDaysBetweenReductions));
    let currentStepDose = currentDose;
    
    const totalReductionNeeded = currentDose - finalTargetDose;
    const halfwayPoint = Math.ceil(totalReductionSteps / 2);
    
    for (let step = 1; step <= totalReductionSteps; step++) {
      const stepDay = Math.min(step * effectiveDaysBetweenReductions, totalDays);
      
      // Add stabilization periods if requested
      if (includeStabilizationPeriods && step > 1 && step % 2 === 0) {
        steps.push({
          day: stepDay,
          dose: Math.round(currentStepDose * 1000) / 1000,
          notes: `Day ${stepDay}: Stabilization - maintain ${Math.round(currentStepDose * 1000) / 1000} ${currentUnit}`
        });
      } else {
        let reductionAmount: number;
        let phaseDescription: string;
        
        if (step <= halfwayPoint) {
          // First half: Moderate exponential reduction (remove 65% of total)
          // Use user's percentage to influence aggressiveness, but keep it reasonable
          const aggressiveness = Math.max(1.2, Math.min(2.5, reductionPercent / 20)); // 20% input = 1.0 aggressiveness
          const targetReductionByHalfway = totalReductionNeeded * 0.65;
          const phaseProgress = step / halfwayPoint;
          const exponentialFactor = 1 - Math.pow(1 - phaseProgress, aggressiveness);
          const targetDoseAtStep = currentDose - (targetReductionByHalfway * exponentialFactor);
          reductionAmount = currentStepDose - Math.max(finalTargetDose, targetDoseAtStep);
          phaseDescription = 'moderate phase';
        } else {
          // Second half: Gentle linear reduction (remove remaining 35%)
          const remainingSteps = totalReductionSteps - halfwayPoint;
          const remainingReduction = totalReductionNeeded * 0.35;
          reductionAmount = remainingSteps > 0 ? remainingReduction / remainingSteps : 0;
          phaseDescription = 'gentle phase';
        }
        
        // Apply the reduction with guaranteed completion
        if (step === totalReductionSteps) {
          // Final step: ensure complete elimination
          currentStepDose = 0;
        } else {
          currentStepDose = Math.max(0, currentStepDose - reductionAmount);
          currentStepDose = Math.round(currentStepDose * 1000) / 1000;
        }
        
        const reductionPercent = currentStepDose > 0 && reductionAmount > 0 ? 
          (reductionAmount / (currentStepDose + reductionAmount)) * 100 : 0;
        
        const reductionAmountDisplay = Math.round(reductionAmount * 1000) / 1000;
        const reductionPercentDisplay = Math.round(reductionPercent * 10) / 10;
        const isComplete = currentStepDose === 0;
        
        steps.push({
          day: stepDay,
          dose: currentStepDose,
          notes: `Day ${stepDay}: Reduce to ${currentStepDose} ${currentUnit} (${phaseDescription}, ${reductionPercentDisplay}% reduction, -${reductionAmountDisplay} ${currentUnit})${isComplete ? ' - complete discontinuation' : ''}`
        });
        
        // Stop when we reach zero
        if (currentStepDose <= 0) break;
      }
    }
  }
  
  // ALL tapering methods must reach zero for complete discontinuation
  // Add final zero step if the last step is not zero
  if (steps.length > 0 && steps[steps.length - 1].dose > 0) {
    // For hyperbolic method, add a few more steps to get closer to zero first
    if (method === 'hyperbolic') {
      let currentStepDose = steps[steps.length - 1].dose;
      let lastDay = steps[steps.length - 1].day;
      const userReductionFactor = reductionPercent / 100;
      
      // Continue for a few more steps to get very close to zero
      let additionalSteps = 0;
      const maxAdditionalSteps = Math.min(3, Math.floor((totalDays - lastDay) / effectiveDaysBetweenReductions));
      
      while (currentStepDose > 0.1 && additionalSteps < maxAdditionalSteps && lastDay < totalDays - effectiveDaysBetweenReductions) {
        lastDay = Math.min(lastDay + effectiveDaysBetweenReductions, totalDays - effectiveDaysBetweenReductions);
        const previousDose = currentStepDose;
        currentStepDose = Math.max(0, previousDose * (1 - userReductionFactor));
        currentStepDose = Math.round(currentStepDose * 1000) / 1000;
        
        const reductionAmount = Math.max(0, previousDose - currentStepDose);
        const actualReductionPercent = previousDose > 0 ? Math.round((reductionAmount / previousDose) * 100 * 10) / 10 : 0;
        
        steps.push({
          day: lastDay,
          dose: currentStepDose,
          notes: `Day ${lastDay}: Reduce to ${currentStepDose} ${currentUnit} (${actualReductionPercent}% reduction from current dose, -${Math.round(reductionAmount * 1000) / 1000} ${currentUnit})`
        });
        
        additionalSteps++;
      }
    }
    
    // Always add final zero step to complete discontinuation
    steps.push({
      day: totalDays,
      dose: 0,
      notes: `Final step: Complete discontinuation`
    });
  }
  
  // Let the mathematical methods work naturally - no forced completion steps
  
  // Get warnings from medication database or provide defaults
  // baseWarnings already declared at top of function

  // Add method-specific warnings
  const methodWarnings = [];
  if (method === 'linear') {
    methodWarnings.push(
      "Linear method: Fixed amount reduction each step - may feel abrupt near the end",
      "Consider stabilization periods if you experience difficulty adjusting"
    );
  } else if (method === 'exponential') {
    methodWarnings.push(
      "Exponential method: Large early reductions may cause initial withdrawal symptoms",
      "Reduction rate decreases over time - early steps will be more challenging"
    );
  } else if (method === 'hyperbolic') {
    methodWarnings.push(
      "Hyperbolic method: Consistent percentage reduction of current dose each step",
      "Be prepared for withdrawal symptoms to persist throughout the taper"
    );
  } else if (method === 'custom') {
    methodWarnings.push(
      "Custom hybrid method: Aggressive early phase followed by gentle final phase",
      "Initial reductions may be challenging but will ease in the second half"
    );
  }

  // Add intensity-specific warnings
  if (reductionPercent > 20) {
    methodWarnings.push(
      `⚠️ High reduction intensity (${reductionPercent}%) - monitor closely for severe withdrawal`,
      "Consider medical supervision for reductions above 20%"
    );
  }

  if (daysBetweenReductions < 5) {
    methodWarnings.push(
      `⚠️ Rapid reduction schedule (every ${daysBetweenReductions} days) - allows limited adjustment time`,
      "Consider extending intervals if withdrawal symptoms are severe"
    );
  }

  if (durationWeeks < 3) {
    methodWarnings.push(
      `⚠️ Short taper duration (${durationWeeks} weeks) - may not allow adequate physiological adjustment`,
      "Longer tapers are generally safer for most medications"
    );
  }
  
  const riskSpecificWarnings = [];
  if (medication?.dependencyRiskCategory === 'benzodiazepine') {
    riskSpecificWarnings.push(
      "Risk of seizures - medical supervision essential",
      "Consider switching to longer-acting benzodiazepine first",
      "Be prepared to pause or slow the taper if withdrawal symptoms are severe"
    );
  }
  if (medication?.dependencyRiskCategory === 'opioid') {
    riskSpecificWarnings.push(
      "Monitor for pain flares and have backup pain management plan",
      "Watch for signs of psychological distress during taper"
    );
  }
  if (medication?.dependencyRiskCategory === 'antidepressant') {
    riskSpecificWarnings.push(
      "Monitor mood carefully during taper",
      "Consider postponing taper during times of high stress",
      "Discontinuation syndrome can mimic flu-like symptoms"
    );
  }
  
  return {
    medicationName: medicationName,
    method: method,
    totalDuration: totalDays,
    steps,
    warnings: [
      ...baseWarnings,
      ...methodWarnings,
      ...riskSpecificWarnings
    ],
    riskLevel: medication?.withdrawalRisk || 'moderate',
    canPause: true,
    flexibilityNotes: "This custom schedule can be paused or slowed at any point if withdrawal symptoms become problematic. Patient comfort and safety should always take priority over adherence to timeline."
  };
}

// Enhanced tapering plan generation with intelligent recommendations
export function generateEnhancedTaperingPlan(
  medicationName: string, 
  currentDose: number, 
  currentUnit: string,
  userMedication: any,
  customOptions?: {
    preferredMethod?: 'linear' | 'exponential' | 'hyperbolic' | 'custom';
    preferredDuration?: number;
    preferredReduction?: number;
    includeStabilizationPeriods?: boolean;
    daysBetweenReductions?: number;
  }
) {
  const intelligentRec = generateIntelligentTaperingRecommendation(
    medicationName, currentDose, currentUnit, userMedication
  );
  
  if (!intelligentRec) return null;
  
  // Use custom options if provided, otherwise use intelligent recommendations
  const finalPlan = {
    method: customOptions?.preferredMethod || intelligentRec.adjustedPlan.method,
    durationWeeks: customOptions?.preferredDuration || intelligentRec.adjustedPlan.durationWeeks,
    reductionPercent: customOptions?.preferredReduction || intelligentRec.adjustedPlan.reductionPercent,
    notes: intelligentRec.adjustedPlan.notes
  };
  
  // Always generate the actual tapering schedule using the final plan parameters
  const schedule = generateCustomTaperingPlan(
    medicationName,
    currentDose,
    currentUnit,
    finalPlan.method,
    finalPlan.durationWeeks,
    finalPlan.reductionPercent,
    customOptions?.includeStabilizationPeriods || false,
    customOptions?.daysBetweenReductions || 7
  );
  
  if (!schedule) return null;
  
  // Override with intelligent recommendations and custom options
  return {
    ...schedule,
    method: finalPlan.method,
    totalDuration: finalPlan.durationWeeks * 7, // Ensure correct duration
    intelligentRecommendations: intelligentRec,
    customizationUsed: !!customOptions,
    includeStabilizationPeriods: customOptions?.includeStabilizationPeriods || false
  };
}

// Function to suggest pause duration based on withdrawal symptoms
export function suggestPauseDuration(medicationName: string, withdrawalSeverity: 'mild' | 'moderate' | 'severe'): number {
  const medication = getMedicationByName(medicationName);
  
  if (!medication) return 7; // Default 1 week
  
  const basePauseDays = {
    'mild': 3,
    'moderate': 7,
    'severe': 14
  };
  
  let pauseDays = basePauseDays[withdrawalSeverity];
  
  // Adjust based on medication type
  if (medication.dependencyRiskCategory === 'benzodiazepine') {
    pauseDays *= 2; // Benzos need longer stabilization
  } else if (medication.dependencyRiskCategory === 'antidepressant') {
    pauseDays *= 1.5; // Antidepressants need moderate stabilization
  }
  
  return Math.min(pauseDays, 30); // Cap at 30 days
}

// Helper function to get comprehensive medication info for autocomplete
export function getMedicationSuggestions(query: string, maxResults: number = 10): Array<{
  name: string;
  category: string;
  riskLevel: string;
  description: string;
}> {
  const results = searchMedicationDatabase(query);
  return results.slice(0, maxResults).map(med => ({
    name: med.name,
    category: med.category,
    riskLevel: med.riskLevel,
    description: med.description || ''
  }));
}
