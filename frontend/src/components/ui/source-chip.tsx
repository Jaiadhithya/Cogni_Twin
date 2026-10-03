import { cn } from '@/lib/utils';

export type AnswerSource = 'data' | 'forecast' | 'documents' | 'relationship';

const labels: Record<AnswerSource, string> = {
  data: 'Data',
  forecast: 'Forecast',
  documents: 'Documents',
  relationship: 'Relationship',
};

const dots: Record<AnswerSource, string> = {
  data: 'bg-chart-1',
  forecast: 'bg-chart-2',
  documents: 'bg-chart-4',
  relationship: 'bg-chart-3',
};

export interface SourceChipProps {
  source: AnswerSource;
  /** The backend's confidence label for the answer ("high", "medium", "low"). */
  confidence?: string;
  className?: string;
}

/** Where an answer came from, plus the model's stated confidence. */
export function SourceChip({ source, confidence, className }: SourceChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-solid px-2.5 py-1 text-xs font-medium text-ink-2',
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', dots[source])} />
      <span>Source: {labels[source]}</span>
      {confidence && (
        <>
          <span aria-hidden className="text-ink-3">·</span>
          <span className="capitalize">{confidence} confidence</span>
        </>
      )}
    </span>
  );
}
