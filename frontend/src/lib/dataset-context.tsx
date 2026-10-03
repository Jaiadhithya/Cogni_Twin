'use client';

/**
 * The active dataset: which upload every page is looking at.
 *
 * Source of truth is the `?dataset=` URL parameter so links and reloads keep the selection;
 * it is mirrored here (and in localStorage) for components that need it. With no parameter
 * the remembered choice is used, then the most recent upload.
 */
import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useUploads } from '@/lib/hooks/queries';
import type { UploadRecord } from '@/lib/api/types';

export const DATASET_PARAM = 'dataset';
const STORAGE_KEY = 'cognitwin:dataset';

interface ActiveDatasetValue {
  /** Undefined until a dataset exists (no uploads yet, or still loading). */
  datasetId: string | undefined;
  dataset: UploadRecord | undefined;
  datasets: UploadRecord[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  setDatasetId: (id: string) => void;
  /** `/forecast` → `/forecast?dataset=<id>` so navigation keeps the selection. */
  withDataset: (href: string) => string;
}

const ActiveDatasetContext = createContext<ActiveDatasetValue | null>(null);

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage unavailable: the URL still carries the selection */
  }
}

export function addDatasetParam(href: string, datasetId: string | undefined): string {
  if (!datasetId) return href;
  const [path, existing = ''] = href.split('?');
  const params = new URLSearchParams(existing);
  params.set(DATASET_PARAM, datasetId);
  return `${path}?${params.toString()}`;
}

export function ActiveDatasetProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const uploads = useUploads(1, 100);

  const datasets = useMemo(() => uploads.data?.records ?? [], [uploads.data]);
  const urlId = searchParams.get(DATASET_PARAM);
  const loaded = uploads.isSuccess;

  const datasetId = useMemo(() => {
    const known = (id: string | null) => (id && datasets.some((d) => d.id === id) ? id : null);
    if (!loaded) return urlId ?? undefined; // trust the URL until the list arrives
    const stored = typeof window === 'undefined' ? null : readStored();
    return known(urlId) ?? known(stored) ?? datasets[0]?.id;
  }, [loaded, urlId, datasets]);

  // Keep the URL and storage in step with the resolved choice.
  useEffect(() => {
    if (!loaded || !datasetId) return;
    writeStored(datasetId);
    if (urlId !== datasetId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set(DATASET_PARAM, datasetId);
      router.replace(`${pathname}?${params.toString()}${window.location.hash}`, { scroll: false });
    }
  }, [loaded, datasetId, urlId, pathname, router, searchParams]);

  const setDatasetId = useCallback(
    (id: string) => {
      writeStored(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set(DATASET_PARAM, id);
      router.push(`${pathname}?${params.toString()}${window.location.hash}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const withDataset = useCallback((href: string) => addDatasetParam(href, datasetId), [datasetId]);
  const refetch = useCallback(() => void uploads.refetch(), [uploads]);

  const value = useMemo<ActiveDatasetValue>(
    () => ({
      datasetId,
      dataset: datasets.find((d) => d.id === datasetId),
      datasets,
      isLoading: uploads.isPending,
      error: uploads.error,
      refetch,
      setDatasetId,
      withDataset,
    }),
    [datasetId, datasets, uploads.isPending, uploads.error, refetch, setDatasetId, withDataset],
  );

  return <ActiveDatasetContext.Provider value={value}>{children}</ActiveDatasetContext.Provider>;
}

export function useActiveDataset(): ActiveDatasetValue {
  const value = useContext(ActiveDatasetContext);
  if (!value) throw new Error('useActiveDataset must be used inside <ActiveDatasetProvider>.');
  return value;
}
