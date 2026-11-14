import { useEffect, useRef, useState } from 'react';
import { CircleAlert, ExternalLink, Eye, TriangleAlert } from 'lucide-react';
import { TEMPLATE_CONTENT_MAX_LENGTH, type TemplatePreviewWarning } from '@sigoa/shared';
import { Can } from '@/components/common/can';
import { LoadingState } from '@/components/common/loading-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { usePreviewTemplate } from '../hooks/use-preview-template';
import { createPdfObjectUrl, revokePdfObjectUrl } from '../lib/pdf-blob';
import { getTemplatePreviewErrorMessage } from '../lib/template-error-message';

export interface TemplatePreviewPanelProps {
  readonly templateId: string;
  readonly content: string;
}

interface PreviewResultState {
  readonly pdfUrl: string;
  readonly warnings: readonly TemplatePreviewWarning[];
  readonly generatedForContent: string;
}

/**
 * Panel de vista previa en PDF para el editor de plantillas (HU-019, RF-019).
 * Solo visible con permiso `plantilla.editar`. Revoca la URL `blob:` al regenerar o desmontar.
 */
export function TemplatePreviewPanel({ templateId, content }: TemplatePreviewPanelProps) {
  const previewMutation = usePreviewTemplate();
  const [previewState, setPreviewState] = useState<PreviewResultState | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const warningRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const currentUrl = previewState?.pdfUrl ?? null;
  useEffect(() => {
    return () => {
      revokePdfObjectUrl(currentUrl);
    };
  }, [currentUrl]);

  useEffect(() => {
    if (serverError) {
      errorRef.current?.focus();
    }
  }, [serverError]);

  const isStale = previewState !== null && content !== previewState.generatedForContent;
  const hasFreshResult = previewState !== null && !isStale;
  const warnings = hasFreshResult ? previewState.warnings : [];

  useEffect(() => {
    if (hasFreshResult && warnings.length > 0) {
      warningRef.current?.focus();
    }
  }, [hasFreshResult, warnings.length]);

  const canGenerate =
    !previewMutation.isPending &&
    content.trim().length > 0 &&
    content.length <= TEMPLATE_CONTENT_MAX_LENGTH;

  async function handlePreview() {
    if (!canGenerate) {
      return;
    }
    setServerError(null);
    try {
      const result = await previewMutation.mutateAsync({ templateId, content });
      const pdfUrl = createPdfObjectUrl(result.pdfBase64);
      setPreviewState({
        pdfUrl,
        warnings: result.warnings,
        generatedForContent: content,
      });
    } catch (error) {
      setServerError(getTemplatePreviewErrorMessage(error));
    }
  }

  return (
    <Can permission="plantilla.editar" scope="GLOBAL">
      <section
        aria-label="Vista previa en PDF"
        className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Vista previa</h3>
            <p className="text-sm text-muted-foreground">
              Genera el PDF con datos ficticios de ejemplo para revisar el diseño antes de publicar.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={!canGenerate}
            onClick={() => void handlePreview()}
          >
            <Eye className="mr-2 size-4" aria-hidden="true" />
            {previewMutation.isPending ? 'Generando vista previa…' : 'Vista previa'}
          </Button>
        </div>

        {serverError && (
          <div ref={errorRef} tabIndex={-1} className="outline-none focus-visible:outline-2">
            <Alert variant="danger" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          </div>
        )}

        {previewMutation.isPending && <LoadingState message="Generando vista previa…" />}

        {!previewMutation.isPending && isStale && (
          <p role="status" className="text-sm text-muted-foreground">
            El contenido cambió desde la última vista previa. Genérala de nuevo.
          </p>
        )}

        {!previewMutation.isPending && hasFreshResult && (
          <div className="space-y-3">
            {warnings.length > 0 && (
              <div ref={warningRef} tabIndex={-1} className="outline-none focus-visible:outline-2">
                <Alert variant="warning" role="status">
                  <TriangleAlert aria-hidden="true" />
                  <AlertDescription>
                    El contenido usa variables que la plantilla no reconoce:{' '}
                    {warnings.map((item) => `{{${item.variable}}}`).join(', ')}. Aparecen sin
                    reemplazar en el PDF.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex justify-end">
              <a
                href={previewState.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80 focus-visible:outline-2"
              >
                Abrir la vista previa en una pestaña nueva
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            </div>

            <iframe
              title="Vista previa en PDF de la plantilla"
              src={previewState.pdfUrl}
              className="h-[36rem] w-full rounded-md border border-border bg-background"
            />
          </div>
        )}
      </section>
    </Can>
  );
}
