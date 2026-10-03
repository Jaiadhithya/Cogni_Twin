'use client';

import { useId } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Select as RadixSelect } from 'radix-ui';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  /** Second line under the label. */
  description?: string;
}

export interface SelectProps {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<SelectOption>;
  /** Visible label above the trigger. */
  label?: string;
  /** Accessible name when there is no visible label. */
  'aria-label'?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

/** Accessible dropdown (Radix) that springs open from its trigger. */
export function Select({ value, onValueChange, options, label, placeholder = 'Select…', disabled, className, triggerClassName, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="t-label text-ink-2">
          {label}
        </label>
      )}
      <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          id={id}
          aria-label={rest['aria-label']}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 rounded-control border border-border-strong bg-surface-solid px-3.5 text-left text-[15px] text-ink',
            'outline-none transition-[border-color,box-shadow] duration-[140ms] focus:border-primary focus:ring-[3px] focus:ring-primary/30',
            'disabled:cursor-not-allowed disabled:opacity-60 data-[placeholder]:text-ink-3',
            triggerClassName,
          )}
        >
          <span className="min-w-0 truncate">
            <RadixSelect.Value placeholder={placeholder} />
          </span>
          <RadixSelect.Icon>
            <ChevronDown aria-hidden className="size-4 text-ink-3" strokeWidth={1.75} />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={6}
            className={cn(
              'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-panel border border-border bg-surface-solid p-1.5 shadow-menu',
              'origin-[var(--radix-select-content-transform-origin)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 duration-200',
            )}
          >
            <RadixSelect.Viewport>
              {options.map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex cursor-pointer select-none flex-col rounded-control py-2 pl-3 pr-9 text-sm text-ink outline-none data-[highlighted]:bg-primary-tint data-[state=checked]:font-medium"
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  {option.description && <span className="text-xs text-ink-3">{option.description}</span>}
                  <RadixSelect.ItemIndicator className="absolute right-3 top-1/2 -translate-y-1/2 text-primary">
                    <Check aria-hidden className="size-4" strokeWidth={2} />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
}
