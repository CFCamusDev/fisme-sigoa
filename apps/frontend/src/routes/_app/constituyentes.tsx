import { createFileRoute, useSearch } from '@tanstack/react-router';
import { z } from 'zod';
import { StakeholdersPage } from '@/features/stakeholders';
import { guardPermission } from '@/lib/permission-guard';

const stakeholdersSearchSchema = z.object({
  editar: z.string().trim().min(1).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/constituyentes')({
  validateSearch: stakeholdersSearchSchema,
  beforeLoad: () => guardPermission('constituyente.ver'),
  component: StakeholdersRouteComponent,
});

function StakeholdersRouteComponent() {
  const search = useSearch({ strict: false }) as { editar?: string };
  return <StakeholdersPage initialEditId={search.editar} />;
}
