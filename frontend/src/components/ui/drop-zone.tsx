'use client';

import { useId, useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DropZoneProps {
  /** Called with the chosen file (one at a time). */
  onFile: (file: File) => void;
  /** Passed to the file input, e.g. ".csv" or "application/pdf". */
  accept?: string;
  title?: string;
  hint?: string;
  /** Name of the file already chosen. */
  fileName?: string | null;
  /** Validation or upload error, shown verbatim. */
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

/** Big drop target. Works by drag, by click, and by keyboard (Enter / Space). */
export function DropZone({
  onFile,
  accept,
  title = 'Drop a file here, or browse',
  hint,
  fileName,
  error,
  disabled,
  className,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const hintId = useId();

  const open = () => {
    if (!disabled) inputRef.current?.click();
  };

  const take = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-describedby={hintId}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) take(event.dataTransfer.files);
        }}
        className={cn(
          'flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed px-6 py-10 text-center',
          'outline-none transition-[border-color,background-color,transform] duration-[160ms] ease-[var(--ease-state)]',
          'focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/30',
          dragging ? 'scale-[1.01] border-primary bg-primary-tint' : 'border-border-strong bg-surface hover:border-primary/60 hover:bg-primary-tint/50',
          error && 'border-negative/60',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span aria-hidden className="grid size-14 place-items-center rounded-full bg-primary-tint text-primary-ink">
          <FileUp className="size-7" strokeWidth={1.75} />
        </span>
        <p className="t-h2">{fileName ?? title}</p>
        <p id={hintId} className="max-w-sm text-sm text-ink-3">
          {hint ?? 'Click to browse, or drag and drop.'}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        aria-label={title}
        onChange={(event) => {
          take(event.target.files);
          event.target.value = ''; // allow choosing the same file again
        }}
      />
      {error && (
        <p role="alert" className="mt-3 rounded-control bg-negative-tint px-4 py-3 text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
