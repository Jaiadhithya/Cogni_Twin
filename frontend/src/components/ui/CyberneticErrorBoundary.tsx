'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CyberneticErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CyberneticErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="relative overflow-hidden rounded-2xl border border-[#FF4466]/30 bg-[#06090E]/95 p-6 shadow-2xl backdrop-blur-xl text-center flex flex-col items-center justify-center my-4">
          <div className="w-10 h-10 rounded-xl bg-[#FF4466]/10 border border-[#FF4466]/30 flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5 text-[#FF4466]" />
          </div>

          <h4 className="font-display text-sm font-bold text-white uppercase tracking-wider mb-1">
            {this.props.fallbackTitle || 'Telemetry Frame Anomaly Caught'}
          </h4>

          <p className="font-mono text-xs text-white/60 max-w-sm mb-4">
            A rendering disruption was isolated by the defensive boundary. Local matrix state preserved.
          </p>

          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 border border-[#00F0FF]/30 text-[#00F0FF] font-mono text-xs font-semibold cursor-pointer transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Telemetry Component</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
