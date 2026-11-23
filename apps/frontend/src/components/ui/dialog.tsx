import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils.js';

interface DialogDescriptionContextValue {
  registerDescription: (id: string) => () => void;
}

const DialogDescriptionContext = React.createContext<DialogDescriptionContextValue | null>(null);

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export interface DialogOverlayProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Overlay
> {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Overlay>>;
}

export function DialogOverlay({ className, ref, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-[70] bg-brand-950/60 motion-panel data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className,
      )}
      {...props}
    />
  );
}

export const dialogContentVariants = cva(
  'fixed top-1/2 left-1/2 z-[80] grid max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl motion-panel data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  {
    variants: {
      size: {
        sm: 'w-[480px]',
        md: 'w-[640px]',
        lg: 'w-[960px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export interface DialogContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Content>>;
  showCloseButton?: boolean;
}

export function DialogContent({
  className,
  children,
  size,
  showCloseButton = true,
  ref,
  ...props
}: DialogContentProps) {
  const [descriptionId, setDescriptionId] = React.useState<string | undefined>(undefined);

  const registerDescription = React.useCallback((id: string) => {
    setDescriptionId(id);
    return () => {
      setDescriptionId((current) => (current === id ? undefined : current));
    };
  }, []);

  const contextValue = React.useMemo(() => ({ registerDescription }), [registerDescription]);
  const resolvedDescribedBy =
    'aria-describedby' in props ? props['aria-describedby'] : descriptionId;

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogDescriptionContext.Provider value={contextValue}>
        <DialogPrimitive.Content
          ref={ref}
          aria-describedby={resolvedDescribedBy}
          className={cn(dialogContentVariants({ size }), className)}
          {...props}
        >
          {children}
          {showCloseButton ? (
            <DialogPrimitive.Close
              aria-label="Cerrar"
              className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground motion-color hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none"
            >
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          ) : null}
        </DialogPrimitive.Content>
      </DialogDescriptionContext.Provider>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 pr-8 text-left', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export interface DialogTitleProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Title
> {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Title>>;
}

export function DialogTitle({ className, ref, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-h3 font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export interface DialogDescriptionProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Description
> {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Description>>;
}

export function DialogDescription({ className, id, ref, ...props }: DialogDescriptionProps) {
  const generatedId = React.useId();
  const resolvedId = id ?? generatedId;
  const ctx = React.useContext(DialogDescriptionContext);

  React.useEffect(() => {
    if (!ctx) return undefined;
    return ctx.registerDescription(resolvedId);
  }, [ctx, resolvedId]);

  return (
    <DialogPrimitive.Description
      ref={ref}
      id={resolvedId}
      className={cn('text-label font-normal text-muted-foreground', className)}
      {...props}
    />
  );
}
