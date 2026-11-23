import { useRef, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormBusyContext } from './form-busy-context';

export interface FormDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly busy?: boolean;
  readonly onRestoreFocus?: () => void;
  readonly children: ReactNode;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  busy = false,
  onRestoreFocus,
  children,
}: FormDialogProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [reportedBusy, setReportedBusy] = useState(false);
  const isBusy = busy || reportedBusy;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isBusy) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        size={size}
        showCloseButton={!isBusy}
        className="max-h-[85dvh] overflow-y-auto"
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
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="focus:outline-none">
            {title}
          </DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <FormBusyContext.Provider value={setReportedBusy}>{children}</FormBusyContext.Provider>
      </DialogContent>
    </Dialog>
  );
}
