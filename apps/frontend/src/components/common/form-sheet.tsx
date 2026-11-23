import { useRef, useState, type ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { FormBusyContext } from './form-busy-context';

export interface FormSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly busy?: boolean;
  readonly onRestoreFocus?: () => void;
  readonly children: ReactNode;
}

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  busy = false,
  onRestoreFocus,
  children,
}: FormSheetProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [reportedBusy, setReportedBusy] = useState(false);
  const isBusy = busy || reportedBusy;

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (isBusy) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <SheetContent
        size={size}
        showCloseButton={!isBusy}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          if (onRestoreFocus) {
            event.preventDefault();
            onRestoreFocus();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (isBusy) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle ref={titleRef} tabIndex={-1} className="focus:outline-none">
            {title}
          </SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>

        <FormBusyContext.Provider value={setReportedBusy}>{children}</FormBusyContext.Provider>
      </SheetContent>
    </Sheet>
  );
}
