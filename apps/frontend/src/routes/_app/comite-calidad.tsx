import { createFileRoute } from '@tanstack/react-router';
import { QualityCommitteePage } from '@/features/quality-committee';
import { guardPermission } from '@/lib/permission-guard';

export const Route = createFileRoute('/_app/comite-calidad')({
  beforeLoad: () => guardPermission('comite.ver'),
  component: QualityCommitteeRouteComponent,
});

function QualityCommitteeRouteComponent() {
  return <QualityCommitteePage />;
}
