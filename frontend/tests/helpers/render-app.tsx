import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../src/components/ui/toast';
import { ActiveDatasetProvider } from '../../src/lib/dataset-context';
import { resetSettingsForTests } from '../../src/lib/settings';

export type Handler = (url: string, init?: RequestInit) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }> | 'pending';

export const ok = (data: unknown, meta?: unknown) => ({ status: 200, body: { status: 'success', data, ...(meta ? { meta } : {}) } });
export const fail = (status: number, type: string, message: string) => ({ status, body: { status: 'error', error: { type, message, details: [] } } });

const DATASET = {
  id: 'ds-1',
  filename: 'kirana_sales.csv',
  entity_type: 'dynamic',
  row_count: 1000,
  warning_count: 0,
  error_count: 0,
  status: 'completed',
  created_at: '2026-03-01T10:00:00',
};

export const uploadsOne = () => ok({ records: [DATASET] }, { pagination: { page: 1, page_size: 100, total_count: 1, total_pages: 1 } });
export const uploadsNone = () => ok({ records: [] }, { pagination: { page: 1, page_size: 100, total_count: 0, total_pages: 1 } });

/** Routes fetch() calls to handlers by URL substring; anything unhandled is a 404 error envelope. */
export function mockBackend(routes: Record<string, Handler>) {
  const calls: string[] = [];
  const fn = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    const result = key ? routes[key](url, init) : fail(404, 'NOT_FOUND', `No mock for ${url}`);
    if (result === 'pending') return new Promise<Response>(() => {});
    const { status = 200, body } = await result;
    return { ok: status >= 200 && status < 300, status, statusText: String(status), headers: { get: () => null }, json: async () => body } as unknown as Response;
  });
  global.fetch = fn as unknown as typeof fetch;
  return { fn, calls };
}

/** Tests run with reduced motion so count-ups show their final value at once. */
export function preferReducedMotion(reduced = true) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

export function renderApp(ui: React.ReactElement) {
  preferReducedMotion();
  resetSettingsForTests();
  window.localStorage.clear();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ActiveDatasetProvider>{ui}</ActiveDatasetProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}
