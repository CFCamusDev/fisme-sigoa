import { createFileRoute } from '@tanstack/react-router';
import { TemplateEditorPage } from '@/features/templates';
import { guardPermission } from '@/lib/permission-guard';
import { tabSearchSchema } from '@/lib/tab-param';

export const Route = createFileRoute('/_app/plantillas_/$templateId')({
  validateSearch: (search: Record<string, unknown>) => tabSearchSchema.parse(search),
  beforeLoad: () => guardPermission('plantilla.ver'),
  component: TemplateEditorRouteComponent,
});

function TemplateEditorRouteComponent() {
  const { templateId } = Route.useParams();
  return <TemplateEditorPage templateId={templateId} />;
}
