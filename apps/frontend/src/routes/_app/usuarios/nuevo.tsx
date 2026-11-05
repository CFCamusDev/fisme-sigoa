import { createFileRoute } from '@tanstack/react-router';
import { CreateUserPage } from '@/features/users';

export const Route = createFileRoute('/_app/usuarios/nuevo')({
  component: CreateUserPage,
});
