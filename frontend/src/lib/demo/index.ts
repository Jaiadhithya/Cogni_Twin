/**
 * Demo data source: the same function surface as src/lib/api/endpoints.ts, backed by
 * fixtures. Selected by useDataSource() only when Demo mode is on. It never touches the network.
 */
import type * as Endpoints from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/errors';
import type {
  Backtest,
  CorrelationMethod,
  DataSummary,
  DatasetCorrelations,
  DatasetProfile,
  DatasetScatter,
  DocumentChunk,
  ExplainPrescribe,
  Health,
  LeverForce,
  QueryResponse,
  SavedSimulation,
  Simulation,
  SimulationComparison,
  SimulationRequest,
  TrainingJob,
  UploadRecord,
} from '@/lib/api/types';
import {
  BASE_UNIT_COST,
  BASE_UNIT_PRICE,
  CATEGORIES,
  DEMO_DATASETS,
  DEMO_DATASET_ID,
  PRODUCTS,
  forecastSeries,
  historySeries,
  isoDay,
  round,
  seedFor,
  seeded,
} from './series';

export type DataSource = typeof Endpoints;

const delay = (ms = 220) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/* ─── In-memory state (resets on reload) ─── */

let uploads: UploadRecord[] = DEMO_DATASETS.map((d, i) => ({
  id: d.id,
  filename: d.name,
  entity_type: 'dynamic',
  row_count: d.rows,
  warning_count: i === 0 ? 0 : 2,
  error_count: 0,
  status: 'completed',
  created_at: `${isoDay(-(9 + i * 20))}T09:30:00`,
}));

const demoModelTier = 'prophet_lgbm';

let savedRuns: SavedSimulation[] = [];

function seedRuns() {
  if (savedRuns.length) return;
  const presets: Array<[string, Record<string, string>]> = [
    ['Raise prices 5%', { unit_price: '+5%' }],
    ['Festive discount push', { discount_pct: '+10%', marketing_spend: '+20%' }],
    ['Cut marketing 15%', { marketing_spend: '-15%' }],
  ];
  savedRuns = presets.map(([name, mutations], i) => {
    const sim = runSimulation({ dataset_id: DEMO_DATASET_ID, horizon_days: 30, mutations });
    return toSaved(sim, name, mutations, 30, `${isoDay(-(i + 1) * 2)}T11:15:00`, `demo-run-${i + 1}`);
  });
}

function toSaved(
  sim: Simulation,
  name: string | null,
  mutations: Record<string, unknown>,
  horizon: number,
  createdAt: string,
  id: string,
): SavedSimulation {
  return {
    id,
    dataset_id: sim.dataset_id,
    name,
    mutations,
    horizon_days: horizon,
    baseline_summary: { total: sim.baseline_total, daily_average: round(sim.baseline_total / horizon) },
    simulated_summary: { total: sim.mutated_total, daily_average: round(sim.mutated_total / horizon) },
    delta_metrics: { total_delta: sim.total_delta, total_delta_pct: sim.total_delta_pct },
    created_at: createdAt,
  };
}

/* ─── Simulation (explicit demo fixture, deterministic) ─── */

const LEVERS = ['unit_price', 'marketing_spend', 'discount_pct'] as const;
const PRICE_ELASTICITY = -2.2;

function parseMutation(value: unknown): number {
  if (typeof value === 'number') return value;
  const text = String(value).trim();
  if (text.endsWith('%')) return Number(text.slice(0, -1)) / 100;
  return Number(text);
}

function runSimulation(req: Pick<SimulationRequest, 'dataset_id' | 'horizon_days' | 'mutations'> & { unit_cost?: number | null }): Simulation {
  const seed = seedFor(req.dataset_id ?? undefined);
  const horizon = req.horizon_days ?? 30;
  const base = forecastSeries(seed, horizon);

  const price = parseMutation(req.mutations.unit_price ?? 0);
  const marketing = parseMutation(req.mutations.marketing_spend ?? 0);
  const discount = parseMutation(req.mutations.discount_pct ?? 0);

  const volumeFactor = Math.max(0.05, (1 + price) ** PRICE_ELASTICITY * (1 + marketing) ** 0.14 * (1 + discount * 0.9));
  const priceFactor = (1 + price) * (1 - Math.min(0.9, Math.max(0, discount) * 0.5));
  const revenueFactor = volumeFactor * priceFactor;

  const points = base.map((p) => {
    const mutated = round(p.predicted * revenueFactor, 0);
    return {
      date: p.date,
      baseline_predicted: p.predicted,
      mutated_predicted: mutated,
      delta: round(mutated - p.predicted, 0),
      delta_pct: p.predicted ? round(((mutated - p.predicted) / p.predicted) * 100, 2) : 0,
    };
  });

  const baselineTotal = points.reduce((s, p) => s + p.baseline_predicted, 0);
  const mutatedTotal = points.reduce((s, p) => s + p.mutated_predicted, 0);

  const unitCost = req.unit_cost ?? BASE_UNIT_COST;
  const baseUnits = baselineTotal / BASE_UNIT_PRICE;
  const simUnits = baseUnits * volumeFactor;
  const simPrice = BASE_UNIT_PRICE * priceFactor;
  const baseProfit = baseUnits * (BASE_UNIT_PRICE - unitCost);
  const simProfit = simUnits * (simPrice - unitCost) - Math.max(0, marketing) * 0.04 * baselineTotal;

  const level = (z: number) => ({
    half_width: round(baselineTotal * 0.0003 * z, 0),
    baseline: {
      lower: points.map((p) => round(Math.max(0, p.baseline_predicted * (1 - 0.08 * z)), 0)),
      upper: points.map((p) => round(p.baseline_predicted * (1 + 0.08 * z), 0)),
    },
    scenario: {
      lower: points.map((p) => round(Math.max(0, p.mutated_predicted * (1 - 0.08 * z)), 0)),
      upper: points.map((p) => round(p.mutated_predicted * (1 + 0.08 * z), 0)),
    },
  });

  const forces: LeverForce[] = Object.keys(req.mutations).map((feature) => {
    const delta = (mutatedTotal - baselineTotal) / Math.max(1, Object.keys(req.mutations).length);
    return {
      feature,
      mutation: String(req.mutations[feature]),
      baseline_impact: round(baselineTotal / 3, 0),
      mutated_impact: round(baselineTotal / 3 + delta, 0),
      delta_force: round(delta, 0),
      contribution_pct: round((delta / Math.max(1, Math.abs(mutatedTotal - baselineTotal))) * 100, 1),
      direction: delta >= 0 ? 'Positive' : 'Negative',
      description: `Demo data: ${feature} (${String(req.mutations[feature])}) moved the 30-day total by ${round(delta, 0)}.`,
      economic_narrative: `Demo data: ${feature} (${String(req.mutations[feature])}) moved the total by ${round(delta, 0)}.`,
    };
  });

  const profitDelta = simProfit - baseProfit;
  const volumeUp = simUnits > baseUnits;

  return {
    dataset_id: seed.id,
    run_id: null,
    mutations_applied: Object.fromEntries(Object.entries(req.mutations).map(([k, v]) => [k, String(v)])),
    baseline_total: round(baselineTotal, 0),
    mutated_total: round(mutatedTotal, 0),
    total_delta: round(mutatedTotal - baselineTotal, 0),
    total_delta_pct: baselineTotal ? round(((mutatedTotal - baselineTotal) / baselineTotal) * 100, 2) : 0,
    points,
    available_levers: [...LEVERS],
    shap_forces: forces,
    shap_positive_forces: forces.filter((f) => f.direction === 'Positive'),
    shap_negative_forces: forces.filter((f) => f.direction === 'Negative'),
    uncertainty: {
      method: 'split_conformal',
      calibration_points: 28,
      dates: points.map((p) => p.date),
      levels: { '80': level(1), '95': level(1.6) },
      notes: [
        'Demo data. Intervals are the point forecast ± the holdout error quantile; they describe model error, not uncertainty about the lever values.',
      ],
    },
    profit: {
      available: true,
      reason: null,
      baseline_gross_profit: round(baseProfit, 0),
      simulated_gross_profit: round(simProfit, 0),
      delta: round(profitDelta, 0),
      delta_pct: baseProfit ? round((profitDelta / Math.abs(baseProfit)) * 100, 2) : null,
      unit_cost: unitCost,
      cost_source: req.unit_cost != null ? 'request' : 'demo assumption',
      price_column: 'unit_price',
      marketing_column: 'marketing_spend',
      margin_guardrail: {
        triggered: volumeUp && simProfit < baseProfit,
        message:
          volumeUp && simProfit < baseProfit
            ? 'Volume rises but gross profit falls: the extra units do not cover the lower margin or added spend.'
            : null,
      },
      assumptions: ['Demo data. Each day’s lever value is treated as that day’s per-unit price and total marketing spend.'],
    },
    pricing: {
      elasticity: { elasticity: PRICE_ELASTICITY, std_err: 0.31, t_stat: -7.1, r2: 0.64, n: 180, controls: ['marketing_spend'], usable: true, reason: null },
      optimal_price: {
        price: round((unitCost * PRICE_ELASTICITY) / (1 + PRICE_ELASTICITY), 2),
        reason: null,
        elasticity: PRICE_ELASTICITY,
        unit_cost: unitCost,
      },
    },
  };
}

/* ─── Summary ─── */

function summaryFor(datasetId?: string): DataSummary {
  const seed = seedFor(datasetId);
  const history = historySeries(seed);
  const total = history.reduce((s, p) => s + p.actual, 0);
  const orders = Math.round(total / 612);
  const shares = [0.31, 0.24, 0.19, 0.15, 0.11];
  return {
    dataset_id: seed.id,
    target_metric_name: 'revenue',
    primary_date_name: 'order_date',
    metadata: {
      target_metric: 'revenue',
      numerical_columns: ['units_sold', 'unit_price', 'discount_pct', 'marketing_spend'],
      categorical_columns: ['product_name', 'category', 'channel'],
    },
    kpis: { total_rows: seed.rows, total_target: total, avg_target: round(total / seed.rows, 2) },
    timeline: history.map((p) => ({ date: p.date, value: p.actual })),
    dimensions: {
      category: CATEGORIES.map((c, i) => ({ category: c, value: round(total * shares[i], 0) })),
      channel: [
        { category: 'In store', value: round(total * 0.62, 0) },
        { category: 'WhatsApp orders', value: round(total * 0.24, 0) },
        { category: 'Online', value: round(total * 0.14, 0) },
      ],
    },
    total_revenue: total,
    total_orders: orders,
    top_products: PRODUCTS.map((name, i) => ({ name, revenue: round(total * shares[i] * 0.8, 0) })),
    top_categories: CATEGORIES.map((name, i) => ({ name, revenue: round(total * shares[i], 0) })),
    daily_revenue: history.map((p) => ({ date: p.date, value: p.actual })),
    data_status: { sales_count: seed.rows, products_count: PRODUCTS.length },
  };
}

/* ─── Dataset analysis ─── */

const NUMERIC_COLUMNS = ['units_sold', 'unit_price', 'discount_pct', 'marketing_spend', 'revenue', 'stock_level'];

function analysisRows(datasetId: string) {
  const rand = seeded(seedFor(datasetId).seed + 101);
  return Array.from({ length: 400 }, () => {
    const price = 120 + rand() * 120;
    const discount = rand() * 25;
    const marketing = 2000 + rand() * 18000;
    const units = Math.max(1, 90 + marketing / 260 - (price - 180) * 0.9 + discount * 2.1 + (rand() - 0.5) * 30);
    return {
      units_sold: units,
      unit_price: price,
      discount_pct: discount,
      marketing_spend: marketing,
      revenue: units * price * (1 - discount / 200),
      stock_level: 150 + rand() * 600 - units * 0.4,
    } as Record<string, number>;
  });
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

function ranks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0]);
  const out = new Array<number>(values.length);
  order.forEach(([, original], rank) => (out[original] = rank + 1));
  return out;
}

function profileFor(datasetId: string): DatasetProfile {
  const seed = seedFor(datasetId);
  const rows = analysisRows(seed.id);
  const numeric = NUMERIC_COLUMNS.map((column) => {
    const v = rows.map((r) => r[column]).sort((a, b) => a - b);
    const n = v.length;
    const mean = v.reduce((s, x) => s + x, 0) / n;
    const std = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
    const q = (p: number) => v[Math.floor((n - 1) * p)];
    const skew = v.reduce((s, x) => s + ((x - mean) / std) ** 3, 0) / n;
    return {
      column,
      count: n,
      nulls: column === 'stock_level' ? 7 : 0,
      mean: round(mean),
      median: round(q(0.5)),
      std: round(std),
      min: round(v[0]),
      max: round(v[n - 1]),
      iqr: round(q(0.75) - q(0.25)),
      skewness: round(skew, 3),
    };
  });
  return {
    dataset_id: seed.id,
    row_count: seed.rows,
    numeric,
    categorical: [
      { column: 'product_name', count: seed.rows, nulls: 0, cardinality: PRODUCTS.length, top_values: PRODUCTS.map((value, i) => ({ value, count: Math.round(seed.rows * [0.31, 0.24, 0.19, 0.15, 0.11][i]) })) },
      { column: 'channel', count: seed.rows, nulls: 0, cardinality: 3, top_values: [{ value: 'In store', count: Math.round(seed.rows * 0.62) }, { value: 'WhatsApp orders', count: Math.round(seed.rows * 0.24) }, { value: 'Online', count: Math.round(seed.rows * 0.14) }] },
    ],
    skipped_columns: [],
    notes: ['Demo data. skewness is the population (Fisher-Pearson g1) coefficient; iqr = q3 - q1.'],
  };
}

function correlationsFor(datasetId: string, method: CorrelationMethod): DatasetCorrelations {
  const rows = analysisRows(datasetId);
  const cols = NUMERIC_COLUMNS.map((c) => {
    const values = rows.map((r) => r[c]);
    return method === 'spearman' ? ranks(values) : values;
  });
  return {
    dataset_id: seedFor(datasetId).id,
    method,
    columns: NUMERIC_COLUMNS,
    matrix: cols.map((a, i) => cols.map((b, j) => (i === j ? 1 : round(pearson(a, b), 4)))),
    n: NUMERIC_COLUMNS.map((c, i) => NUMERIC_COLUMNS.map((d, j) => (c === 'stock_level' || d === 'stock_level' ? (i === j ? 393 : 393) : 400))),
    sampled: false,
    sample_size: rows.length,
  };
}

function scatterFor(datasetId: string, x: string, y: string, limit: number): DatasetScatter {
  if (!NUMERIC_COLUMNS.includes(x) || !NUMERIC_COLUMNS.includes(y)) {
    throw new ApiError({ status: 400, type: 'VALIDATION_ERROR', message: `'x' and 'y' must be numeric columns of this dataset; available: ${NUMERIC_COLUMNS.join(', ')}.` });
  }
  const rows = analysisRows(datasetId);
  return {
    dataset_id: seedFor(datasetId).id,
    x,
    y,
    points: rows.slice(0, limit).map((r) => ({ [x]: round(r[x]), [y]: round(r[y]) })),
    total_pairs: rows.length,
    returned: Math.min(limit, rows.length),
    sampled: limit < rows.length,
    pearson_r: round(pearson(rows.map((r) => r[x]), rows.map((r) => r[y])), 6),
  };
}

/* ─── Ask AI ─── */

function answerFor(question: string, datasetId?: string): QueryResponse {
  const q = question.toLowerCase();
  const summary = summaryFor(datasetId);
  const common = { question, confidence: 'high' };

  if (/(product|item|sku|sell)/.test(q)) {
    return {
      ...common,
      answer: `Your top product is ${summary.top_products[0].name}, with about ${Math.round((summary.top_products[0].revenue / summary.total_revenue) * 100)}% of revenue. The top five products together account for roughly 80%.`,
      insights: ['Atta and rice together bring in more than half of staple revenue.', 'Salt sells steadily but at a low value per order.'],
      prescriptive_actions: [
        { priority: 1, action: 'Keep Aashirvaad Atta 10kg in stock at all times.', expected_impact: 'Avoids lost sales on your best seller.', timeframe: 'This week' },
        { priority: 2, action: 'Bundle Toor Dal with Basmati Rice.', expected_impact: 'Raises the average order value.', timeframe: 'Next 30 days' },
      ],
      charts: [{ type: 'bar', title: 'Top products by revenue', description: 'Last 180 days', x_key: 'product', y_keys: ['revenue'], data: summary.top_products.map((p) => ({ product: p.name, revenue: p.revenue })) }],
      generated_sql: 'SELECT product_name AS product, SUM(revenue) AS revenue FROM dataset GROUP BY 1 ORDER BY 2 DESC LIMIT 5',
      raw_data: summary.top_products.map((p) => ({ product: p.name, revenue: p.revenue })),
    };
  }
  if (/(category|segment|channel)/.test(q)) {
    return {
      ...common,
      answer: `${summary.top_categories[0].name} is your largest category. Dairy and Beverages follow.`,
      insights: ['Staples are steady across the week.', 'Snacks spike on weekends.'],
      prescriptive_actions: [{ priority: 2, action: 'Add a weekend snack display near the counter.', expected_impact: 'Captures weekend impulse purchases.', timeframe: 'Next 2 weeks' }],
      charts: [{ type: 'pie', title: 'Revenue by category', x_key: 'category', y_keys: ['value'], data: summary.dimensions.category.map((row) => ({ ...row })) }],
      generated_sql: 'SELECT category, SUM(revenue) AS value FROM dataset GROUP BY 1 ORDER BY 2 DESC',
      raw_data: summary.dimensions.category,
    };
  }
  return {
    ...common,
    confidence: 'medium',
    answer: 'Revenue has grown slowly over the last six months, with a clear weekend lift and a festive peak about a month ago.',
    insights: ['Weekends run roughly 20% above weekdays.', 'The festive peak was about 35% above the surrounding weeks.'],
    prescriptive_actions: [{ priority: 1, action: 'Staff up for Saturday and Sunday.', expected_impact: 'Keeps queues short at your busiest hours.', timeframe: 'This week' }],
    charts: [{ type: 'line', title: 'Daily revenue', x_key: 'date', y_keys: ['value'], data: summary.timeline.filter((_, i) => i % 3 === 0) }],
    generated_sql: 'SELECT order_date AS date, SUM(revenue) AS value FROM dataset GROUP BY 1 ORDER BY 1',
    raw_data: summary.timeline.slice(-14),
  };
}

/* ─── Training jobs ─── */

const jobStarts = new Map<string, { startedAt: number; datasetId: string | null; granularity: string }>();

function jobState(jobId: string): TrainingJob {
  const entry = jobStarts.get(jobId);
  if (!entry) throw new ApiError({ status: 404, type: 'NOT_FOUND', message: `Training job '${jobId}' not found.` });
  const elapsed = Date.now() - entry.startedAt;
  const status = elapsed < 1200 ? 'queued' : elapsed < 4800 ? 'running' : 'succeeded';
  const iso = (ms: number) => new Date(entry.startedAt + ms).toISOString();
  return {
    job_id: jobId,
    dataset_id: entry.datasetId,
    granularity: entry.granularity,
    status,
    error: null,
    created_at: iso(0),
    started_at: status === 'queued' ? null : iso(1200),
    finished_at: status === 'succeeded' ? iso(4800) : null,
    metrics: status === 'succeeded' ? { data_points_used: 180, model_tier: demoModelTier } : null,
  };
}

/* ─── The source ─── */

const health: Health = {
  status: 'ok',
  components: { database: 'healthy', model_directory: 'accessible', qdrant: 'reachable', llm_api_key: 'configured' },
};

export const demoSource: DataSource = {
  async getHealth() {
    await delay(80);
    return health;
  },

  async ingestCsv(file) {
    await delay(600);
    const id = `demo-${Date.now().toString(16)}-4a2b-8c3d-9e0f1a2b3c4d`.slice(0, 36);
    uploads = [{ id, filename: file.name, entity_type: 'dynamic', row_count: 1200, warning_count: 0, error_count: 0, status: 'completed', created_at: new Date().toISOString() }, ...uploads];
    return {
      dataset_id: id,
      table_name: `dataset_${id.replace(/-/g, '')}`,
      row_count: 1200,
      columns: [
        { name: 'order_date', type: 'datetime64[ns]' },
        { name: 'units_sold', type: 'int64' },
        { name: 'revenue', type: 'float64' },
      ],
      column_mapping: { primary_date: 'order_date', target_metric: 'revenue', dimensions: ['category'], numerical_columns: ['units_sold'], categorical_columns: ['category'] },
      warnings: [],
    };
  },

  async getUploads(page = 1, pageSize = 20) {
    await delay();
    const start = (page - 1) * pageSize;
    return {
      records: uploads.slice(start, start + pageSize),
      pagination: { page, page_size: pageSize, total_count: uploads.length, total_pages: Math.max(1, Math.ceil(uploads.length / pageSize)) },
    };
  },

  async deleteUpload(uploadId) {
    await delay();
    const found = uploads.find((u) => u.id === uploadId);
    if (!found) throw new ApiError({ status: 404, type: 'NOT_FOUND', message: `Dataset '${uploadId}' not found.` });
    uploads = uploads.filter((u) => u.id !== uploadId);
    return { dataset_id: uploadId, table_name: `dataset_${uploadId.replace(/-/g, '')}`, models_removed: 1 };
  },

  async getSummary(datasetId) {
    await delay();
    return summaryFor(datasetId);
  },
  async getProfile(datasetId) {
    await delay();
    return profileFor(datasetId);
  },
  async getCorrelations(datasetId, method = 'pearson') {
    await delay();
    return correlationsFor(datasetId, method);
  },
  async getScatter(datasetId, x, y, limit = 500) {
    await delay();
    return scatterFor(datasetId, x, y, limit);
  },

  async startTraining(datasetId, granularity = 'daily') {
    await delay(150);
    const jobId = `demo-job-${Date.now().toString(36)}`;
    jobStarts.set(jobId, { startedAt: Date.now(), datasetId: datasetId ?? null, granularity });
    return jobState(jobId);
  },
  async getTrainingJob(jobId) {
    await delay(60);
    return jobState(jobId);
  },

  async getForecast(horizonDays = 30, datasetId) {
    await delay();
    const seed = seedFor(datasetId);
    return {
      model_info: { trained_at: `${isoDay(-2)}T08:00:00`, data_points_used: 180, granularity: 'daily', dataset_id: seed.id },
      dataset_id: seed.id,
      history: historySeries(seed),
      forecast: forecastSeries(seed, horizonDays),
    };
  },
  async getForecastStatus(datasetId) {
    await delay(120);
    const seed = seedFor(datasetId);
    return {
      model_available: true,
      dataset_id: seed.id,
      trained_at: `${isoDay(-2)}T08:00:00`,
      data_points_used: 180,
      granularity: 'daily',
      date_range: { start: isoDay(-180), end: isoDay(-1) },
      model_tier: demoModelTier,
    };
  },
  async getBacktest(testDays = 14, datasetId): Promise<Backtest> {
    await delay();
    const seed = seedFor(datasetId);
    return {
      dataset_id: seed.id,
      data_points_used: 180,
      test_days: testDays,
      train_points: 180 - testDays,
      mae: round(14200 * seed.scale, 0),
      rmse: round(18900 * seed.scale, 0),
      mape: 7.4,
      model_tier: demoModelTier,
      test_start: isoDay(-testDays),
      test_end: isoDay(-1),
    };
  },

  async simulate(body) {
    await delay(260);
    const sim = runSimulation(body);
    if (body.save) {
      seedRuns();
      const id = `demo-run-${savedRuns.length + 1}`;
      savedRuns = [toSaved(sim, body.name ?? null, body.mutations, body.horizon_days ?? 30, new Date().toISOString(), id), ...savedRuns];
      return { ...sim, run_id: id };
    }
    return sim;
  },

  async getSimulations(datasetId, page = 1, pageSize = 20) {
    await delay();
    seedRuns();
    const rows = savedRuns.filter((r) => !datasetId || r.dataset_id === datasetId);
    const start = (page - 1) * pageSize;
    return {
      records: rows.slice(start, start + pageSize),
      pagination: { page, page_size: pageSize, total_count: rows.length, total_pages: Math.max(1, Math.ceil(rows.length / pageSize)) },
    };
  },

  async compareSimulations(ids): Promise<SimulationComparison> {
    await delay();
    seedRuns();
    const runs = ids.map((id) => savedRuns.find((r) => r.id === id));
    if (runs.some((r) => !r)) throw new ApiError({ status: 404, type: 'NOT_FOUND', message: 'One or more saved scenarios were not found.' });
    const found = runs as SavedSimulation[];
    const pick = (section: 'baseline_summary' | 'simulated_summary' | 'delta_metrics', key: string) => found.map((r) => (r[section][key] as number | undefined) ?? null);
    return {
      run_ids: found.map((r) => r.id),
      runs: found.map((r) => ({ id: r.id, name: r.name, dataset_id: r.dataset_id, mutations: r.mutations, horizon_days: r.horizon_days, created_at: r.created_at })),
      metrics: [
        { metric: 'baseline_total', values: pick('baseline_summary', 'total') },
        { metric: 'baseline_daily_average', values: pick('baseline_summary', 'daily_average') },
        { metric: 'simulated_total', values: pick('simulated_summary', 'total') },
        { metric: 'simulated_daily_average', values: pick('simulated_summary', 'daily_average') },
        { metric: 'total_delta', values: pick('delta_metrics', 'total_delta') },
        { metric: 'total_delta_pct', values: pick('delta_metrics', 'total_delta_pct') },
      ],
    };
  },

  async getExplainPrescribe(horizonDays = 30, datasetId): Promise<ExplainPrescribe> {
    await delay(300);
    const seed = seedFor(datasetId);
    return {
      forecast_points: forecastSeries(seed, horizonDays),
      shap_drivers: {
        positive: [
          { feature: 'weekly seasonality', contribution: 18400, description: 'Weekends add about ₹18,400 a day over weekdays.' },
          { feature: 'trend', contribution: 6200, description: 'Steady growth adds about ₹6,200 a day over the period.' },
        ],
        negative: [{ feature: 'discount_pct', contribution: -3100, description: 'Lower discounts recently trimmed about ₹3,100 a day.' }],
      },
      anomaly_detected: false,
      anomaly_description: null,
      anomaly_root_cause: null,
      prescriptive_actions: [
        { priority: 1, action: 'Stock up on atta and rice before the weekend peaks.', expected_impact: 'Protects roughly ₹40,000 of weekend sales.', timeframe: 'This week' },
        { priority: 2, action: 'Test a 5% price rise on Sunflower Oil 1L.', expected_impact: 'Raises gross profit with little volume loss.', timeframe: 'Next 2 weeks' },
        { priority: 3, action: 'Plan a small festive promotion for next month.', expected_impact: 'Repeats last season’s 35% lift.', timeframe: 'Next 30 days' },
      ],
      executive_summary: 'Demo data: demand is steady with a growing trend. Expect a strong weekend lift, and keep your top staples in stock.',
    };
  },

  async getExplanation(productId, forecastDate) {
    await delay();
    return {
      product_id: productId,
      forecast_date: forecastDate ?? isoDay(1),
      predicted_value: 196000,
      base_value: 182000,
      top_positive_drivers: [{ feature: 'weekly seasonality', contribution: 18400, description: 'Weekend uplift.' }],
      top_negative_drivers: [{ feature: 'discount_pct', contribution: -3100, description: 'Lower discounts.' }],
      forces: null,
      explanation_text: 'Demo data: weekend demand lifts the forecast above its baseline.',
      method: 'prophet_component_decomposition',
      method_note: 'Factor attribution from the model’s own components (demo data).',
      document_context: null,
    };
  },

  async askQuestion(question, datasetId) {
    await delay(900);
    return answerFor(question, datasetId);
  },

  async uploadDocument(file) {
    await delay(700);
    return { document_id: `demo-doc-${Date.now().toString(36)}`, filename: file.name, chunk_count: 14, status: 'processed' };
  },

  async searchDocuments(query, topK = 4) {
    await delay(400);
    const chunks: DocumentChunk[] = [
      { chunk_id: 'c1', document_id: 'demo-doc-1', score: 0.83, text: 'Delivery lead times from the regional distributor average 3 days, rising to 6 days during the festive season.', metadata: { filename: 'distributor_contract.pdf', page: 2 } },
      { chunk_id: 'c2', document_id: 'demo-doc-1', score: 0.74, text: 'Price revisions require 14 days’ written notice. Bulk orders above 500 units qualify for a 3% rebate.', metadata: { filename: 'distributor_contract.pdf', page: 4 } },
      { chunk_id: 'c3', document_id: 'demo-doc-2', score: 0.66, text: `Search for “${query}”: store opening hours are extended to 11 pm on festive weekends.`, metadata: { filename: 'store_operations.pdf', page: 1 } },
    ];
    return { results: chunks.slice(0, topK) };
  },
};
