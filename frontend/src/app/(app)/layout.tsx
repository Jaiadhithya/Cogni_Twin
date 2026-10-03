import { Suspense } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Providers } from '@/components/providers';
import { ActiveDatasetProvider } from '@/lib/dataset-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      {/* useSearchParams (the ?dataset= selection) needs a Suspense boundary. */}
      <Suspense>
        <ActiveDatasetProvider>
          <AppShell>{children}</AppShell>
        </ActiveDatasetProvider>
      </Suspense>
    </Providers>
  );
}
