import { useState } from 'react';
import { ANNEX_CATALOG, type AnnexCatalogEntry, type AnnexCode } from '@sigoa/shared';
import { AlertCircle, CheckCircle2, FileDown, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/common';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { saveBlobFile } from '@/lib/blob-download';
import { useDownloadAnnexPdf } from '../hooks/use-download-annex-pdf';
import { getAnnexErrorMessage } from '../lib/annex-error-message';

interface DownloadFeedback {
  readonly kind: 'success' | 'error';
  readonly message: string;
}

export function AnnexesPage() {
  const downloadMutation = useDownloadAnnexPdf();
  const [activeCode, setActiveCode] = useState<AnnexCode | null>(null);
  const [feedback, setFeedback] = useState<DownloadFeedback | null>(null);

  async function handleDownload(entry: AnnexCatalogEntry) {
    setFeedback(null);
    setActiveCode(entry.code);
    try {
      const result = await downloadMutation.mutateAsync(entry.code);
      saveBlobFile(result.blob, result.fileName);
      const versionLabel =
        result.versionNumber !== null ? ` (versión ${result.versionNumber})` : '';
      setFeedback({
        kind: 'success',
        message: `Se descargó ${entry.name}${versionLabel}.`,
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        message: getAnnexErrorMessage(error),
      });
    } finally {
      setActiveCode(null);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Anexos oficiales"
        description="Descarga cualquiera de los 11 anexos del procedimiento en formato PDF desde su versión de plantilla publicada."
      />

      {feedback?.kind === 'error' ? (
        <Alert variant="danger">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      {feedback?.kind === 'success' ? (
        <Alert variant="success">
          <CheckCircle2 aria-hidden="true" />
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <ul className="divide-y divide-border rounded-lg border border-border bg-card text-card-foreground">
        {ANNEX_CATALOG.map((entry) => {
          const isGenerating = activeCode === entry.code;
          return (
            <li
              key={entry.code}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-caption font-medium text-muted-foreground">
                    {entry.code}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    · Formato N.º {entry.number}
                  </span>
                </div>
                <p className="text-body font-medium text-card-foreground">{entry.name}</p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isGenerating}
                aria-label={`Descargar PDF del ${entry.name}`}
                onClick={() => void handleDownload(entry)}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                    Generando…
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 size-4" aria-hidden="true" />
                    Descargar PDF
                  </>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
