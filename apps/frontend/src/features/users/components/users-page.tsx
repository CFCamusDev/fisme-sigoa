import { PageHeader, EmptyState } from '@/components/common';

export function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Usuarios" description="Administra quién accede a FISME-SIGOA" />

      <section className="surface p-6">
        <EmptyState
          title="Usuarios del sistema"
          description="La lista de usuarios estará disponible en la siguiente entrega."
        />
      </section>
    </div>
  );
}
