'use client';

import { useEffect } from 'react';
import { ApiError } from '@/lib/api/errors';
import { ErrorState } from '@/components/ui/error-state';

/** Route-level error boundary: plain-language message, the reference id if there is one, and Try again. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorState
      title="Something went wrong on this page"
      error={new ApiError({ status: 500, type: 'UI_ERROR', message: error.message || 'An unexpected error occurred.', requestId: error.digest ?? null })}
      onRetry={reset}
    />
  );
}
