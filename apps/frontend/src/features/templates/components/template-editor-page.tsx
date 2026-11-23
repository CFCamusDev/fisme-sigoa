import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/hooks/use-permission';
import { useTabParam } from '@/hooks/use-tab-param';
import { cn } from '@/lib/utils';
import { useTemplateDetail } from '../hooks/use-template-detail';
import { getTemplateErrorMessage } from '../lib/template-error-message';
import { formatTemplateType, formatVersionLabel } from '../lib/template-labels';
import { TemplateEditor } from './template-editor';
import { TemplatePreviewPanel } from './template-preview-panel';
import { TemplateVariablesPanel } from './template-variables-panel';
import { TemplateVersionHistory } from './template-version-history';

const TEMPLATE_TABS = ['contenido', 'variables', 'vista-previa', 'historial'] as const;

export interface TemplateEditorPageProps {
  readonly templateId: string;
}

export function TemplateEditorPage({ templateId }: TemplateEditorPageProps) {
  const { allowed: canEdit } = usePermission('plantilla.editar', 'GLOBAL');
  const [tab, setTab] = useTabParam(TEMPLATE_TABS, 'contenido');
  const detailQuery = useTemplateDetail(templateId);
  const detail = detailQuery.data;

  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [versionRevision, setVersionRevision] = useState(0);
  const insertRef = useRef<((key: string) => void) | null>(null);

  const serverBaseContent = detail?.draft?.content ?? detail?.published?.content ?? '';
  const editorKey = detail
    ? `${detail.id}:${detail.draft?.id ?? 'published'}:${detail.draft?.updatedAt ?? ''}:${versionRevision}`
    : 'empty';

  const [prevEditorKey, setPrevEditorKey] = useState(editorKey);
  const [currentContent, setCurrentContent] = useState(serverBaseContent);

  if (prevEditorKey !== editorKey) {
    setPrevEditorKey(editorKey);
    setCurrentContent(serverBaseContent);
  }

  useEffect(() => {
    if (!dirty) {
      return undefined;
    }
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    withResolver: true,
  });

  const description = detail
    ? [
        formatTemplateType(detail.type),
        detail.published
          ? `Publicada ${formatVersionLabel(detail.published.number)}`
          : 'Sin publicar',
        detail.draft ? `Borrador ${formatVersionLabel(detail.draft.number)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail ? `${detail.code} · ${detail.name}` : 'Editor de plantilla'}
        description={description}
        actions={
          <Link to="/plantillas" className={cn(buttonVariants({ variant: 'outline' }))}>
            <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
            Volver a plantillas
          </Link>
        }
      />

      {feedback && (
        <Alert variant="success" role="status">
          <CheckCircle2 aria-hidden="true" />
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}

      {detailQuery.isLoading && <LoadingState message="Cargando la plantilla..." />}

      {detailQuery.isError &&
        (detailQuery.error?.status === 403 ? (
          <ErrorState
            title="Acceso denegado"
            message="No tienes permiso para consultar esta plantilla."
            illustration="noPermission"
          />
        ) : detailQuery.error?.status === 404 ? (
          <ErrorState
            title="Plantilla no encontrada"
            message="La plantilla solicitada no existe o no está disponible."
          />
        ) : (
          <ErrorState
            title="Error al cargar la plantilla"
            message={getTemplateErrorMessage(detailQuery.error)}
            onRetry={() => void detailQuery.refetch()}
          />
        ))}

      {!detailQuery.isLoading && !detailQuery.isError && detail && (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList aria-label="Secciones de la plantilla">
            <TabsTrigger value="contenido">Contenido</TabsTrigger>
            <TabsTrigger value="variables">Variables</TabsTrigger>
            {canEdit && <TabsTrigger value="vista-previa">Vista previa</TabsTrigger>}
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="contenido" forceMount className="data-[state=inactive]:hidden">
            <TemplateEditor
              key={editorKey}
              detail={detail}
              insertRef={insertRef}
              onContentChange={setCurrentContent}
              onDirtyChange={setDirty}
              onSaved={(version) => {
                setFeedback(`Borrador ${formatVersionLabel(version.number)} guardado.`);
                setVersionRevision((value) => value + 1);
                void detailQuery.refetch();
              }}
              onPublished={(version) => {
                setFeedback(`Versión ${formatVersionLabel(version.number)} publicada.`);
                setVersionRevision((value) => value + 1);
                void detailQuery.refetch();
              }}
            />
          </TabsContent>

          <TabsContent value="variables" forceMount className="data-[state=inactive]:hidden">
            <TemplateVariablesPanel
              variables={detail.variables}
              onInsert={
                canEdit
                  ? (key) => {
                      insertRef.current?.(key);
                      setTab('contenido');
                    }
                  : undefined
              }
            />
          </TabsContent>

          {canEdit && (
            <TabsContent value="vista-previa" forceMount className="data-[state=inactive]:hidden">
              <TemplatePreviewPanel templateId={detail.id} content={currentContent} />
            </TabsContent>
          )}

          <TabsContent value="historial" forceMount className="data-[state=inactive]:hidden">
            <TemplateVersionHistory versions={detail.versions} />
          </TabsContent>
        </Tabs>
      )}

      <ConfirmDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open) {
            blocker.reset?.();
          }
        }}
        title="Cambios sin guardar"
        description="Tienes cambios sin guardar en esta plantilla. Si sales ahora, se perderán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        tone="destructive"
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  );
}
