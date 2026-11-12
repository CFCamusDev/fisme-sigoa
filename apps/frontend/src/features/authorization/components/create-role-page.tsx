import { useNavigate } from '@tanstack/react-router';
import { PageHeader } from '@/components/common/page-header.js';
import { RoleForm } from './role-form.js';

export function CreateRolePage() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate({ to: '/roles' });
  };

  const handleCancel = () => {
    navigate({ to: '/roles' });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo rol"
        description="Define un nuevo rol con nombre y descripción. Posteriormente podrás asignar sus permisos."
      />

      <section className="surface rounded-lg p-6">
        <RoleForm mode="create" onSuccess={handleSuccess} onCancel={handleCancel} />
      </section>
    </div>
  );
}
