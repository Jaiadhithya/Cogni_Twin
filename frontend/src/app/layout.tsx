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
  title: 'Cognitia Twin — AI Business Digital Twin & Scientific Observatory',
  description: 'AI-powered Business Digital Twin Platform. Monitor, Predict, Simulate, and Prescribe with machine learning forecasting and counterfactual What-If analysis.',
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
        "dark",
        spaceGrotesk.variable,
        plusJakartaSans.variable,
        jetbrainsMono.variable
      )}
      suppressHydrationWarning
    >
      <body className="antialiased min-h-screen bg-[#07080B] text-slate-100 font-sans selection:bg-[#00F0FF] selection:text-black">
        {children}
      </body>
    </html>
  );
}
