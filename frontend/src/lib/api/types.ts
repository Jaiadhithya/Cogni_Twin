/**
 * API types. Anything the backend schema declares precisely comes from the generated
 * `schema.d.ts` (npm run gen:api). Endpoints the backend types as `Any` / `dict` are
 * hand-typed below, next to the generated ones, from the service code that builds them.
 */
import type { components } from './schema';

type Schemas = components['schemas'];

/* ─── Generated (precise) ─── */
export type TrainingJob = Schemas['TrainingJobData'];
export type TrainingJobStatus = TrainingJob['status'];
export type ForecastStatus = Schemas['ForecastStatusResponseData'];
export type ForecastPredict = Schemas['ForecastPredictResponseData'];
export type ForecastPoint = Schemas['ForecastPoint'];
export type HistoryPoint = Schemas['HistoryPoint'];
export type Backtest = Schemas['BacktestResponseData'];
export type SimulationRequest = Schemas['SimulationRequest'];
/** What a caller sends: the schema's defaults (save, horizon) are optional. */
export type SimulationInput = Omit<SimulationRequest, 'save' | 'horizon_days'> & { save?: boolean; horizon_days?: number };
export type SimulationPoint = Schemas['SimulationPointSchema'];
export type SavedSimulation = Schemas['SavedSimulationData'];
export type SimulationComparison = Schemas['SimulationComparisonData'];
export type ExplainPrescribe = Schemas['ExplainPrescribeResponseData'];
export type PrescriptiveAction = Schemas['src__api__schemas__explain_prescribe__PrescriptiveAction'];
export type AnomalyRootCause = Schemas['AnomalyRootCause'];
export type ShapExplanation = Schemas['ShapExplanationResponse'];
export type QueryResponse = Schemas['QueryResponseData'];
export type ChartSpec = Schemas['ChartSpec'];
export type DocumentUpload = Schemas['DocumentUploadResponse'];
export type DocumentSearch = Schemas['DocumentSearchResponse'];
export type DocumentChunk = Schemas['ChunkResponse'];
export type TrainGranularity = Schemas['ForecastTrainRequest']['granularity'];

/* ─── Envelope meta ─── */
export interface PaginationMeta {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
}

export interface Paged<T> {
  records: T[];
  pagination: PaginationMeta | null;
}

/* ─── Health (returned bare, not enveloped) ─── */
/** e.g. "healthy", "reachable", "unreachable: ConnectError". */
export type ComponentState = string;

export interface Health {
  status: 'ok' | 'degraded';
  components: {
    database: ComponentState;
    model_directory: ComponentState;
    qdrant: ComponentState;
    llm_api_key: ComponentState;
  } & Record<string, ComponentState>;
}

/* ─── Ingest (returned bare, not enveloped) ─── */
export interface IngestColumn {
  name: string;
  type: string;
}

export interface IngestResult {
  dataset_id: string;
  table_name: string;
  row_count: number;
  columns: IngestColumn[];
  column_mapping: {
    primary_date?: string | null;
    target_metric?: string | null;
    dimensions?: string[];
    numerical_columns?: string[];
    categorical_columns?: string[];
  } & Record<string, unknown>;
  warnings: string[];
}

/* ─── Uploads / datasets ─── */
export interface UploadRecord {
  id: string;
  filename: string;
  entity_type: string;
  row_count: number;
  warning_count: number;
  error_count: number;
  status: string;
  created_at: string | null;
}

export interface DeleteDatasetResult {
  dataset_id: string;
  table_name: string;
  models_removed: number;
}

/* ─── /data/summary ─── */
export interface NameRevenue {
  name: string;
  revenue: number;
}

export interface SummaryDimensionRow {
  category: string;
  value: number;
}

export interface DataSummary {
  dataset_id?: string;
  target_metric_name?: string;
  primary_date_name?: string;
  metadata?: {
    target_metric: string;
    numerical_columns: string[];
    categorical_columns: string[];
  };
  kpis: { total_rows: number; total_target: number; avg_target: number };
  timeline: Array<{ date: string; value: number }>;
  dimensions: Record<string, SummaryDimensionRow[]>;
  total_revenue: number;
  total_orders: number;
  top_products: NameRevenue[];
  top_categories: NameRevenue[];
  daily_revenue: Array<{ date: string; value: number }>;
  data_status: { sales_count: number; products_count: number };
}

/* ─── /data/{id}/profile | correlations | scatter ─── */
export interface NumericColumnProfile {
  column: string;
  count: number;
  nulls: number;
  mean: number | null;
  median: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  iqr: number | null;
  skewness: number | null;
}

export interface CategoricalColumnProfile {
  column: string;
  count: number;
  nulls: number;
  cardinality: number;
  top_values: Array<{ value: string; count: number }>;
}

export interface DatasetProfile {
  dataset_id: string;
  row_count: number;
  numeric: NumericColumnProfile[];
  categorical: CategoricalColumnProfile[];
  skipped_columns: string[];
  notes: string[];
}

export type CorrelationMethod = 'pearson' | 'spearman';

export interface DatasetCorrelations {
  dataset_id: string;
  method: CorrelationMethod;
  columns: string[];
  /** matrix[row][col]; null when a column is constant. */
  matrix: Array<Array<number | null>>;
  /** Pairwise-complete sample size of every cell. */
  n: number[][];
  sampled: boolean;
  sample_size: number;
}

export interface DatasetScatter {
  dataset_id: string;
  x: string;
  y: string;
  /** Each point is keyed by the x and y column names. */
  points: Array<Record<string, number>>;
  total_pairs: number;
  returned: number;
  sampled: boolean;
  pearson_r: number | null;
}

/* ─── /forecast/simulate: the fields the backend types as dicts ─── */
export interface IntervalBounds {
  lower: number[];
  upper: number[];
}

export interface UncertaintyLevel {
  /** Present for split-conformal intervals. */
  half_width?: number;
  baseline: IntervalBounds | null;
  scenario: IntervalBounds | null;
}

export interface SimulationUncertainty {
  method: 'split_conformal' | 'model_intervals';
  calibration_points: number | null;
  dates: string[];
  /** Keyed by confidence level, e.g. "80", "95". */
  levels: Record<string, UncertaintyLevel>;
  notes: string[];
}

export interface MarginGuardrail {
  triggered: boolean;
  message: string | null;
}

export type SimulationProfit =
  | { available: false; reason: string; profit: null }
  | {
      available: true;
      reason: null;
      baseline_gross_profit: number;
      simulated_gross_profit: number;
      delta: number;
      delta_pct: number | null;
      unit_cost: number;
      cost_source: string;
      price_column: string | null;
      marketing_column: string | null;
      margin_guardrail: MarginGuardrail;
      assumptions: string[];
    };

export interface PriceElasticityFit {
  elasticity: number | null;
  std_err: number | null;
  t_stat: number | null;
  r2: number | null;
  n: number;
  controls: string[];
  usable: boolean;
  reason?: string | null;
}

export interface OptimalPrice {
  price: number | null;
  reason: string | null;
  elasticity?: number;
  unit_cost?: number;
}

export interface SimulationPricing {
  elasticity: PriceElasticityFit | null;
  optimal_price: OptimalPrice;
}

/** One lever's contribution to the scenario. */
export interface LeverForce {
  feature: string;
  mutation: string;
  baseline_impact: number;
  mutated_impact: number;
  delta_force: number;
  contribution_pct: number;
  direction: 'Positive' | 'Negative';
  description: string;
  economic_narrative: string;
}

export interface Simulation {
  dataset_id: string | null;
  run_id: string | null;
  mutations_applied: Record<string, string>;
  baseline_total: number;
  mutated_total: number;
  total_delta: number;
  total_delta_pct: number;
  points: SimulationPoint[];
  available_levers: string[];
  shap_forces: LeverForce[];
  shap_positive_forces: LeverForce[];
  shap_negative_forces: LeverForce[];
  uncertainty: SimulationUncertainty | null;
  profit: SimulationProfit | null;
  pricing: SimulationPricing | null;
}
