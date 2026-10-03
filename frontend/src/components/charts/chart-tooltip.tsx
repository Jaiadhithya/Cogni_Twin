import { tooltipStyle } from '@/lib/chart-theme';
import { formatInr } from '@/lib/formatters';

interface TooltipEntry {
  name?: string | number;
  value?: number | string | ReadonlyArray<number | string>;
  color?: string;
  dataKey?: string | number;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: string | number;
  /** Formats each value. Defaults to INR. */
  formatValue?: (value: number, name: string) => string;
  formatLabel?: (label: string | number) => string;
  /** Series to leave out (e.g. a band's helper series). */
  hide?: ReadonlyArray<string>;
}

/** Solid white tooltip card with tabular figures. Pass to Recharts as `content={<ChartTooltip />}`. */
export function ChartTooltip({ active, payload, label, formatValue = (v) => formatInr(v), formatLabel, hide = [] }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((entry) => !hide.includes(String(entry.dataKey ?? entry.name)));
  if (!rows.length) return null;
  return (
    <div style={tooltipStyle}>
      {label !== undefined && <p className="mb-1.5 text-xs font-medium text-ink-3">{formatLabel ? formatLabel(label) : String(label)}</p>}
      <ul className="space-y-1">
        {rows.map((entry) => {
          const name = String(entry.name ?? entry.dataKey ?? '');
          const raw = Array.isArray(entry.value) ? entry.value[0] : entry.value;
          const value = typeof raw === 'number' ? formatValue(raw, name) : String(raw ?? '');
          return (
            <li key={`${entry.dataKey}-${name}`} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-2 text-ink-2">
                <span aria-hidden className="size-2 rounded-full" style={{ background: entry.color }} />
                {name}
              </span>
              <span className="font-semibold text-ink">{value}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
