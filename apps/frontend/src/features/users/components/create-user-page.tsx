import { PageHeader } from '@/components/common/page-header';
import { UserForm } from './user-form';

export function CreateUserPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo usuario"
        description="Registra un nuevo usuario en la plataforma. Se le enviará un correo para activar su cuenta."
      />

      <section className="surface rounded-lg p-6">
        <UserForm mode="create" />
      </section>
    </div>
  );
}
