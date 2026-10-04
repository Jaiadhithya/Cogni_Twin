/**
 * One typed function per backend endpoint (all under /api/v1, reached through the
 * same-origin /api proxy). These always hit the network; demo mode is applied one
 * layer up, in src/lib/hooks, so a failure here is never papered over with fake data.
 */
import { request, requestWithMeta } from './client';
import type {
  Backtest,
  CorrelationMethod,
  DataSummary,
  DatasetCorrelations,
  DatasetProfile,
  DatasetScatter,
  DeleteDatasetResult,
  DocumentSearch,
  DocumentUpload,
  ExplainPrescribe,
  ForecastPredict,
  ForecastStatus,
  Health,
  IngestResult,
  Paged,
  PaginationMeta,
  QueryResponse,
  SavedSimulation,
  ShapExplanation,
  Simulation,
  SimulationComparison,
  SimulationInput,
  TrainGranularity,
  TrainingJob,
  UploadRecord,
} from './types';

/* ─── Health ─── */
export const getHealth = (signal?: AbortSignal) => request<Health>('/health', { signal });

/* ─── Ingest / datasets ─── */
export function ingestCsv(file: File, signal?: AbortSignal) {
  const formData = new FormData();
  formData.append('file', file);
  return request<IngestResult>('/ingest/csv', { method: 'POST', formData, signal });
}

export async function getUploads(page = 1, pageSize = 20, signal?: AbortSignal): Promise<Paged<UploadRecord>> {
  const { data, meta } = await requestWithMeta<{ records: UploadRecord[] }>('/data/uploads', {
    query: { page, page_size: pageSize },
    signal,
  });
  return { records: data.records, pagination: (meta?.pagination as PaginationMeta | undefined) ?? null };
}

export const deleteUpload = (uploadId: string) =>
  request<DeleteDatasetResult>(`/data/uploads/${encodeURIComponent(uploadId)}`, { method: 'DELETE' });

/* ─── Data ─── */
export const getSummary = (datasetId?: string, signal?: AbortSignal) =>
  request<DataSummary>('/data/summary', { query: { dataset_id: datasetId }, signal });

export const getProfile = (datasetId: string, signal?: AbortSignal) =>
  request<DatasetProfile>(`/data/${encodeURIComponent(datasetId)}/profile`, { signal });

export const getCorrelations = (datasetId: string, method: CorrelationMethod = 'pearson', signal?: AbortSignal) =>
  request<DatasetCorrelations>(`/data/${encodeURIComponent(datasetId)}/correlations`, { query: { method }, signal });

export const getScatter = (datasetId: string, x: string, y: string, limit = 500, signal?: AbortSignal) =>
  request<DatasetScatter>(`/data/${encodeURIComponent(datasetId)}/scatter`, { query: { x, y, limit }, signal });

/* ─── Forecast ─── */
/** Starts a background job (202). Poll getTrainingJob until succeeded/failed. */
export const startTraining = (datasetId?: string, granularity: TrainGranularity = 'daily') =>
  request<TrainingJob>('/forecast/train', { method: 'POST', body: { granularity, dataset_id: datasetId } });

export const getTrainingJob = (jobId: string, signal?: AbortSignal) =>
  request<TrainingJob>(`/forecast/jobs/${encodeURIComponent(jobId)}`, { signal });

export const getForecast = (horizonDays = 30, datasetId?: string, signal?: AbortSignal) =>
  request<ForecastPredict>('/forecast/predict', { query: { horizon_days: horizonDays, dataset_id: datasetId }, signal });

export const getForecastStatus = (datasetId?: string, signal?: AbortSignal) =>
  request<ForecastStatus>('/forecast/status', { query: { dataset_id: datasetId }, signal });

export const getBacktest = (testDays = 14, datasetId?: string, signal?: AbortSignal) =>
  request<Backtest>('/forecast/backtest', { query: { test_days: testDays, dataset_id: datasetId }, signal });

export const simulate = (body: SimulationInput, signal?: AbortSignal) =>
  request<Simulation>('/forecast/simulate', { method: 'POST', body, signal });

export async function getSimulations(
  datasetId?: string,
  page = 1,
  pageSize = 20,
  signal?: AbortSignal,
): Promise<Paged<SavedSimulation>> {
  const { data, meta } = await requestWithMeta<{ records: SavedSimulation[] }>('/forecast/simulations', {
    query: { dataset_id: datasetId, page, page_size: pageSize },
    signal,
  });
  return { records: data.records, pagination: (meta?.pagination as PaginationMeta | undefined) ?? null };
}

export const compareSimulations = (ids: string[], signal?: AbortSignal) =>
  request<SimulationComparison>('/forecast/simulations/compare', { query: { ids: ids.join(',') }, signal });

export const getExplainPrescribe = (horizonDays = 30, datasetId?: string, signal?: AbortSignal) =>
  request<ExplainPrescribe>('/forecast/explain-prescribe', {
    query: { horizon_days: horizonDays, dataset_id: datasetId },
    signal,
  });

export const getExplanation = (productId: string, forecastDate?: string, signal?: AbortSignal) =>
  request<ShapExplanation>(`/forecast/explain/${encodeURIComponent(productId)}`, {
    query: { forecast_date: forecastDate },
    signal,
  });

/* ─── Ask AI ─── */
export const askQuestion = (question: string, datasetId?: string, signal?: AbortSignal) =>
  request<QueryResponse>('/query', { method: 'POST', body: { question, dataset_id: datasetId }, signal });

/* ─── Documents ─── */
export function uploadDocument(file: File, signal?: AbortSignal) {
  const formData = new FormData();
  formData.append('file', file);
  return request<DocumentUpload>('/documents/upload', { method: 'POST', formData, signal });
}

export const searchDocuments = (query: string, topK = 4, signal?: AbortSignal) =>
  request<DocumentSearch>('/documents/search', { method: 'POST', body: { query, top_k: topK }, signal });
