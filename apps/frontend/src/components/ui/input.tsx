import * as React from 'react';
import { cn } from '@/lib/utils.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-label text-foreground placeholder:text-muted-foreground transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50',
        'aria-invalid:border-2 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
