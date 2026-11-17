import { Button } from '@/components/ui/button';

export interface ProcessExecutionsPaginationProps {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly onPageChange: (page: number) => void;
}

const numberFormatter = new Intl.NumberFormat('es-PE');

export function ProcessExecutionsPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: ProcessExecutionsPaginationProps) {
  if (total === 0) {
    return null;
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-card-foreground">
      <p className="text-muted-foreground">
        Mostrando {numberFormatter.format(from)}–{numberFormatter.format(to)} de{' '}
        {numberFormatter.format(total)} ejecuciones
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Página {numberFormatter.format(page)} de {numberFormatter.format(totalPages)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
