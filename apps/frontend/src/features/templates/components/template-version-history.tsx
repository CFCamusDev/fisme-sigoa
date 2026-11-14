import type { TemplateVersionSummaryDto } from '@sigoa/shared';
import { StatusBadge } from '@/components/common/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/date';
import { formatVersionLabel } from '../lib/template-labels';

export interface TemplateVersionHistoryProps {
  readonly versions: readonly TemplateVersionSummaryDto[];
}

export function TemplateVersionHistory({ versions }: TemplateVersionHistoryProps) {
  return (
    <section
      aria-labelledby="template-history-title"
      className="rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-6"
    >
      <h3 id="template-history-title" className="text-base font-semibold text-foreground">
        Historial de versiones
      </h3>
      <p className="text-sm text-muted-foreground">
        De la más reciente a la más antigua. Una versión publicada no se modifica.
      </p>

      <Table>
        <caption className="sr-only">Versiones de la plantilla y su fecha de publicación</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Versión</TableHead>
            <TableHead scope="col">Estado</TableHead>
            <TableHead scope="col">Publicada el</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((version) => (
            <TableRow key={version.id}>
              <TableCell className="font-semibold text-foreground">
                {formatVersionLabel(version.number)}
              </TableCell>
              <TableCell>
                <StatusBadge status={version.status} />
              </TableCell>
              <TableCell className="text-foreground">{formatDate(version.publishedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
