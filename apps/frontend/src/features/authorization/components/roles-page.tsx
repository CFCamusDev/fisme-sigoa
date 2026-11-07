import { EmptyState, PageHeader } from '@/components/common';

export function RolesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Roles" description="Administra los grupos de permisos de FISME-SIGOA" />
      <EmptyState
        title="No hay roles registrados"
        description="Aún no se han configurado roles en el sistema."
      />
    </div>
  );
}
