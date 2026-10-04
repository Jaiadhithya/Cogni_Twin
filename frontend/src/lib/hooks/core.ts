'use client';

import { useMemo } from 'react';
import * as live from '@/lib/api/endpoints';
import { demoSource, type DataSource } from '@/lib/demo';
import { useDemoMode } from '@/lib/settings';

export type Mode = 'live' | 'demo';

/** The network, or the demo fixtures when Demo mode is on. Never a silent mix of the two. */
export function useDataSource(): { source: DataSource; mode: Mode } {
  const demo = useDemoMode();
  return useMemo(() => ({ source: demo ? demoSource : live, mode: demo ? ('demo' as const) : ('live' as const) }), [demo]);
}

/**
 * Query keys. Every key starts with the mode (so demo and live caches never mix) and the
 * resource name; dataset-scoped keys always carry the dataset id.
 */
export const keys = {
  health: (mode: Mode) => [mode, 'health'] as const,
  uploads: (mode: Mode) => [mode, 'uploads'] as const,
  uploadsPage: (mode: Mode, page: number, pageSize: number) => [mode, 'uploads', page, pageSize] as const,
  summary: (mode: Mode, datasetId: string | undefined) => [mode, 'summary', datasetId] as const,
  profile: (mode: Mode, datasetId: string | undefined) => [mode, 'profile', datasetId] as const,
  correlations: (mode: Mode, datasetId: string | undefined, method: string) => [mode, 'correlations', datasetId, method] as const,
  scatter: (mode: Mode, datasetId: string | undefined, x: string, y: string, limit: number) =>
    [mode, 'scatter', datasetId, x, y, limit] as const,
  /** Everything produced by the trained model for one dataset. */
  forecastAll: (mode: Mode, datasetId: string | undefined) => [mode, 'forecast', datasetId] as const,
  forecastStatus: (mode: Mode, datasetId: string | undefined) => [mode, 'forecast', datasetId, 'status'] as const,
  forecast: (mode: Mode, datasetId: string | undefined, horizon: number) => [mode, 'forecast', datasetId, 'predict', horizon] as const,
  backtest: (mode: Mode, datasetId: string | undefined, testDays: number) => [mode, 'forecast', datasetId, 'backtest', testDays] as const,
  levers: (mode: Mode, datasetId: string | undefined) => [mode, 'forecast', datasetId, 'levers'] as const,
  explainPrescribe: (mode: Mode, datasetId: string | undefined, horizon: number) =>
    [mode, 'forecast', datasetId, 'explain-prescribe', horizon] as const,
  explanation: (mode: Mode, productId: string, forecastDate: string | undefined, datasetId: string | undefined) =>
    [mode, 'explanation', productId, forecastDate, datasetId] as const,
  simulationsAll: (mode: Mode, datasetId: string | undefined) => [mode, 'simulations', datasetId] as const,
  simulations: (mode: Mode, datasetId: string | undefined, page: number) => [mode, 'simulations', datasetId, page] as const,
  compare: (mode: Mode, datasetId: string | undefined, ids: string[]) => [mode, 'simulations', datasetId, 'compare', ...ids] as const,
  trainingJob: (mode: Mode, jobId: string | null) => [mode, 'training-job', jobId] as const,
};
