import { createFileRoute } from '@tanstack/react-router';
import { CreateRolePage } from '@/features/authorization';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/roles/nuevo')({
  beforeLoad: () => guardPermission('rol.editar'),
  component: CreateRolePage,
});
