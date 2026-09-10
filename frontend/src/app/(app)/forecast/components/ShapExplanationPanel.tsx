'use client';

import { TrendingUp, TrendingDown, Info, Bot } from 'lucide-react';

interface Driver {
  feature: string;
  contribution: number;
}

interface ShapExplanationPanelProps {
  explanationText: string;
  positiveDrivers: Driver[];
  negativeDrivers: Driver[];
}

export function ShapExplanationPanel({ explanationText, positiveDrivers, negativeDrivers }: ShapExplanationPanelProps) {
  
  const parseExecutiveSummary = (text: string) => {
    // Basic markdown parsing to split bullets
    const lines = text.split('\n').filter(l => l.trim() !== '');
    return lines.map((line, idx) => {
      const isHeader = line.startsWith('##') || line.startsWith('**');
      if (isHeader) return null;
      // Strip initial dashes or asterisks for clean rendering
      const cleanLine = line.replace(/^[\-\*]\s*/, '');
      return (
        <li 
          key={idx} 
          className="flex items-start gap-3 text-neutral-300 text-sm leading-relaxed"
        >
          <span className="mt-0.5 opacity-80 shrink-0">
            {/* If line already has emoji, keep it, otherwise default */}
            {cleanLine.match(/^[\u{1F300}-\u{1F9FF}]/u) ? '' : '• '}
          </span>
          <span dangerouslySetInnerHTML={{ __html: cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong class="text-neutral-100">$1</strong>') }} />
        </li>
      );
    }).filter(Boolean);
  };

  return (
    <div className="mt-8 relative overflow-hidden bg-black border border-neutral-800 rounded-none shadow-2xl transition-all">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      
      <div className="p-8 relative z-10 flex flex-col xl:flex-row gap-12">
        
        {/* Executive Summary Section */}
        <div className="w-full xl:w-1/2">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-neutral-900 border border-neutral-800 p-2 rounded-full">
              <Bot className="w-5 h-5 text-neutral-400" />
            </div>
            <h3 className="text-xl font-bold tracking-tighter text-neutral-200 uppercase">Executive Summary</h3>
          </div>
          
          <div className="bg-[#111] border border-neutral-800 p-6 shadow-inner">
            <ul className="space-y-4">
              {parseExecutiveSummary(explanationText)}
            </ul>
          </div>
        </div>

        {/* Drivers Section */}
        <div className="w-full xl:w-1/2">
           <h3 className="text-xl font-bold tracking-tighter text-neutral-200 uppercase mb-6 flex items-center gap-2">
            <Info className="w-5 h-5 text-neutral-500" />
            Decomposed Forces
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Positive Drivers */}
            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest text-neutral-500 mb-2 border-b border-neutral-800 pb-2">Positive Factors</h4>
              {positiveDrivers.map((driver, idx) => (
                <div 
                  key={`pos-${idx}`}
                  className="bg-gradient-to-br from-emerald-950/30 to-black border border-emerald-900/30 p-4 shadow-[0_15px_30px_-10px_rgba(16,185,129,0.1)] hover:border-emerald-800/50 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationFillMode: 'both', animationDelay: `${(idx * 100) + 100}ms` }}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-neutral-300 font-medium capitalize tracking-wide">{driver.feature.replace(/_/g, ' ')}</span>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="mt-2 text-xl font-bold text-emerald-400">
                    +₹{Math.abs(driver.contribution).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ))}
            </div>

            {/* Negative Drivers */}
            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-widest text-neutral-500 mb-2 border-b border-neutral-800 pb-2">Negative Factors</h4>
              {negativeDrivers.map((driver, idx) => (
                <div 
                  key={`neg-${idx}`}
                  className="bg-gradient-to-br from-rose-950/30 to-black border border-rose-900/30 p-4 shadow-[0_15px_30px_-10px_rgba(225,29,72,0.1)] hover:border-rose-800/50 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationFillMode: 'both', animationDelay: `${(idx * 100) + 100}ms` }}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-neutral-300 font-medium capitalize tracking-wide">{driver.feature.replace(/_/g, ' ')}</span>
                    <TrendingDown className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="mt-2 text-xl font-bold text-rose-400">
                    -₹{Math.abs(driver.contribution).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
