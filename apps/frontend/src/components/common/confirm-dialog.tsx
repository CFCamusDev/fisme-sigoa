import { useId, useState } from 'react';
import { VOID_REASON_MIN_LENGTH } from '@sigoa/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ConfirmDialogReasonConfig {
  readonly label: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly placeholder?: string;
}

export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly pendingLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: 'default' | 'destructive';
  readonly isPending?: boolean;
  readonly error?: string | null;
  readonly reason?: ConfirmDialogReasonConfig;
  readonly onConfirm: (reason?: string) => void | Promise<void>;
  readonly onCloseAutoFocus?: (event: Event) => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Cancelar',
  tone = 'default',
  isPending = false,
  error = null,
  reason,
  onConfirm,
  onCloseAutoFocus,
}: ConfirmDialogProps) {
  const reasonId = useId();
  const reasonErrorId = useId();
  const [reasonText, setReasonText] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setReasonText('');
      setReasonError(null);
    }
  }

  const minLength = reason?.minLength ?? VOID_REASON_MIN_LENGTH;
  const trimmedReason = reasonText.trim();

  function handleConfirmClick() {
    if (isPending) {
      return;
    }
    if (reason) {
      if (trimmedReason.length < minLength) {
        setReasonError(`El motivo debe tener al menos ${minLength} caracteres.`);
        return;
      }
      setReasonError(null);
      void onConfirm(trimmedReason);
      return;
    }
    void onConfirm();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPending) {
          return;
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        size="sm"
        showCloseButton={!isPending}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          if (isPending) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isPending) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (isPending) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="danger" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {reason ? (
          <div className="space-y-2">
            <Label htmlFor={reasonId}>{reason.label}</Label>
            <Textarea
              id={reasonId}
              value={reasonText}
              disabled={isPending}
              maxLength={reason.maxLength}
              placeholder={reason.placeholder}
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? reasonErrorId : undefined}
              onChange={(event) => {
                setReasonText(event.target.value);
                if (reasonError) {
                  setReasonError(null);
                }
              }}
            />
            <div className="flex items-center justify-between gap-2 text-meta text-muted-foreground">
              <span>Mínimo {minLength} caracteres</span>
              <span>
                {reason.maxLength
                  ? `${trimmedReason.length}/${reason.maxLength}`
                  : `${trimmedReason.length} caracteres`}
              </span>
            </div>
            {reasonError ? (
              <p id={reasonErrorId} role="alert" className="text-meta font-medium text-danger">
                {reasonError}
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'destructive' ? 'destructive' : 'default'}
            disabled={isPending}
            aria-busy={isPending}
            onClick={handleConfirmClick}
          >
            {isPending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
