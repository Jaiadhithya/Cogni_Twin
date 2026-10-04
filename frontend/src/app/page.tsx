import { Hero } from '@/components/landing/hero';
import { LandingNav } from '@/components/landing/landing-nav';
import { Features, Footer, HowItWorks } from '@/components/landing/sections';
import { Providers } from '@/components/providers';

export default function LandingPage() {
  return (
    <Providers>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-cta focus:px-4 focus:py-2 focus:text-sm focus:text-white">
        Skip to content
      </a>
      <LandingNav />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Features />
        <HowItWorks />
      </main>
      <Footer />
    </Providers>
  );
}
