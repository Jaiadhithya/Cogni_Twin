'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import type { CorrelationMethod } from '@/lib/api/types';
import { parseLeversFromError } from '@/lib/forecast';
import { keys, useDataSource } from './core';

/*
 * One hook per read resource. Dataset-scoped hooks stay idle until a dataset id is known
 * (`enabled`), so a page with no dataset shows its Empty state instead of querying "latest".
 * A failed request surfaces as the query's `error`; nothing is substituted.
 */

export function useHealth() {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.health(mode),
    queryFn: ({ signal }) => source.getHealth(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useUploads(page = 1, pageSize = 20) {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.uploadsPage(mode, page, pageSize),
    queryFn: ({ signal }) => source.getUploads(page, pageSize, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSummary(datasetId: string | undefined) {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.summary(mode, datasetId),
    queryFn: ({ signal }) => source.getSummary(datasetId, signal),
    enabled: Boolean(datasetId),
  });
}

export function useProfile(datasetId: string | undefined) {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.profile(mode, datasetId),
    queryFn: ({ signal }) => source.getProfile(datasetId as string, signal),
    enabled: Boolean(datasetId),
  });
}

export function useCorrelations(datasetId: string | undefined, method: CorrelationMethod = 'pearson') {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.correlations(mode, datasetId, method),
    queryFn: ({ signal }) => source.getCorrelations(datasetId as string, method, signal),
    enabled: Boolean(datasetId),
    placeholderData: keepPreviousData,
  });
}

export function useScatter(datasetId: string | undefined, x: string | undefined, y: string | undefined, limit = 500) {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.scatter(mode, datasetId, x ?? '', y ?? '', limit),
    queryFn: ({ signal }) => source.getScatter(datasetId as string, x as string, y as string, limit, signal),
    enabled: Boolean(datasetId && x && y),
    placeholderData: keepPreviousData,
  });
}

export function useForecastStatus(datasetId: string | undefined) {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.forecastStatus(mode, datasetId),
    queryFn: ({ signal }) => source.getForecastStatus(datasetId, signal),
    enabled: Boolean(datasetId),
  });
}

export function useForecast(datasetId: string | undefined, horizonDays = 30, enabled = true) {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.forecast(mode, datasetId, horizonDays),
    queryFn: ({ signal }) => source.getForecast(horizonDays, datasetId, signal),
    enabled: Boolean(datasetId) && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useBacktest(datasetId: string | undefined, testDays = 14) {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.backtest(mode, datasetId, testDays),
    queryFn: ({ signal }) => source.getBacktest(testDays, datasetId, signal),
    enabled: Boolean(datasetId),
  });
}

export function useExplainPrescribe(datasetId: string | undefined, horizonDays = 30) {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.explainPrescribe(mode, datasetId, horizonDays),
    queryFn: ({ signal }) => source.getExplainPrescribe(horizonDays, datasetId, signal),
    enabled: Boolean(datasetId),
  });
}

export function useExplanation(productId: string | undefined, forecastDate?: string, datasetId?: string) {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.explanation(mode, productId ?? '', forecastDate, datasetId),
    queryFn: ({ signal }) => source.getExplanation(productId as string, forecastDate, datasetId, signal),
    enabled: Boolean(productId),
  });
}

export function useSimulations(datasetId: string | undefined, page = 1) {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.simulations(mode, datasetId, page),
    queryFn: ({ signal }) => source.getSimulations(datasetId, page, 20, signal),
    enabled: Boolean(datasetId),
    placeholderData: keepPreviousData,
  });
}

/** Compare 2–10 saved scenarios of one dataset. Idle until at least two ids are given. */
export function useCompareSimulations(datasetId: string | undefined, ids: string[]) {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.compare(mode, datasetId, ids),
    queryFn: ({ signal }) => source.compareSimulations(ids, signal),
    enabled: Boolean(datasetId) && ids.length >= 2,
    placeholderData: keepPreviousData,
  });
}

/**
 * Which lever columns (price, marketing…) the dataset's model can simulate. The backend has no
 * endpoint for this, so we ask for a simulation with no levers and read the list out of the
 * error it returns. Resolves to [] when the model has no lever columns.
 */
export function useLevers(datasetId: string | undefined, enabled = true) {
  const { source, mode } = useDataSource();
  return useQuery({
    queryKey: keys.levers(mode, datasetId),
    queryFn: async ({ signal }) => {
      try {
        const probe = await source.simulate({ dataset_id: datasetId, horizon_days: 7, mutations: {} }, signal);
        return probe.available_levers;
      } catch (error) {
        const levers = isApiError(error) ? parseLeversFromError(error.message) : null;
        if (levers) return levers;
        throw error;
      }
    },
    enabled: Boolean(datasetId) && enabled,
    staleTime: 5 * 60_000,
  });
}
