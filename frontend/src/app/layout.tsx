import type { Metadata } from 'next';
import './globals.css';
import { Space_Grotesk, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600', '700'],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  weight: ['300', '400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'CogniTwin — Business Digital Twin & Forecasting Instrument',
  description:
    'A computational twin of your business. Ingest transaction data, forecast demand with Prophet, run counterfactual what-if simulations, and get causal explanations in plain language.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        'dark',
        spaceGrotesk.variable,
        plusJakartaSans.variable,
        jetbrainsMono.variable
      )}
      suppressHydrationWarning
    >
      <body className="grain antialiased min-h-screen bg-graphite-950 text-ink font-sans">
        {children}
      </body>
    </html>
  );
}
