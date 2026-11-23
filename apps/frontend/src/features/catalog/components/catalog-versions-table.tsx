import { Link } from '@tanstack/react-router';
import type { CatalogVersionDto } from '@sigoa/shared';
import { StatusBadge } from '@/components/common/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import { formatDate } from '@/lib/date';

export interface CatalogVersionsTableProps {
  versions: readonly CatalogVersionDto[];
}

/** Etiqueta corta de una versión (`V1`). */
export function formatVersionLabel(number: number): string {
  return `V${number}`;
}

export function CatalogVersionsTable({ versions }: CatalogVersionsTableProps) {
  const { allowed: canEdit } = usePermission('catalogo.editar', 'GLOBAL');
  const numberById = new Map(versions.map((version) => [version.id, version.number]));

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="p-4 sm:p-6 pb-2">
        <h2 className="text-base font-semibold text-foreground">Listado de versiones</h2>
        <p className="text-sm text-muted-foreground">
          De la más reciente a la más antigua. Solo la versión aprobada está vigente.
        </p>
      </div>

      <div className="p-4 sm:p-6 pt-2">
        <Table>
          <caption className="sr-only">
            Versiones del catálogo de objetivos educacionales y atributos del graduado
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Versión</TableHead>
              <TableHead scope="col">Estado</TableHead>
              <TableHead scope="col">Basada en</TableHead>
              <TableHead scope="col">OE</TableHead>
              <TableHead scope="col">AG</TableHead>
              <TableHead scope="col">Creada</TableHead>
              <TableHead scope="col">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((version) => {
              const sourceNumber = version.basedOnVersionId
                ? numberById.get(version.basedOnVersionId)
                : undefined;
              return (
                <TableRow key={version.id}>
                  <TableCell className="font-semibold text-foreground">
                    {formatVersionLabel(version.number)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={version.status}
                      label={version.status === 'APPROVED' ? 'Aprobada (vigente)' : undefined}
                    />
                  </TableCell>
                  <TableCell className="text-foreground">
                    {sourceNumber !== undefined ? formatVersionLabel(sourceNumber) : '—'}
                  </TableCell>
                  <TableCell className="text-foreground">{version.objectiveCount}</TableCell>
                  <TableCell className="text-foreground">{version.attributeCount}</TableCell>
                  <TableCell className="text-foreground">{formatDate(version.createdAt)}</TableCell>
                  <TableCell>
                    <Link
                      to="/catalogo/versiones/$versionId"
                      params={{ versionId: version.id }}
                      aria-label={`${canEdit && version.status === 'DRAFT' ? 'Editar' : 'Ver'} ${formatVersionLabel(version.number)}`}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {canEdit && version.status === 'DRAFT' ? 'Editar' : 'Ver'}
                    </Link>
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
