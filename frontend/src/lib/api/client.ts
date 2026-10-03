import { ApiError, networkError, normalizeError } from './errors';

/** Same-origin base: the browser talks to the Next.js proxy, never to the backend directly. */
export const API_BASE = '/api';

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  query?: Query;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query): string {
  if (!query) return `${API_BASE}${path}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${API_BASE}${path}?${qs}` : `${API_BASE}${path}`;
}

/**
 * Backend success bodies are `{ status: 'success', data, meta? }`. A few endpoints
 * (`/health`, `/ingest/csv`) return the payload bare; those pass through unchanged.
 */
function unwrap<T>(body: unknown): { data: T; meta: Record<string, unknown> | undefined } {
  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    if (record.status === 'success' && 'data' in record) {
      const meta = typeof record.meta === 'object' && record.meta !== null ? (record.meta as Record<string, unknown>) : undefined;
      return { data: record.data as T, meta };
    }
  }
  return { data: body as T, meta: undefined };
}

export interface ApiResult<T> {
  data: T;
  meta?: Record<string, unknown>;
  status: number;
}

/** Low-level call. Throws ApiError on any failure; never substitutes data. */
export async function requestWithMeta<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', query, body, formData, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  let payload: BodyInit | undefined;
  if (formData) {
    payload = formData; // the browser sets the multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), { method, headers, body: payload, signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw networkError(cause);
  }

  const parsed: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw normalizeError(response.status, parsed, response.headers, response.statusText);
  }
  if (parsed === null) {
    throw new ApiError({ status: response.status, type: 'INVALID_RESPONSE', message: 'The server returned an unreadable response.' });
  }
  const { data, meta } = unwrap<T>(parsed);
  return { data, meta, status: response.status };
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await requestWithMeta<T>(path, options)).data;
}
