const API_BASE_URL = '/api';

export class ApiError extends Error {
  constructor(public status: number, public type: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorType = data?.error?.type || data?.detail?.type || 'UNKNOWN_ERROR';
    const errorMessage = data?.error?.message || data?.detail?.message || response.statusText;
    throw new ApiError(response.status, errorType, errorMessage);
  }

  return data.data as T;
}

// Upload API
// Data API
export const getSummary = (datasetId?: string) => {
  const url = datasetId ? `/data/summary?dataset_id=${encodeURIComponent(datasetId)}` : '/data/summary';
  return fetchApi<any>(url);
};
export const getUploadHistory = (page = 1) => fetchApi<any>(`/data/uploads?page=${page}`);

// Forecast API
export const getForecastStatus = (datasetId?: string) => {
  const url = datasetId ? `/forecast/status?dataset_id=${encodeURIComponent(datasetId)}` : '/forecast/status';
  return fetchApi<any>(url);
};

export type TrainingJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface TrainingJob {
  job_id: string;
  dataset_id: string | null;
  granularity: string;
  status: TrainingJobStatus;
  error: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  metrics: Record<string, any> | null;
}

export const startTraining = (granularity = 'daily', datasetId?: string) => fetchApi<TrainingJob>('/forecast/train', {
  method: 'POST',
  body: JSON.stringify({ granularity, dataset_id: datasetId }),
});

export const getTrainingJob = (jobId: string) => fetchApi<TrainingJob>(`/forecast/jobs/${encodeURIComponent(jobId)}`);

const TRAINING_POLL_MS = 2000;
const TRAINING_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Start a background training job and poll until it finishes.
 * Resolves with the succeeded job; rejects with the job's own error if it fails.
 */
export async function trainForecast(
  granularity = 'daily',
  datasetId?: string,
  onStatus?: (status: TrainingJobStatus) => void,
): Promise<TrainingJob> {
  let job = await startTraining(granularity, datasetId);
  const deadline = Date.now() + TRAINING_TIMEOUT_MS;
  onStatus?.(job.status);
  while (job.status === 'queued' || job.status === 'running') {
    if (Date.now() > deadline) {
      throw new ApiError(504, 'TRAINING_TIMEOUT', 'Training is taking longer than expected. Check back in a few minutes.');
    }
    await new Promise((resolve) => setTimeout(resolve, TRAINING_POLL_MS));
    job = await getTrainingJob(job.job_id);
    onStatus?.(job.status);
  }
  if (job.status === 'failed') {
    throw new ApiError(400, 'ML_ERROR', job.error || 'Training failed.');
  }
  return job;
}

export const getForecast = (horizonDays = 30, datasetId?: string) => {
  const queryParams = new URLSearchParams({ horizon_days: String(horizonDays) });
  if (datasetId) queryParams.set('dataset_id', datasetId);
  return fetchApi<any>(`/forecast/predict?${queryParams.toString()}`);
};

// Query API
export const executeQuery = (question: string, datasetId?: string) => fetchApi<any>('/query', {
  method: 'POST',
  body: JSON.stringify({ question, dataset_id: datasetId }),
});

// Document API
export const uploadDocument = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) {
    const errorType = data?.error?.type || data?.detail?.type || 'UPLOAD_ERROR';
    const errorMessage = data?.error?.message || data?.detail?.message || 'Document upload failed';
    throw new ApiError(response.status, errorType, errorMessage);
  }
  return data.data;
};

export const searchDocument = (query: string, topK: number = 4) => fetchApi<any>('/documents/search', {
  method: 'POST',
  body: JSON.stringify({ query, top_k: topK }),
});

// Explain API
// --- Phase 6: Simulation API ---
export interface SimulationPoint {
  date: string;
  baseline_predicted: number;
  mutated_predicted: number;
  delta: number;
  delta_pct: number;
}

export interface SimulationResponse {
  mutations_applied: Record<string, string>;
  baseline_total: number;
  mutated_total: number;
  total_delta: number;
  total_delta_pct: number;
  points: SimulationPoint[];
  available_levers: string[];
  shap_positive_forces?: ShapDriverPayload[];
  shap_negative_forces?: ShapDriverPayload[];
}

export interface ShapDriverPayload {
  feature: string;
  contribution: number;
  description: string;
}

export interface PrescriptiveAction {
  priority: number;
  action: string;
  expected_impact: string;
  timeframe: string;
}

export interface ExplainPrescribeResponse {
  forecast_points: Array<{ date: string; predicted: number; lower_bound: number; upper_bound: number }>;
  shap_drivers: {
    positive: ShapDriverPayload[];
    negative: ShapDriverPayload[];
  };
  anomaly_detected: boolean;
  anomaly_description: string | null;
  prescriptive_actions: PrescriptiveAction[];
  executive_summary: string;
}

export const simulateScenario = (mutations: Record<string, string>, horizonDays = 30, datasetId?: string) =>
  fetchApi<SimulationResponse>('/forecast/simulate', {
    method: 'POST',
    body: JSON.stringify({ mutations, horizon_days: horizonDays, dataset_id: datasetId }),
  });

export const getExplainPrescribe = (horizonDays = 30, datasetId?: string) => {
  const queryParams = new URLSearchParams({ horizon_days: String(horizonDays) });
  if (datasetId) queryParams.set('dataset_id', datasetId);
  return fetchApi<ExplainPrescribeResponse>(`/forecast/explain-prescribe?${queryParams.toString()}`);
};
