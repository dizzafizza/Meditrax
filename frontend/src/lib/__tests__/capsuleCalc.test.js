import {
  CAPSULE_SIZES,
  toMg,
  fromMg,
  convertMass,
  capsuleCapacityMg,
  bagToCapsules,
  capsulesToPowder,
  fillerPlan,
  costPer,
  formatMass,
} from "../capsuleCalc";

describe("unit conversion", () => {
  test("toMg converts common units", () => {
    expect(toMg(1, "g")).toBe(1000);
    expect(toMg(1000, "mcg")).toBe(1);
    expect(toMg(5, "mg")).toBe(5);
  });

  test("round-trips through mg", () => {
    expect(fromMg(toMg(2.5, "g"), "g")).toBeCloseTo(2.5, 6);
    expect(convertMass(1, "oz", "g")).toBeCloseTo(28.349523125, 6);
    expect(convertMass(1, "g", "oz")).toBeCloseTo(1 / 28.349523125, 9);
  });

  test("bad units/values are defensive", () => {
    expect(toMg(NaN, "mg")).toBe(0);
    expect(fromMg(100, "bogus")).toBe(100); // unknown unit → factor 1
  });
});

describe("capsuleCapacityMg", () => {
  test("size 0 at 0.6 g/mL ≈ 408 mg", () => {
    // 0.68 mL × 0.6 g/mL × 1000 = 408 mg
    expect(capsuleCapacityMg("0", 0.6)).toBeCloseTo(408, 1);
  });

  test("unknown size → 0", () => {
    expect(capsuleCapacityMg("99", 0.6)).toBe(0);
  });

  test("all standard sizes are defined", () => {
    ["000", "00", "0", "1", "2", "3", "4", "5"].forEach((k) => {
      expect(CAPSULE_SIZES[k]).toBeGreaterThan(0);
    });
  });
});

describe("bagToCapsules", () => {
  test("50 g @ 250 mg fill → 200 capsules, no leftover", () => {
    const r = bagToCapsules({ totalAmount: 50, totalUnit: "g", fillPerCapsuleMg: 250, purityPct: 100 });
    expect(r.capsules).toBe(200);
    expect(r.leftoverMg).toBe(0);
    expect(r.totalActiveMg).toBe(50000);
  });

  test("purity < 100 increases material per capsule and lowers count", () => {
    const full = bagToCapsules({ totalAmount: 50, totalUnit: "g", fillPerCapsuleMg: 250, purityPct: 100 });
    const half = bagToCapsules({ totalAmount: 50, totalUnit: "g", fillPerCapsuleMg: 250, purityPct: 50 });
    expect(half.materialPerCapsuleMg).toBeCloseTo(full.materialPerCapsuleMg * 2, 3);
    expect(half.capsules).toBe(100);
  });

  test("reports leftover powder", () => {
    const r = bagToCapsules({ totalAmount: 1000, totalUnit: "mg", fillPerCapsuleMg: 300, purityPct: 100 });
    expect(r.capsules).toBe(3);
    expect(r.leftoverMg).toBeCloseTo(100, 3);
  });

  test("zero / missing inputs → zero capsules, all leftover", () => {
    const r = bagToCapsules({ totalAmount: 10, totalUnit: "g", fillPerCapsuleMg: 0 });
    expect(r.capsules).toBe(0);
    expect(r.leftoverMg).toBe(10000);
  });
});

describe("capsulesToPowder (reverse)", () => {
  test("100 capsules × 200 mg → 20 g", () => {
    const r = capsulesToPowder({ numCapsules: 100, fillPerCapsuleMg: 200, purityPct: 100 });
    expect(r.totalMaterialMg).toBe(20000);
    expect(r.totalActiveMg).toBe(20000);
  });

  test("purity increases required material", () => {
    const r = capsulesToPowder({ numCapsules: 100, fillPerCapsuleMg: 200, purityPct: 50 });
    expect(r.totalMaterialMg).toBe(40000);
    expect(r.totalActiveMg).toBe(20000);
  });
});

describe("fillerPlan", () => {
  test("small dose leaves room for filler", () => {
    const r = fillerPlan({ sizeKey: "0", densityGPerMl: 0.6, activeDoseMg: 8, purityPct: 100, numCapsules: 30 });
    expect(r.capacityMg).toBeCloseTo(408, 1);
    expect(r.fillerPerCapsuleMg).toBeCloseTo(400, 1);
    expect(r.totalFillerMg).toBeCloseTo(12000, 0);
    expect(r.totalActiveMg).toBe(240);
    expect(r.warning).toBe("");
  });

  test("dose exceeding capacity → warning, no negative filler", () => {
    const r = fillerPlan({ sizeKey: "5", densityGPerMl: 0.6, activeDoseMg: 500, numCapsules: 10 });
    expect(r.warning).toMatch(/won't fit/i);
    expect(r.fillerPerCapsuleMg).toBe(0);
  });

  test("missing size → prompt warning", () => {
    const r = fillerPlan({ sizeKey: "", densityGPerMl: 0.6, activeDoseMg: 10, numCapsules: 10 });
    expect(r.warning).toMatch(/density/i);
  });
});

describe("costPer", () => {
  test("cost per capsule and per day", () => {
    const r = costPer({ bagCost: 40, capsules: 200, dosesPerDay: 2 });
    expect(r.perCapsule).toBe(0.2);
    expect(r.perDay).toBe(0.4);
  });

  test("zero capsules → 0, null per-day when no schedule", () => {
    const r = costPer({ bagCost: 40, capsules: 0 });
    expect(r.perCapsule).toBe(0);
    expect(r.perDay).toBeNull();
  });
});

describe("formatMass", () => {
  test("chooses readable unit", () => {
    expect(formatMass(500)).toBe("500 mg");
    expect(formatMass(2500)).toBe("2.5 g");
    expect(formatMass(0.5)).toBe("500 mcg");
  });
});
