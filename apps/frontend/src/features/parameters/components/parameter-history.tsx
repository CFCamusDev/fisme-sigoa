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

export interface ParameterHistoryProps {
  items: ParameterDto[];
}

export function ParameterHistory({ items }: ParameterHistoryProps) {
  return (
    <section
      aria-labelledby="parameter-history-title"
      className="rounded-lg border border-border bg-card text-card-foreground shadow-sm"
    >
      <div className="p-4 sm:p-6 pb-2">
        <h2 id="parameter-history-title" className="text-base font-semibold text-foreground">
          Historial de vigencias
        </h2>
        <p className="text-sm text-muted-foreground">
          Cada cambio rige desde un semestre; los semestres anteriores conservan su valor.
        </p>
      </div>

      <div className="space-y-2 p-4 sm:p-6 pt-2">
        {items.map((item) => (
          <details key={item.key} className="rounded-md border border-border bg-card">
            <summary className="cursor-pointer px-4 py-3 text-label text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              {item.label}
              <span className="ml-2 text-meta font-normal text-muted-foreground">
                {item.versions.length === 1 ? 'Sin cambios' : `${item.versions.length} versiones`}
              </span>
            </summary>
            <div className="px-4 pb-4">
              <Table aria-label={`Historial de ${item.label}`}>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="text-right">
                      Valor
                    </TableHead>
                    <TableHead scope="col">Desde</TableHead>
                    <TableHead scope="col">Hasta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.versions.map((version) => (
                    <TableRow key={`${item.key}-${version.effectiveFromSemesterCode ?? 'default'}`}>
                      <TableCell className="text-right tabular text-foreground">
                        {formatParameterValue(item.key, version.value)}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {formatEffectiveFrom(version.effectiveFromSemesterCode)}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {version.effectiveToSemesterCode ?? 'Sin fecha de fin'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
