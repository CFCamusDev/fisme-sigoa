import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils.js';

export const Tabs = TabsPrimitive.Root;

export interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  ref?: React.Ref<React.ComponentRef<typeof TabsPrimitive.List>>;
}

export function TabsList({ className, ref, ...props }: TabsListProps) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto border-b border-border',
        className,
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Trigger
> {
  ref?: React.Ref<React.ComponentRef<typeof TabsPrimitive.Trigger>>;
}

export function TabsTrigger({ className, ref, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        '-mb-px inline-flex items-center justify-center whitespace-nowrap border-b-2 border-transparent px-4 py-2.5 text-label font-semibold text-muted-foreground transition-colors motion-color',
        'hover:text-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:border-brand-700 data-[state=active]:text-brand-700',
        className,
      )}
      {...props}
    />
  );
}

export interface TabsContentProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Content
> {
  ref?: React.Ref<React.ComponentRef<typeof TabsPrimitive.Content>>;
}

export function TabsContent({ className, ref, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        'mt-4 animate-fade-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  );
}
