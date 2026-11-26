import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils.js';

interface SheetDescriptionContextValue {
  registerDescription: (id: string) => () => void;
}

const SheetDescriptionContext = React.createContext<SheetDescriptionContextValue | null>(null);

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetPortal = DialogPrimitive.Portal;

export interface SheetOverlayProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Overlay
> {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Overlay>>;
}

export function SheetOverlay({ className, ref, ...props }: SheetOverlayProps) {
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

export const sheetContentVariants = cva(
  'fixed inset-y-0 right-0 z-[80] flex h-full max-w-full flex-col border-l border-border bg-card text-card-foreground shadow-lg motion-panel data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
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

export interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetContentVariants> {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Content>>;
  showCloseButton?: boolean;
}

export function SheetContent({
  className,
  children,
  size,
  showCloseButton = true,
  ref,
  ...props
}: SheetContentProps) {
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
    <SheetPortal>
      <SheetOverlay />
      <SheetDescriptionContext.Provider value={contextValue}>
        <DialogPrimitive.Content
          ref={ref}
          aria-describedby={resolvedDescribedBy}
          className={cn(sheetContentVariants({ size }), className)}
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
      </SheetDescriptionContext.Provider>
    </SheetPortal>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-1.5 border-b border-border px-6 pt-6 pb-4 pr-12',
        className,
      )}
      {...props}
    />
  );
}

export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-card px-6 py-4 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

export interface SheetTitleProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Title
> {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Title>>;
}

export function SheetTitle({ className, ref, ...props }: SheetTitleProps) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-h3 font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export interface SheetDescriptionProps extends React.ComponentPropsWithoutRef<
  typeof DialogPrimitive.Description
> {
  ref?: React.Ref<React.ComponentRef<typeof DialogPrimitive.Description>>;
}

export function SheetDescription({ className, id, ref, ...props }: SheetDescriptionProps) {
  const generatedId = React.useId();
  const resolvedId = id ?? generatedId;
  const ctx = React.useContext(SheetDescriptionContext);

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
