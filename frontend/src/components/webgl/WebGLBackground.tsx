'use client'

import React, { Suspense, lazy, Component, ErrorInfo } from 'react';

const SignalStreams = lazy(() => import('./SignalStreams'));

class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("WebGL Background Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div 
          className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen"
          style={{ background: 'radial-gradient(circle at center, #000000 0%, #090D16 100%)' }}
        />
      );
    }
    return this.props.children;
  }
}

export default function WebGLBackground() {
  return (
    <ErrorBoundary>
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen">
        <Suspense fallback={
          <div className="w-full h-full" style={{ background: 'radial-gradient(circle at center, #000000 0%, #090D16 100%)' }} />
        }>
          <SignalStreams />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
