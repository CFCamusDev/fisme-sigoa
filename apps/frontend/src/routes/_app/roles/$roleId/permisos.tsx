import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { RolePermissionsPage } from '@/features/authorization';
import { guardPermission } from '@/lib/permission-guard';

const rolePermissionsSearchSchema = z.object({
  module: z.string().max(80).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/roles/$roleId/permisos')({
  validateSearch: (search: Record<string, unknown>) => rolePermissionsSearchSchema.parse(search),
  beforeLoad: () => guardPermission('rol.editar'),
  component: RolePermissionsRouteComponent,
});

function RolePermissionsRouteComponent() {
  const { roleId } = Route.useParams();
  return <RolePermissionsPage roleId={roleId} />;
}
