import type { ProcessExecutionDto } from '@sigoa/shared';
import { Link } from '@tanstack/react-router';
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
import { PROCESS_TYPE_LABELS } from '../lib/process-type-labels';

export interface ProcessExecutionsTableProps {
  readonly items: readonly ProcessExecutionDto[];
}

export function ProcessExecutionsTable({ items }: ProcessExecutionsTableProps) {
  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground">
      <Table>
        <caption className="sr-only">Listado de ejecuciones de proceso</caption>
        <TableHeader className="bg-muted text-foreground">
          <TableRow>
            <TableHead scope="col" className="text-foreground">
              Nombre
            </TableHead>
            <TableHead scope="col" className="text-foreground">
              Proceso
            </TableHead>
            <TableHead scope="col" className="text-foreground">
              Periodo
            </TableHead>
            <TableHead scope="col" className="text-foreground">
              Versión
            </TableHead>
            <TableHead scope="col" className="text-foreground">
              Estado
            </TableHead>
            <TableHead scope="col" className="text-foreground">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const periodLabel = item.semesterCode ?? String(item.year);
            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium text-foreground">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {PROCESS_TYPE_LABELS[item.type]}
                </TableCell>
                <TableCell className="text-foreground">{periodLabel}</TableCell>
                <TableCell className="text-muted-foreground">
                  v{item.catalogVersionNumber}
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Can permission="ejecucion.ver">
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/ejecuciones/$executionId" params={{ executionId: item.id }}>
                          Ver tablero
                        </Link>
                      </Button>
                    </Can>
                    <Can permission="cronograma.ver">
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/cronograma/$executionId" params={{ executionId: item.id }}>
                          Cronograma
                        </Link>
                      </Button>
                    </Can>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
