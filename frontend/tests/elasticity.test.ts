import {
  elasticityFor,
  demandDeltaPct,
  netMutationFactor,
  ELASTICITY,
} from '../src/legacy/lib/elasticity';

describe('elasticity model', () => {
  it('applies a negative price elasticity', () => {
    // +10% price should reduce demand
    expect(demandDeltaPct('unit_price', 10)).toBeCloseTo(10 * ELASTICITY.unit_price, 6);
    expect(demandDeltaPct('unit_price', 10)).toBeLessThan(0);
  });

  it('treats a discount as a positive demand lift', () => {
    expect(demandDeltaPct('discount_pct', 10)).toBeGreaterThan(0);
  });

  it('resolves levers by substring across naming variants', () => {
    expect(elasticityFor('unit_price')).toBe(ELASTICITY.unit_price);
    expect(elasticityFor('marketing_spend')).toBe(ELASTICITY.marketing_spend);
    expect(elasticityFor('discount_pct')).toBe(ELASTICITY.discount_pct);
    expect(elasticityFor('supplier_lead_time_days')).toBe(ELASTICITY.supplier_lead_time_days);
  });

  it('folds mutations into a single multiplicative factor', () => {
    const factor = netMutationFactor({ unit_price: 10, marketing_spend: 10 });
    const pricePart = 1 + (10 * ELASTICITY.unit_price) / 100;
    const mktgPart = 1 + (10 * ELASTICITY.marketing_spend) / 100;
    expect(factor).toBeCloseTo(pricePart * mktgPart, 6);
  });

  it('parses string mutations with a percent sign', () => {
    expect(netMutationFactor({ unit_price: '+10%' })).toBeCloseTo(
      1 + (10 * ELASTICITY.unit_price) / 100,
      6,
    );
  });

  it('is stable: an unknown lever falls back to the default elasticity', () => {
    expect(demandDeltaPct('some_new_lever', 10)).toBeCloseTo(10 * 0.2, 6);
  });
});
