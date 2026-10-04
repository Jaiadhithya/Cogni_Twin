import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';

export const metadata = { title: 'Page not found · CogniTwin' };

/** Shown for any URL that does not exist. */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="glass flex max-w-md flex-col items-center gap-4 rounded-card px-8 py-12 text-center">
        <span aria-hidden className="grid size-14 place-items-center rounded-full bg-primary-tint text-primary-ink">
          <Compass className="size-7" strokeWidth={1.75} />
        </span>
        <p className="t-eyebrow text-ink-3">Error 404</p>
        <h1 className="t-h1">We could not find that page</h1>
        <p className="text-[15px] text-ink-2">The link may be old, or the page may have moved. Your data is safe.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/dashboard" variant="cta" arrow>
            Go to dashboard
          </ButtonLink>
          <ButtonLink href="/" variant="secondary">
            Home
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
