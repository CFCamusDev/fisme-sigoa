import { useRef, useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CatalogChange } from '../lib/catalog-diff';
import { hasName, type CatalogEditorItem } from '../types/catalog-editor';
import { CatalogChangeBadge } from './catalog-change-badge';

export interface CatalogItemListProps {
  /** Nombre accesible de la lista ("Objetivos educacionales"). */
  readonly label: string;
  readonly items: readonly CatalogEditorItem[];
  readonly changes: ReadonlyMap<string, CatalogChange>;
  /** Solo en Borrador y con `catalogo.editar` se puede editar y ordenar. */
  readonly editable: boolean;
  /** Hay una petición en vuelo: se deshabilitan todos los controles. */
  readonly busy: boolean;
  readonly onEdit: (item: CatalogEditorItem) => void;
  /** Recibe la lista completa de ids en el orden nuevo. */
  readonly onReorder: (orderedIds: string[]) => void;
}

function moveId(ids: string[], from: number, to: number): string[] {
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) {
    return ids;
  }
  next.splice(to, 0, moved);
  return next;
}

/** Fila bloqueada: todos los campos visibles pero deshabilitados (CA3). */
function LockedItem({ item, change }: { item: CatalogEditorItem; change?: CatalogChange }) {
  return (
    <li className="space-y-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-center gap-2">
        {change && <CatalogChangeBadge change={change} />}
      </div>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-1">
          <Label htmlFor={`code-${item.id}`}>Código</Label>
          <Input id={`code-${item.id}`} value={item.code} disabled readOnly />
        </div>
        {hasName(item) && (
          <div className="space-y-1">
            <Label htmlFor={`name-${item.id}`}>Nombre</Label>
            <Input id={`name-${item.id}`} value={item.name} disabled readOnly />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`statement-${item.id}`}>Enunciado</Label>
        <Textarea id={`statement-${item.id}`} value={item.statement} disabled readOnly rows={3} />
      </div>
    </li>
  );
}

export function CatalogItemList({
  label,
  items,
  changes,
  editable,
  busy,
  onEdit,
  onReorder,
}: CatalogItemListProps) {
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const ids = items.map((item) => item.id);
  const controlsDisabled = busy;

  function handleDrop(event: DragEvent<HTMLLIElement>, targetIndex: number) {
    event.preventDefault();
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from === null || from === targetIndex || busy) {
      return;
    }
    onReorder(moveId(ids, from, targetIndex));
  }

  if (!editable) {
    return (
      <ul aria-label={label} className="space-y-3">
        {items.map((item) => (
          <LockedItem key={item.id} item={item} change={changes.get(item.code)} />
        ))}
      </ul>
    );
  }

  return (
    <ul aria-label={label} className="space-y-3">
      {items.map((item, index) => {
        const change = changes.get(item.code);
        const isOver = overIndex === index;
        return (
          <li
            key={item.id}
            draggable={!controlsDisabled}
            onDragStart={(event) => {
              dragIndex.current = index;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', item.id);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (overIndex !== index) {
                setOverIndex(index);
              }
            }}
            onDragLeave={() => setOverIndex((current) => (current === index ? null : current))}
            onDrop={(event) => handleDrop(event, index)}
            onDragEnd={() => {
              dragIndex.current = null;
              setOverIndex(null);
            }}
            className={cn(
              'flex gap-3 rounded-lg border p-4',
              isOver
                ? 'border-ring bg-accent text-accent-foreground'
                : 'border-border bg-card text-card-foreground',
            )}
          >
            <GripVertical
              className="mt-1 size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{item.code}</span>
                {hasName(item) && <span className="font-semibold">{item.name}</span>}
                {change && <CatalogChangeBadge change={change} />}
              </div>
              <p className="whitespace-pre-line text-body">{item.statement}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-start justify-end gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={controlsDisabled || index === 0}
                aria-label={`Subir ${item.code}`}
                onClick={() => onReorder(moveId(ids, index, index - 1))}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={controlsDisabled || index === items.length - 1}
                aria-label={`Bajar ${item.code}`}
                onClick={() => onReorder(moveId(ids, index, index + 1))}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={controlsDisabled}
                aria-label={`Editar ${item.code}`}
                onClick={() => onEdit(item)}
              >
                <Pencil aria-hidden="true" />
                Editar
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
