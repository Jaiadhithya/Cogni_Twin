import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { DashboardView } from '../src/components/dashboard/dashboard-view';
import { fail, mockBackend, ok, renderApp, uploadsNone, uploadsOne } from './helpers/render-app';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

const timeline = Array.from({ length: 70 }, (_, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, value: 1000 + i * 10 }));
const summary = {
  dataset_id: 'ds-1',
  target_metric_name: 'revenue',
  kpis: { total_rows: 500, total_target: 2_500_000, avg_target: 5000 },
  timeline,
  dimensions: {},
  total_revenue: 2_500_000,
  total_orders: 500,
  top_products: [{ name: 'Atta 10kg', revenue: 900_000 }],
  top_categories: [{ name: 'Staples', revenue: 1_500_000 }],
  daily_revenue: timeline,
  data_status: { sales_count: 500, products_count: 1 },
};

describe('Dashboard: the four states', () => {
  it('Loading: shows skeletons while the dataset list loads', () => {
    mockBackend({ '/api/data/uploads': () => 'pending', '/api/health': () => 'pending' });
    const { container } = renderApp(<DashboardView />);
    expect(container.querySelector('.skeleton')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('Loading: shows page-shaped skeletons while the summary loads', async () => {
    mockBackend({ '/api/data/uploads': uploadsOne, '/api/data/summary': () => 'pending', '/api/forecast': () => 'pending' });
    const { container } = renderApp(<DashboardView />);
    await waitFor(() => expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(3));
  });

  it('Empty: with no datasets, says so and offers to upload', async () => {
    mockBackend({ '/api/data/uploads': uploadsNone });
    renderApp(<DashboardView />);
    expect(await screen.findByText('No dataset yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /upload a csv/i })).toHaveAttribute('href', '/upload');
  });

  it('Error: a failed dataset list shows the real reason and a retry', async () => {
    mockBackend({ '/api/data/uploads': () => fail(500, 'INTERNAL_ERROR', 'Database is down. Quote reference 3f2b8c1e-7a21-4f0e-9a52-0d1c2e3f4a01.') });
    renderApp(<DashboardView />);
    expect(await screen.findByText(/Database is down/)).toBeInTheDocument();
    expect(screen.getByText('3f2b8c1e-7a21-4f0e-9a52-0d1c2e3f4a01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('Error: a failed summary shows the error, never made-up numbers', async () => {
    mockBackend({
      '/api/data/uploads': uploadsOne,
      '/api/data/summary': () => fail(502, 'BACKEND_UNREACHABLE', 'The CogniTwin backend is not reachable.'),
    });
    renderApp(<DashboardView />);
    expect(await screen.findByText('We could not load your dashboard')).toBeInTheDocument();
    expect(screen.queryByText(/Total revenue/i)).not.toBeInTheDocument();
    expect(screen.queryByText('₹25 L')).not.toBeInTheDocument();
  });

  it('Data: shows the KPIs, the breakdown and the model panels, each with its own state', async () => {
    mockBackend({
      '/api/data/uploads': uploadsOne,
      '/api/data/summary': () => ok(summary),
      '/api/forecast/status': () => ok({ model_available: false }),
      '/api/forecast/backtest': () => fail(400, 'ML_ERROR', 'No trained model'),
      '/api/forecast/explain-prescribe': () => fail(400, 'ML_ERROR', 'No trained forecasting model is available.'),
    });
    renderApp(<DashboardView />);
    expect(await screen.findByText('Total revenue')).toBeInTheDocument();
    expect(screen.getByText('₹25 L')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Atta 10kg')).toBeInTheDocument();
    // model panels fail or are empty independently of the rest of the page
    expect(await screen.findByText('Recommendations unavailable')).toBeInTheDocument();
    expect(await screen.findByText('No trained model yet')).toBeInTheDocument();
  });

  it('Data: shows the insight and model health when the model exists', async () => {
    mockBackend({
      '/api/data/uploads': uploadsOne,
      '/api/data/summary': () => ok(summary),
      '/api/forecast/status': () => ok({ model_available: true, trained_at: '2026-03-02T08:00:00', data_points_used: 180, granularity: 'daily', model_tier: 'prophet' }),
      '/api/forecast/backtest': () => ok({ mape: 7.4, test_days: 14, mae: 1, rmse: 1, data_points_used: 180, train_points: 166, test_start: '2026-02-01', test_end: '2026-02-14' }),
      '/api/forecast/explain-prescribe': () =>
        ok({
          forecast_points: [],
          shap_drivers: { positive: [], negative: [] },
          anomaly_detected: false,
          prescriptive_actions: [{ priority: 1, action: 'Stock up on atta', expected_impact: 'Protects weekend sales', timeframe: 'this week' }],
          executive_summary: 'Demand is steady.',
        }),
    });
    renderApp(<DashboardView />);
    expect(await screen.findByText('Demand is steady.')).toBeInTheDocument();
    expect(screen.getByText('Stock up on atta')).toBeInTheDocument();
    expect(await screen.findByText('7.4%')).toBeInTheDocument();
    expect(screen.getByText('Prophet')).toBeInTheDocument();
  });
});
