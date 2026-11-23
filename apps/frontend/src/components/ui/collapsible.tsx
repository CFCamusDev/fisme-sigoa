import * as React from 'react';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils.js';

export const Collapsible = CollapsiblePrimitive.Root;
export const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

export interface CollapsibleContentProps extends React.ComponentPropsWithoutRef<
  typeof CollapsiblePrimitive.Content
> {
  ref?: React.Ref<React.ComponentRef<typeof CollapsiblePrimitive.Content>>;
}

export function CollapsibleContent({ className, ref, ...props }: CollapsibleContentProps) {
  return (
    <CollapsiblePrimitive.Content
      ref={ref}
      className={cn(
        'overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
        className,
      )}
      {...props}
    />
  );
}
