import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import type { TemplateTypeValue, TemplateVersionDto } from '@sigoa/shared';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useTemplateDetail } from '../hooks/use-template-detail';
import { useTemplates } from '../hooks/use-templates';
import { getTemplateErrorMessage } from '../lib/template-error-message';
import {
  TEMPLATE_TYPE_OPTIONS,
  formatTemplateType,
  formatVersionLabel,
} from '../lib/template-labels';
import { TemplateEditor } from './template-editor';
import { TemplateVersionHistory } from './template-version-history';
import { TemplatesTable } from './templates-table';

export interface TemplatesPageProps {
  /** Plantilla abierta; vive en la URL para poder compartir el enlace (D4 del plan). */
  readonly selectedId?: string;
  readonly onSelectedChange: (templateId: string | undefined) => void;
}

type Notice =
  | { readonly kind: 'saved'; readonly version: TemplateVersionDto }
  | { readonly kind: 'published'; readonly version: TemplateVersionDto };

export function TemplatesPage({ selectedId, onSelectedChange }: TemplatesPageProps) {
  const uid = useId();
  const [type, setType] = useState<TemplateTypeValue | ''>('');
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const listQuery = useTemplates({ ...(type ? { type } : {}), pageSize: 100 });
  const detailQuery = useTemplateDetail(selectedId);

  const templates = listQuery.data?.items ?? [];
  const detail = detailQuery.data;

  useEffect(() => {
    if (notice) {
      noticeRef.current?.focus();
    }
  }, [notice]);

  const handleDirtyChange = useCallback((value: boolean) => setDirty(value), []);

  function open(templateId: string) {
    setNotice(null);
    onSelectedChange(templateId);
  }

  const hintId = `${uid}-dirty-hint`;
  const filterId = `${uid}-type`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plantillas oficiales"
        description="Formatos oficiales versionados: edita el contenido HTML, guarda un borrador y publícalo como una versión nueva."
      />

      {notice && (
        <div ref={noticeRef} tabIndex={-1} className="outline-none focus-visible:outline-2">
          <Alert variant="success">
            <CircleCheck aria-hidden="true" />
            <AlertDescription>
              {notice.kind === 'saved'
                ? `Se guardó el borrador ${formatVersionLabel(notice.version.number)}. Revísalo y publícalo cuando esté listo.`
                : `Se publicó la versión ${notice.version.number}. Los documentos ya generados conservan la versión con la que se crearon.`}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <section className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Listado de plantillas</h2>
            <p className="text-sm text-muted-foreground">
              Cada plantilla muestra su versión publicada y, si existe, su borrador.
            </p>
          </div>
          <div className="space-y-1 sm:w-56">
            <Label htmlFor={filterId}>Tipo de plantilla</Label>
            <Select
              id={filterId}
              value={type}
              disabled={dirty}
              onChange={(event) => setType(event.target.value as TemplateTypeValue | '')}
            >
              <option value="">Todos</option>
              {TEMPLATE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatTemplateType(option)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {dirty && (
          <p id={hintId} className="text-sm text-muted-foreground">
            Guarda o descarta los cambios para abrir otra plantilla.
          </p>
        )}

        {listQuery.isLoading && <LoadingState message="Cargando plantillas..." />}

        {listQuery.isError &&
          (listQuery.error?.status === 403 ? (
            <ErrorState
              title="Acceso denegado"
              message="No tienes permiso para consultar las plantillas."
              illustration="noPermission"
            />
          ) : (
            <ErrorState
              title="Error al cargar las plantillas"
              message={getTemplateErrorMessage(listQuery.error)}
              onRetry={() => void listQuery.refetch()}
            />
          ))}

        {!listQuery.isLoading && !listQuery.isError && templates.length === 0 && (
          <EmptyState
            title="No hay plantillas para mostrar"
            description={
              type
                ? 'No hay plantillas de este tipo. Elige otro tipo para continuar.'
                : 'Aún no hay plantillas oficiales cargadas.'
            }
            illustration="empty"
          />
        )}

        {!listQuery.isLoading && !listQuery.isError && templates.length > 0 && (
          <TemplatesTable
            templates={templates}
            selectedId={selectedId}
            onOpen={open}
            openDisabled={dirty}
            disabledHintId={hintId}
          />
        )}
      </section>

      {selectedId && detailQuery.isLoading && <LoadingState message="Cargando la plantilla..." />}

      {selectedId &&
        detailQuery.isError &&
        (detailQuery.error?.status === 404 ? (
          <ErrorState
            title="La plantilla no existe"
            message="El enlace apunta a una plantilla que ya no existe. Elige otra del listado."
            illustration="notFound"
          />
        ) : (
          <ErrorState
            title="Error al cargar la plantilla"
            message={getTemplateErrorMessage(detailQuery.error)}
            onRetry={() => void detailQuery.refetch()}
          />
        ))}

      {selectedId && detail && (
        <div className="space-y-6">
          <TemplateEditor
            key={`${detail.id}:${detail.draft?.id ?? 'none'}:${detail.draft?.updatedAt ?? detail.published?.id ?? 'empty'}`}
            detail={detail}
            onSaved={(version) => setNotice({ kind: 'saved', version })}
            onPublished={(version) => setNotice({ kind: 'published', version })}
            onDirtyChange={handleDirtyChange}
          />
          <TemplateVersionHistory versions={detail.versions} />
        </div>
      )}
    </div>
  );
}
