import { createFileRoute } from '@tanstack/react-router';
import { CreateRolePage } from '@/features/authorization';

export const Route = createFileRoute('/_app/roles/nuevo')({
  component: CreateRolePage,
});
