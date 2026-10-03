'use client';

import { createContext, useContext, useId, useState } from 'react';
import { motion } from 'framer-motion';
import { Tabs as RadixTabs } from 'radix-ui';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  value: string;
  pillId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

/** Tabs with a gliding underline pill. Keyboard: arrow keys move, Home/End jump. */
export function Tabs({ value, defaultValue = '', onValueChange, className, children }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const pillId = useId();
  const current = value ?? internal;
  return (
    <TabsContext.Provider value={{ value: current, pillId }}>
      <RadixTabs.Root
        value={current}
        onValueChange={(next) => {
          setInternal(next);
          onValueChange?.(next);
        }}
        className={className}
      >
        {children}
      </RadixTabs.Root>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...rest }: React.ComponentProps<typeof RadixTabs.List>) {
  return <RadixTabs.List className={cn('flex gap-1 border-b border-border', className)} {...rest} />;
}

export function TabsTrigger({ value, className, children, ...rest }: React.ComponentProps<typeof RadixTabs.Trigger>) {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;
  return (
    <RadixTabs.Trigger
      value={value}
      className={cn(
        'relative px-3.5 py-2.5 text-sm font-medium outline-none transition-colors duration-[140ms] focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-primary',
        active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
        className,
      )}
      {...rest}
    >
      {children}
      {active && ctx && (
        <motion.span layoutId={ctx.pillId} transition={spring} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
      )}
    </RadixTabs.Trigger>
  );
}

export function TabsContent({ className, ...rest }: React.ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content className={cn('pt-5 outline-none', className)} {...rest} />;
}
