import { createFileRoute } from '@tanstack/react-router';
import { ExecutionBoardPage } from '@/features/processes';
import { guardPermission } from '@/lib/permission-guard';
import { tabSearchSchema } from '@/lib/tab-param';

export const Route = createFileRoute('/_app/ejecuciones_/$executionId')({
  validateSearch: (search: Record<string, unknown>) => tabSearchSchema.parse(search),
  beforeLoad: () => guardPermission('ejecucion.ver'),
  component: ExecutionBoardRouteComponent,
});

function ExecutionBoardRouteComponent() {
  const { executionId } = Route.useParams();
  return <ExecutionBoardPage executionId={executionId} />;
}
