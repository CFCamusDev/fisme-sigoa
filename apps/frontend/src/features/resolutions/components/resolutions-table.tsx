import { CircleCheck, Clock } from 'lucide-react';
import type { ResolutionDto } from '@sigoa/shared';
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
import { formatResolutionType, formatVersionLabel } from '../lib/resolution-labels';

export interface ResolutionsTableProps {
  readonly resolutions: readonly ResolutionDto[];
  /** Número de cada versión del catálogo por identificador; sin dato se muestra «—». */
  readonly versionNumberById: ReadonlyMap<string, number>;
}

export function ResolutionsTable({ resolutions, versionNumberById }: ResolutionsTableProps) {
  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="p-4 pb-2 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Listado de resoluciones</h2>
        <p className="text-sm text-muted-foreground">
          De la más reciente a la más antigua. Una resolución aprobada activa lo que aprueba.
        </p>
      </div>

      <div className="p-4 pt-2 sm:p-6 sm:pt-2">
        <Table>
          <caption className="sr-only">
            Resoluciones del Decano que aprueban los objetivos educacionales y los atributos del
            graduado
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Tipo</TableHead>
              <TableHead scope="col">Número</TableHead>
              <TableHead scope="col">Fecha</TableHead>
              <TableHead scope="col">Versión</TableHead>
              <TableHead scope="col">Estado</TableHead>
              <TableHead scope="col">PDF firmado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolutions.map((resolution) => {
              const versionNumber = resolution.catalogVersionId
                ? versionNumberById.get(resolution.catalogVersionId)
                : undefined;
              return (
                <TableRow key={resolution.id}>
                  <TableCell className="text-foreground">
                    {formatResolutionType(resolution.type)}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {resolution.number}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {formatDate(resolution.issuedOn)}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {versionNumber !== undefined ? formatVersionLabel(versionNumber) : '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={resolution.status} />
                  </TableCell>
                  <TableCell className="text-foreground">
                    {resolution.pdfFileId ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CircleCheck className="size-4" aria-hidden="true" />
                        Adjunto
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="size-4" aria-hidden="true" />
                        Pendiente
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
