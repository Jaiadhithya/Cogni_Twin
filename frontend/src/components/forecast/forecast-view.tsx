'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { DatasetGate } from '@/components/layout/dataset-gate';
import { Button } from '@/components/ui/button';
import { ChartSkeleton } from '@/components/ui/skeleton';
import { DataState } from '@/components/ui/data-state';
import { EmptyState } from '@/components/ui/empty-state';
import { JobStatus } from '@/components/ui/job-status';
import { PageHeader } from '@/components/ui/page-header';
import { RevealGroup, RevealItem } from '@/components/ui/reveal';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useSimulate } from '@/lib/hooks/mutations';
import { useForecast, useForecastStatus, useSummary } from '@/lib/hooks/queries';
import { useTrainingJob } from '@/lib/hooks/training';
import { AttributionPanel } from './attribution-panel';
import { ForecastChart } from './forecast-chart';
import { WhatIfPanel } from './what-if-panel';

type Horizon = '30' | '60' | '90';

function Content({ datasetId }: { datasetId: string }) {
  const [horizon, setHorizon] = useState<Horizon>('30');
  const days = Number(horizon);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = useForecastStatus(datasetId);
  const forecast = useForecast(datasetId, days, status.data?.model_available === true);
  const summary = useSummary(datasetId);
  const training = useTrainingJob(datasetId);
  const preview = useSimulate(datasetId);
  const metric = summary.data?.target_metric_name ?? summary.data?.metadata?.target_metric;

  // "?retrain=1" (from the command palette or the dashboard) starts training once, then clears itself.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (searchParams.get('retrain') !== '1' || autoStarted.current) return;
    autoStarted.current = true;
    training.start();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('retrain');
    router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false });
  }, [searchParams, training, router, pathname]);

  const showJob = training.status !== 'idle';
  const noModel = status.data && !status.data.model_available;
  const trainButton = (
    <Button variant={noModel ? 'cta' : 'secondary'} size="sm" icon={<RefreshCw className="size-4" strokeWidth={1.75} />} loading={training.isActive} onClick={training.start}>
      {noModel ? 'Train model' : 'Retrain'}
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forecast & What-If"
        description="See what is coming, then change a lever to see what would happen."
        actions={
          <>
            <SegmentedControl
              label="Forecast horizon"
              value={horizon}
              onValueChange={setHorizon}
              options={[
                { value: '30', label: '30 days' },
                { value: '60', label: '60 days' },
                { value: '90', label: '90 days' },
              ]}
            />
            {trainButton}
          </>
        }
      />

      {showJob && (
        <JobStatus phase={training.status} error={training.failureMessage ?? (training.error ? training.error.message : null)} timedOut={training.timedOut} className="max-w-xl" />
      )}

      <DataState
        query={status.isError || status.isPending ? { ...status, data: undefined } : noModel ? { ...forecast, data: undefined, isPending: true, fetchStatus: 'idle' as const } : forecast}
        errorTitle="We could not load the forecast"
        skeleton={<ChartSkeleton height={340} />}
        empty={
          <EmptyState
            title="No trained model yet"
            description="Train a forecasting model on this dataset to see what is coming and to run what-ifs."
            action={trainButton}
          />
        }
      >
        {(data) => (
          <RevealGroup className="space-y-6">
            <RevealItem>
              <ForecastChart predict={data} simulation={preview.data ?? null} metric={metric} horizonDays={days} />
            </RevealItem>
            <RevealItem>
              <WhatIfPanel datasetId={datasetId} horizonDays={days} metric={metric} preview={preview} />
            </RevealItem>
            <RevealItem>
              <AttributionPanel datasetId={datasetId} forecastDate={data.forecast[0]?.date} scenarioForces={preview.data?.shap_forces ?? []} />
            </RevealItem>
          </RevealGroup>
        )}
      </DataState>
    </div>
  );
}

export function ForecastView() {
  return (
    <DatasetGate header={<PageHeader title="Forecast & What-If" description="See what is coming, then change a lever to see what would happen." />} skeleton={<ChartSkeleton height={340} />}>{(id) => <Content key={id} datasetId={id} />}</DatasetGate>
  );
}
