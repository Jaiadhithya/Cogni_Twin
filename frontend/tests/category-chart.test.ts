import { categoryAxisWidth, shortenCategory } from '../src/components/dashboard/category-chart';

describe('category chart labels', () => {
  it('widens the label column to fit the longest name', () => {
    expect(categoryAxisWidth(['Dairy', 'Snacks'])).toBe(72); // short names: minimum width
    expect(categoryAxisWidth(['Smart Robotics', 'Quantum Sensors'])).toBe(15 * 7 + 12);
  });

  it('caps the width and shortens names that would not fit', () => {
    const long = 'Enterprise Hardware and Networking Equipment';
    expect(categoryAxisWidth([long])).toBe(168);
    const short = shortenCategory(long);
    expect(short.endsWith('…')).toBe(true);
    expect(short.length).toBeLessThanOrEqual(22);
    expect(shortenCategory('Quantum Sensors')).toBe('Quantum Sensors');
  });
});
