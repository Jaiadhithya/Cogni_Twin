/** Plain-language strength of a correlation coefficient (mirrors the backend's wording). */
export function describeCorrelation(r: number | null): string {
  if (r === null) return 'not computable';
  const a = Math.abs(r);
  const strength = a < 0.1 ? 'negligible' : a < 0.3 ? 'weak' : a < 0.5 ? 'moderate' : a < 0.7 ? 'strong' : 'very strong';
  if (strength === 'negligible') return strength;
  return `${strength} ${r > 0 ? 'positive' : 'negative'}`;
}
