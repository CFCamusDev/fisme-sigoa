import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CatalogComparisonPage } from '@/features/catalog';
import { guardPermission } from '@/lib/permission-guard';

const versionIdSearchSchema = z.string().min(1).max(64).optional().catch(undefined);

/** Las versiones elegidas viven en la URL para poder compartir la comparación (HU-017, D8). */
const comparisonSearchSchema = z.object({
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
        void navigate({ search: selection });
      }}
    />
  );
}
