import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/usuarios/nuevo')({
  component: () => <div>Formulario de nuevo usuario</div>,
});
