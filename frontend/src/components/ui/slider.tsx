'use client';

import { useId } from 'react';
import { Slider as RadixSlider } from 'radix-ui';
import { cn } from '@/lib/utils';

export interface SliderProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  /** Fires when the user releases the thumb: a good moment to run a simulation. */
  onValueCommit?: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Text for the current value, e.g. "+10%". */
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

/** Labelled slider with a live value readout. Keyboard: arrows, Home/End, PageUp/PageDown. */
export function Slider({ label, value, onValueChange, onValueCommit, min, max, step = 1, format, disabled, className }: SliderProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label id={id} className="t-label text-ink-2">
          {label}
        </label>
        <output aria-live="off" className="text-sm font-semibold tabular-nums text-ink">
          {format ? format(value) : value}
        </output>
      </div>
      <RadixSlider.Root
        value={[value]}
        onValueChange={([next]) => onValueChange(next)}
        onValueCommit={([next]) => onValueCommit?.(next)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-labelledby={id}
        className="relative flex h-6 w-full touch-none select-none items-center data-[disabled]:opacity-50"
      >
        <RadixSlider.Track className="relative h-1.5 grow rounded-full bg-black/[0.07]">
          <RadixSlider.Range className="absolute h-full rounded-full bg-primary" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          aria-label={label}
          className="block size-5 rounded-full border border-border-strong bg-surface-solid shadow-[0_1px_3px_rgb(15_23_42/0.25)] outline-none transition-[transform,box-shadow] duration-[140ms] hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-primary/40 active:scale-95"
        />
      </RadixSlider.Root>
    </div>
  );
}
