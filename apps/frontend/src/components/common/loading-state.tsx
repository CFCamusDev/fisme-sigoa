import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = 'Cargando información...',
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center p-8 text-center', className)}
    >
      <div className="size-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-700" />
      <span className="mt-3 text-label text-muted-foreground">{message}</span>
      <span className="sr-only">{message}</span>
    </div>
  );
}
