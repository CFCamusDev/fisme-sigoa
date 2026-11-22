import { createFileRoute } from '@tanstack/react-router';
import { ExecutionBoardPage } from '@/features/processes';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/ejecuciones_/$executionId')({
  beforeLoad: () => guardPermission('ejecucion.ver'),
  component: ExecutionBoardRouteComponent,
});

function ExecutionBoardRouteComponent() {
  const { executionId } = Route.useParams();
  return <ExecutionBoardPage executionId={executionId} />;
}
