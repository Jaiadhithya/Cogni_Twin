'use client';

import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

export const inputStyles =
  'h-11 w-full rounded-control border border-border-strong bg-surface-solid px-3.5 text-[15px] text-ink placeholder:text-ink-3 ' +
  'outline-none transition-[border-color,box-shadow] duration-[140ms] ' +
  'focus:border-primary focus:ring-[3px] focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 ' +
  'aria-[invalid=true]:border-negative aria-[invalid=true]:focus:ring-negative/25';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Visible label. Always provide one (or aria-label). */
  label?: string;
  hint?: string;
  error?: string;
  /** Icon inside the field, left side. */
  leading?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, className, id: idProp, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="t-label text-ink-2">
          {label}
        </label>
      )}
      <div className="relative">
        {leading && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center text-ink-3 [&>svg]:size-4">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputStyles, leading && 'pl-10')}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-negative">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
