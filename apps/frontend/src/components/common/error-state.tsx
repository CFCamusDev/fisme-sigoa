import { Illustration } from './illustration';
import { Button } from '@/components/ui/button';
import { type IllustrationName } from '@/lib/illustrations';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  message: string;
  illustration?: IllustrationName;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Ocurrió un error',
  message,
  illustration = 'error',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-danger-border bg-danger-soft p-6 text-center text-danger',
        className,
      )}
    >
      <Illustration name={illustration} size={160} />
      <h3 className="mt-4 text-h3 font-semibold text-danger">{title}</h3>
      <p className="mt-1 text-body text-danger">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-4 border-danger-border text-danger hover:bg-danger/10"
        >
          Reintentar
        </Button>
      )}
    </div>
  );
}
