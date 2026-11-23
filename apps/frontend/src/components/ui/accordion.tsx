import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';

type AccordionSingleProps = {
  type?: 'single';
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  collapsible?: boolean;
};

type AccordionMultipleProps = {
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
};

export type AccordionProps = React.HTMLAttributes<HTMLDivElement> &
  (AccordionSingleProps | AccordionMultipleProps);

interface AccordionContextValue {
  openItems: readonly string[];
  toggleItem: (itemValue: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);
const AccordionItemContext = React.createContext<string | null>(null);

export function Accordion(props: AccordionProps) {
  const { className, children } = props;

  if (props.type === 'multiple') {
    return (
      <AccordionMultiple className={className} {...props}>
        {children}
      </AccordionMultiple>
    );
  }

  return (
    <AccordionSingle className={className} {...props}>
      {children}
    </AccordionSingle>
  );
}

function AccordionSingle({
  value,
  defaultValue = '',
  onValueChange,
  collapsible = true,
  className,
  children,
  ...rest
}: AccordionSingleProps & Omit<React.HTMLAttributes<HTMLDivElement>, keyof AccordionSingleProps>) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const isControlled = value !== undefined;
  const activeValue = isControlled ? value : internalValue;

  const toggleItem = React.useCallback(
    (itemValue: string) => {
      const nextValue = activeValue === itemValue ? (collapsible ? '' : itemValue) : itemValue;
      if (!isControlled) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [activeValue, collapsible, isControlled, onValueChange],
  );

  const contextValue = React.useMemo<AccordionContextValue>(
    () => ({
      openItems: activeValue ? [activeValue] : [],
      toggleItem,
    }),
    [activeValue, toggleItem],
  );

  return (
    <AccordionContext.Provider value={contextValue}>
      <div
        className={cn('divide-y divide-border rounded-lg border border-border', className)}
        {...rest}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

function AccordionMultiple({
  type: _type,
  value,
  defaultValue = [],
  onValueChange,
  className,
  children,
  ...rest
}: AccordionMultipleProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof AccordionMultipleProps>) {
  const [internalValue, setInternalValue] = React.useState<string[]>(defaultValue);
  const isControlled = value !== undefined;
  const activeValues = isControlled ? value : internalValue;

  const toggleItem = React.useCallback(
    (itemValue: string) => {
      const nextValues = activeValues.includes(itemValue)
        ? activeValues.filter((v) => v !== itemValue)
        : [...activeValues, itemValue];
      if (!isControlled) {
        setInternalValue(nextValues);
      }
      onValueChange?.(nextValues);
    },
    [activeValues, isControlled, onValueChange],
  );

  const contextValue = React.useMemo<AccordionContextValue>(
    () => ({
      openItems: activeValues,
      toggleItem,
    }),
    [activeValues, toggleItem],
  );

  return (
    <AccordionContext.Provider value={contextValue}>
      <div
        className={cn('divide-y divide-border rounded-lg border border-border', className)}
        {...rest}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function AccordionItem({ value, className, children, ...props }: AccordionItemProps) {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) {
    throw new Error('AccordionItem debe usarse dentro de Accordion');
  }

  const isOpen = ctx.openItems.includes(value);

  return (
    <AccordionItemContext.Provider value={value}>
      <Collapsible
        open={isOpen}
        onOpenChange={() => ctx.toggleItem(value)}
        className={cn('bg-card', className)}
        {...props}
      >
        {children}
      </Collapsible>
    </AccordionItemContext.Provider>
  );
}

export interface AccordionTriggerProps extends React.ComponentPropsWithoutRef<
  typeof CollapsibleTrigger
> {
  ref?: React.Ref<React.ComponentRef<typeof CollapsibleTrigger>>;
}

export function AccordionTrigger({ className, children, ref, ...props }: AccordionTriggerProps) {
  return (
    <CollapsibleTrigger
      ref={ref}
      type="button"
      className={cn(
        'flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-label font-semibold text-foreground transition-colors motion-color hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&[data-state=open]>svg]:rotate-180',
        className,
      )}
      {...props}
    >
      <span className="flex-1">{children}</span>
      <ChevronDown
        className="size-4 shrink-0 text-muted-foreground transition-transform motion-color"
        aria-hidden="true"
      />
    </CollapsibleTrigger>
  );
}

export interface AccordionContentProps extends React.ComponentPropsWithoutRef<
  typeof CollapsibleContent
> {
  ref?: React.Ref<React.ComponentRef<typeof CollapsibleContent>>;
}

export function AccordionContent({ className, children, ref, ...props }: AccordionContentProps) {
  return (
    <CollapsibleContent ref={ref} className={cn('px-4 pb-4 text-body', className)} {...props}>
      {children}
    </CollapsibleContent>
  );
}
