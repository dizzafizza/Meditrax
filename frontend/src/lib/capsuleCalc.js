// Capsule maker calculator — pure functions for hand-filling capsules from
// bulk powder. No React / no side effects, mirroring taperEngine.js so the math
// is trivially unit-testable. Defensive like predictor.js: never throw on bad
// input — return zeros (and, where relevant, a `warning` string).

// Standard empty gelatin/HPMC capsule sizes → nominal fill volume in millilitres.
// (Common reference values; actual capacity varies a little by brand.)
export const CAPSULE_SIZES = {
  "000": 1.37,
  "00": 0.95,
  "0": 0.68,
  "1": 0.5,
  "2": 0.37,
  "3": 0.3,
  "4": 0.21,
  "5": 0.13,
};

// Ordered largest → smallest, for building reference tables / size suggestions.
export const CAPSULE_SIZE_ORDER = ["000", "00", "0", "1", "2", "3", "4", "5"];

// Approximate bulk (poured) powder densities in g/mL. These are rough guides —
// users can override with a measured value.
export const DENSITY_PRESETS = {
  "light/fluffy": 0.3,
  fine: 0.5,
  typical: 0.6,
  "dense/crystalline": 0.85,
};

// Mass units → milligrams. Grain (gr) is included because apothecary/compounding
// recipes still use it.
export const MASS_UNITS = {
  mcg: 0.001,
  mg: 1,
  g: 1000,
  gr: 64.79891,
  oz: 28349.523125,
};

export const MASS_UNIT_ORDER = ["mcg", "mg", "g", "gr", "oz"];

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function round(x, dp = 2) {
  const f = Math.pow(10, dp);
  return Math.round(num(x) * f) / f;
}

// ---- unit conversion ----

export function toMg(amount, unit) {
  const factor = MASS_UNITS[unit] ?? 1;
  return num(amount) * factor;
}

export function fromMg(mg, unit) {
  const factor = MASS_UNITS[unit] ?? 1;
  if (factor === 0) return 0;
  return num(mg) / factor;
}

// Convert between any two supported mass units.
export function convertMass(amount, fromUnit, toUnit) {
  return fromMg(toMg(amount, fromUnit), toUnit);
}

// ---- capsule capacity ----

// Milligrams of powder a given capsule size holds at a given powder density.
// capacity(mg) = volume(mL) × density(g/mL) × 1000(mg/g)
export function capsuleCapacityMg(sizeKey, densityGPerMl) {
  const vol = CAPSULE_SIZES[sizeKey];
  if (vol == null) return 0;
  return round(vol * num(densityGPerMl) * 1000, 1);
}

// ---- core: bag of powder → number of capsules ----

// totalAmount/totalUnit: the whole bag. fillPerCapsuleMg: intended active dose
// per capsule (mg). purityPct: % of the powder that is the active substance
// (100 = pure). Material actually weighed per capsule = dose / purity.
export function bagToCapsules({ totalAmount, totalUnit = "mg", fillPerCapsuleMg, purityPct = 100 }) {
  const totalMaterialMg = toMg(totalAmount, totalUnit);
  const purity = num(purityPct);
  const dose = num(fillPerCapsuleMg);
  const materialPerCapsuleMg = purity > 0 ? dose / (purity / 100) : 0;

  if (materialPerCapsuleMg <= 0 || totalMaterialMg <= 0) {
    return { capsules: 0, totalMaterialMg: round(totalMaterialMg, 3), materialPerCapsuleMg: 0, leftoverMg: round(totalMaterialMg, 3), totalActiveMg: 0 };
  }

  const capsules = Math.floor(totalMaterialMg / materialPerCapsuleMg);
  const leftoverMg = totalMaterialMg - capsules * materialPerCapsuleMg;
  return {
    capsules,
    totalMaterialMg: round(totalMaterialMg, 3),
    materialPerCapsuleMg: round(materialPerCapsuleMg, 3),
    leftoverMg: round(leftoverMg, 3),
    totalActiveMg: round(capsules * dose, 3),
  };
}

// ---- reverse: target N capsules → powder needed ----

export function capsulesToPowder({ numCapsules, fillPerCapsuleMg, purityPct = 100 }) {
  const n = Math.max(0, Math.floor(num(numCapsules)));
  const purity = num(purityPct);
  const dose = num(fillPerCapsuleMg);
  const materialPerCapsuleMg = purity > 0 ? dose / (purity / 100) : 0;
  return {
    totalMaterialMg: round(n * materialPerCapsuleMg, 3),
    totalActiveMg: round(n * dose, 3),
    materialPerCapsuleMg: round(materialPerCapsuleMg, 3),
  };
}

// ---- filler / dilution planner (volumetric dosing / trituration) ----

// When the active dose is small relative to what a capsule holds, blend it with
// an inert filler so every capsule fills evenly and doses uniformly. Returns
// per-capsule and batch masses, plus a warning when the dose won't fit.
export function fillerPlan({ sizeKey, densityGPerMl, activeDoseMg, purityPct = 100, numCapsules }) {
  const capacityMg = capsuleCapacityMg(sizeKey, densityGPerMl);
  const purity = num(purityPct);
  const dose = num(activeDoseMg);
  const materialPerCapsuleMg = purity > 0 ? dose / (purity / 100) : 0;
  const n = Math.max(0, Math.floor(num(numCapsules)));

  let warning = "";
  let fillerPerCapsuleMg = capacityMg - materialPerCapsuleMg;
  if (capacityMg <= 0) {
    warning = "Enter a capsule size and powder density to estimate capacity.";
    fillerPerCapsuleMg = 0;
  } else if (materialPerCapsuleMg >= capacityMg) {
    warning = "The active material won't fit in this capsule size — use a larger capsule, split the dose, or increase potency.";
    fillerPerCapsuleMg = 0;
  }

  return {
    capacityMg,
    materialPerCapsuleMg: round(materialPerCapsuleMg, 3),
    fillerPerCapsuleMg: round(Math.max(0, fillerPerCapsuleMg), 3),
    totalActiveMg: round(n * dose, 3),
    totalMaterialMg: round(n * materialPerCapsuleMg, 3),
    totalFillerMg: round(n * Math.max(0, fillerPerCapsuleMg), 3),
    warning,
  };
}

// ---- cost ----

export function costPer({ bagCost, capsules, dosesPerDay }) {
  const cost = num(bagCost);
  const n = Math.max(0, Math.floor(num(capsules)));
  const perCapsule = n > 0 ? cost / n : 0;
  const perDay = num(dosesPerDay) > 0 ? perCapsule * num(dosesPerDay) : null;
  return {
    perCapsule: round(perCapsule, 4),
    perDay: perDay == null ? null : round(perDay, 4),
  };
}

// ---- formatting helper for UI (mg → friendly unit string) ----

// Picks a readable unit: mg under 1000, otherwise g.
export function formatMass(mg, dp = 2) {
  const v = num(mg);
  if (Math.abs(v) >= 1000) return `${round(v / 1000, dp)} g`;
  if (Math.abs(v) > 0 && Math.abs(v) < 1) return `${round(v * 1000, 0)} mcg`;
  return `${round(v, dp)} mg`;
}
