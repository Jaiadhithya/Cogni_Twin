import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QueryPage from '../src/app/(app)/(legacy)/query/page';
import * as api from '../src/legacy/lib/api';

jest.mock('../src/legacy/lib/api', () => ({
  executeQuery: jest.fn(),
  getSummary: jest.fn(),
}));

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('QueryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.getSummary as jest.Mock).mockResolvedValue({
      kpis: { total_rows: 50 },
      metadata: { target_metric: 'revenue' }
    });
  });

  it('handles query execution with charts and insights', async () => {
    (api.executeQuery as jest.Mock).mockResolvedValue({
      question: 'Show revenue trend',
      answer: 'Revenue increased consistently across the evaluated periods.',
      insights: [
        'Total revenue grew by 18% over the period.',
        'Highest volume recorded in Electronics category.'
      ],
      prescriptive_actions: [
        {
          priority: 1,
          action: 'Expand marketing budget by 10% in high-performing regions',
          expected_impact: '+₹2.5 Lakh Gross Margin',
          timeframe: 'Next 14 Days'
        }
      ],
      charts: [
        {
          type: 'line',
          title: 'Trend: Revenue Over Time',
          description: 'Historical revenue trajectory',
          x_key: 'date',
          y_keys: ['revenue'],
          data: [
            { date: '2026-01-01', revenue: 1000 },
            { date: '2026-01-02', revenue: 1500 }
          ]
        }
      ],
      generated_sql: 'SELECT date, revenue FROM sales LIMIT 20;',
      raw_data: [{ date: '2026-01-01', revenue: 1000 }],
      confidence: 'high'
    });

    render(<QueryPage />);

    const input = screen.getByPlaceholderText(/Ask anything/i);
    const submitBtn = screen.getByRole('button', { name: /Run/i });

    fireEvent.change(input, { target: { value: 'Show revenue trend' } });
    fireEvent.click(submitBtn);

    // Wait for the synthesized answer
    await waitFor(() => {
      expect(screen.getByText(/Revenue increased consistently across the evaluated periods/i)).toBeInTheDocument();
    });

    // Check that executive insights rendered
    expect(screen.getByText(/Executive insights/i)).toBeInTheDocument();
    expect(screen.getByText(/Total revenue grew by 18% over the period/i)).toBeInTheDocument();

    // Check that prescriptive actions rendered
    expect(screen.getByText(/Prescriptive action plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Expand marketing budget by 10% in high-performing regions/i)).toBeInTheDocument();
    expect(screen.getByText(/\+₹2\.5 Lakh Gross Margin/i)).toBeInTheDocument();

    // Check that chart title rendered
    expect(screen.getByText(/Trend: Revenue Over Time/i)).toBeInTheDocument();
  });

  it('renders multi-column bar, pie, and scatter charts', async () => {
    (api.executeQuery as jest.Mock).mockResolvedValue({
      question: 'Compare categories and correlations',
      answer: 'Category breakdown and price elasticity correlation analysis.',
      insights: ['Electronics dominate 60% of volume.'],
      prescriptive_actions: [],
      charts: [
        {
          type: 'bar',
          title: 'Units Sold by Category',
          description: 'Breakdown across product categories',
          x_key: 'category',
          y_keys: ['units_sold'],
          data: [{ category: 'Electronics', units_sold: 450 }, { category: 'Apparel', units_sold: 210 }]
        },
        {
          type: 'pie',
          title: 'Distribution by Category',
          description: 'Share of total units',
          x_key: 'category',
          y_keys: ['units_sold'],
          data: [{ category: 'Electronics', units_sold: 450 }, { category: 'Apparel', units_sold: 210 }]
        },
        {
          type: 'scatter',
          title: 'Correlation: Price vs Demand',
          description: 'Price elasticity scatter',
          x_key: 'unit_price',
          y_keys: ['units_sold'],
          data: [{ unit_price: 15.0, units_sold: 100 }, { unit_price: 10.0, units_sold: 150 }]
        }
      ],
      generated_sql: 'SELECT category, units_sold FROM sales;',
      raw_data: [{ category: 'Electronics', units_sold: 450 }],
      confidence: 'high'
    });

    render(<QueryPage />);

    const input = screen.getByPlaceholderText(/Ask anything/i);
    const submitBtn = screen.getByRole('button', { name: /Run/i });

    fireEvent.change(input, { target: { value: 'Compare categories and correlations' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Category breakdown and price elasticity correlation analysis/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Units Sold by Category/i)).toBeInTheDocument();
    expect(screen.getByText(/Distribution by Category/i)).toBeInTheDocument();
    expect(screen.getByText(/Correlation: Price vs Demand/i)).toBeInTheDocument();
  });

  it('displays clear error message when backend query fails', async () => {
    (api.executeQuery as jest.Mock).mockRejectedValue(new Error('Connection to database timed out'));

    render(<QueryPage />);

    const input = screen.getByPlaceholderText(/Ask anything/i);
    const submitBtn = screen.getByRole('button', { name: /Run/i });

    fireEvent.change(input, { target: { value: 'Failing query' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Connection to database timed out/i)).toBeInTheDocument();
    });
  });

  it('binds query execution to active dataset_id from localStorage', async () => {
    localStorage.setItem('active_dataset_id', 'custom-twin-uuid-999');
    (api.executeQuery as jest.Mock).mockResolvedValue({
      question: 'Show profit margins',
      answer: 'Profit margins are strong at 24%.',
      insights: ['Healthy gross margins.'],
      prescriptive_actions: [],
      charts: [],
      generated_sql: 'SELECT margin FROM dataset_custom;',
      raw_data: [],
      confidence: 'high'
    });

    render(<QueryPage />);

    // Active dataset chip should reflect the stored id
    await waitFor(() => {
      expect(screen.getByText('custom-twin-uuid-999')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ask anything/i);
    const submitBtn = screen.getByRole('button', { name: /Run/i });

    fireEvent.change(input, { target: { value: 'Show profit margins' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.executeQuery).toHaveBeenCalledWith('Show profit margins', 'custom-twin-uuid-999');
    });

    localStorage.removeItem('active_dataset_id');
  });
});
