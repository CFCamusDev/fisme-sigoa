import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils.js';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

export interface DropdownMenuContentProps extends React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
> {
  ref?: React.Ref<React.ComponentRef<typeof DropdownMenuPrimitive.Content>>;
}

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ref,
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-[80] min-w-[12rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md motion-color data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export interface DropdownMenuItemProps extends React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Item
> {
  ref?: React.Ref<React.ComponentRef<typeof DropdownMenuPrimitive.Item>>;
}

export function DropdownMenuItem({ className, ref, ...props }: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2.5 py-2 text-label font-normal outline-none transition-colors motion-color focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export interface DropdownMenuLabelProps extends React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Label
> {
  ref?: React.Ref<React.ComponentRef<typeof DropdownMenuPrimitive.Label>>;
}

export function DropdownMenuLabel({ className, ref, ...props }: DropdownMenuLabelProps) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn('px-2.5 py-1.5 text-meta font-semibold text-muted-foreground', className)}
      {...props}
    />
  );
}

export interface DropdownMenuSeparatorProps extends React.ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Separator
> {
  ref?: React.Ref<React.ComponentRef<typeof DropdownMenuPrimitive.Separator>>;
}

export function DropdownMenuSeparator({ className, ref, ...props }: DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}
