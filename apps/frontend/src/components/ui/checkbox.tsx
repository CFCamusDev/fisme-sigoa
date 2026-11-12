import * as React from 'react';
import { cn } from '@/lib/utils.js';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  ref?: React.Ref<HTMLInputElement>;
}

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        'size-4 shrink-0 rounded-xs border border-input accent-primary transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-2 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
