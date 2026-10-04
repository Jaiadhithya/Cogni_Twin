/**
 * Helpers for the Forecast & What-If page: lever discovery, mutation strings and chart rows.
 * They arrange what the backend returned; they never estimate anything themselves.
 */
import type { ForecastPredict, Simulation } from '@/lib/api/types';

/**
 * The backend only reveals a dataset's lever columns in the error it returns for a simulation
 * without levers: "…No recognized levers… Available levers: ['unit_price', 'marketing_spend']".
 * Returns null when the message does not contain that list.
 */
export function parseLeversFromError(message: string): string[] | null {
  const match = message.match(/Available levers:\s*\[([\s\S]*?)\]/);
  if (!match) return null;
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

export const LEVER_RANGE = { min: -50, max: 50, step: 1 } as const;

/** { unit_price: 10, marketing_spend: 0 } → { unit_price: "+10%" } (zero levers are left out). */
export function toMutations(values: Record<string, number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [lever, pct] of Object.entries(values)) {
    if (pct !== 0) out[lever] = `${pct > 0 ? '+' : ''}${pct}%`;
  }
  return out;
}

export function humanizeLever(name: string): string {
  const text = name.replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface ChartRow {
  date: string;
  actual: number | null;
  forecast: number | null;
  /** [lower, upper] for the 80% and 95% bands. */
  band80: [number, number] | null;
  band95: [number, number] | null;
  scenario: number | null;
}

export const HISTORY_DAYS_SHOWN = 60;

/**
 * Join history, forecast and (optionally) a simulation on date. With a simulation the bands
 * come from its conformal/model intervals (80% and 95% when returned); without one, from the
 * forecast's own lower/upper bounds (single band, shown as 80%).
 */
export function buildChartRows(predict: ForecastPredict, simulation: Simulation | null): ChartRow[] {
  const rows = new Map<string, ChartRow>();
  const row = (date: string): ChartRow => {
    let r = rows.get(date);
    if (!r) {
      r = { date, actual: null, forecast: null, band80: null, band95: null, scenario: null };
      rows.set(date, r);
    }
    return r;
  };

  for (const h of predict.history.slice(-HISTORY_DAYS_SHOWN)) row(h.date).actual = h.actual;
  for (const f of predict.forecast) {
    const r = row(f.date);
    r.forecast = f.predicted;
    r.band80 = [f.lower_bound, f.upper_bound];
  }

  if (simulation) {
    simulation.points.forEach((p, i) => {
      const r = row(p.date);
      r.scenario = p.mutated_predicted;
      r.forecast = p.baseline_predicted;
      const levels = simulation.uncertainty?.levels ?? {};
      for (const [key, field] of [['80', 'band80'], ['95', 'band95']] as const) {
        const baseline = levels[key]?.baseline;
        r[field] = baseline ? [baseline.lower[i], baseline.upper[i]] : field === 'band80' ? r.band80 : null;
      }
    });
  }

  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** The last actual and first forecast are joined so the two lines touch. */
export function bridgeActualToForecast(rows: ChartRow[]): ChartRow[] {
  const lastActual = [...rows].reverse().find((r) => r.actual !== null);
  const firstForecast = rows.find((r) => r.forecast !== null);
  if (!lastActual || !firstForecast || lastActual.date >= firstForecast.date) return rows;
  return rows.map((r) => (r === lastActual ? { ...r, forecast: r.actual } : r));
}
