import { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { TemplateTypeValue } from '@sigoa/shared';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { LoadingState } from '@/components/common/loading-state';
import { PageHeader } from '@/components/common/page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useTemplates } from '../hooks/use-templates';
import { getTemplateErrorMessage } from '../lib/template-error-message';
import { TEMPLATE_TYPE_OPTIONS, formatTemplateType } from '../lib/template-labels';
import { TemplatesTable } from './templates-table';

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function TemplatesPage() {
  const uid = useId();
  const [type, setType] = useState<TemplateTypeValue | ''>('');
  const [query, setQuery] = useState('');

  const listQuery = useTemplates({ ...(type ? { type } : {}), pageSize: 100 });

  const templates = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const normalizedQuery = normalizeSearch(query);

  const filteredTemplates = useMemo(() => {
    if (!normalizedQuery) {
      return templates;
    }
    return templates.filter(
      (template) =>
        normalizeSearch(template.code).includes(normalizedQuery) ||
        normalizeSearch(template.name).includes(normalizedQuery),
    );
  }, [normalizedQuery, templates]);

  const filterId = `${uid}-type`;
  const searchId = `${uid}-search`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plantillas oficiales"
        description="Formatos oficiales versionados: edita el contenido HTML, guarda un borrador y publícalo como una versión nueva."
      />

      <section className="space-y-4 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Listado de plantillas</h2>
            <p className="text-sm text-muted-foreground">
              Cada plantilla muestra su versión publicada y, si existe, su borrador.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1 sm:w-64">
              <Label htmlFor={searchId}>Buscar plantilla</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Código o nombre..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1 sm:w-56">
              <Label htmlFor={filterId}>Tipo de plantilla</Label>
              <Select
                id={filterId}
                value={type}
                onChange={(event) => setType(event.target.value as TemplateTypeValue | '')}
              >
                <option value="">Todos</option>
                {TEMPLATE_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatTemplateType(option)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {listQuery.isLoading && <LoadingState message="Cargando plantillas..." />}

        {listQuery.isError &&
          (listQuery.error?.status === 403 ? (
            <ErrorState
              title="Acceso denegado"
              message="No tienes permiso para consultar las plantillas."
              illustration="noPermission"
            />
          ) : (
            <ErrorState
              title="Error al cargar las plantillas"
              message={getTemplateErrorMessage(listQuery.error)}
              onRetry={() => void listQuery.refetch()}
            />
          ))}

        {!listQuery.isLoading && !listQuery.isError && templates.length === 0 && (
          <EmptyState
            title="No hay plantillas para este filtro"
            description="Cambia el tipo seleccionado para ver las demás plantillas."
            illustration="empty"
          />
        )}

        {!listQuery.isLoading &&
          !listQuery.isError &&
          templates.length > 0 &&
          filteredTemplates.length === 0 && (
            <EmptyState
              title={`Ninguna plantilla coincide con “${query.trim()}”`}
              description="Prueba con otro código o nombre de plantilla."
              illustration="noResults"
            />
          )}

        {!listQuery.isLoading && !listQuery.isError && filteredTemplates.length > 0 && (
          <TemplatesTable templates={filteredTemplates} />
        )}
      </section>
    </div>
  );
}
