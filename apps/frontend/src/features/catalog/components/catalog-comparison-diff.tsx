import { Minus, Pencil, Plus, Equal, type LucideIcon } from 'lucide-react';
import type { CatalogItemDiffDto, WordDiffSegmentDto } from '@sigoa/shared';
import { BADGE_BASE, TONE_CLASSES, type StatusTone } from '@/lib/status';
import { cn } from '@/lib/utils';

const CHANGE_DESCRIPTORS: Record<
  CatalogItemDiffDto['change'],
  { label: string; tone: StatusTone; Icon: LucideIcon }
> = {
  ADDED: { label: 'Agregado', tone: 'success', Icon: Plus },
  REMOVED: { label: 'Quitado', tone: 'danger', Icon: Minus },
  MODIFIED: { label: 'Modificado', tone: 'warning', Icon: Pencil },
  UNCHANGED: { label: 'Sin cambios', tone: 'neutral', Icon: Equal },
};

/** Insignia del tipo de cambio: ícono y texto, nunca solo color. */
export function CatalogItemChangeBadge({ change }: { change: CatalogItemDiffDto['change'] }) {
  const { label, tone, Icon } = CHANGE_DESCRIPTORS[change];
  return (
    <span className={cn(BADGE_BASE, TONE_CLASSES[tone])}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Texto con las palabras agregadas y quitadas resaltadas. Además del color usa subrayado
 * (`<ins>`) y tachado (`<del>`), y un texto solo para lector de pantalla (RNF-036).
 */
export function HighlightedText({ segments }: { segments: readonly WordDiffSegmentDto[] }) {
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'ADDED') {
          return (
            <ins
              key={index}
              className={cn(TONE_CLASSES.success, 'rounded-sm px-0.5 underline decoration-2')}
            >
              <span className="sr-only">[agregado: </span>
              {segment.text}
              <span className="sr-only">]</span>
            </ins>
          );
        }
        if (segment.type === 'REMOVED') {
          return (
            <del key={index} className={cn(TONE_CLASSES.danger, 'rounded-sm px-0.5 line-through')}>
              <span className="sr-only">[quitado: </span>
              {segment.text}
              <span className="sr-only">]</span>
            </del>
          );
        }
        return <span key={index}>{segment.text}</span>;
      })}
    </>
  );
}

export interface CatalogComparisonDiffProps {
  readonly title: string;
  readonly items: readonly CatalogItemDiffDto[];
  readonly showUnchanged: boolean;
}

/** Lista de elementos comparados de un tipo (OE o AG) con sus diferencias resaltadas. */
export function CatalogComparisonDiff({ title, items, showUnchanged }: CatalogComparisonDiffProps) {
  const visible = showUnchanged ? items : items.filter((item) => item.change !== 'UNCHANGED');
  const headingId = `catalog-diff-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6"
    >
      <h2 id={headingId} className="text-base font-semibold text-foreground">
        {title}
      </h2>

      {visible.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {items.length === 0
            ? 'Ninguna de las dos versiones tiene elementos de este tipo.'
            : 'No hay diferencias entre las dos versiones.'}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {visible.map((item) => (
            <li key={`${item.code}-${item.change}`} className="space-y-1 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{item.code}</span>
                <CatalogItemChangeBadge change={item.change} />
              </div>
              {item.nameSegments.length > 0 && (
                <p className="text-sm font-semibold text-foreground">
                  <HighlightedText segments={item.nameSegments} />
                </p>
              )}
              <p className="text-sm text-foreground">
                <HighlightedText segments={item.statementSegments} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
