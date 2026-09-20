import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ForecastPage from '../src/app/(app)/forecast/page';
import * as api from '../src/lib/api';

jest.mock('../src/lib/api', () => ({
  getForecastStatus: jest.fn(),
  getSummary: jest.fn(),
  getForecast: jest.fn(),
  getExplainPrescribe: jest.fn(),
  simulateScenario: jest.fn(),
  trainForecast: jest.fn()
}));

jest.mock('../src/components/forecast/SimulationSliders', () => {
  return function MockSimulationSliders({ onMutationsChange }: any) {
    return (
      <button
        data-testid="mock-slider"
        onClick={() => onMutationsChange({ 'test_mutation': '+10' })}
      >
        Change Mutation
      </button>
    );
  };
});

jest.mock('../src/components/forecast/ForecastChart', () => () => <div data-testid="chart" />);

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('ForecastPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disables the Retrain button while training', async () => {
    (api.getForecastStatus as jest.Mock).mockResolvedValue({ model_available: true, data_points_used: 100 });
    (api.getSummary as jest.Mock).mockResolvedValue({ kpis: { total_rows: 100 }, metadata: { target_metric: 'sales' } });
    (api.getForecast as jest.Mock).mockResolvedValue({ history: [], forecast: [] });
    (api.getExplainPrescribe as jest.Mock).mockResolvedValue({});

    let resolveTrain: (value?: unknown) => void;
    const trainPromise = new Promise((resolve) => {
      resolveTrain = resolve as (value?: unknown) => void;
    });
    (api.trainForecast as jest.Mock).mockReturnValue(trainPromise);

    render(<ForecastPage />);

    const retrainButton = (await screen.findByRole('button', { name: /Retrain/i })) as HTMLButtonElement;
    expect(retrainButton.disabled).toBe(false);

    fireEvent.click(retrainButton);

    await waitFor(() => {
      expect(retrainButton.disabled).toBe(true);
    });
    expect(screen.getByText(/Fitting/i)).toBeInTheDocument();
    expect(api.trainForecast).toHaveBeenCalled();

    resolveTrain!({});

    await waitFor(() => {
      expect(retrainButton.disabled).toBe(false);
    });
  });

  it('runs a what-if simulation when mutations change', async () => {
    (api.getForecastStatus as jest.Mock).mockResolvedValue({ model_available: true, data_points_used: 100 });
    (api.getSummary as jest.Mock).mockResolvedValue({ kpis: { total_rows: 100 }, metadata: { target_metric: 'sales' } });
    (api.getForecast as jest.Mock).mockResolvedValue({
      history: [{ date: '2026-01-01', actual: 100 }],
      forecast: [{ date: '2026-02-01', predicted: 120, lower_bound: 110, upper_bound: 130 }],
    });
    (api.getExplainPrescribe as jest.Mock).mockResolvedValue({});
    (api.simulateScenario as jest.Mock).mockResolvedValue({
      points: [{ date: '2026-02-01', baseline: 120, mutated: 130 }],
      mutations_applied: { unit_price: '+10%' },
      total_delta: 10,
      total_delta_pct: 8.3,
      baseline_total: 120,
      mutated_total: 130,
    });

    render(<ForecastPage />);

    await screen.findByTestId('mock-slider');
    fireEvent.click(screen.getByTestId('mock-slider'));

    await waitFor(() => {
      expect(api.simulateScenario).toHaveBeenCalled();
    });

    const calls = (api.simulateScenario as jest.Mock).mock.calls;
    expect(calls[0][0]).toEqual({ test_mutation: '+10' });
  });
});
