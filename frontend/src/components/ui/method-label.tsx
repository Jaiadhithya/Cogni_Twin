import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Backend method identifiers → the label people read. Unknown ones are humanised, not hidden. */
const LABELS: Record<string, string> = {
  prophet_component_decomposition: 'Factor attribution',
  tree_shap: 'SHAP (exact)',
  linear_coefficients: 'Linear coefficients',
  split_conformal: 'Split-conformal intervals',
  model_intervals: 'Model intervals',
};

export function methodLabelText(method: string): string {
  return LABELS[method] ?? method.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export interface MethodLabelProps {
  method: string;
  /** What the method means, in one sentence (the backend's `method_note`). */
  note?: string | null;
  className?: string;
}

/** "Method: Factor attribution": says how a number was produced. */
export function MethodLabel({ method, note, className }: MethodLabelProps) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3', className)}>
      <FlaskConical aria-hidden className="size-3.5" strokeWidth={1.75} />
      <span>
        Method: <span className="font-medium text-ink-2">{methodLabelText(method)}</span>
      </span>
      {note && <span className="basis-full sm:basis-auto">— {note}</span>}
    </p>
  );
}
