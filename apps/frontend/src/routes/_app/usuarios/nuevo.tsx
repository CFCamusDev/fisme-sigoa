import { createFileRoute } from '@tanstack/react-router';
import { CreateUserPage } from '@/features/users';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/usuarios/nuevo')({
  beforeLoad: () => guardPermission('usuario.crear'),
  component: CreateUserPage,
});
