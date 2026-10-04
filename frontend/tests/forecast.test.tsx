import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForecastView } from '../src/components/forecast/forecast-view';
import { fail, mockBackend, ok, renderApp, uploadsNone, uploadsOne } from './helpers/render-app';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/forecast',
  useSearchParams: () => new URLSearchParams(),
}));

const status = (available: boolean) =>
  ok({ model_available: available, trained_at: '2026-03-02T08:00:00', data_points_used: 180, granularity: 'daily', model_tier: 'prophet' });

const predict = ok({
  model_info: { trained_at: '2026-03-02T08:00:00', data_points_used: 180, granularity: 'daily', dataset_id: 'ds-1' },
  dataset_id: 'ds-1',
  history: [{ date: '2026-03-01', actual: 1000 }],
  forecast: [{ date: '2026-03-02', predicted: 1100, lower_bound: 1000, upper_bound: 1200 }],
});

const leversError = () => fail(400, 'ML_ERROR', "No recognized levers provided for simulation. Available levers: ['unit_price', 'marketing_spend']");

const simulation = {
  dataset_id: 'ds-1',
  run_id: null,
  mutations_applied: { unit_price: '+10%' },
  baseline_total: 1000000,
  mutated_total: 900000,
  total_delta: -100000,
  total_delta_pct: -10,
  points: [{ date: '2026-03-02', baseline_predicted: 1100, mutated_predicted: 990, delta: -110, delta_pct: -10 }],
  available_levers: ['unit_price', 'marketing_spend'],
  shap_forces: [],
  shap_positive_forces: [],
  shap_negative_forces: [],
  uncertainty: { method: 'split_conformal', calibration_points: 28, dates: ['2026-03-02'], levels: {}, notes: [] },
  profit: { available: false, reason: 'No unit cost available. Provide a cost per unit.', profit: null },
  pricing: { elasticity: null, optimal_price: { price: null, reason: 'Demand is inelastic (elasticity -0.6 >= -1); no finite optimum exists.' } },
};

describe('Forecast: the four states', () => {
  it('Loading: shows a chart-shaped skeleton while the model status loads', async () => {
    mockBackend({ '/api/data/uploads': uploadsOne, '/api/forecast/status': () => 'pending' });
    const { container } = renderApp(<ForecastView />);
    await waitFor(() => expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0));
    expect(screen.getByRole('heading', { name: 'Forecast & What-If' })).toBeInTheDocument();
  });

  it('Empty: with no dataset, offers to upload', async () => {
    mockBackend({ '/api/data/uploads': uploadsNone });
    renderApp(<ForecastView />);
    expect(await screen.findByText('No dataset yet')).toBeInTheDocument();
  });

  it('Empty: with no trained model, offers to train one and does not request a forecast', async () => {
    const { calls } = mockBackend({ '/api/data/uploads': uploadsOne, '/api/forecast/status': () => status(false), '/api/data/summary': () => fail(404, 'NOT_FOUND', 'x') });
    renderApp(<ForecastView />);
    expect(await screen.findByText('No trained model yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /train model/i }).length).toBeGreaterThan(0);
    expect(calls.some((u) => u.includes('/forecast/predict'))).toBe(false);
  });

  it('Error: shows the backend’s reason and a retry, with no chart', async () => {
    mockBackend({
      '/api/data/uploads': uploadsOne,
      '/api/forecast/status': () => fail(500, 'INTERNAL_ERROR', 'Could not read the model store.'),
    });
    renderApp(<ForecastView />);
    expect(await screen.findByText('Could not read the model store.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Revenue forecast' })).not.toBeInTheDocument();
  });

  it('Error: a failed forecast request is an error, not demo data', async () => {
    mockBackend({
      '/api/data/uploads': uploadsOne,
      '/api/forecast/status': () => status(true),
      '/api/forecast/predict': () => fail(400, 'ML_ERROR', 'Failed to generate predictions.'),
    });
    renderApp(<ForecastView />);
    expect(await screen.findByText('We could not load the forecast')).toBeInTheDocument();
    expect(screen.getByText('Failed to generate predictions.')).toBeInTheDocument();
  });

  it('Data: shows the chart, the what-if levers and the drivers panel', async () => {
    mockBackend({
      '/api/data/uploads': uploadsOne,
      '/api/forecast/status': () => status(true),
      '/api/forecast/predict': () => predict,
      '/api/data/summary': () => ok({ target_metric_name: 'revenue', kpis: { total_rows: 1, total_target: 1, avg_target: 1 }, timeline: [], dimensions: {}, total_revenue: 1, total_orders: 1, top_products: [], top_categories: [], daily_revenue: [], data_status: { sales_count: 1, products_count: 1 } }),
      '/api/forecast/simulate': leversError,
      '/api/forecast/explain/aggregate': () => fail(400, 'ForecastNotReadyError', 'Model not trained for aggregate'),
    });
    renderApp(<ForecastView />);
    expect(await screen.findByRole('heading', { name: 'Revenue forecast' })).toBeInTheDocument();
    // levers are read from the backend's own error message
    expect(await screen.findByText('Unit price')).toBeInTheDocument();
    expect(screen.getByText('Marketing spend')).toBeInTheDocument();
    expect(await screen.findByText('Driver explanation unavailable')).toBeInTheDocument();
  });

  it('What-if: shows the caveats the backend returns instead of inventing values', async () => {
    mockBackend({
      '/api/data/uploads': uploadsOne,
      '/api/forecast/status': () => status(true),
      '/api/forecast/predict': () => predict,
      '/api/data/summary': () => fail(404, 'NOT_FOUND', 'x'),
      '/api/forecast/simulate': (_url, init) => (JSON.parse(String(init?.body)).mutations['unit_price'] ? ok(simulation) : leversError()),
      '/api/forecast/explain/aggregate': () => fail(400, 'ForecastNotReadyError', 'x'),
    });
    renderApp(<ForecastView />);
    const slider = (await screen.findAllByRole('slider'))[0];
    slider.focus();
    await userEvent.keyboard('{ArrowRight>10/}');
    expect(await screen.findByText(/Profit unavailable: No unit cost available/, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/Optimal price unavailable: Demand is inelastic/)).toBeInTheDocument();
    expect(screen.getByText(/Price sensitivity unavailable/)).toBeInTheDocument();
  });
});
