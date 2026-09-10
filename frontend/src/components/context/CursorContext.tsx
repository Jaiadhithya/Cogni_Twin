'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CursorTargetState {
  width: number;
  height: number;
  top: number;
  left: number;
  borderRadius?: number;
}

interface CursorContextType {
  cursorTarget: CursorTargetState | null;
  setCursorTarget: (target: CursorTargetState | null) => void;
}

const CursorContext = createContext<CursorContextType | undefined>(undefined);

export function CursorProvider({ children }: { children: ReactNode }) {
  const [cursorTarget, setCursorTarget] = useState<CursorTargetState | null>(null);

  return (
    <CursorContext.Provider value={{ cursorTarget, setCursorTarget }}>
      {children}
    </CursorContext.Provider>
  );
}

export function useCursor() {
  const context = useContext(CursorContext);
  if (context === undefined) {
    throw new Error('useCursor must be used within a CursorProvider');
  }
  return context;
}
