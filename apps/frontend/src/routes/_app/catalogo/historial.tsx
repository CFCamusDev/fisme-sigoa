import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CatalogComparisonPage } from '@/features/catalog';
import { guardPermission } from '@/lib/permission-guard';
import { tabSearchSchema } from '@/lib/tab-param';

const versionIdSearchSchema = z.string().min(1).max(64).optional().catch(undefined);

/** Las versiones elegidas y la pestaña viven en la URL para poder compartir la comparación (HU-017, D8, HU-082). */
const comparisonSearchSchema = tabSearchSchema.extend({
  base: versionIdSearchSchema,
  target: versionIdSearchSchema,
});

export const Route = createFileRoute('/_app/catalogo/historial')({
  beforeLoad: () => guardPermission('catalogo.ver'),
  validateSearch: (search: Record<string, unknown>) => comparisonSearchSchema.parse(search),
  component: CatalogComparisonRouteComponent,
});

function CatalogComparisonRouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <CatalogComparisonPage
      selection={search}
      onSelectionChange={(selection) => {
        void navigate({
          search: ((prev: Record<string, unknown>) => ({ ...prev, ...selection })) as never,
        });
      }}
    />
  );
}
