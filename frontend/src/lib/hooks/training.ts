'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TrainGranularity, TrainingJob, TrainingJobStatus } from '@/lib/api/types';
import { keys, useDataSource } from './core';

export const TRAINING_POLL_MS = 2000;
export const TRAINING_TIMEOUT_MS = 15 * 60 * 1000;

export type TrainingPhase = 'idle' | TrainingJobStatus;

const isActive = (status: TrainingJobStatus | undefined) => status === 'queued' || status === 'running';

/**
 * Train a forecasting model as a background job and follow it to the end.
 *
 *   start()  → POST /forecast/train (202) → poll GET /forecast/jobs/{id} every 2s
 *   until `succeeded` or `failed`; then the dataset's forecast queries are refetched.
 *
 * On failure `failureMessage` is the job's own `error` text, verbatim. After 15 minutes
 * without a result polling stops and `timedOut` is set (the job itself keeps running).
 */
export function useTrainingJob(datasetId: string | undefined, granularity: TrainGranularity = 'daily') {
  const { source, mode } = useDataSource();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const timedOutRef = useRef(false);
  const settledRef = useRef<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => source.startTraining(datasetId, granularity),
    onSuccess: (job) => {
      timedOutRef.current = false;
      settledRef.current = null;
      setTimedOut(false);
      queryClient.setQueryData(keys.trainingJob(mode, job.job_id), job);
      setJobId(job.job_id);
    },
  });

  const jobQuery = useQuery<TrainingJob>({
    queryKey: keys.trainingJob(mode, jobId),
    queryFn: ({ signal }) => source.getTrainingJob(jobId as string, signal),
    enabled: jobId !== null,
    staleTime: TRAINING_POLL_MS,
    refetchInterval: (query) => (isActive(query.state.data?.status) && !timedOutRef.current ? TRAINING_POLL_MS : false),
    retry: 1,
  });

  const job = jobQuery.data ?? null;
  const status: TrainingPhase = job ? job.status : startMutation.isPending || jobId ? 'queued' : 'idle';
  const active = isActive(job?.status) && !timedOut;

  // Give up polling after the deadline.
  useEffect(() => {
    if (!jobId || !isActive(job?.status)) return;
    const timer = setTimeout(() => {
      timedOutRef.current = true;
      setTimedOut(true);
    }, TRAINING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [jobId, job?.status]);

  // A finished job changes everything the model produces: refetch it once.
  useEffect(() => {
    if (!jobId || !job || isActive(job.status)) return;
    const marker = `${jobId}:${job.status}`;
    if (settledRef.current === marker) return;
    settledRef.current = marker;
    if (job.status === 'succeeded') {
      void queryClient.invalidateQueries({ queryKey: keys.forecastAll(mode, datasetId) });
    }
  }, [jobId, job, mode, datasetId, queryClient]);

  const reset = useCallback(() => {
    timedOutRef.current = false;
    settledRef.current = null;
    setTimedOut(false);
    setJobId(null);
    startMutation.reset();
  }, [startMutation]);

  return {
    start: () => startMutation.mutate(),
    reset,
    job,
    status,
    /** Queued or running right now. */
    isActive: active || startMutation.isPending,
    isStarting: startMutation.isPending,
    succeeded: job?.status === 'succeeded',
    failed: job?.status === 'failed',
    /** The job's own error text when it failed. */
    failureMessage: job?.status === 'failed' ? (job.error ?? 'Training failed.') : null,
    timedOut,
    /** Request errors from starting the job or polling it (not the job's own failure). */
    error: startMutation.error ?? jobQuery.error ?? null,
  };
}
