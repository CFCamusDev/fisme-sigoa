import { Pencil, Plus } from 'lucide-react';
import { BADGE_BASE, TONE_CLASSES } from '@/lib/status';
import { cn } from '@/lib/utils';
import type { CatalogChange } from '../lib/catalog-diff';

const DESCRIPTORS = {
  NEW: { label: 'Nuevo', tone: 'info', Icon: Plus },
  MODIFIED: { label: 'Modificado', tone: 'warning', Icon: Pencil },
} as const;

/** Insignia de cambio respecto de la vigente: ícono y texto, nunca solo color. */
export function CatalogChangeBadge({ change }: { change: CatalogChange }) {
  if (change === 'UNCHANGED') {
    return null;
  }
  const { label, tone, Icon } = DESCRIPTORS[change];
  return (
    <span className={cn(BADGE_BASE, TONE_CLASSES[tone])}>
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
      <span className="sr-only"> respecto de la versión vigente</span>
    </span>
  );
}
