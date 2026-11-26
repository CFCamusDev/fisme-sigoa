import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMPORT_STEPS, type ImportStep } from '../lib/import-steps';

export interface ImportStepIndicatorProps {
  readonly currentStep: ImportStep;
}

export function ImportStepIndicator({ currentStep }: ImportStepIndicatorProps) {
  return (
    <ol aria-label="Pasos de importación" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {IMPORT_STEPS.map(({ step, label }) => {
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;

        return (
          <li
            key={step}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
              isCompleted && 'border-primary/30 bg-primary/10 text-primary',
              isCurrent && 'border-primary bg-card font-semibold text-foreground',
              !isCompleted && !isCurrent && 'border-border bg-muted/40 text-muted-foreground',
            )}
          >
            {isCompleted ? (
              <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-background text-muted-foreground',
                )}
              >
                {step}
              </span>
            )}
            <span>
              {step}. {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
