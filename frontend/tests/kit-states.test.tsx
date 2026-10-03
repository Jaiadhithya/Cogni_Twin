import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangeBadge } from '../src/components/ui/change-badge';
import { DataState, type QueryLike } from '../src/components/ui/data-state';
import { EmptyState } from '../src/components/ui/empty-state';
import { MethodLabel, methodLabelText } from '../src/components/ui/method-label';
import { summarizeHealth } from '../src/components/layout/health';
import { ApiError } from '../src/lib/api/errors';
import { addDatasetParam } from '../src/lib/dataset-context';
import type { Health } from '../src/lib/api/types';

const base: QueryLike<{ rows: number }> = { data: undefined, isPending: false, isError: false, error: null, refetch: jest.fn() };

function renderState(query: Partial<QueryLike<{ rows: number }>>) {
  return render(
    <DataState
      query={{ ...base, ...query }}
      skeleton={<div data-testid="skeleton">loading</div>}
      isEmpty={(d) => d.rows === 0}
      empty={<EmptyState title="No dataset yet" />}
    >
      {(d) => <p>{d.rows} rows</p>}
    </DataState>,
  );
}

describe('DataState: the four states', () => {
  it('Loading shows a skeleton', async () => {
    renderState({ isPending: true, fetchStatus: 'fetching' });
    expect(await screen.findByTestId('skeleton')).toBeInTheDocument();
  });

  it('Empty explains what is missing (data is empty)', async () => {
    renderState({ data: { rows: 0 } });
    expect(await screen.findByText('No dataset yet')).toBeInTheDocument();
  });

  it('Empty also covers a query that is idle because there is no dataset to ask about', async () => {
    renderState({ isPending: true, fetchStatus: 'idle' });
    expect(await screen.findByText('No dataset yet')).toBeInTheDocument();
  });

  it('Error shows the real reason, the request id and a working Retry', async () => {
    const refetch = jest.fn();
    const id = '3f2b8c1e-7a21-4f0e-9a52-0d1c2e3f4a01';
    renderState({
      isError: true,
      error: new ApiError({ status: 500, type: 'INTERNAL_ERROR', message: 'Something broke on our side.', requestId: id }),
      refetch,
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke on our side.');
    expect(screen.getByText(id)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('Data renders the content', async () => {
    renderState({ data: { rows: 12 } });
    expect(await screen.findByText('12 rows')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument());
  });
});

describe('summarizeHealth', () => {
  const ok: Health = { status: 'ok', components: { database: 'healthy', model_directory: 'accessible', qdrant: 'reachable', llm_api_key: 'configured' } };

  it('is green when everything is fine', () => {
    expect(summarizeHealth(ok, null, false)).toMatchObject({ tone: 'ok', label: 'All systems normal', documentsOffline: false });
  });

  it('is amber and names document search when Qdrant is down', () => {
    const health: Health = { status: 'degraded', components: { ...ok.components, qdrant: 'unreachable: ConnectError' } };
    expect(summarizeHealth(health, null, false)).toMatchObject({ tone: 'degraded', label: 'Degraded: document search offline', documentsOffline: true });
  });

  it('is red when the database is down', () => {
    const health: Health = { status: 'degraded', components: { ...ok.components, database: 'unhealthy: OperationalError' } };
    expect(summarizeHealth(health, null, false).tone).toBe('down');
  });

  it('is red when /health itself fails', () => {
    expect(summarizeHealth(undefined, new Error('x'), false)).toMatchObject({ tone: 'down', label: 'Backend offline' });
  });

  it('is neutral while checking', () => {
    expect(summarizeHealth(undefined, null, true).tone).toBe('checking');
  });
});

describe('small components', () => {
  it('ChangeBadge colours by good and bad, and inverts for costs', () => {
    const { container, rerender } = render(<ChangeBadge value={5} />);
    expect(container.firstElementChild?.className).toMatch(/text-positive/);
    rerender(<ChangeBadge value={5} invert />);
    expect(container.firstElementChild?.className).toMatch(/text-negative/);
    rerender(<ChangeBadge value={0} />);
    expect(container.firstElementChild?.className).not.toMatch(/text-positive|text-negative/);
  });

  it('MethodLabel maps backend identifiers to readable names', () => {
    expect(methodLabelText('prophet_component_decomposition')).toBe('Factor attribution');
    expect(methodLabelText('tree_shap')).toBe('SHAP (exact)');
    expect(methodLabelText('linear_coefficients')).toBe('Linear coefficients');
    expect(methodLabelText('some_new_method')).toBe('Some new method');
    render(<MethodLabel method="tree_shap" />);
    expect(screen.getByText('SHAP (exact)')).toBeInTheDocument();
  });

  it('addDatasetParam keeps other query parameters', () => {
    expect(addDatasetParam('/forecast', 'abc')).toBe('/forecast?dataset=abc');
    expect(addDatasetParam('/ask?q=hello', 'abc')).toBe('/ask?q=hello&dataset=abc');
    expect(addDatasetParam('/forecast', undefined)).toBe('/forecast');
  });
});
