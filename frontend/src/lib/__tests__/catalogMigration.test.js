// Existing installs must pick up new/updated curated catalog entries on
// upgrade — the catalog is seeded once, so without a merge migration users
// who installed an earlier version never see later additions. We simulate a
// pre-migration install by pre-seeding the mock store with an old catalog
// (and no catalogSeedVersion) before localdb initializes.

jest.mock("localforage", () => {
  const stores = new Map();
  globalThis.__meditraxStore = stores;
  return {
    createInstance: () => ({
      getItem: async (k) => (stores.has(k) ? stores.get(k) : null),
      setItem: async (k, v) => { stores.set(k, v); return v; },
      removeItem: async (k) => { stores.delete(k); },
    }),
  };
});

import * as db from "../localdb";

beforeAll(() => {
  const S = globalThis.__meditraxStore;
  S.set("profiles", [{ id: "p1", name: "Me", color: "#2A767B", created_at: "2020-01-01T00:00:00.000Z" }]);
  S.set("activeProfileId", "p1");
  // An "old" catalog: one curated entry with stale content, plus a user's
  // AI-sourced entry. No catalogSeedVersion key → triggers the migration.
  S.set("catalog", [
    { id: "c-sert", name: "Sertraline", name_lower: "sertraline", category: "antidepressant", source: "curated", content: "OLD stale content", risk_level: "low", dependency_risk_category: "moderate", default_unit: "mg" },
    { id: "c-custom", name: "MyCustomDrug", name_lower: "mycustomdrug", category: "other", source: "ai", content: "user-added thing", risk_level: "low", dependency_risk_category: "none", default_unit: "mg" },
  ]);
});

describe("catalog seed migration on upgrade", () => {
  test("adds the new recreational entries while preserving user/AI entries", async () => {
    const items = await db.getKnowledge("", "all");
    const names = items.map((d) => d.name);
    // New curated additions now present
    for (const n of ["MDMA", "LSD", "Cocaine", "Alcohol", "Ketamine", "Cannabis (THC)"]) {
      expect(names).toContain(n);
    }
    // The user's own AI-added entry is untouched
    const custom = items.find((d) => d.name === "MyCustomDrug");
    expect(custom).toBeTruthy();
    expect(custom.source).toBe("ai");
    expect(custom.content).toBe("user-added thing");
  });

  test("refreshes a still-curated entry's content but keeps its id (links stay valid)", async () => {
    const items = await db.getKnowledge("", "all");
    const sert = items.find((d) => d.name === "Sertraline");
    expect(sert.id).toBe("c-sert"); // id preserved so catalog_id references survive
    expect(sert.content).not.toBe("OLD stale content"); // refreshed from the seed
    expect(sert.mechanism).toBeTruthy(); // seed fields the old entry lacked are now filled in
  });

  test("street-name search works after migration (finds MDMA via 'molly')", async () => {
    const results = await db.searchCatalog("molly", 10);
    expect(results.some((d) => d.name === "MDMA")).toBe(true);
  });

  test("newly-added seed fields (e.g. default_form) reach existing installs on upgrade", async () => {
    const items = await db.getKnowledge("", "all");
    expect(items.find((d) => d.name === "Cannabis (THC)").default_form).toBe("smoked/vaporized");
    expect(items.find((d) => d.name === "Cocaine").default_form).toBe("insufflated");
  });

  test("the seed version is recorded so the migration doesn't re-run", async () => {
    await db.getKnowledge("", "all"); // ensureInit already ran
    expect(await globalThis.__meditraxStore.get("catalogSeedVersion")).toBeDefined();
  });
});
