import { useId } from 'react';
import type { StakeholderImportRowDto } from '@sigoa/shared';
import { StatusBadge } from '@/components/common/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { STAKEHOLDER_IMPORT_ROW_BADGE } from '../lib/stakeholder-import-labels';

export interface StakeholderImportPreviewTableProps {
  readonly rows: readonly StakeholderImportRowDto[];
  readonly showOnlyErrors: boolean;
  readonly onToggleOnlyErrors: (checked: boolean) => void;
}

export function StakeholderImportPreviewTable({
  rows,
  showOnlyErrors,
  onToggleOnlyErrors,
}: StakeholderImportPreviewTableProps) {
  const filterId = useId();
  const visibleRows = showOnlyErrors ? rows.filter((row) => row.status === 'INVALID') : rows;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          id={filterId}
          type="checkbox"
          checked={showOnlyErrors}
          onChange={(event) => onToggleOnlyErrors(event.target.checked)}
          className="size-4 rounded border-border accent-primary"
        />
        <label htmlFor={filterId} className="text-sm font-medium text-foreground">
          Mostrar solo filas con errores
        </label>
      </div>

      {visibleRows.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          No hay filas con errores en el archivo.
        </p>
      ) : (
        <div className="max-h-96 overflow-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fila</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Observaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => {
                const badge = STAKEHOLDER_IMPORT_ROW_BADGE[row.status];
                return (
                  <TableRow key={row.rowNumber}>
                    <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                    <TableCell className="font-mono text-xs">{row.document ?? '—'}</TableCell>
                    <TableCell>{row.fullName ?? '—'}</TableCell>
                    <TableCell>
                      <StatusBadge status={badge.status} label={badge.label} />
                    </TableCell>
                    <TableCell>
                      {row.errors.length > 0 ? (
                        <ul className="list-disc space-y-0.5 pl-4 text-xs text-destructive">
                          {row.errors.map((error, index) => (
                            <li key={`${row.rowNumber}-${index}`}>{error}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
