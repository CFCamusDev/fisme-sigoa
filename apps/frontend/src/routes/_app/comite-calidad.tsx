import { createFileRoute } from '@tanstack/react-router';
import { QualityCommitteePage } from '@/features/quality-committee';
import { guardPermission } from '@/lib/permission-guard';
import { tabSearchSchema } from '@/lib/tab-param';

export const Route = createFileRoute('/_app/comite-calidad')({
  validateSearch: (search: Record<string, unknown>) => tabSearchSchema.parse(search),
  beforeLoad: () => guardPermission('comite.ver'),
  component: QualityCommitteeRouteComponent,
});

function QualityCommitteeRouteComponent() {
  return <QualityCommitteePage />;
}
