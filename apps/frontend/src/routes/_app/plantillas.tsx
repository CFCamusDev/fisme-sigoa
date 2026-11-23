import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { TemplatesPage } from '@/features/templates';
import { guardPermission } from '@/lib/permission-guard';

/** La plantilla abierta vive en la URL para poder compartir el enlace (HU-018, D4). */
const templatesSearchSchema = z.object({
  id: z.string().min(1).max(64).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/plantillas')({
  validateSearch: (search: Record<string, unknown>) => templatesSearchSchema.parse(search),
  beforeLoad: ({ search }) => {
    guardPermission('plantilla.ver');
    if (search.id) {
      throw redirect({
        to: '/plantillas/$templateId',
        params: { templateId: search.id },
      });
    }
  },
  component: TemplatesRouteComponent,
});

function TemplatesRouteComponent() {
  return <TemplatesPage />;
}
