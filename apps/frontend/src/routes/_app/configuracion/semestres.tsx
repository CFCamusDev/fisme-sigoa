import { createFileRoute } from '@tanstack/react-router';
import { SemestersPage } from '@/features/parameters';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/configuracion/semestres')({
  beforeLoad: () => guardPermission('parametro.ver'),
  component: SemestersRouteComponent,
});

function SemestersRouteComponent() {
  return <SemestersPage />;
}
