'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getSummary, getUploadHistory } from '@/lib/api';
import { DEMO_SUMMARY_DATA } from '@/lib/mockData';

export interface DatasetMeta {
  id: string;
  name: string;
  description?: string;
  row_count?: number;
  dimensions?: string[];
  target_metric?: string;
  created_at?: string;
  status?: string;
  isPreset?: boolean;
}

export const PRESET_DATASETS: DatasetMeta[] = [
  {
    id: 'COGNITWIN-PROD',
    name: 'Enterprise Retail Core',
    description: 'High-frequency omni-channel transactions with 4 core dimensions and promotional telemetry.',
    row_count: 51280,
    dimensions: ['Product_Category', 'Sales_Channel', 'Geographic_Region', 'Customer_Tier'],
    target_metric: 'revenue',
    status: 'OPTIMAL',
    isPreset: true,
  },
  {
    id: 'COMPLEX-MULTIVARIATE',
    name: 'Complex Multivariate Matrix',
    description: 'Multi-category supply-chain dataset with macro-economic indicators, logistics latency, and elastic pricing.',
    row_count: 74800,
    dimensions: ['Region', 'Category', 'Fulfillment_Hub', 'Discount_Band'],
    target_metric: 'sales_volume',
    status: 'INDEXED',
    isPreset: true,
  },
  {
    id: 'RETAIL-SYNTHETIC-2026',
    name: 'Synthetic Stress-Test Twin',
    description: 'Volatile demand spikes, seasonal anomalies, and inventory constraint scenarios for chaos testing.',
    row_count: 38400,
    dimensions: ['Store_Format', 'Merchandise_Class', 'Weather_Index'],
    target_metric: 'daily_revenue',
    status: 'ACTIVE',
    isPreset: true,
  }
];

const STORAGE_KEY = 'cognitwin_active_dataset_id';
const CUSTOM_EVENT_NAME = 'cognitwin:dataset_sync';

interface DatasetContextType {
  activeDatasetId: string;
  activeDataset: DatasetMeta;
  availableDatasets: DatasetMeta[];
  activeSummary: any;
  isLoading: boolean;
  isOnline: boolean;
  error: string | null;
  selectDataset: (datasetId: string) => Promise<void>;
  registerDataset: (metadata: Partial<DatasetMeta> & { id: string; name?: string }) => void;
  refreshDatasets: () => Promise<void>;
  refreshSummary: () => Promise<void>;
}

const DatasetContext = createContext<DatasetContextType | null>(null);

export function DatasetProvider({ children }: { children: React.ReactNode }) {
  const [activeDatasetId, setActiveDatasetId] = useState<string>(PRESET_DATASETS[0].id);

  // Synchronize active dataset from URL params or localStorage after hydration to prevent SSR mismatch
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlId = urlParams.get('dataset_id');
      const saved = urlId || localStorage.getItem(STORAGE_KEY) || localStorage.getItem('active_dataset_id');
      if (saved && saved !== PRESET_DATASETS[0].id) {
        setActiveDatasetId(saved);
      }
    } catch (e) {}
  }, []);

  const [uploadedDatasets, setUploadedDatasets] = useState<DatasetMeta[]>([]);
  const [activeSummary, setActiveSummary] = useState<any>(DEMO_SUMMARY_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Network drop / reconnect listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch upload history from backend to populate available dynamic datasets
  const refreshDatasets = useCallback(async () => {
    try {
      const res = await getUploadHistory(1);
      if (res && res.records && Array.isArray(res.records)) {
        const mapped: DatasetMeta[] = res.records.map((r: any) => ({
          id: r.id || r.filename,
          name: r.filename || `Dataset ${r.id?.slice(0, 8)}`,
          row_count: r.row_count,
          status: r.status || 'READY',
          created_at: r.created_at,
          isPreset: false,
        }));
        setUploadedDatasets(mapped);
      }
    } catch {
      // Backend may not have uploads yet, keep presets
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getUploadHistory(1)
      .then((res) => {
        if (isMounted && res && res.records && Array.isArray(res.records)) {
          const mapped: DatasetMeta[] = res.records.map((r: any) => ({
            id: r.id || r.filename,
            name: r.filename || `Dataset ${r.id?.slice(0, 8)}`,
            row_count: r.row_count,
            status: r.status || 'READY',
            created_at: r.created_at,
            isPreset: false,
          }));
          setUploadedDatasets(mapped);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Combined dataset catalog
  const availableDatasets = useMemo(() => {
    const combined = [...PRESET_DATASETS];
    for (const up of uploadedDatasets) {
      if (!combined.some(d => d.id === up.id)) {
        combined.push(up);
      }
    }
    return combined;
  }, [uploadedDatasets]);

  // Current active dataset meta
  const activeDataset = useMemo(() => {
    return availableDatasets.find(d => d.id === activeDatasetId) || {
      id: activeDatasetId,
      name: activeDatasetId,
      row_count: 51280,
      dimensions: ['Product_Category', 'Sales_Channel', 'Geographic_Region'],
      target_metric: 'revenue',
      status: 'ACTIVE',
      isPreset: false,
    };
  }, [availableDatasets, activeDatasetId]);

  // Fetch telemetry summary for the currently active dataset
  const refreshSummary = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const isPreset = PRESET_DATASETS.some(p => p.id === activeDatasetId);
      const queryId = isPreset ? undefined : activeDatasetId;
      const data = await getSummary(queryId);

      if (data && (data.metadata || data.kpis || data.revenue_trend)) {
        setActiveSummary(data);
      } else {
        setActiveSummary(DEMO_SUMMARY_DATA);
      }
    } catch (err: any) {
      // Graceful fallback to demo summary for zero blank screens
      setActiveSummary(DEMO_SUMMARY_DATA);
      setError(err?.message || 'Failed to pull live summary');
    } finally {
      setIsLoading(false);
    }
  }, [activeDatasetId]);

  useEffect(() => {
    let isMounted = true;
    const isPreset = PRESET_DATASETS.some(p => p.id === activeDatasetId);
    const queryId = isPreset ? undefined : activeDatasetId;

    getSummary(queryId)
      .then((data) => {
        if (!isMounted) return;
        if (data && (data.metadata || data.kpis || data.revenue_trend)) {
          setActiveSummary(data);
        } else {
          setActiveSummary(DEMO_SUMMARY_DATA);
        }
        setIsLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setActiveSummary(DEMO_SUMMARY_DATA);
        setError(err?.message || 'Failed to pull live summary');
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeDatasetId]);

  // Dataset selector handler with multi-tab / cross-component sync
  const selectDataset = useCallback(async (datasetId: string) => {
    if (!datasetId) return;
    setActiveDatasetId(datasetId);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, datasetId);
        window.dispatchEvent(new CustomEvent(CUSTOM_EVENT_NAME, { detail: { datasetId } }));
      } catch (e) {}
    }
  }, []);

  // Register newly ingested dataset from /ingest
  const registerDataset = useCallback((metadata: Partial<DatasetMeta> & { id: string; name?: string }) => {
    const newDataset: DatasetMeta = {
      id: metadata.id,
      name: metadata.name || metadata.id,
      description: metadata.description || 'Dynamically ingested dataset',
      row_count: metadata.row_count || 0,
      dimensions: metadata.dimensions || ['Dimension_1', 'Dimension_2'],
      target_metric: metadata.target_metric || 'revenue',
      status: 'OPTIMAL',
      created_at: new Date().toISOString(),
      isPreset: false,
    };

    setUploadedDatasets(prev => {
      if (prev.some(d => d.id === newDataset.id)) {
        return prev.map(d => d.id === newDataset.id ? { ...d, ...newDataset } : d);
      }
      return [newDataset, ...prev];
    });

    selectDataset(newDataset.id);
  }, [selectDataset]);

  // Listen for storage events across tabs or local custom sync events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && e.newValue !== activeDatasetId) {
        setActiveDatasetId(e.newValue);
      }
    };

    const handleCustomSync = (e: Event) => {
      const custom = e as CustomEvent<{ datasetId: string }>;
      if (custom.detail?.datasetId && custom.detail.datasetId !== activeDatasetId) {
        setActiveDatasetId(custom.detail.datasetId);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(CUSTOM_EVENT_NAME, handleCustomSync);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomSync);
    };
  }, [activeDatasetId]);

  return (
    <DatasetContext.Provider
      value={{
        activeDatasetId,
        activeDataset,
        availableDatasets,
        activeSummary,
        isLoading,
        isOnline,
        error,
        selectDataset,
        registerDataset,
        refreshDatasets,
        refreshSummary,
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
}

const DEFAULT_FALLBACK_CONTEXT: DatasetContextType = {
  activeDatasetId: PRESET_DATASETS[0].id,
  activeDataset: PRESET_DATASETS[0],
  availableDatasets: PRESET_DATASETS,
  activeSummary: DEMO_SUMMARY_DATA,
  isLoading: false,
  isOnline: true,
  error: null,
  selectDataset: async () => {},
  registerDataset: () => {},
  refreshDatasets: async () => {},
  refreshSummary: async () => {},
};

export function useDataset() {
  const context = useContext(DatasetContext);
  if (!context) {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('active_dataset_id');
        if (saved) {
          return {
            ...DEFAULT_FALLBACK_CONTEXT,
            activeDatasetId: saved,
            activeDataset: {
              id: saved,
              name: saved,
              row_count: 51280,
              dimensions: ['Product_Category', 'Sales_Channel', 'Geographic_Region'],
              target_metric: 'revenue',
              status: 'ACTIVE',
              isPreset: false,
            }
          };
        }
      } catch (e) {}
    }
    return DEFAULT_FALLBACK_CONTEXT;
  }
  return context;
}
