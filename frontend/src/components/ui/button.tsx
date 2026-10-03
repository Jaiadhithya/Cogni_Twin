'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'cta' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface StyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

const base =
  'group relative inline-flex select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap font-medium ' +
  'transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-[140ms] ease-[var(--ease-state)] ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  cta: 'rounded-full bg-cta text-white shadow-[0_1px_2px_rgb(15_23_42/0.2),0_6px_16px_rgb(15_23_42/0.18)] hover:shadow-[0_1px_2px_rgb(15_23_42/0.2),0_10px_24px_rgb(15_23_42/0.24)]',
  secondary: 'rounded-full border border-border-strong bg-surface-solid text-ink hover:border-ink-3/50',
  ghost: 'rounded-control bg-transparent text-primary-ink hover:bg-primary-tint',
  danger: 'rounded-full bg-negative text-white hover:bg-negative/90',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-[15px]',
};

export function buttonStyles({ variant = 'secondary', size = 'md', className }: StyleOptions = {}): string {
  return cn(base, variants[variant], variant === 'ghost' ? 'px-3 py-1.5 text-sm' : sizes[size], className);
}

/** Moving highlight on the dark CTA. Hidden under reduced motion. */
function Sheen() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:translate-x-[320%] motion-reduce:hidden"
    />
  );
}

interface ContentProps {
  variant: ButtonVariant;
  loading?: boolean;
  icon?: React.ReactNode;
  /** Trailing arrow that nudges on hover. */
  arrow?: boolean;
  children: React.ReactNode;
}

function Content({ variant, loading, icon, arrow, children }: ContentProps) {
  return (
    <>
      {variant === 'cta' && <Sheen />}
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" strokeWidth={1.75} /> : icon}
      <span className="relative">{children}</span>
      {arrow && !loading && (
        <ArrowRight
          aria-hidden
          className="relative size-4 transition-transform duration-[140ms] group-hover:translate-x-0.5"
          strokeWidth={1.75}
        />
      )}
    </>
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  arrow?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, arrow, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, className })}
      {...rest}
    >
      <Content variant={variant} loading={loading} icon={icon} arrow={arrow}>
        {children}
      </Content>
    </button>
  );
});

export interface ButtonLinkProps extends Omit<React.ComponentProps<typeof Link>, 'className'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  arrow?: boolean;
  className?: string;
}

/** A link that looks like a Button. */
export function ButtonLink({ variant = 'secondary', size = 'md', icon, arrow, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonStyles({ variant, size, className })} {...rest}>
      <Content variant={variant} icon={icon} arrow={arrow}>
        {children}
      </Content>
    </Link>
  );
}
