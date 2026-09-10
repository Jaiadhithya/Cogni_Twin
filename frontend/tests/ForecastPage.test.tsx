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

jest.mock('../src/components/forecast/VisxForecastChart', () => () => <div data-testid="chart" />);

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('ForecastPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disables the Retrain Model button while simulating', async () => {
    (api.getForecastStatus as jest.Mock).mockResolvedValue({ model_available: true, data_points_used: 100 });
    (api.getSummary as jest.Mock).mockResolvedValue({ kpis: { total_rows: 100 }, metadata: { target_metric: 'sales' } });
    (api.getForecast as jest.Mock).mockResolvedValue({ history: [], forecast: [] });
    (api.getExplainPrescribe as jest.Mock).mockResolvedValue({});
    
    let resolveSimulation: any;
    const simulationPromise = new Promise(resolve => {
      resolveSimulation = resolve;
    });
    (api.simulateScenario as jest.Mock).mockReturnValue(simulationPromise);

    render(<ForecastPage />);

    const retrainButton = (await screen.findByRole('button', { name: /Retrain Model/i })) as HTMLButtonElement;
    expect(retrainButton.disabled).toBe(false);

    fireEvent.click(screen.getByTestId('mock-slider'));
    fireEvent.click(retrainButton);

    expect(retrainButton.disabled).toBe(true);
    expect(screen.getByText(/Fitting Tensor\.\.\./i)).toBeTruthy();
    
    resolveSimulation({
      points: [],
      shap_positive_forces: [],
      shap_negative_forces: [],
      total_delta: 0,
      total_delta_pct: 0,
      baseline_total: 0,
      mutated_total: 0
    });
    
    await waitFor(() => {
      expect(retrainButton.disabled).toBe(false);
    });
  });
});
