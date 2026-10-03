'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';
import { RadioGroup } from 'radix-ui';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  /** Accessible name of the group, e.g. "Forecast horizon". */
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** A segmented picker with a sliding pill (shared layoutId) that glides between options. */
export function SegmentedControl<T extends string>({ value, onValueChange, options, label, size = 'md', className }: SegmentedControlProps<T>) {
  const pillId = useId();
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-label={label}
      orientation="horizontal"
      className={cn('relative inline-flex items-center rounded-full bg-black/[0.045] p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <RadioGroup.Item
            key={option.value}
            value={option.value}
            className={cn(
              'relative isolate rounded-full font-medium outline-none transition-colors duration-[140ms] focus-visible:ring-2 focus-visible:ring-primary',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-[13px]',
              active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                transition={spring}
                className="absolute inset-0 -z-10 rounded-full bg-surface-solid shadow-[0_1px_2px_rgb(15_23_42/0.1),0_0_0_1px_rgb(15_23_42/0.04)]"
              />
            )}
            {option.label}
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}

export type Period = '7' | '30' | '90' | 'all';

const PERIOD_OPTIONS: ReadonlyArray<SegmentedOption<Period>> = [
  { value: '7', label: '7D' },
  { value: '30', label: '30D' },
  { value: '90', label: '90D' },
  { value: 'all', label: 'All' },
];

export interface PeriodPickerProps {
  value: Period;
  onChange: (value: Period) => void;
  options?: ReadonlyArray<SegmentedOption<Period>>;
  className?: string;
}

/** Last 7 / 30 / 90 days / All: the period control on charts and KPI rows. */
export function PeriodPicker({ value, onChange, options = PERIOD_OPTIONS, className }: PeriodPickerProps) {
  return <SegmentedControl value={value} onValueChange={onChange} options={options} label="Time period" size="sm" className={className} />;
}
