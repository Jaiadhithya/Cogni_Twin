'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Info, RotateCcw, Save } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChangeBadge } from '@/components/ui/change-badge';
import { CountUp } from '@/components/ui/count-up';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { GlassCard } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/toast';
import { describeError } from '@/lib/api/errors';
import { humanizeMetric, metricFormatters } from '@/lib/dashboard';
import { humanizeLever, LEVER_RANGE, toMutations } from '@/lib/forecast';
import { formatInr, formatInrDelta, formatInrPrecise, formatNumber } from '@/lib/formatters';
import { useLevers } from '@/lib/hooks/queries';
import { useSimulate } from '@/lib/hooks/mutations';
import { duration, ease } from '@/lib/motion';
import type { Simulation, SimulationInput } from '@/lib/api/types';

type Preview = UseMutationResult<Simulation, Error, Omit<SimulationInput, 'dataset_id'>>;

export interface WhatIfPanelProps {
  datasetId: string;
  horizonDays: number;
  metric: string | undefined;
  preview: Preview;
}

const DEBOUNCE_MS = 450;
const pct = (v: number) => (v > 0 ? `+${v}%` : `${v}%`);

/** A badge that gives one soft pulse whenever its value changes. */
function PulseBadge({ value, label, invert }: { value: number; label?: string; invert?: boolean }) {
  return (
    <motion.span key={Math.round(value * 100)} initial={{ scale: 1 }} animate={{ scale: [1, 1.1, 1] }} transition={{ duration: duration.emphasis, ease: ease.out }} className="inline-flex">
      <ChangeBadge value={value} label={label} invert={invert} />
    </motion.span>
  );
}

function Result({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard as="section" aria-label={title} padding="sm" className="space-y-2">
      <h3 className="t-label">{title}</h3>
      {children}
    </GlassCard>
  );
}

function Unavailable({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 text-sm text-ink-3">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <span>{children}</span>
    </p>
  );
}

function Results({ sim, metric, horizonDays }: { sim: Simulation; metric: string | undefined; horizonDays: number }) {
  const fmt = metricFormatters(metric);
  const label = humanizeMetric(metric);
  const profit = sim.profit;
  const optimal = sim.pricing?.optimal_price;
  const elasticity = sim.pricing?.elasticity;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Result title={`${label} change over ${horizonDays} days`}>
        <p className="t-kpi">
          <CountUp value={sim.total_delta} format={(v) => (fmt.money ? formatInrDelta(v, true) : (v >= 0 ? '+' : '−') + formatNumber(Math.abs(v)))} fromZero={false} />
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <PulseBadge value={sim.total_delta_pct} />
          <span className="text-xs text-ink-3">
            {fmt.compact(sim.baseline_total)} → {fmt.compact(sim.mutated_total)}
          </span>
        </div>
      </Result>

      <Result title="Profit impact">
        {profit?.available ? (
          <>
            <p className="t-kpi">
              <CountUp value={profit.delta} format={(v) => formatInrDelta(v, true)} fromZero={false} />
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {profit.delta_pct !== null && <PulseBadge value={profit.delta_pct} />}
              <span className="text-xs text-ink-3">
                {formatInr(profit.baseline_gross_profit)} → {formatInr(profit.simulated_gross_profit)}
              </span>
            </div>
            <p className="text-xs text-ink-3">
              Unit cost {formatInrPrecise(profit.unit_cost)} ({profit.cost_source.replace(/_/g, ' ')})
            </p>
          </>
        ) : (
          <Unavailable>Profit unavailable: {profit?.reason ?? 'the backend returned no profit analysis.'}</Unavailable>
        )}
      </Result>

      {profit?.available && profit.margin_guardrail.triggered && (
        <div role="alert" className="flex gap-3 rounded-panel border border-warning/25 bg-warning-tint p-4 text-sm text-warning sm:col-span-2">
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="font-semibold">Margin warning</p>
            <p>{profit.margin_guardrail.message}</p>
          </div>
        </div>
      )}

      <Result title="Optimal price">
        {optimal?.price != null ? (
          <>
            <p className="t-kpi">{formatInrPrecise(optimal.price)}</p>
            <p className="text-xs text-ink-3">
              Profit-maximising price{optimal.unit_cost != null ? ` at a unit cost of ${formatInrPrecise(optimal.unit_cost)}` : ''}
              {optimal.elasticity != null ? `, elasticity ${optimal.elasticity}` : ''}.
            </p>
          </>
        ) : (
          <Unavailable>Optimal price unavailable: {optimal?.reason ?? 'the backend returned no price analysis.'}</Unavailable>
        )}
      </Result>

      <Result title="Price sensitivity">
        {elasticity?.elasticity != null ? (
          <>
            <p className="t-kpi">{elasticity.elasticity}</p>
            <p className="text-xs text-ink-3">
              {elasticity.usable ? 'Statistically reliable' : `Not reliable: ${elasticity.reason ?? 'weak fit'}`} · fit on {formatNumber(elasticity.n)} observations
              {elasticity.r2 != null ? `, R² ${elasticity.r2}` : ''}.
            </p>
          </>
        ) : (
          <Unavailable>Price sensitivity unavailable{elasticity?.reason ? `: ${elasticity.reason}` : sim.pricing ? ': not estimated for this dataset.' : '.'}</Unavailable>
        )}
      </Result>
    </div>
  );
}

/** Lever sliders → live what-if. Zero levers are not sent; the result tweens as sliders move. */
export function WhatIfPanel({ datasetId, horizonDays, metric, preview }: WhatIfPanelProps) {
  const levers = useLevers(datasetId);
  const saver = useSimulate(datasetId);
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, number>>({});
  const [unitCost, setUnitCost] = useState('');
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const previewRef = useRef(preview);

  useEffect(() => {
    previewRef.current = preview;
  });

  const mutations = useMemo(() => toMutations(values), [values]);
  const cost = unitCost.trim() === '' ? undefined : Number(unitCost);
  const costInvalid = cost !== undefined && (!Number.isFinite(cost) || cost < 0);
  const request = useMemo<Omit<SimulationInput, 'dataset_id'>>(
    () => ({ horizon_days: horizonDays, mutations, ...(cost !== undefined && !costInvalid ? { unit_cost: cost } : {}) }),
    [horizonDays, mutations, cost, costInvalid],
  );
  const hasMutations = Object.keys(mutations).length > 0;

  // Re-run the what-if shortly after the sliders (or horizon) settle.
  useEffect(() => {
    if (!hasMutations) {
      previewRef.current.reset();
      return;
    }
    const timer = setTimeout(() => previewRef.current.mutate(request), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [request, hasMutations]);

  const reset = () => {
    setValues({});
  };

  const save = () => {
    saver.mutate(
      { ...request, save: true, name: name.trim() || undefined },
      {
        onSuccess: () => {
          setSaveOpen(false);
          setName('');
          toast({ title: 'Scenario saved', description: 'Find it on the Scenarios page to compare with others.', tone: 'success' });
        },
      },
    );
  };

  const leverList = levers.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="t-h2">What-if</h2>
          <p className="mt-0.5 text-sm text-ink-3">Change a lever and see the forecast, profit and price respond.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(280px,1fr)_2fr]">
        <GlassCard className="space-y-5">
          {levers.isPending && (
            <div className="space-y-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {levers.isError && <ErrorState bare error={levers.error} title="We could not load the levers" onRetry={() => void levers.refetch()} />}
          {levers.isSuccess && leverList.length === 0 && (
            <EmptyState bare title="No levers in this dataset" description="What-if needs columns such as price or marketing spend. This dataset has none the model can change." />
          )}
          {leverList.map((lever) => (
            <Slider
              key={lever}
              label={humanizeLever(lever)}
              value={values[lever] ?? 0}
              onValueChange={(v) => setValues((current) => ({ ...current, [lever]: v }))}
              min={LEVER_RANGE.min}
              max={LEVER_RANGE.max}
              step={LEVER_RANGE.step}
              format={pct}
            />
          ))}
          {leverList.length > 0 && (
            <>
              <Input
                label="Cost per unit (optional)"
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="e.g. 126"
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
                error={costInvalid ? 'Enter a cost of zero or more.' : undefined}
                hint="Used for profit when your data has no cost column."
              />
              <div className="flex flex-wrap gap-3">
                <Button variant="cta" size="sm" icon={<Save className="size-4" strokeWidth={1.75} />} disabled={!hasMutations || costInvalid || !preview.data} onClick={() => setSaveOpen(true)}>
                  Save scenario
                </Button>
                <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" strokeWidth={1.75} />} disabled={!hasMutations} onClick={reset}>
                  Reset
                </Button>
              </div>
            </>
          )}
        </GlassCard>

        <div aria-live="polite" aria-busy={preview.isPending || undefined}>
          {!hasMutations && leverList.length > 0 && (
            <GlassCard className="grid h-full min-h-48 place-items-center text-center text-sm text-ink-3">Move a slider to run a what-if. Results appear here.</GlassCard>
          )}
          {hasMutations && preview.isError && <ErrorState error={preview.error} title="The what-if did not run" onRetry={() => preview.mutate(request)} />}
          {hasMutations && !preview.isError && !preview.data && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-card" />
              ))}
            </div>
          )}
          {hasMutations && preview.data && (
            <div className={preview.isPending ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
              <Results sim={preview.data} metric={metric} horizonDays={horizonDays} />
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save this scenario"
        description="Give it a name you will recognise when comparing scenarios."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button variant="cta" size="sm" loading={saver.isPending} onClick={save}>
              Save scenario
            </Button>
          </>
        }
      >
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Raise prices 5%" maxLength={255} />
        {saver.isError && (
          <p role="alert" className="mt-3 rounded-control bg-negative-tint px-3 py-2 text-sm text-negative">
            {describeError(saver.error)}
          </p>
        )}
        <ul className="mt-3 flex flex-wrap gap-2">
          {Object.entries(mutations).map(([lever, change]) => (
            <li key={lever} className="rounded-full bg-primary-tint px-2.5 py-1 text-xs font-medium text-primary-ink">
              {humanizeLever(lever)} {change}
            </li>
          ))}
        </ul>
      </Dialog>

    </div>
  );
}

