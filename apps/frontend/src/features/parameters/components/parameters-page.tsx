import { useState } from 'react';
import { PageHeader, LoadingState, ErrorState } from '@/components/common';
import { EmptyState } from '@/components/common/empty-state';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useParameters } from '../hooks/use-parameters';
import { useSemesters } from '../hooks/use-semesters';
import { ParameterHistory } from './parameter-history';
import { ParametersTable } from './parameters-table';

export function ParametersPage() {
  /** Vacío = «Hoy»: rige el último semestre iniciado hasta la fecha. */
  const [semesterCode, setSemesterCode] = useState('');
  const { data: semesters } = useSemesters();
  const { data, isLoading, isError, error, refetch } = useParameters(semesterCode || undefined);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parámetros"
        description="Umbrales, metas, pesos y mínimos que usa el sistema. Cada cambio rige desde un semestre."
      />

      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="parameters-semester">Ver valores vigentes en</Label>
          <Select
            id="parameters-semester"
            value={semesterCode}
            onChange={(event) => setSemesterCode(event.target.value)}
          >
            <option value="">Hoy</option>
            {(semesters?.items ?? []).map((semester) => (
              <option key={semester.id} value={semester.code}>
                {semester.code}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading && <LoadingState message="Cargando parámetros..." />}

      {isError &&
        (error?.status === 403 ? (
          <ErrorState
            title="Acceso denegado"
            message="No tienes permiso para consultar los parámetros."
            illustration="noPermission"
          />
        ) : (
          <ErrorState
            title="Error al cargar los parámetros"
            message="No se pudieron obtener los parámetros. Intenta de nuevo."
            onRetry={() => void refetch()}
          />
        ))}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState
          title="No hay parámetros configurados"
          description="Los valores por defecto se cargan con la configuración inicial del sistema."
          illustration="empty"
        />
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <div className="space-y-6">
          <ParametersTable items={data.items} semesterCode={data.semesterCode} />
          <ParameterHistory items={data.items} />
        </div>
      )}
    </div>
  );
}
