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
export const uploadFile = async (entityType: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload/${entityType}`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    const errorType = data?.error?.type || data?.detail?.type || 'UPLOAD_ERROR';
    const errorMessage = data?.error?.message || data?.detail?.message || 'Upload failed';
    throw new ApiError(response.status, errorType, errorMessage);
  }

  return data.data;
};

// Data API
export const getSummary = (datasetId?: string) => {
  const url = datasetId ? `/data/summary?dataset_id=${datasetId}` : '/data/summary';
  return fetchApi<any>(url);
};
export const getUploadHistory = (page = 1) => fetchApi<any>(`/data/uploads?page=${page}`);
export const getEntityData = (entityType: string, page = 1) => fetchApi<any>(`/data/${entityType}?page=${page}`);

// Forecast API
export const getForecastStatus = () => fetchApi<any>('/forecast/status');
export const trainForecast = (granularity = 'daily') => fetchApi<any>('/forecast/train', {
  method: 'POST',
  body: JSON.stringify({ granularity }),
});
export const getForecast = (horizonDays = 30) => fetchApi<any>(`/forecast/predict?horizon_days=${horizonDays}`);

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
export const getExplanation = (productId: string, forecastDate: string) => fetchApi<any>(`/forecast/explain/${productId}?forecast_date=${forecastDate}`);

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

export const simulateScenario = (mutations: Record<string, string>, horizonDays = 30) =>
  fetchApi<SimulationResponse>('/forecast/simulate', {
    method: 'POST',
    body: JSON.stringify({ mutations, horizon_days: horizonDays }),
  });

export const getExplainPrescribe = (horizonDays = 30) =>
  fetchApi<ExplainPrescribeResponse>(`/forecast/explain-prescribe?horizon_days=${horizonDays}`);
