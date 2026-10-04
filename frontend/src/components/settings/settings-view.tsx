'use client';

import { RefreshCw } from 'lucide-react';
import pkg from '../../../package.json';
import { HealthPillView } from '@/components/layout/health-dot';
import { summarizeHealth } from '@/components/layout/health';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { Switch } from '@/components/ui/switch';
import { formatDate, formatInr, formatInrCompact, formatInrDelta, formatNumber, formatSignedPercent } from '@/lib/formatters';
import { useHealth } from '@/lib/hooks/queries';
import { useSettings } from '@/lib/settings';

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <GlassCard as="section" aria-label={title} className="space-y-4">
      <div>
        <h2 className="t-h2">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
      </div>
      {children}
    </GlassCard>
  );
}

const SAMPLES: Array<[string, string]> = [
  ['Full amount', formatInr(12450000)],
  ['Compact (lakh)', formatInrCompact(1245000)],
  ['Compact (crore)', formatInrCompact(34000000)],
  ['Change in money', formatInrDelta(-18500)],
  ['Change in percent', formatSignedPercent(14.2)],
  ['Count', formatNumber(48210)],
  ['Date', formatDate('2026-03-04')],
];

export function SettingsView() {
  const { demoMode, setDemoMode } = useSettings();
  const health = useHealth();
  const summary = summarizeHealth(health.data, health.error, health.isPending);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Preferences for this browser. Nothing here is sent to the server." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Demo mode" description="For trying CogniTwin without your own data.">
          <Switch
            label="Show sample data"
            description="Reads built-in sample data instead of the backend. A “Demo data” badge stays visible on every page while this is on. It never turns itself on after an error."
            checked={demoMode}
            onCheckedChange={setDemoMode}
          />
        </Section>

        <Section title="Number and currency format" description="Everything is in Indian rupees with Indian digit grouping.">
          <dl className="divide-y divide-border text-sm">
            {SAMPLES.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2.5">
                <dt className="text-ink-3">{label}</dt>
                <dd className="font-medium tabular-nums text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Backend status" description="Live check of the services CogniTwin depends on.">
          <div className="flex flex-wrap items-center gap-3">
            <HealthPillView summary={summary} />
            <Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" strokeWidth={1.75} />} loading={health.isFetching} onClick={() => void health.refetch()}>
              Check again
            </Button>
          </div>
          {summary.details.length > 0 && (
            <ul className="space-y-1 text-sm capitalize text-ink-2">
              {summary.details.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="About">
          <dl className="divide-y divide-border text-sm">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-ink-3">App</dt>
              <dd className="font-medium text-ink">CogniTwin</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-ink-3">Version</dt>
              <dd className="font-medium tabular-nums text-ink">{pkg.version}</dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-ink-3">Data source</dt>
              <dd className="font-medium text-ink">{demoMode ? 'Demo data' : 'Your backend'}</dd>
            </div>
          </dl>
        </Section>
      </div>
    </div>
  );
}
