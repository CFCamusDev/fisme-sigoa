import { PageHeader, LoadingState, ErrorState } from '@/components/common';
import { useSemesters } from '../hooks/use-semesters';
import { getSemesterErrorMessage } from '../lib/semester-error-message';
import { SemesterForm } from './semester-form';
import { SemestersTable } from './semesters-table';

export function SemestersPage() {
  const { data, isLoading, isError, error, refetch } = useSemesters();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Semestres"
        description="Gestión y registro de los periodos académicos institucionales de EPIS."
      />

      {isLoading && <LoadingState message="Cargando semestres..." />}

      {isError && (
        <>
          {error?.status === 403 ? (
            <ErrorState
              title="Acceso denegado"
              message="No tienes permiso para consultar los semestres."
              illustration="noPermission"
            />
          ) : (
            <ErrorState
              title="Error al cargar los semestres"
              message={getSemesterErrorMessage(error)}
              onRetry={() => void refetch()}
            />
          )}
        </>
      )}

      {!isLoading && !isError && (
        <div className="space-y-6">
          <SemesterForm onSuccess={() => void refetch()} />
          <SemestersTable semesters={data?.items ?? []} />
        </div>
      )}
    </div>
  );
}
