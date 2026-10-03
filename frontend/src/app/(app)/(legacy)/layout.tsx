import React from 'react';
import { DatasetProvider } from '@/legacy/context/DatasetContext';
import { ToastProvider } from '@/legacy/components/ui/CyberneticToast';
import { CyberneticErrorBoundary } from '@/legacy/components/ui/CyberneticErrorBoundary';

/**
 * TEMPORARY: the old dashboard / forecast / ingest / query pages still run on the legacy
 * providers until Phase 2 rebuilds them on the new kit. Delete this group with src/legacy.
 */
export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <DatasetProvider>
      <ToastProvider>
        <CyberneticErrorBoundary>{children}</CyberneticErrorBoundary>
      </ToastProvider>
    </DatasetProvider>
  );
}
