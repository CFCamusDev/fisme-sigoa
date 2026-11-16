import { createFileRoute } from '@tanstack/react-router';
import { StakeholdersPage } from '@/features/stakeholders';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/constituyentes')({
  beforeLoad: () => guardPermission('constituyente.ver'),
  component: StakeholdersRouteComponent,
});

function StakeholdersRouteComponent() {
  return <StakeholdersPage />;
}
