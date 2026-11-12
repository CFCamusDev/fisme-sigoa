import * as React from 'react';
import { cn } from '@/lib/utils.js';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: React.Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-label text-foreground placeholder:text-muted-foreground transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50',
        'aria-invalid:border-2 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}
