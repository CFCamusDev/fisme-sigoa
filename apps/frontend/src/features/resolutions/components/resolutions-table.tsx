import { Fragment, useState } from 'react';
import { CircleCheck, Clock } from 'lucide-react';
import type { ResolutionDto } from '@sigoa/shared';
import { Can } from '@/components/common/can';
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
import { formatDate } from '@/lib/date';
import { formatResolutionType, formatVersionLabel } from '../lib/resolution-labels';
import { ApproveResolutionForm } from './approve-resolution-form';

export interface ResolutionsTableProps {
  readonly resolutions: readonly ResolutionDto[];
  /** Número de cada versión del catálogo por identificador; sin dato se muestra «—». */
  readonly versionNumberById: ReadonlyMap<string, number>;
  /** Se llama con la resolución ya aprobada para que la página lo informe. */
  readonly onApproved?: (resolution: ResolutionDto) => void;
}

export function ResolutionsTable({
  resolutions,
  versionNumberById,
  onApproved,
}: ResolutionsTableProps) {
  const [approvingId, setApprovingId] = useState<string | null>(null);

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
              <TableHead scope="col">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolutions.map((resolution) => {
              const versionNumber = resolution.catalogVersionId
                ? versionNumberById.get(resolution.catalogVersionId)
                : undefined;
              return (
                <Fragment key={resolution.id}>
                  <TableRow>
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
                    <TableCell>
                      {resolution.status === 'REGISTERED' && (
                        <Can permission="resolucion.aprobar" scope="GLOBAL">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Aprobar resolución ${resolution.number}`}
                            aria-expanded={approvingId === resolution.id}
                            onClick={() =>
                              setApprovingId(approvingId === resolution.id ? null : resolution.id)
                            }
                          >
                            Aprobar
                          </Button>
                        </Can>
                      )}
                    </TableCell>
                  </TableRow>
                  {approvingId === resolution.id && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <ApproveResolutionForm
                          resolution={resolution}
                          onCancel={() => setApprovingId(null)}
                          onApproved={(approved) => {
                            setApprovingId(null);
                            onApproved?.(approved);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
