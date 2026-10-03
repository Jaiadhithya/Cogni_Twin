/**
 * One error type for every failed backend call.
 *
 * The backend answers failures in two shapes:
 *   { status: 'error', error: { type, message, details } }   (middleware / handlers)
 *   { detail: string | { type, message } | ValidationIssue[] } (raw FastAPI)
 * and may quote a request id inside a 500 message ("quote reference <uuid>").
 */

export class ApiError extends Error {
  readonly status: number;
  readonly type: string;
  readonly requestId: string | null;
  readonly details: unknown[];

  constructor(init: { status: number; type: string; message: string; requestId?: string | null; details?: unknown[] }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.type = init.type;
    this.requestId = init.requestId ?? null;
    this.details = init.details ?? [];
  }

  /** The backend could not be reached at all (proxy 502, network failure). */
  get isUnreachable(): boolean {
    return this.type === 'BACKEND_UNREACHABLE' || this.type === 'NETWORK_ERROR';
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

const REQUEST_ID_IN_MESSAGE = /reference\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Build an ApiError from a failed response. `body` is the parsed JSON (or null). */
export function normalizeError(status: number, body: unknown, headers?: Headers | null, fallbackText?: string): ApiError {
  let type = 'UNKNOWN_ERROR';
  let message: string | undefined;
  let details: unknown[] = [];

  if (isRecord(body)) {
    const envelope = body.error;
    const detail = body.detail;
    if (isRecord(envelope)) {
      type = str(envelope.type) ?? type;
      message = str(envelope.message);
      if (Array.isArray(envelope.details)) details = envelope.details;
    } else if (isRecord(detail)) {
      type = str(detail.type) ?? type;
      message = str(detail.message);
    } else if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail)) {
      type = 'VALIDATION_ERROR';
      details = detail;
      message = 'Invalid request parameters';
    }
  }

  message = message ?? str(fallbackText) ?? `Request failed with status ${status}`;
  const requestId = str(headers?.get('x-request-id')) ?? message.match(REQUEST_ID_IN_MESSAGE)?.[1] ?? null;

  return new ApiError({ status, type, message, requestId, details });
}

/** A fetch() that threw before any response arrived. */
export function networkError(cause: unknown): ApiError {
  const reason = cause instanceof Error ? cause.message : 'unknown error';
  return new ApiError({
    status: 0,
    type: 'NETWORK_ERROR',
    message: `Could not reach the server (${reason}). Check your connection and try again.`,
  });
}

/** Plain-language one-liner for an error state. */
export function describeError(error: unknown): string {
  if (isApiError(error)) {
    if (error.isUnreachable) return 'The CogniTwin backend is not reachable right now.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
