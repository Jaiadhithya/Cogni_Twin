'use client';

import { GlassCard } from '@/components/ui/glass-card';
import { PageHeader } from '@/components/ui/page-header';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/lib/settings';

/**
 * Phase 1 ships the one setting everything else depends on: the Demo mode switch.
 * Phase 3 adds the format preview, about/version and backend health details.
 */
export default function SettingsPage() {
  const { demoMode, setDemoMode } = useSettings();
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Preferences for this browser. Nothing here is sent to the server." />
      <GlassCard className="max-w-2xl">
        <Switch
          label="Demo mode"
          description="Show sample data instead of reading from the backend. A “Demo data” badge stays visible on every page while this is on. Off by default."
          checked={demoMode}
          onCheckedChange={setDemoMode}
        />
      </GlassCard>
    </div>
  );
}
