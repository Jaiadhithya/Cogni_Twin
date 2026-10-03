'use client';

/**
 * Client-side settings (currently just demo mode), persisted in localStorage.
 * Every storage access is wrapped: private windows and blocked storage must not break the app.
 * Implemented as a tiny external store so any component can read it without a provider and
 * server render / hydration always start from the defaults.
 */
import { useCallback, useSyncExternalStore } from 'react';

export interface Settings {
  /** Read fixtures from src/lib/demo instead of the backend. Off by default. */
  demoMode: boolean;
}

export const DEFAULT_SETTINGS: Settings = { demoMode: false };
export const SETTINGS_STORAGE_KEY = 'cognitwin:settings';

let current: Settings = DEFAULT_SETTINGS;
let loaded = false;
const listeners = new Set<() => void>();

function readStored(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      return { demoMode: record.demoMode === true };
    }
  } catch {
    /* storage unavailable or corrupt: fall back to defaults */
  }
  return DEFAULT_SETTINGS;
}

function ensureLoaded() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  current = readStored();
  // Keep multiple tabs in step.
  window.addEventListener('storage', (event) => {
    if (event.key === SETTINGS_STORAGE_KEY) {
      current = readStored();
      listeners.forEach((l) => l());
    }
  });
}

function subscribe(listener: () => void): () => void {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Settings {
  ensureLoaded();
  return current;
}

function getServerSnapshot(): Settings {
  return DEFAULT_SETTINGS;
}

export function updateSettings(patch: Partial<Settings>): void {
  ensureLoaded();
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* not persisted, still applied for this session */
  }
  listeners.forEach((l) => l());
}

/** Test helper: forget cached state so the next read goes back to storage. */
export function resetSettingsForTests(): void {
  current = DEFAULT_SETTINGS;
  loaded = false;
  listeners.clear();
}

export function useSettings(): Settings & { setDemoMode: (on: boolean) => void } {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setDemoMode = useCallback((on: boolean) => updateSettings({ demoMode: on }), []);
  return { ...settings, setDemoMode };
}

export function useDemoMode(): boolean {
  return useSyncExternalStore(subscribe, () => getSnapshot().demoMode, () => false);
}
