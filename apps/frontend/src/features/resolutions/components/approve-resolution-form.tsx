import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { CircleAlert, FileText } from 'lucide-react';
import type { ResolutionDto } from '@sigoa/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApproveResolution } from '../hooks/use-approve-resolution';
import { formatFileSize, validateResolutionPdf } from '../lib/pdf-file';
import { getResolutionErrorMessage } from '../lib/resolution-error-message';

export interface ApproveResolutionFormProps {
  readonly resolution: ResolutionDto;
  readonly onCancel: () => void;
  readonly onApproved: (resolution: ResolutionDto) => void;
}

export function ApproveResolutionForm({
  resolution,
  onCancel,
  onApproved,
}: ApproveResolutionFormProps) {
  const uid = useId();
  const mutation = useApproveResolution();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape cierra el panel mientras no haya un envío en vuelo.
  const pending = mutation.isPending;
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pending, onCancel]);

  useEffect(() => {
    if (serverError) {
      alertRef.current?.focus();
    }
  }, [serverError]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setFileError(null);
    setServerError(null);
  }

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (mutation.isPending) {
      return;
    }
    setServerError(null);
    const problem = validateResolutionPdf(file);
    if (problem || !file) {
      setFileError(problem);
      inputRef.current?.focus();
      return;
    }
    setFileError(null);
    try {
      const approved = await mutation.mutateAsync({ resolutionId: resolution.id, file });
      onApproved(approved);
    } catch (error) {
      setServerError(getResolutionErrorMessage(error));
    }
  }

  const inputId = `${uid}-pdf`;
  const helpId = `${uid}-pdf-help`;
  const errorId = `${uid}-pdf-error`;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={`Aprobar resolución ${resolution.number}`}
      className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-6"
    >
      <h3 className="text-base font-semibold text-foreground">
        Aprobar resolución {resolution.number}
      </h3>

      {serverError && (
        <div ref={alertRef} tabIndex={-1} className="outline-none focus-visible:outline-2">
          <Alert variant="danger">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={inputId}>PDF firmado</Label>
        <Input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="application/pdf"
          onChange={handleChange}
          aria-invalid={!!fileError}
          aria-describedby={fileError ? `${helpId} ${errorId}` : helpId}
        />
        <p id={helpId} className="text-xs text-muted-foreground">
          PDF firmado por el Decano, máximo 10 MB.
        </p>
        {file && (
          <p className="inline-flex items-center gap-1.5 text-sm text-foreground">
            <FileText className="size-4" aria-hidden="true" />
            {file.name} ({formatFileSize(file.size)})
          </p>
        )}
        {fileError && (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {fileError}
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Aprobando…' : 'Aprobar resolución'}
        </Button>
      </div>
    </form>
  );
}
