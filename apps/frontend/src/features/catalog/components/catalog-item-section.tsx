import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Plus } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { CatalogItemKind } from '../api/reorder-catalog-items';
import type { SaveCatalogAttributeInput } from '../api/save-catalog-attribute';
import type { SaveCatalogObjectiveInput } from '../api/save-catalog-objective';
import { useReorderCatalogItems } from '../hooks/use-reorder-catalog-items';
import { useSaveCatalogItem } from '../hooks/use-save-catalog-item';
import { diffCatalogItems } from '../lib/catalog-diff';
import { getCatalogEditErrorMessage } from '../lib/catalog-error-message';
import { CATALOG_KIND_LABELS, type CatalogEditorItem } from '../types/catalog-editor';
import { CatalogItemForm, type CatalogItemFormValues } from './catalog-item-form';
import { CatalogItemList } from './catalog-item-list';

export interface CatalogItemSectionProps {
  readonly kind: CatalogItemKind;
  readonly versionId: string;
  readonly items: readonly CatalogEditorItem[];
  /** Elementos de la versión vigente para marcar Nuevo/Modificado; vacío si no hay vigente. */
  readonly currentItems: readonly CatalogEditorItem[];
  readonly editable: boolean;
}

type Mode = { type: 'create' } | { type: 'edit'; itemId: string } | null;

export function CatalogItemSection({
  kind,
  versionId,
  items,
  currentItems,
  editable,
}: CatalogItemSectionProps) {
  const labels = CATALOG_KIND_LABELS[kind];
  const save = useSaveCatalogItem(kind, versionId);
  const reorder = useReorderCatalogItems(kind, versionId);
  const [mode, setMode] = useState<Mode>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'danger'; message: string } | null>(
    null,
  );
  const [announcement, setAnnouncement] = useState('');
  const noticeRef = useRef<HTMLDivElement>(null);
  const busy = save.isPending || reorder.isPending;

  const { changes, removedCodes } = useMemo(
    () => diffCatalogItems(items, currentItems),
    [items, currentItems],
  );
  const hasCurrent = currentItems.length > 0;

  useEffect(() => {
    if (notice) {
      noticeRef.current?.focus();
    }
  }, [notice]);

  const editing = mode?.type === 'edit' ? items.find((item) => item.id === mode.itemId) : undefined;

  async function handleSubmit(values: CatalogItemFormValues) {
    setNotice(null);
    const id = editing?.id;
    const input: SaveCatalogObjectiveInput | SaveCatalogAttributeInput =
      kind === 'ATTRIBUTES'
        ? { id, code: values.code, name: values.name ?? '', statement: values.statement }
        : { id, code: values.code, statement: values.statement };
    await save.mutateAsync(input as never);
    setMode(null);
    setNotice({
      type: 'success',
      message: id
        ? `Se guardaron los cambios de ${values.code}.`
        : `Se agregó ${values.code} al final de la lista.`,
    });
  }

  async function handleReorder(orderedIds: string[]) {
    setNotice(null);
    try {
      const response = await reorder.mutateAsync(orderedIds);
      setAnnouncement(`Orden actualizado: ${response.items.map((item) => item.code).join(', ')}.`);
    } catch (error) {
      setNotice({ type: 'danger', message: getCatalogEditErrorMessage(error) });
    }
  }

  return (
    <section
      aria-labelledby={`catalog-section-${kind}`}
      className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`catalog-section-${kind}`} className="text-base font-semibold text-foreground">
          {labels.title}
        </h2>
        {editable && mode === null && (
          <Button type="button" onClick={() => setMode({ type: 'create' })} disabled={busy}>
            <Plus aria-hidden="true" />
            {labels.addLabel}
          </Button>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {notice && (
        <div ref={noticeRef} tabIndex={-1} className="outline-none focus-visible:outline-2">
          <Alert variant={notice.type}>
            {notice.type === 'success' ? (
              <CircleCheck aria-hidden="true" />
            ) : (
              <CircleAlert aria-hidden="true" />
            )}
            <AlertDescription>{notice.message}</AlertDescription>
          </Alert>
        </div>
      )}

      {removedCodes.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Códigos de la versión vigente que ya no están en esta versión: {removedCodes.join(', ')}.
        </p>
      )}

      {editable && mode !== null && (
        <CatalogItemForm
          key={editing?.id ?? 'new'}
          kind={kind}
          item={editing}
          submitting={save.isPending}
          onSubmit={handleSubmit}
          onCancel={() => setMode(null)}
        />
      )}

      {items.length === 0 ? (
        <EmptyState
          title={`Aún no hay ${labels.title.toLowerCase()}`}
          description={
            editable
              ? `Agrega el primer ${labels.singular} de esta versión.`
              : 'Esta versión no tiene elementos registrados.'
          }
          illustration="empty"
        />
      ) : (
        <CatalogItemList
          label={labels.title}
          items={items}
          changes={hasCurrent ? changes : new Map()}
          editable={editable}
          busy={busy}
          onEdit={(item) => {
            setNotice(null);
            setMode({ type: 'edit', itemId: item.id });
          }}
          onReorder={(orderedIds) => void handleReorder(orderedIds)}
        />
      )}
    </section>
  );
}
