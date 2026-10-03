'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useVariants } from '@/lib/motion';
import { ErrorState } from './error-state';
import { EmptyState } from './empty-state';

/** The slice of a TanStack Query result that DataState needs. */
export interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  fetchStatus?: 'fetching' | 'paused' | 'idle';
  refetch: () => unknown;
}

export interface DataStateProps<T> {
  query: QueryLike<T>;
  /** Skeleton shaped like the content. */
  skeleton: React.ReactNode;
  /** Shown when the query has no dataset to run on, or `isEmpty` says the data is empty. */
  empty?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  /** Title for the error state. */
  errorTitle?: string;
  children: (data: T) => React.ReactNode;
  className?: string;
}

type Phase = 'loading' | 'error' | 'empty' | 'data';

/**
 * The four states every data panel has: Loading (skeleton), Empty (next step), Error
 * (real reason + Retry + request id) and Data. Skeleton and content cross-fade; nothing pops.
 * There is no fallback path: a failed request is always the Error state.
 */
export function DataState<T>({ query, skeleton, empty, isEmpty, errorTitle, children, className }: DataStateProps<T>) {
  const fade = useVariants('fade');

  let phase: Phase;
  if (query.isError) phase = 'error';
  else if (query.data !== undefined) phase = isEmpty?.(query.data) ? 'empty' : 'data';
  else if (query.isPending && query.fetchStatus === 'idle') phase = 'empty'; // disabled: no dataset to query
  else phase = 'loading';

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={phase}
        variants={fade}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={className}
        data-state={phase}
        aria-busy={phase === 'loading' || undefined}
      >
        {phase === 'loading' && skeleton}
        {phase === 'error' && <ErrorState error={query.error} title={errorTitle} onRetry={() => void query.refetch()} />}
        {phase === 'empty' && (empty ?? <EmptyState title="Nothing to show yet" />)}
        {phase === 'data' && query.data !== undefined && children(query.data)}
      </motion.div>
    </AnimatePresence>
  );
}
