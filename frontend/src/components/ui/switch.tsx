'use client';

import { useId } from 'react';
import { Switch as RadixSwitch } from 'radix-ui';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  className?: string;
}

/** Labelled on/off switch. The thumb glides with a CSS transform. */
export function Switch({ checked, onCheckedChange, label, description, className }: SwitchProps) {
  const id = useId();
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-[15px] font-medium text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
      </div>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-black/15 outline-none transition-colors duration-[200ms] focus-visible:ring-[3px] focus-visible:ring-primary/40 data-[state=checked]:bg-primary"
      >
        <RadixSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgb(15_23_42/0.3)] transition-transform duration-[200ms] ease-[var(--ease-out-expo)] data-[state=checked]:translate-x-[22px]" />
      </RadixSwitch.Root>
    </div>
  );
}
