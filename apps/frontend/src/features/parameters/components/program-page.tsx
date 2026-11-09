import { PageHeader, LoadingState, ErrorState } from '@/components/common';
import { useProgram } from '../hooks/use-program';
import { getProgramErrorMessage } from '../lib/program-error-message';
import { ProgramForm } from './program-form';

export function ProgramPage() {
  const { data: program, isLoading, isError, error, refetch } = useProgram();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programa"
        description="Configuración de los datos del programa institucional y facultad."
      />

      {isLoading && <LoadingState message="Cargando datos del programa..." />}

      {isError && (
        <>
          {error?.status === 404 ? (
            <ErrorState
              title="Programa no encontrado"
              message="No hay un programa configurado en el sistema."
              illustration="notFound"
              onRetry={() => void refetch()}
            />
          ) : error?.status === 403 ? (
            <ErrorState
              title="Acceso denegado"
              message="No tienes permiso para consultar los datos del programa."
              illustration="noPermission"
            />
          ) : (
            <ErrorState
              title="Error al cargar el programa"
              message={getProgramErrorMessage(error)}
              onRetry={() => void refetch()}
            />
          )}
        </>
      )}

      {!isLoading && !isError && program && <ProgramForm program={program} />}
    </div>
  );
}
