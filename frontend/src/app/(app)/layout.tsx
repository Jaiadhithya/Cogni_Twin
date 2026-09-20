import React from 'react';
import BottomDock from '@/components/layout/BottomDock';
import ObservatoryHeader from '@/components/layout/ObservatoryHeader';
import { DatasetProvider } from '@/context/DatasetContext';
import { ToastProvider } from '@/components/ui/CyberneticToast';
import { CyberneticErrorBoundary } from '@/components/ui/CyberneticErrorBoundary';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DatasetProvider>
      <ToastProvider>
        <div className="relative min-h-screen overflow-x-hidden bg-graphite-950 text-ink">
          {/* Ambient instrument grid + vignette (static, cheap, intentional) */}
          <div
            aria-hidden="true"
            className="bg-grid vignette pointer-events-none fixed inset-0 z-0"
          />

          {/* Top telemetry header */}
          <ObservatoryHeader />

          {/* Main viewport */}
          <main className="relative z-10 w-full min-h-[calc(100dvh-65px)] pb-28">
            <CyberneticErrorBoundary>{children}</CyberneticErrorBoundary>
          </main>

          {/* Floating navigation dock */}
          <BottomDock />
        </div>
      </ToastProvider>
    </DatasetProvider>
  );
}
