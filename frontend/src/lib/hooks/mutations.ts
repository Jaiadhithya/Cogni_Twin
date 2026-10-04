'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SimulationInput } from '@/lib/api/types';
import { keys, useDataSource } from './core';

/** Upload a CSV, then refresh the dataset list. The caller decides which dataset becomes active. */
export function useIngestCsv() {
  const { source, mode } = useDataSource();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => source.ingestCsv(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.uploads(mode) }),
  });
}

/** Delete a dataset (also removes its trained models) and drop everything cached for it. */
export function useDeleteUpload() {
  const { source, mode } = useDataSource();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uploadId: string) => source.deleteUpload(uploadId),
    onSuccess: (_result, uploadId) => {
      const scoped = ['summary', 'profile', 'correlations', 'scatter', 'forecast', 'simulations'] as const;
      for (const resource of scoped) {
        queryClient.removeQueries({ queryKey: [mode, resource, uploadId] });
      }
      return queryClient.invalidateQueries({ queryKey: keys.uploads(mode) });
    },
  });
}

/** Run (and optionally save) a what-if. Saving refreshes the scenario list. */
export function useSimulate(datasetId: string | undefined) {
  const { source, mode } = useDataSource();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<SimulationInput, 'dataset_id'>) => source.simulate({ ...body, dataset_id: datasetId }),
    onSuccess: (_result, body) => {
      if (body.save) return queryClient.invalidateQueries({ queryKey: keys.simulationsAll(mode, datasetId) });
    },
  });
}

export function useAskQuestion(datasetId: string | undefined) {
  const { source } = useDataSource();
  return useMutation({
    mutationFn: (question: string) => source.askQuestion(question, datasetId),
  });
}

export function useUploadDocument() {
  const { source } = useDataSource();
  return useMutation({ mutationFn: (file: File) => source.uploadDocument(file) });
}

export function useSearchDocuments() {
  const { source } = useDataSource();
  return useMutation({
    mutationFn: ({ query, topK }: { query: string; topK?: number }) => source.searchDocuments(query, topK),
  });
}
