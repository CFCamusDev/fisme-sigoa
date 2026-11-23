import { useMemo, useState } from 'react';
import { PageHeader, LoadingState, ErrorState } from '@/components/common';
import { EmptyState } from '@/components/common/empty-state';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/hooks/use-permission';
import { useTabParam } from '@/hooks/use-tab-param';
import { useParameters } from '../hooks/use-parameters';
import { useSemesters } from '../hooks/use-semesters';
import { ParameterHistory } from './parameter-history';
import { ParametersForm } from './parameters-form';
import { ParametersTable } from './parameters-table';

const EDITABLE_TABS = ['vigentes', 'historial', 'definir'] as const;
const READONLY_TABS = ['vigentes', 'historial'] as const;

export function ParametersPage() {
  /** Vacío = «Hoy»: rige el último semestre iniciado hasta la fecha. */
  const [semesterCode, setSemesterCode] = useState('');
  const { allowed: canEdit } = usePermission('parametro.editar');
  const allowedTabs = useMemo(() => (canEdit ? EDITABLE_TABS : READONLY_TABS), [canEdit]);
  const [activeTab, setActiveTab] = useTabParam(allowedTabs, 'vigentes');

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
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as (typeof allowedTabs)[number])}
        >
          <TabsList aria-label="Secciones de parámetros">
            <TabsTrigger value="vigentes">Valores vigentes</TabsTrigger>
            <TabsTrigger value="historial">Historial de vigencias</TabsTrigger>
            {canEdit ? <TabsTrigger value="definir">Definir parámetros</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="vigentes">
            <ParametersTable items={data.items} semesterCode={data.semesterCode} />
          </TabsContent>

          <TabsContent value="historial">
            <ParameterHistory items={data.items} />
          </TabsContent>

          {canEdit ? (
            <TabsContent value="definir">
              <ParametersForm
                onSuccess={(code) => {
                  setSemesterCode(code);
                  setActiveTab('vigentes');
                }}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      )}
    </div>
  );
}
