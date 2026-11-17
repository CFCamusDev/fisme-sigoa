import { createFileRoute } from '@tanstack/react-router';
import { StakeholderListsPage } from '@/features/stakeholders';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/listas-constituyentes')({
  beforeLoad: () => guardPermission('constituyente.ver'),
  component: StakeholderListsRouteComponent,
});

function StakeholderListsRouteComponent() {
  return <StakeholderListsPage />;
}
