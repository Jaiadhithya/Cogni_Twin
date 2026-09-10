import React from 'react';
import BottomDock from '@/components/layout/BottomDock';
import ObservatoryHeader from '@/components/layout/ObservatoryHeader';
import WebGLBackground from '@/components/webgl/WebGLBackground';
import CustomCursor from '@/components/ui/CustomCursor';
import { CursorProvider } from '@/components/context/CursorContext';
import { DatasetProvider } from '@/context/DatasetContext';
import { ToastProvider } from '@/components/ui/CyberneticToast';
import { CyberneticErrorBoundary } from '@/components/ui/CyberneticErrorBoundary';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DatasetProvider>
      <ToastProvider>
        <CursorProvider>
          <div className="min-h-screen bg-[#030507] text-white overflow-x-hidden relative selection:bg-[#00F0FF] selection:text-black">
            <CustomCursor />
            
            {/* Subtle WebGL Signal Streams in Background */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
              <WebGLBackground />
            </div>

            {/* Ambient Observatory Vignette */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(0,240,255,0.06),rgba(0,0,0,0))]" />
            
            {/* Top Telemetry Header */}
            <ObservatoryHeader />

            {/* Main Observatory Content Viewport with Defensive Boundary */}
            <main className="relative z-10 w-full min-h-[calc(100vh-65px)] pb-32">
              <CyberneticErrorBoundary>
                {children}
              </CyberneticErrorBoundary>
            </main>
            
            {/* Fixed Floating Bottom Navigation Dock */}
            <BottomDock />
          </div>
        </CursorProvider>
      </ToastProvider>
    </DatasetProvider>
  );
}
