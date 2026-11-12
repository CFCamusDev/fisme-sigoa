import * as React from 'react';
import { cn } from '@/lib/utils.js';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  ref?: React.Ref<HTMLSelectElement>;
}

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-md border border-input bg-card px-3 text-label text-foreground transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50',
        'aria-invalid:border-2 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
