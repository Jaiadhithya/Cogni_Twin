import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatasetsView } from '../src/components/datasets/datasets-view';
import { DocumentsView } from '../src/components/documents/documents-view';
import { ScenariosView } from '../src/components/scenarios/scenarios-view';
import { SettingsView } from '../src/components/settings/settings-view';
import { describeCorrelation } from '../src/lib/explorer';
import { parseLeversFromError, toMutations } from '../src/lib/forecast';
import { validateQuestion } from '../src/lib/ask';
import { fail, mockBackend, ok, renderApp, uploadsNone, uploadsOne } from './helpers/render-app';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/datasets',
  useSearchParams: () => new URLSearchParams(),
}));

const run = (id: string, name: string, total: number) => ({
  id,
  dataset_id: 'ds-1',
  name,
  mutations: { unit_price: '+5%' },
  horizon_days: 30,
  baseline_summary: { total: 1000, daily_average: 33 },
  simulated_summary: { total, daily_average: 30 },
  delta_metrics: { total_delta: total - 1000, total_delta_pct: ((total - 1000) / 1000) * 100 },
  created_at: '2026-03-01T10:00:00',
});

describe('Datasets', () => {
  it('Empty: offers to upload', async () => {
    mockBackend({ '/api/data/uploads': uploadsNone });
    renderApp(<DatasetsView />);
    expect(await screen.findByText('No datasets yet')).toBeInTheDocument();
  });

  it('Error: shows the reason and a retry', async () => {
    mockBackend({ '/api/data/uploads': () => fail(500, 'INTERNAL_ERROR', 'Cannot reach the database.') });
    renderApp(<DatasetsView />);
    expect(await screen.findByText('Cannot reach the database.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('Delete: the confirm dialog names the dataset and says its model goes too; Cancel deletes nothing', async () => {
    const { calls } = mockBackend({ '/api/data/uploads': uploadsOne });
    renderApp(<DatasetsView />);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete kirana_sales.csv' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Delete “kirana_sales.csv”\?/)).toBeInTheDocument();
    expect(within(dialog).getByText(/also deletes its trained forecasting model/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.some((u) => u.includes('DELETE'))).toBe(false);
  });

  it('Delete: confirming calls DELETE /data/uploads/{id}', async () => {
    const { fn } = mockBackend({
      '/api/data/uploads/ds-1': () => ok({ dataset_id: 'ds-1', table_name: 't', models_removed: 1 }),
      '/api/data/uploads': uploadsOne,
    });
    renderApp(<DatasetsView />);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete kirana_sales.csv' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete dataset' }));
    await waitFor(() => expect(fn.mock.calls.some(([url, init]) => String(url) === '/api/data/uploads/ds-1' && (init as RequestInit).method === 'DELETE')).toBe(true));
  });
});

describe('Scenarios', () => {
  const list = (runs: unknown[]) => ok({ records: runs }, { pagination: { page: 1, page_size: 20, total_count: runs.length, total_pages: 1 } });

  it('Empty: explains how to save a scenario', async () => {
    mockBackend({ '/api/data/uploads': uploadsOne, '/api/forecast/simulations': () => list([]) });
    renderApp(<ScenariosView />);
    expect(await screen.findByText('No scenarios saved yet')).toBeInTheDocument();
  });

  it('Error: shows the reason', async () => {
    mockBackend({ '/api/data/uploads': uploadsOne, '/api/forecast/simulations': () => fail(500, 'INTERNAL_ERROR', 'Scenario store unavailable.') });
    renderApp(<ScenariosView />);
    expect(await screen.findByText('Scenario store unavailable.')).toBeInTheDocument();
  });

  it('Selecting two scenarios compares them; at most four can be selected', async () => {
    const runs = ['a', 'b', 'c', 'd', 'e'].map((id, i) => run(id, `Scenario ${id}`, 900 + i * 50));
    const { calls } = mockBackend({
      '/api/data/uploads': uploadsOne,
      '/api/forecast/simulations/compare': () =>
        ok({
          run_ids: ['a', 'b'],
          runs: [{ id: 'a', name: 'Scenario a', mutations: {}, horizon_days: 30, created_at: null, dataset_id: 'ds-1' }, { id: 'b', name: 'Scenario b', mutations: {}, horizon_days: 30, created_at: null, dataset_id: 'ds-1' }],
          metrics: [{ metric: 'total_delta', values: [-100, -50] }],
        }),
      '/api/forecast/simulations': () => list(runs),
    });
    renderApp(<ScenariosView />);
    const boxes = await screen.findAllByRole('checkbox');
    await userEvent.click(boxes[0]);
    expect(screen.getByText('Select one more to compare.')).toBeInTheDocument();
    expect(calls.some((u) => u.includes('/compare'))).toBe(false);
    await userEvent.click(boxes[1]);
    expect(await screen.findByText('Side by side')).toBeInTheDocument();
    expect(calls.find((u) => u.includes('/compare'))).toContain('ids=a%2Cb');
    await userEvent.click(boxes[2]);
    await userEvent.click(boxes[3]);
    expect(boxes[4]).toBeDisabled();
  });
});

describe('Documents', () => {
  it('says plainly that listing and deleting are not available', async () => {
    mockBackend({ '/api/health': () => ok({}) });
    renderApp(<DocumentsView />);
    expect(screen.getByText(/cannot list or delete uploaded documents yet/)).toBeInTheDocument();
  });

  it('Degraded: shows "document search is offline" and disables upload and search', async () => {
    mockBackend({
      '/api/health': () => ({ body: { status: 'degraded', components: { database: 'healthy', model_directory: 'accessible', qdrant: 'unreachable: ConnectError', llm_api_key: 'configured' } } }),
    });
    renderApp(<DocumentsView />);
    expect(await screen.findByText(/Document search is offline/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
  });
});

describe('Settings', () => {
  it('has a demo switch that is off by default, a format preview and about', async () => {
    mockBackend({ '/api/health': () => ({ body: { status: 'ok', components: { database: 'healthy', model_directory: 'accessible', qdrant: 'reachable', llm_api_key: 'configured' } } }) });
    renderApp(<SettingsView />);
    expect(screen.getByRole('switch', { name: 'Show sample data' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('₹1,24,50,000')).toBeInTheDocument();
    expect(screen.getByText('₹12.5 L')).toBeInTheDocument();
    expect(await screen.findByText('All systems normal')).toBeInTheDocument();
  });
});

describe('helpers', () => {
  it('reads levers out of the backend error message', () => {
    expect(parseLeversFromError("No recognized levers provided for simulation. Available levers: ['unit_price', 'marketing_spend']")).toEqual(['unit_price', 'marketing_spend']);
    expect(parseLeversFromError('Available levers: []')).toEqual([]);
    expect(parseLeversFromError('Something else')).toBeNull();
  });

  it('builds mutation strings and leaves zero levers out', () => {
    expect(toMutations({ unit_price: 10, marketing_spend: 0, discount: -5 })).toEqual({ unit_price: '+10%', discount: '-5%' });
  });

  it('validates questions like the backend does (5 to 500 characters)', () => {
    expect(validateQuestion('hi')).toMatch(/at least 5/);
    expect(validateQuestion('x'.repeat(501))).toMatch(/under 500/);
    expect(validateQuestion('How are sales?')).toBeNull();
  });

  it('describes correlation strength', () => {
    expect(describeCorrelation(0.8)).toBe('very strong positive');
    expect(describeCorrelation(-0.35)).toBe('moderate negative');
    expect(describeCorrelation(0.02)).toBe('negligible');
    expect(describeCorrelation(null)).toBe('not computable');
  });
});
