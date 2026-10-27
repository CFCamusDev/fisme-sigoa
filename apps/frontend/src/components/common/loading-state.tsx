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
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-sky-900" />
      <span className="mt-3 text-sm text-neutral-600">{message}</span>
      <span className="sr-only">{message}</span>
    </div>
  );
}
