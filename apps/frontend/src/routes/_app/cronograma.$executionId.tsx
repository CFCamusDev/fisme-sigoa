import { createFileRoute } from '@tanstack/react-router';
import { ScheduleEditorPage } from '@/features/processes';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/cronograma/$executionId')({
  beforeLoad: () => guardPermission('cronograma.ver'),
  component: ScheduleEditorRouteComponent,
});

function ScheduleEditorRouteComponent() {
  const { executionId } = Route.useParams();
  return <ScheduleEditorPage executionId={executionId} />;
}
