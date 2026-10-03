import { ApiError, describeError, normalizeError } from '../src/lib/api/errors';
import { request, requestWithMeta } from '../src/lib/api/client';
import { getUploads } from '../src/lib/api/endpoints';

const noHeaders = { get: () => null } as unknown as Headers;
const headersWith = (values: Record<string, string>) =>
  ({ get: (name: string) => values[name.toLowerCase()] ?? null }) as unknown as Headers;

function mockFetch(status: number, body: unknown, headers: Headers = noHeaders) {
  const fn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    headers,
    json: async () => {
      if (body === undefined) throw new Error('no body');
      return body;
    },
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe('normalizeError', () => {
  it('reads the backend error envelope', () => {
    const error = normalizeError(400, { status: 'error', error: { type: 'ML_ERROR', message: 'No trained model.', details: [] } }, noHeaders);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.type).toBe('ML_ERROR');
    expect(error.message).toBe('No trained model.');
    expect(error.requestId).toBeNull();
  });

  it('reads FastAPI detail objects', () => {
    const error = normalizeError(404, { detail: { type: 'NOT_FOUND', message: 'Dataset missing.' } }, noHeaders);
    expect(error.type).toBe('NOT_FOUND');
    expect(error.message).toBe('Dataset missing.');
  });

  it('reads FastAPI detail strings', () => {
    const error = normalizeError(404, { detail: 'Not Found' }, noHeaders);
    expect(error.message).toBe('Not Found');
    expect(error.type).toBe('UNKNOWN_ERROR');
  });

  it('treats a detail array as a validation error and keeps the issues', () => {
    const issues = [{ loc: ['query', 'x'], msg: 'field required' }];
    const error = normalizeError(422, { detail: issues }, noHeaders);
    expect(error.type).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual(issues);
  });

  it('takes the request id from the x-request-id header', () => {
    const error = normalizeError(500, { error: { type: 'INTERNAL_ERROR', message: 'Boom' } }, headersWith({ 'x-request-id': 'abc-123' }));
    expect(error.requestId).toBe('abc-123');
  });

  it('finds the request id the backend quotes inside a 500 message', () => {
    const id = '3f2b8c1e-7a21-4f0e-9a52-0d1c2e3f4a01';
    const error = normalizeError(
      500,
      { detail: { type: 'INTERNAL_ERROR', message: `An internal error occurred. If this persists, quote reference ${id}.` } },
      noHeaders,
    );
    expect(error.requestId).toBe(id);
  });

  it('falls back to the status text, then a generic message', () => {
    expect(normalizeError(502, null, noHeaders, 'Bad Gateway').message).toBe('Bad Gateway');
    expect(normalizeError(500, null, noHeaders).message).toBe('Request failed with status 500');
  });

  it('describes errors in plain language', () => {
    expect(describeError(new ApiError({ status: 502, type: 'BACKEND_UNREACHABLE', message: 'x' }))).toMatch(/not reachable/);
    expect(describeError(new ApiError({ status: 400, type: 'ML_ERROR', message: 'Need 30 points.' }))).toBe('Need 30 points.');
    expect(describeError(new Error('plain'))).toBe('plain');
  });
});

describe('request()', () => {
  afterEach(() => jest.restoreAllMocks());

  it('unwraps the success envelope', async () => {
    mockFetch(200, { status: 'success', data: { ok: true } });
    await expect(request('/x')).resolves.toEqual({ ok: true });
  });

  it('passes bare payloads (health, ingest) through unchanged', async () => {
    mockFetch(200, { status: 'ok', components: { database: 'healthy' } });
    await expect(request('/health')).resolves.toEqual({ status: 'ok', components: { database: 'healthy' } });
  });

  it('throws an ApiError for a failed response and never returns data', async () => {
    mockFetch(400, { status: 'error', error: { type: 'FILE_VALIDATION_ERROR', message: 'Missing a date column.', details: [] } });
    await expect(request('/ingest/csv')).rejects.toMatchObject({ name: 'ApiError', status: 400, type: 'FILE_VALIDATION_ERROR', message: 'Missing a date column.' });
  });

  it('turns a network failure into a NETWORK_ERROR', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    await expect(request('/x')).rejects.toMatchObject({ type: 'NETWORK_ERROR', status: 0 });
  });

  it('rejects an unreadable success body', async () => {
    mockFetch(200, undefined);
    await expect(request('/x')).rejects.toMatchObject({ type: 'INVALID_RESPONSE' });
  });

  it('builds the query string and skips empty values', async () => {
    const fn = mockFetch(200, { status: 'success', data: {} });
    await request('/data/summary', { query: { dataset_id: 'ds-1', page: 2, empty: '', missing: undefined } });
    expect(fn.mock.calls[0][0]).toBe('/api/data/summary?dataset_id=ds-1&page=2');
  });

  it('sends JSON bodies with a content type', async () => {
    const fn = mockFetch(200, { status: 'success', data: {} });
    await request('/query', { method: 'POST', body: { question: 'hello there' } });
    const init = fn.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"question":"hello there"}');
  });

  it('exposes envelope meta (pagination)', async () => {
    mockFetch(200, { status: 'success', data: { records: [] }, meta: { pagination: { page: 1, page_size: 20, total_count: 0, total_pages: 1 } } });
    const result = await requestWithMeta('/data/uploads');
    expect(result.meta?.pagination).toMatchObject({ total_count: 0 });
  });
});

describe('endpoints', () => {
  it('getUploads returns records with their pagination', async () => {
    mockFetch(200, {
      status: 'success',
      data: { records: [{ id: 'a', filename: 'sales.csv' }] },
      meta: { pagination: { page: 1, page_size: 20, total_count: 1, total_pages: 1 } },
    });
    const page = await getUploads();
    expect(page.records).toHaveLength(1);
    expect(page.pagination?.total_count).toBe(1);
  });
});
