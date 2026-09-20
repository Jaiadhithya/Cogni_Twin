/**
 * Single canonical elasticity model for the platform.
 *
 * Every client-side what-if / counterfactual approximation MUST route through
 * here so that the same lever yields the same number on every page. These are
 * direction-of-effect heuristics for the fallback UI only; the authoritative
 * simulation is the backend Prophet counterfactual (`/forecast/simulate`).
 *
 * Values are fractional demand response per 1% change in the lever, e.g. a
 * PRICE_ELASTICITY of -0.88 means a +1% price rise yields a -0.88% demand move.
 */

export const ELASTICITY = {
  /** Price elasticity of demand (negative: price up -> demand down). */
  unit_price: -0.88,
  /** Marketing spend response (positive, diminishing). */
  marketing_spend: 0.45,
  /** Discount lift (positive: a discount raises demand). */
  discount_pct: 0.35,
  /** Promotional spend behaves like marketing. */
  promo: 0.45,
  /** Inventory/safety-stock buffer has a muted positive effect. */
  inventory_buffer: 0.22,
  /** Supplier lead time (negative: longer waits cost sales). */
  supplier_lead_time_days: -0.15,
} as const;

/** Fallback elasticity for any lever without an explicit entry. */
const DEFAULT_ELASTICITY = 0.2;

export type ElasticityKey = keyof typeof ELASTICITY;

/**
 * Resolve the elasticity factor for a lever name. Matching is lenient
 * (substring based) because backend lever names vary (`unit_price`,
 * `discount_pct`, `marketing_spend`, ...).
 */
export function elasticityFor(lever: string): number {
  const key = lever.toLowerCase();
  if (key.includes('price') && !key.includes('inventory')) return ELASTICITY.unit_price;
  if (key.includes('marketing')) return ELASTICITY.marketing_spend;
  if (key.includes('promo')) return ELASTICITY.promo;
  if (key.includes('discount')) return ELASTICITY.discount_pct;
  if (key.includes('inventory') || key.includes('stock') || key.includes('buffer')) {
    return ELASTICITY.inventory_buffer;
  }
  if (key.includes('lead') || key.includes('supplier')) return ELASTICITY.supplier_lead_time_days;
  return DEFAULT_ELASTICITY;
}

/**
 * Convert a lever mutation into the resulting percentage-point change in
 * demand. `mutationPct` is the user's lever delta in percent (e.g. +15 for a
 * 15% price rise). The returned value is the demand change in percent.
 */
export function demandDeltaPct(lever: string, mutationPct: number): number {
  return mutationPct * elasticityFor(lever);
}

/**
 * Fold a set of mutations into a single multiplicative revenue factor.
 * `mutations` maps a lever name to its percent delta (e.g. `{ unit_price: 15 }`).
 */
export function netMutationFactor(mutations: Record<string, number | string>): number {
  let factor = 1.0;
  for (const [lever, raw] of Object.entries(mutations)) {
    const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace('%', '')) || 0;
    factor *= 1 + demandDeltaPct(lever, num) / 100;
  }
  return factor;
}
