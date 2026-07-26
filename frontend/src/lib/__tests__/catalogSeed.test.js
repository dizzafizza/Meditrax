// Sanity checks for the curated knowledge-base seed — catches typos that
// would otherwise silently fall back to defaults (e.g. an unknown category
// falling back to "other" in the effects engine, or an out-of-enum risk
// level rendering oddly in the UI) rather than failing loudly.

import { CATALOG_SEED } from "../catalogSeed";
import { CATEGORY_PK, SUBSTANCE_PK, substancePkFor } from "../effectsEngine";
import { SUBSTANCE_TOLERANCE } from "../toleranceEngine";
import { CATEGORY_LABELS } from "../format";

const RISK_LEVELS = ["minimal", "low", "moderate", "high"];
const DEPENDENCY_LEVELS = ["none", "low", "moderate", "high", "extreme"];
// Mirror of MedicationFormSheet's FORMS list — default_form must be one of
// these so it maps to a real option in the medication Form dropdown.
const FORMS = ["tablet", "capsule", "liquid", "injection", "patch", "drops", "spray", "inhaler", "cream", "smoked/vaporized", "insufflated", "edible", "other"];

describe("CATALOG_SEED integrity", () => {
  test("any entry with a default_form uses a valid form from the Form dropdown", () => {
    for (const d of CATALOG_SEED) {
      if (d.default_form != null) expect(FORMS).toContain(d.default_form);
    }
  });

  test("route-dependent recreational substances carry a sensible default_form", () => {
    const expected = {
      "Cannabis (THC)": "smoked/vaporized",
      "Cocaine": "insufflated",
      "Ketamine": "insufflated",
      "Alcohol": "liquid",
      "GHB / GBL": "liquid",
      "Methamphetamine": "smoked/vaporized",
    };
    for (const [name, form] of Object.entries(expected)) {
      const d = CATALOG_SEED.find((x) => x.name === name);
      expect(d).toBeTruthy();
      expect(d.default_form).toBe(form);
    }
  });

  test("every entry's category has a UI label (chronic-condition categories like antihypertensive/diabetes intentionally have no dedicated effects-engine PK profile and fall back to 'other')", () => {
    for (const d of CATALOG_SEED) {
      expect(CATEGORY_LABELS).toHaveProperty(d.category);
    }
  });

  test("every entry uses a valid risk_level and dependency_risk_category", () => {
    for (const d of CATALOG_SEED) {
      expect(RISK_LEVELS).toContain(d.risk_level);
      expect(DEPENDENCY_LEVELS).toContain(d.dependency_risk_category);
    }
  });

  test("no duplicate names (would silently collide via saveCatalogEntry's name_lower dedup)", () => {
    const names = CATALOG_SEED.map((d) => d.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  test("every entry has the required descriptive fields non-empty", () => {
    for (const d of CATALOG_SEED) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.content.length).toBeGreaterThan(0);
      expect(d.default_unit.length).toBeGreaterThan(0);
    }
  });

  describe("recreational/psychoactive additions", () => {
    const names = ["Alcohol", "Cannabis (THC)", "Cocaine", "GHB / GBL", "Ketamine", "Kratom", "LSD", "MDMA", "Methamphetamine", "Psilocybin mushrooms"];

    test("all ten are present", () => {
      const present = CATALOG_SEED.map((d) => d.name);
      for (const n of names) expect(present).toContain(n);
    });

    test("each carries a harm-reduction warning and a non-'none' risk_level", () => {
      for (const n of names) {
        const d = CATALOG_SEED.find((x) => x.name === n);
        expect(d.warnings.length).toBeGreaterThan(0);
        expect(d.risk_level).not.toBe("minimal");
      }
    });

    test("dangerous depressant combinations are called out for alcohol and GHB/GBL", () => {
      const alcohol = CATALOG_SEED.find((d) => d.name === "Alcohol");
      const ghb = CATALOG_SEED.find((d) => d.name === "GHB / GBL");
      expect(alcohol.interactions.join(" ")).toMatch(/opioid/i);
      expect(ghb.interactions.join(" ")).toMatch(/alcohol/i);
    });

    test("each has a dedicated effects-engine PK profile (not a silent 'other' fallback)", () => {
      for (const n of names) {
        const d = CATALOG_SEED.find((x) => x.name === n);
        expect(CATEGORY_PK).toHaveProperty(d.category);
      }
    });
  });
});

// The per-substance pharmacology tables key off a medication's name, which
// for anything added from the knowledge base is the catalog entry's name.
// A rename or typo on either side would silently drop the substance back to
// its (materially less accurate) category default, with nothing failing --
// exactly the kind of silent regression these tests exist to catch.
describe("per-substance pharmacology tables line up with the catalog", () => {
  const byName = new Map(CATALOG_SEED.map((d) => [d.name.trim().toLowerCase(), d]));

  test("every SUBSTANCE_PK key names a real catalog entry", () => {
    for (const key of Object.keys(SUBSTANCE_PK)) {
      expect(byName.has(key)).toBe(true);
    }
  });

  test("every SUBSTANCE_TOLERANCE key names a real catalog entry", () => {
    for (const key of Object.keys(SUBSTANCE_TOLERANCE)) {
      expect(byName.has(key)).toBe(true);
    }
  });

  test("a catalog entry with its own PK profile actually resolves to it", () => {
    for (const key of Object.keys(SUBSTANCE_PK)) {
      const entry = byName.get(key);
      expect(substancePkFor({ name: entry.name, generic_name: entry.generic_name })).toBe(SUBSTANCE_PK[key]);
    }
  });
});
