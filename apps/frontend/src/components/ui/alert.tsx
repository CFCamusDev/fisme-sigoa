import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils.js';

export const alertVariants = cva(
  'relative w-full rounded-lg border p-4 text-body [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-5',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-foreground',
        danger: 'border-danger-border bg-danger-soft text-danger [&>svg]:text-danger',
        warning: 'border-warning-border bg-warning-soft text-warning [&>svg]:text-warning',
        success: 'border-success-border bg-success-soft text-success [&>svg]:text-success',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  ref?: React.Ref<HTMLDivElement>;
}

export function Alert({ className, variant = 'default', role, ...props }: AlertProps) {
  const resolvedRole = role ?? (variant === 'danger' ? 'alert' : 'status');
  return (
    <div role={resolvedRole} className={cn(alertVariants({ variant }), className)} {...props} />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { ref?: React.Ref<HTMLHeadingElement> }) {
  return (
    // eslint-disable-next-line jsx-a11y/heading-has-content
    <h5
      className={cn('mb-1 font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.Ref<HTMLParagraphElement> }) {
  return (
    <div className={cn('text-body text-foreground [&_p]:leading-relaxed', className)} {...props} />
  );
}
