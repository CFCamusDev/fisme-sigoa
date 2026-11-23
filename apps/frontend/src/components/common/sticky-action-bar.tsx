import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface StickyActionBarProps {
  readonly status?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

export function StickyActionBar({ status, children, className }: StickyActionBarProps) {
  return (
    <div
      data-testid="sticky-action-bar"
      className={cn(
        'sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-card-foreground shadow-md',
        className,
      )}
    >
      <div aria-live="polite" className="text-label font-normal text-muted-foreground">
        {status}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
