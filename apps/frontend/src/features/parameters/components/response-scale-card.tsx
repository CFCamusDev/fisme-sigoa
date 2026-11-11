import type { ReactNode } from 'react';
import type { ResponseScaleDto } from '@sigoa/shared';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getScaleTypeLabel } from '../lib/response-scale-labels';

export interface ResponseScaleCardProps {
  scale: ResponseScaleDto;
  /** Con permiso `parametro.editar` aparecen las acciones. */
  canEdit?: boolean;
  onEdit?: (scale: ResponseScaleDto, opener: HTMLElement) => void;
  onDuplicate?: (scale: ResponseScaleDto, opener: HTMLElement) => void;
  /** Panel en línea (por ejemplo, el formulario de duplicar). */
  panel?: ReactNode;
}

export function ResponseScaleCard({
  scale,
  canEdit = false,
  onEdit,
  onDuplicate,
  panel,
}: ResponseScaleCardProps) {
  const titleId = `response-scale-${scale.id}-title`;

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
            {scale.name}
          </h2>
          <p className="text-meta text-muted-foreground">
            {scale.code} · {getScaleTypeLabel(scale.type)} · {scale.levels.length} niveles
          </p>
        </div>
        {scale.inUse && <StatusBadge status="CLOSED" label="En uso" />}
      </div>

      <div className="mt-4">
        <Table aria-label={`Niveles de ${scale.name}`}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Orden</TableHead>
              <TableHead scope="col">Etiqueta</TableHead>
              <TableHead scope="col" className="text-right">
                Valor
              </TableHead>
              <TableHead scope="col">Cuenta como logro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scale.levels.map((level) => (
              <TableRow key={level.order}>
                <TableCell className="tabular text-foreground">{level.order}</TableCell>
                <TableCell className="text-foreground">{level.label}</TableCell>
                <TableCell className="text-right tabular text-foreground">
                  {new Intl.NumberFormat('es-PE').format(level.value)}
                </TableCell>
                <TableCell>
                  {level.countsAsAchievement ? (
                    <StatusBadge status="MET" label="Cuenta como logro" />
                  ) : (
                    <span className="text-muted-foreground">No cuenta</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {scale.inUse && (
        <p className="mt-4 text-sm text-muted-foreground">
          Esta escala está en uso en una encuesta publicada y no se puede modificar. Duplícala para
          crear una nueva.
        </p>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!scale.inUse && onEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => onEdit(scale, event.currentTarget)}
            >
              Editar
            </Button>
          )}
          {onDuplicate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => onDuplicate(scale, event.currentTarget)}
            >
              Duplicar
            </Button>
          )}
        </div>
      )}

      {panel && <div className="mt-4">{panel}</div>}
    </section>
  );
}
