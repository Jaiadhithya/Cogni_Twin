import { summaryPoints } from '../src/components/forecast/attribution-panel';

describe('driver summary bullets', () => {
  it('splits one bullet per line', () => {
    expect(summaryPoints('- 📈 Weekends add ₹1.2 L\n- 📉 Competitor offers take off ₹40,000')).toEqual([
      '📈 Weekends add ₹1.2 L',
      '📉 Competitor offers take off ₹40,000',
    ]);
  });

  it('splits bullets run together on one line', () => {
    expect(summaryPoints('- 📈 Weekends add ₹1.2 L - 📉 Prices take off ₹9,000')).toEqual(['📈 Weekends add ₹1.2 L', '📉 Prices take off ₹9,000']);
  });

  it('drops markdown bold and "up:" style labels', () => {
    expect(summaryPoints('- 📈 up: Marketing spend added **₹14,435**.\n- ⚠️ warning: Weekdays are slow.')).toEqual([
      '📈 Marketing spend added ₹14,435.',
      '⚠️ Weekdays are slow.',
    ]);
  });

  it('leaves plain prose with hyphens alone', () => {
    expect(summaryPoints('Sales in Oct - Nov are higher.')).toEqual(['Sales in Oct - Nov are higher.']);
  });
});
