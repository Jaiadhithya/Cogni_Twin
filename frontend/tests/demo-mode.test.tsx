import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DemoBadge } from '../src/components/layout/demo-badge';
import { useSummary } from '../src/lib/hooks/queries';
import { resetSettingsForTests, updateSettings, useSettings } from '../src/lib/settings';
import { DEMO_DATASET_ID } from '../src/lib/demo/series';

function Probe() {
  const summary = useSummary(DEMO_DATASET_ID);
  const { demoMode } = useSettings();
  return (
    <div>
      <DemoBadge />
      <p data-testid="mode">{demoMode ? 'demo' : 'live'}</p>
      {summary.isError && <p role="alert">{summary.error.message}</p>}
      {summary.data && <p data-testid="rows">{summary.data.kpis.total_rows}</p>}
    </div>
  );
}

function renderProbe() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );
}

const liveSummary = () =>
  jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: () => null },
    json: async () => ({ status: 'success', data: { kpis: { total_rows: 777, total_target: 1, avg_target: 1 } } }),
  });

describe('demo mode', () => {
  beforeEach(() => {
    resetSettingsForTests();
    window.localStorage.clear();
  });

  it('is off by default: no badge, and the backend is called', async () => {
    const fetchMock = liveSummary();
    global.fetch = fetchMock as unknown as typeof fetch;

    renderProbe();
    expect(screen.getByTestId('mode')).toHaveTextContent('live');
    expect(screen.queryByText('Demo data')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('rows')).toHaveTextContent('777'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/data/summary?dataset_id=${DEMO_DATASET_ID}`);
  });

  it('when on: shows the Demo data badge and makes no network calls', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    updateSettings({ demoMode: true });

    renderProbe();
    expect(screen.getByTestId('mode')).toHaveTextContent('demo');
    expect(screen.getByText('Demo data')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('rows')).toHaveTextContent('48210'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('switching on and off swaps the source without mixing caches', async () => {
    const fetchMock = liveSummary();
    global.fetch = fetchMock as unknown as typeof fetch;

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('rows')).toHaveTextContent('777'));

    act(() => updateSettings({ demoMode: true }));
    await waitFor(() => expect(screen.getByTestId('rows')).toHaveTextContent('48210'));
    expect(fetchMock).toHaveBeenCalledTimes(1); // the demo read added no request

    act(() => updateSettings({ demoMode: false }));
    await waitFor(() => expect(screen.getByTestId('rows')).toHaveTextContent('777'));
    expect(screen.queryByText('Demo data')).not.toBeInTheDocument();
  });

  it('never falls back to demo data when a live request fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      headers: { get: () => null },
      json: async () => ({ status: 'error', error: { type: 'BACKEND_UNREACHABLE', message: 'The CogniTwin backend is not reachable.', details: [] } }),
    }) as unknown as typeof fetch;

    renderProbe();
    expect(await screen.findByRole('alert')).toHaveTextContent('not reachable');
    expect(screen.queryByTestId('rows')).not.toBeInTheDocument();
  });

  it('persists the choice in localStorage', () => {
    updateSettings({ demoMode: true });
    expect(JSON.parse(window.localStorage.getItem('cognitwin:settings') ?? '{}')).toEqual({ demoMode: true });
  });
});
