import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TRAINING_POLL_MS, useTrainingJob } from '../src/lib/hooks/training';
import { resetSettingsForTests } from '../src/lib/settings';

type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

const job = (status: JobStatus, extra: Record<string, unknown> = {}) => ({
  job_id: 'job-1',
  dataset_id: 'ds-1',
  granularity: 'daily',
  status,
  error: null,
  created_at: null,
  started_at: null,
  finished_at: null,
  metrics: null,
  ...extra,
});

const ok = (status: number, data: unknown) => ({
  ok: true,
  status,
  statusText: 'OK',
  headers: { get: () => null },
  json: async () => ({ status: 'success', data }),
});

function setup(responses: Array<ReturnType<typeof ok>>) {
  const fetchMock = jest.fn();
  responses.forEach((r) => fetchMock.mockResolvedValueOnce(r));
  global.fetch = fetchMock as unknown as typeof fetch;

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useTrainingJob('ds-1'), { wrapper });
  return { fetchMock, invalidate, ...hook };
}

describe('useTrainingJob', () => {
  beforeEach(() => {
    resetSettingsForTests();
    window.localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('starts idle', () => {
    const { result } = setup([]);
    expect(result.current.status).toBe('idle');
    expect(result.current.isActive).toBe(false);
  });

  it('follows a job from queued to running to succeeded, then refetches the forecast', async () => {
    const { result, fetchMock, invalidate } = setup([
      ok(202, job('queued')),
      ok(200, job('running')),
      ok(200, job('succeeded', { metrics: { data_points_used: 90 } })),
    ]);

    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('queued'));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/forecast/train');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ granularity: 'daily', dataset_id: 'ds-1' });
    expect(result.current.isActive).toBe(true);

    // First poll: running.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(TRAINING_POLL_MS);
    });
    await waitFor(() => expect(result.current.status).toBe('running'));
    expect(fetchMock.mock.calls[1][0]).toBe('/api/forecast/jobs/job-1');
    expect(result.current.isActive).toBe(true);
    expect(invalidate).not.toHaveBeenCalled();

    // Second poll: done.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(TRAINING_POLL_MS);
    });
    await waitFor(() => expect(result.current.status).toBe('succeeded'));
    expect(result.current.succeeded).toBe(true);
    expect(result.current.isActive).toBe(false);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['live', 'forecast', 'ds-1'] }));

    // It stops polling once finished.
    const calls = fetchMock.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(TRAINING_POLL_MS * 3);
    });
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('shows the job’s own error text when training fails', async () => {
    const { result, invalidate } = setup([
      ok(202, job('queued')),
      ok(200, job('failed', { error: 'Need at least 30 data points; found 12.' })),
    ]);

    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('queued'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(TRAINING_POLL_MS);
    });
    await waitFor(() => expect(result.current.status).toBe('failed'));
    expect(result.current.failed).toBe(true);
    expect(result.current.failureMessage).toBe('Need at least 30 data points; found 12.');
    expect(result.current.isActive).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('surfaces a request error when the job cannot be started', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      headers: { get: () => null },
      json: async () => ({ status: 'error', error: { type: 'BACKEND_UNREACHABLE', message: 'The CogniTwin backend is not reachable.', details: [] } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useTrainingJob('ds-1'), {
      wrapper: ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });

    act(() => result.current.start());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.message).toMatch(/not reachable/);
    expect(result.current.status).toBe('idle');
  });
});
