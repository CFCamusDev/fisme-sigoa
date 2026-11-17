import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import {
  STAKEHOLDER_IMPORT_MAX_FILE_BYTES,
  type ConfirmStakeholderImportResponse,
  type PreviewStakeholderImportResponse,
  type StakeholderListDto,
} from '@sigoa/shared';
import { AlertTriangle, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirmStakeholderImport } from '../hooks/use-confirm-stakeholder-import';
import { useDownloadStakeholderImportTemplate } from '../hooks/use-download-stakeholder-import-template';
import { usePreviewStakeholderImport } from '../hooks/use-preview-stakeholder-import';
import { getStakeholderImportErrorMessage } from '../lib/stakeholder-import-error-message';
import { STAKEHOLDER_LIST_TYPE_LABELS } from '../lib/stakeholder-list-labels';
import { StakeholderImportPreviewTable } from './stakeholder-import-preview-table';

const numberFormatter = new Intl.NumberFormat('es-PE');

export interface StakeholderImportWizardProps {
  readonly list: StakeholderListDto;
  readonly onImported: (result: ConfirmStakeholderImportResponse) => void;
  readonly onCancel: () => void;
}

function validateSelectedFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return 'Selecciona un archivo con extensión .xlsx.';
  }
  if (file.size === 0) {
    return 'El archivo seleccionado está vacío.';
  }
  if (file.size > STAKEHOLDER_IMPORT_MAX_FILE_BYTES) {
    return 'El archivo supera el límite máximo de 2 MiB.';
  }
  return null;
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function StakeholderImportWizard({
  list,
  onImported,
  onCancel,
}: StakeholderImportWizardProps) {
  const fileInputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewStakeholderImportResponse | null>(null);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const summaryHeadingRef = useRef<HTMLHeadingElement>(null);

  const downloadMutation = useDownloadStakeholderImportTemplate();
  const previewMutation = usePreviewStakeholderImport();
  const confirmMutation = useConfirmStakeholderImport();

  const isBusy =
    downloadMutation.isPending || previewMutation.isPending || confirmMutation.isPending;

  useEffect(() => {
    if (previewData) {
      summaryHeadingRef.current?.focus();
    }
  }, [previewData]);

  useEffect(() => {
    function handleWindowKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !previewMutation.isPending && !confirmMutation.isPending) {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [confirmMutation.isPending, onCancel, previewMutation.isPending]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPreviewData(null);
    setShowOnlyErrors(false);

    if (!file) {
      setSelectedFile(null);
      setErrorMessage(null);
      return;
    }

    const validationError = validateSelectedFile(file);
    if (validationError) {
      setSelectedFile(null);
      setErrorMessage(validationError);
      return;
    }

    setSelectedFile(file);
    setErrorMessage(null);
  }

  async function handleDownloadTemplate() {
    setErrorMessage(null);
    try {
      const { blob, fileName } = await downloadMutation.mutateAsync(list.type);
      triggerBlobDownload(blob, fileName);
    } catch (error) {
      setErrorMessage(getStakeholderImportErrorMessage(error));
    }
  }

  async function handlePreview() {
    if (!selectedFile) {
      setErrorMessage('Selecciona un archivo Excel (.xlsx) para continuar.');
      return;
    }

    setErrorMessage(null);
    try {
      const preview = await previewMutation.mutateAsync({
        listId: list.id,
        file: selectedFile,
      });
      setPreviewData(preview);
      setShowOnlyErrors(false);
    } catch (error) {
      setErrorMessage(getStakeholderImportErrorMessage(error));
    }
  }

  async function handleConfirm() {
    if (!selectedFile || confirmMutation.isPending) {
      return;
    }

    setErrorMessage(null);
    try {
      const result = await confirmMutation.mutateAsync({
        listId: list.id,
        file: selectedFile,
      });
      onImported(result);
    } catch (error) {
      const message = getStakeholderImportErrorMessage(error);
      setErrorMessage(message);
      if (
        error &&
        typeof error === 'object' &&
        (error as { name?: unknown }).name === 'NotReadableError'
      ) {
        setPreviewData(null);
        setSelectedFile(null);
      }
    }
  }

  function handleChooseAnotherFile() {
    setPreviewData(null);
    setSelectedFile(null);
    setShowOnlyErrors(false);
    setErrorMessage(null);
  }

  const validRowCount = previewData ? previewData.totals.new + previewData.totals.existing : 0;

  return (
    <div
      role="region"
      aria-label="Importar constituyentes desde Excel"
      className="space-y-4 rounded-lg border border-border bg-card p-6 text-card-foreground"
    >
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <FileSpreadsheet className="size-5" aria-hidden="true" />
          Importar constituyentes desde Excel — {STAKEHOLDER_LIST_TYPE_LABELS[list.type]}{' '}
          {list.year}
        </h3>
        <p className="text-sm text-muted-foreground">
          Descarga la plantilla oficial, llénala con tus registros (máximo 500 filas y 2 MiB) y
          revisa la vista previa antes de confirmar.
        </p>
      </div>

      {errorMessage ? (
        <Alert variant="danger" role="alert">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {!previewData ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => void handleDownloadTemplate()}
            >
              <Download className="mr-2 size-4" aria-hidden="true" />
              {downloadMutation.isPending ? 'Descargando…' : 'Descargar plantilla'}
            </Button>
          </div>

          <div className="max-w-md space-y-1.5">
            <Label htmlFor={fileInputId}>Archivo Excel (.xlsx)</Label>
            <Input
              id={fileInputId}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isBusy}
              onChange={handleFileChange}
            />
            {selectedFile ? (
              <p className="text-xs text-muted-foreground">
                Archivo seleccionado: {selectedFile.name} (
                {numberFormatter.format(selectedFile.size)} bytes)
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!selectedFile || isBusy}
              onClick={() => void handlePreview()}
            >
              <Upload className="mr-2 size-4" aria-hidden="true" />
              {previewMutation.isPending ? 'Analizando…' : 'Ver vista previa'}
            </Button>
            <Button type="button" variant="ghost" disabled={isBusy} onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div aria-live="polite" className="space-y-1">
            <h4
              ref={summaryHeadingRef}
              tabIndex={-1}
              className="text-base font-semibold text-foreground outline-none"
            >
              {numberFormatter.format(previewData.totals.total)} filas:{' '}
              {numberFormatter.format(previewData.totals.new)} nuevas,{' '}
              {numberFormatter.format(previewData.totals.existing)} ya registradas,{' '}
              {numberFormatter.format(previewData.totals.alreadyInList)} ya en la lista,{' '}
              {numberFormatter.format(previewData.totals.invalid)} con errores
            </h4>
            <p className="text-sm text-muted-foreground">
              Al confirmar se importarán solo las filas válidas (nuevas y ya registradas).
            </p>
          </div>

          <StakeholderImportPreviewTable
            rows={previewData.rows}
            showOnlyErrors={showOnlyErrors}
            onToggleOnlyErrors={setShowOnlyErrors}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={validRowCount === 0 || confirmMutation.isPending}
              onClick={() => void handleConfirm()}
            >
              {confirmMutation.isPending ? 'Importando…' : 'Confirmar importación'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={confirmMutation.isPending}
              onClick={handleChooseAnotherFile}
            >
              Elegir otro archivo
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={confirmMutation.isPending}
              onClick={onCancel}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
