import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/usuarios/$userId/editar')({
  component: () => <div>Formulario de edición de usuario</div>,
});
