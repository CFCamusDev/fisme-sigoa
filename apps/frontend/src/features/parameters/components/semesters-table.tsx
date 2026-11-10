import type { SemesterDto } from '@sigoa/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common/empty-state';
import { formatSemesterDate } from '../lib/format-semester-date';

export interface SemestersTableProps {
  semesters: SemesterDto[];
}

export function SemestersTable({ semesters }: SemestersTableProps) {
  if (semesters.length === 0) {
    return (
      <EmptyState
        title="Aún no hay semestres registrados"
        description="Los periodos académicos creados aparecerán en esta lista para alimentar los selectores de evaluación."
        illustration="empty"
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="p-4 sm:p-6 pb-2">
        <h3 className="text-base font-semibold text-foreground">Listado de semestres</h3>
        <p className="text-sm text-muted-foreground">
          Semestres académicos ordenados descendentemente por fecha de inicio.
        </p>
      </div>

      <div className="p-4 sm:p-6 pt-2">
        <Table aria-label="Semestres académicos">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Código</TableHead>
              <TableHead scope="col">Fecha de inicio</TableHead>
              <TableHead scope="col">Fecha de fin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {semesters.map((semester) => (
              <TableRow key={semester.id}>
                <TableCell className="font-semibold text-foreground">{semester.code}</TableCell>
                <TableCell className="text-foreground">
                  {formatSemesterDate(semester.startDate)}
                </TableCell>
                <TableCell className="text-foreground">
                  {formatSemesterDate(semester.endDate)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
