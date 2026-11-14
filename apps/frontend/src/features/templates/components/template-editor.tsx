import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert } from 'lucide-react';
import {
  TEMPLATE_CONTENT_MAX_LENGTH,
  saveTemplateDraftRequestSchema,
  type SaveTemplateDraftRequest,
  type TemplateDetailDto,
  type TemplateVersionDto,
} from '@sigoa/shared';
import { Can } from '@/components/common/can';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/use-permission';
import { usePublishTemplate } from '../hooks/use-publish-template';
import { useSaveTemplateDraft } from '../hooks/use-save-template-draft';
import { getTemplateErrorMessage } from '../lib/template-error-message';
import { formatVersionLabel } from '../lib/template-labels';
import { TemplateVariablesPanel } from './template-variables-panel';

export interface TemplateEditorProps {
  readonly detail: TemplateDetailDto;
  readonly onSaved: (version: TemplateVersionDto) => void;
  readonly onPublished: (version: TemplateVersionDto) => void;
  readonly onDirtyChange: (dirty: boolean) => void;
}

const COUNT_FORMAT = new Intl.NumberFormat('es-PE');
const MAX_LABEL = COUNT_FORMAT.format(TEMPLATE_CONTENT_MAX_LENGTH);

/**
 * Editor del HTML de una plantilla (HU-018, RF-018). El contenido se muestra siempre como texto en
 * un `Textarea`, nunca como HTML. El padre lo remonta (`key`) cuando el servidor devuelve otro
 * borrador, de modo que el estado del formulario siempre parte de lo guardado.
 */
export function TemplateEditor({
  detail,
  onSaved,
  onPublished,
  onDirtyChange,
}: TemplateEditorProps) {
  const uid = useId();
  const { allowed: canEdit } = usePermission('plantilla.editar', 'GLOBAL');
  const saveMutation = useSaveTemplateDraft();
  const publishMutation = usePublishTemplate();

  const baseContent = detail.draft?.content ?? detail.published?.content ?? '';
  const [savedContent, setSavedContent] = useState(baseContent);
  const [confirming, setConfirming] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    control,
    formState: { errors },
  } = useForm<SaveTemplateDraftRequest>({
    resolver: zodResolver(saveTemplateDraftRequestSchema),
    mode: 'onSubmit',
    defaultValues: { content: baseContent },
  });
  const { ref: registerRef, ...contentField } = register('content');

  const content = useWatch({ control, name: 'content' });
  const dirty = content !== savedContent;
  // Tras guardar, el detalle aún trae el borrador anterior hasta que se recarga: no se publica ese.
  const waitingForRefresh = savedContent !== baseContent;
  const draft = detail.draft;
  const nextNumber = Math.max(0, ...detail.versions.map((version) => version.number)) + 1;
  const editingNumber = draft ? draft.number : nextNumber;
  const pending = saveMutation.isPending || publishMutation.isPending;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  useEffect(() => {
    if (serverError) {
      errorRef.current?.focus();
    }
  }, [serverError]);

  useEffect(() => {
    if (confirming) {
      confirmRef.current?.focus();
    }
  }, [confirming]);

  function insertVariable(key: string) {
    const element = textareaRef.current;
    const current = getValues('content');
    const start = element?.selectionStart ?? current.length;
    const end = element?.selectionEnd ?? current.length;
    const token = `{{${key}}}`;
    setValue('content', `${current.slice(0, start)}${token}${current.slice(end)}`, {
      shouldDirty: true,
    });
    element?.focus();
    const caret = start + token.length;
    requestAnimationFrame(() => element?.setSelectionRange(caret, caret));
  }

  async function onSubmit(values: SaveTemplateDraftRequest) {
    if (saveMutation.isPending) {
      return;
    }
    setServerError(null);
    setConfirming(false);
    try {
      const version = await saveMutation.mutateAsync({
        templateId: detail.id,
        content: values.content,
      });
      setSavedContent(values.content);
      onSaved(version);
    } catch (error) {
      setServerError(getTemplateErrorMessage(error));
    }
  }

  async function confirmPublish() {
    if (publishMutation.isPending || !draft) {
      return;
    }
    setServerError(null);
    try {
      const published = await publishMutation.mutateAsync({
        templateId: detail.id,
        versionId: draft.id,
        expectedUpdatedAt: draft.updatedAt,
      });
      setConfirming(false);
      onPublished(published);
    } catch (error) {
      setConfirming(false);
      setServerError(getTemplateErrorMessage(error));
    }
  }

  const textareaId = `${uid}-content`;
  const helpId = `${uid}-help`;
  const counterId = `${uid}-counter`;
  const errorId = `${uid}-error`;
  const overLimit = content.length > TEMPLATE_CONTENT_MAX_LENGTH;
  const contentError = errors.content?.message;

  const publishedNumber = detail.published?.number;
  const confirmText =
    publishedNumber !== undefined
      ? `Publicar la versión ${draft?.number} dejará Obsoleta la versión ${publishedNumber}. Esta acción no se puede deshacer.`
      : `Publicar la versión ${draft?.number} la dejará como la versión vigente. Esta acción no se puede deshacer.`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-label={`Editar la plantilla ${detail.code}`}
        className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-6"
      >
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            {detail.code} · {detail.name}
          </h3>
          <p id={helpId} className="text-sm text-muted-foreground">
            {!canEdit
              ? 'Solo lectura: no tienes permiso para editar plantillas.'
              : draft
                ? `Editando el borrador ${formatVersionLabel(draft.number)}.`
                : `Editando una copia de la versión vigente. Al guardar se crea el borrador ${formatVersionLabel(editingNumber)}.`}
          </p>
        </div>

        {serverError && (
          <div ref={errorRef} tabIndex={-1} className="outline-none focus-visible:outline-2">
            <Alert variant="danger" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={textareaId}>Contenido HTML</Label>
          <Textarea
            id={textareaId}
            {...contentField}
            ref={(element) => {
              registerRef(element);
              textareaRef.current = element;
            }}
            readOnly={!canEdit}
            spellCheck={false}
            rows={18}
            className="font-mono text-sm"
            aria-describedby={[helpId, counterId, contentError ? errorId : null]
              .filter(Boolean)
              .join(' ')}
            aria-invalid={contentError ? true : undefined}
            onChange={(event) => {
              setConfirming(false);
              void contentField.onChange(event);
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              id={counterId}
              className={overLimit ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
            >
              {COUNT_FORMAT.format(content.length)} / {MAX_LABEL} caracteres
            </p>
            {canEdit && dirty && (
              <p role="status" className="text-sm font-semibold text-foreground">
                Tienes cambios sin guardar
              </p>
            )}
          </div>
          {contentError && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {contentError}
            </p>
          )}
        </div>

        {confirming && draft && (
          <div ref={confirmRef} tabIndex={-1} className="outline-none focus-visible:outline-2">
            <Alert
              variant="warning"
              role="alertdialog"
              aria-label="Confirmar la publicación"
              onKeyDown={(event) => {
                if (event.key === 'Escape' && !publishMutation.isPending) {
                  setConfirming(false);
                }
              }}
            >
              <CircleAlert aria-hidden="true" />
              <AlertDescription>
                <p>{confirmText}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void confirmPublish()}
                    disabled={publishMutation.isPending}
                  >
                    {publishMutation.isPending ? 'Publicando…' : 'Confirmar'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirming(false)}
                    disabled={publishMutation.isPending}
                  >
                    Cancelar
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Can permission="plantilla.editar" scope="GLOBAL">
            <Button type="submit" disabled={!dirty || pending}>
              {saveMutation.isPending ? 'Guardando…' : 'Guardar borrador'}
            </Button>
            {dirty && (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  reset({ content: savedContent });
                  setServerError(null);
                }}
              >
                Descartar cambios
              </Button>
            )}
          </Can>
          {draft && (
            <Can permission="plantilla.publicar" scope="GLOBAL">
              <Button
                type="button"
                variant="outline"
                disabled={dirty || waitingForRefresh || pending || confirming}
                onClick={() => setConfirming(true)}
              >
                {`Publicar versión ${draft.number}`}
              </Button>
            </Can>
          )}
        </div>
      </form>

      <TemplateVariablesPanel
        variables={detail.variables}
        onInsert={canEdit ? insertVariable : undefined}
      />
    </div>
  );
}
