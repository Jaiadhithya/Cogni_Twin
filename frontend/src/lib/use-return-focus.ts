'use client';

import { useCallback, useRef } from 'react';

/**
 * Radix only restores focus to a `Dialog.Trigger`. Our dialogs and the mobile drawer are opened
 * from ordinary buttons (controlled `open`), so remember what had focus when the overlay opened
 * and put it back on close. Spread the result onto `Dialog.Content`.
 */
export function useReturnFocus() {
  const previous = useRef<HTMLElement | null>(null);

  const onOpenAutoFocus = useCallback(() => {
    previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, []);

  const onCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    previous.current?.focus();
    previous.current = null;
  }, []);

  return { onOpenAutoFocus, onCloseAutoFocus };
}
