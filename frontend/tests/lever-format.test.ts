import { elasticityInWords } from '../src/components/forecast/what-if-panel';
import { formatLeverValue, humanizeLever } from '../src/lib/forecast';

describe('lever names and values', () => {
  it('names the unit instead of showing the raw suffix', () => {
    expect(humanizeLever('promo_discount_pct')).toBe('Promo discount (%)');
    expect(humanizeLever('ad_spend_inr')).toBe('Ad spend (₹)');
    expect(humanizeLever('rainfall_mm')).toBe('Rainfall (mm)');
    expect(humanizeLever('unit_price')).toBe('Unit price');
  });

  it('formats a lever value in its own unit', () => {
    expect(formatLeverValue('ad_spend_inr', 1111.52)).toBe('₹1,112');
    expect(formatLeverValue('promo_discount_pct', 8.97)).toBe('9.0%');
    expect(formatLeverValue('rainfall_mm', 4.39)).toBe('4.4 mm');
    expect(formatLeverValue('unit_price', 32999)).toBe('₹32,999');
  });
});

describe('price sensitivity in words', () => {
  it('says what a 1% price rise does to units sold', () => {
    expect(elasticityInWords(-1.84)).toBe('A 1% price rise cuts units sold by about 1.8%.');
    expect(elasticityInWords(0.01)).toBe('Price changes barely move units sold.');
  });
});
