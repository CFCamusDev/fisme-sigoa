import { Button } from '@/components/ui/button';

export interface UsersPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  isLoading?: boolean;
  onPageChange: (newPage: number) => void;
}

export function UsersPagination({
  page,
  totalPages,
  total,
  isLoading = false,
  onPageChange,
}: UsersPaginationProps) {
  if (total <= 0) {
    return null;
  }

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;
  const countLabel = total === 1 ? '1 usuario' : `${total} usuarios`;

  return (
    <nav
      aria-label="Paginación de usuarios"
      className="flex flex-col items-center justify-between gap-4 py-3 sm:flex-row"
    >
      <div className="text-body text-muted-foreground" aria-live="polite">
        Mostrando página {page} de {Math.max(totalPages, 1)} ({countLabel})
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevious || isLoading}
          aria-label="Ir a la página anterior"
        >
          Anterior
        </Button>
        <span className="text-label text-foreground px-2" aria-hidden="true">
          {page} / {Math.max(totalPages, 1)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || isLoading}
          aria-label="Ir a la página siguiente"
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
