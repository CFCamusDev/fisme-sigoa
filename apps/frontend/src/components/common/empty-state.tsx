import { type ReactNode } from 'react';
import { Illustration } from './illustration';
import { type IllustrationName } from '@/lib/illustrations';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description?: string;
  illustration?: IllustrationName;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  illustration = 'empty',
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-8 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-500">
          {icon}
        </div>
      ) : (
        <Illustration name={illustration} size={160} />
      )}
      <h3 className="mt-4 text-h3 font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 text-body text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
