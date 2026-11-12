import type { ParameterDto } from '@sigoa/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatEffectiveFrom, formatParameterValue } from '../lib/format-parameter-value';

export interface ParametersTableProps {
  items: ParameterDto[];
  /** Semestre al que corresponde la vista; nulo cuando no hay semestres iniciados. */
  semesterCode: string | null;
}

export function ParametersTable({ items, semesterCode }: ParametersTableProps) {
  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="p-4 sm:p-6 pb-2">
        <h2 className="text-base font-semibold text-foreground">Valores vigentes</h2>
        <p className="text-sm text-muted-foreground">
          {semesterCode
            ? `Valores que rigen en el semestre ${semesterCode}.`
            : 'Aún no hay semestres iniciados: rigen los valores por defecto.'}
        </p>
      </div>

      <div className="p-4 sm:p-6 pt-2">
        <Table aria-label="Parámetros vigentes">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Parámetro</TableHead>
              <TableHead scope="col" className="text-right">
                Valor
              </TableHead>
              <TableHead scope="col">Vigente desde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.key}>
                <TableCell>
                  <span className="block font-semibold text-foreground">{item.label}</span>
                  <span className="block text-meta text-muted-foreground">{item.key}</span>
                </TableCell>
                <TableCell className="text-right tabular text-foreground">
                  {formatParameterValue(item.key, item.value)}
                </TableCell>
                <TableCell className="text-foreground">
                  {formatEffectiveFrom(item.effectiveFromSemesterCode)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
