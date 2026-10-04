import { Banknote, Receipt, Search, TrendingUp } from 'lucide-react';

/**
 * Static markup of what the dashboard looks like (not live data): the glass product window
 * inside the hero. Purely illustrative, hidden from assistive technology.
 */
export function ProductWindow() {
  return (
    <div aria-hidden className="select-none">
      {/* Gradient border shell: the single gradient element in the hero besides the headline word. */}
      <div className="rounded-[28px] bg-gradient-to-br from-primary/45 via-accent/35 to-warning/25 p-[3px] shadow-[0_30px_80px_-30px_rgb(168_85_247/0.45)]">
        <div className="glass rounded-[25px] bg-surface-solid p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-negative/70" />
            <span className="size-2.5 rounded-full bg-chart-4" />
            <span className="size-2.5 rounded-full bg-positive/80" />
            <div className="ml-4 flex h-8 flex-1 items-center gap-2 rounded-full bg-black/[0.04] px-3 text-xs text-ink-3">
              <Search className="size-3.5" strokeWidth={1.75} /> Ask about your business…
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="text-lg font-semibold text-ink">Performance</p>
              <p className="text-xs text-ink-3">Live metrics from your sales data</p>
            </div>
            <span className="rounded-full bg-black/[0.05] px-3 py-1 text-xs font-medium text-ink-2">Last 30 days</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Revenue', value: '₹3.8 Cr', badge: '+7.1%', icon: Banknote },
              { label: 'Orders', value: '62,813', badge: '+2.1%', icon: Receipt },
              { label: 'Forecast', value: '₹1.2 Cr', badge: '+8.4%', icon: TrendingUp },
            ].map(({ label, value, badge, icon: Icon }) => (
              <div key={label} className="rounded-panel border border-border bg-surface-solid p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-ink-3">{label}</span>
                  <Icon className="size-3.5 text-primary-ink" strokeWidth={1.75} />
                </div>
                <p className="mt-1.5 text-lg font-semibold tabular-nums text-ink sm:text-xl">{value}</p>
                <span className="mt-1.5 inline-block rounded-full bg-positive-tint px-1.5 py-0.5 text-[10px] font-semibold text-positive">{badge}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-panel border border-border bg-surface-solid p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink">Revenue forecast</span>
              <span className="flex items-center gap-3 text-ink-3">
                <span className="flex items-center gap-1"><span className="h-0.5 w-3 rounded bg-chart-1" /> Actual</span>
                <span className="flex items-center gap-1"><span className="h-0.5 w-3 rounded bg-chart-2" /> Forecast</span>
              </span>
            </div>
            <svg viewBox="0 0 400 120" className="mt-2 h-24 w-full sm:h-28" role="presentation">
              <path d="M0 80 C 25 70, 45 90, 70 66 S 120 50, 150 62 S 200 40, 225 52" fill="none" stroke="var(--color-chart-1)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M225 52 C 255 36, 280 60, 310 40 S 360 30, 400 22 L400 62 C 360 70, 330 78, 310 70 S 255 82, 225 52 Z" fill="var(--color-chart-2)" fillOpacity="0.14" />
              <path d="M225 52 C 255 40, 280 56, 310 46 S 360 38, 400 32" fill="none" stroke="var(--color-chart-2)" strokeWidth="2.5" strokeDasharray="6 5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
