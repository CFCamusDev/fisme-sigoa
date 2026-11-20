import { BadgeCheck, Pencil, UserCheck } from 'lucide-react';
import type { ActorCommitteeMembershipDto, QualityCommitteeDto } from '@sigoa/shared';
import { Can } from '@/components/common/can';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatCommitteePeriod, isCommitteeEditable } from '../lib/committee-dates';
import { getCommitteePositionLabel } from '../lib/committee-labels';

export interface CurrentCommitteeCardProps {
  readonly committee: QualityCommitteeDto;
  readonly actorMembership: ActorCommitteeMembershipDto | null;
  readonly onEditMembers: (committee: QualityCommitteeDto) => void;
}

export function CurrentCommitteeCard({
  committee,
  actorMembership,
  onEditMembers,
}: CurrentCommitteeCardProps) {
  const editable = isCommitteeEditable(committee.periodEnd);

  return (
    <section
      aria-labelledby="current-committee-heading"
      className="space-y-4 rounded-lg border border-border bg-card p-6 text-card-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="current-committee-heading" className="text-lg font-semibold text-foreground">
              Comité vigente
            </h2>
            <StatusBadge status="CURRENT" />
          </div>
          <p className="text-sm text-muted-foreground">
            Periodo: {formatCommitteePeriod(committee.periodStart, committee.periodEnd)}
          </p>
        </div>

        {editable && (
          <Can permission="comite.editar">
            <Button type="button" variant="outline" onClick={() => onEditMembers(committee)}>
              <Pencil className="mr-2 size-4" aria-hidden="true" />
              Editar miembros
            </Button>
          </Can>
        )}
      </div>

      {actorMembership && (
        <Alert variant="success">
          <BadgeCheck aria-hidden="true" />
          <AlertDescription>
            Eres miembro vigente del Comité ({getCommitteePositionLabel(actorMembership.position)}).
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">
                Nombre completo
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Grado académico
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Cargo
              </th>
              <th scope="col" className="py-2 font-medium">
                Cuenta vinculada
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {committee.members.map((member) => (
              <tr key={member.id}>
                <td className="py-3 pr-4 font-medium text-foreground">{member.fullName}</td>
                <td className="py-3 pr-4 text-foreground">{member.degree}</td>
                <td className="py-3 pr-4 text-foreground">
                  {getCommitteePositionLabel(member.position)}
                </td>
                <td className="py-3 text-muted-foreground">
                  {member.linkedUserName ? (
                    <span className="inline-flex items-center gap-1.5 text-foreground">
                      <UserCheck className="size-4 text-success" aria-hidden="true" />
                      <span>Vinculado a {member.linkedUserName}</span>
                    </span>
                  ) : (
                    <span>Sin cuenta vinculada</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
