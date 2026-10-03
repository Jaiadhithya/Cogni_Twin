import { trainForecast } from '../src/lib/api';

const job = (status: string, extra: Record<string, unknown> = {}) => ({
  ok: true,
  status: status === 'queued' ? 202 : 200,
  json: async () => ({
    data: { job_id: 'job-1', dataset_id: null, granularity: 'daily', status, error: null, metrics: null, ...extra },
  }),
});

describe('trainForecast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('polls the job until it succeeds and reports each status', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(job('queued'))
      .mockResolvedValueOnce(job('running'))
      .mockResolvedValueOnce(job('succeeded', { metrics: { data_points_used: 90 } }));
    global.fetch = fetchMock as any;
    const statuses: string[] = [];

    const promise = trainForecast('daily', 'ds-1', (s) => statuses.push(s));
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe('succeeded');
    expect(statuses).toEqual(['queued', 'running', 'succeeded']);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/forecast/train');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/forecast/jobs/job-1');
  });

  it('rejects with the job error when training fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(job('queued'))
      .mockResolvedValueOnce(job('failed', { error: 'Need at least 30 data points; found 12.' })) as any;

    const promise = trainForecast('daily');
    const assertion = expect(promise).rejects.toThrow('Need at least 30 data points; found 12.');
    await jest.runAllTimersAsync();
    await assertion;
  });
});
