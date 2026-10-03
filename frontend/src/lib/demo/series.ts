/**
 * Deterministic demo data. Only ever read when the user switches Demo mode on in Settings;
 * nothing here is a fallback for a failed request. Amounts are INR.
 */

export const DEMO_DATASET_ID = '5b0f4c1e-7a21-4f0e-9a52-0d1c2e3f4a01';
export const DEMO_DATASET_2_ID = '9c3e7d52-1b64-4a8d-8f37-6e2a1b0c9d02';

/** mulberry32: small, fast, seedable. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const round = (value: number, digits = 2): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/** YYYY-MM-DD in UTC, `offset` days from today. */
export function isoDay(offset: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export interface DemoDatasetProfileSeed {
  id: string;
  name: string;
  scale: number;
  seed: number;
  rows: number;
}

export const DEMO_DATASETS: DemoDatasetProfileSeed[] = [
  { id: DEMO_DATASET_ID, name: 'kirana_store_sales_2025.csv', scale: 1, seed: 11, rows: 48210 },
  { id: DEMO_DATASET_2_ID, name: 'pune_outlet_daily_sales.csv', scale: 0.42, seed: 29, rows: 18640 },
];

export function seedFor(datasetId: string | undefined): DemoDatasetProfileSeed {
  return DEMO_DATASETS.find((d) => d.id === datasetId) ?? DEMO_DATASETS[0];
}

export const HISTORY_DAYS = 180;
export const BASE_UNIT_PRICE = 180;
export const BASE_UNIT_COST = 126;

/** Daily revenue for the last HISTORY_DAYS days (ending yesterday). */
export function historySeries(seed: DemoDatasetProfileSeed): Array<{ date: string; actual: number }> {
  const rand = seeded(seed.seed);
  const out: Array<{ date: string; actual: number }> = [];
  for (let i = HISTORY_DAYS; i >= 1; i--) {
    const date = isoDay(-i);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 1.22 : dow === 5 ? 1.08 : 1;
    const trend = 1 + (HISTORY_DAYS - i) * 0.0009;
    const festive = i > 25 && i < 32 ? 1.35 : 1;
    const noise = 0.92 + rand() * 0.16;
    out.push({ date, actual: round(182000 * seed.scale * weekend * trend * festive * noise, 0) });
  }
  return out;
}

/** Point forecast + conformal-style band for `horizon` days after today. */
export function forecastSeries(seed: DemoDatasetProfileSeed, horizon: number) {
  const history = historySeries(seed);
  const last = history.slice(-28).reduce((s, p) => s + p.actual, 0) / 28;
  const out: Array<{ date: string; predicted: number; lower_bound: number; upper_bound: number }> = [];
  for (let i = 0; i < horizon; i++) {
    const date = isoDay(i);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 1.2 : dow === 5 ? 1.07 : 0.98;
    const trend = 1 + (i + 1) * 0.0008;
    const predicted = round(last * 0.97 * weekend * trend, 0);
    const half = predicted * (0.09 + i * 0.0012);
    out.push({ date, predicted, lower_bound: round(Math.max(0, predicted - half), 0), upper_bound: round(predicted + half, 0) });
  }
  return out;
}

export const PRODUCTS = ['Aashirvaad Atta 10kg', 'Basmati Rice 5kg', 'Sunflower Oil 1L', 'Toor Dal 1kg', 'Tata Salt 1kg'];
export const CATEGORIES = ['Staples', 'Dairy', 'Beverages', 'Snacks', 'Personal Care'];
