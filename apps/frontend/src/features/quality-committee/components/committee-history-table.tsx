import { Pencil } from 'lucide-react';
import type { QualityCommitteeDto, QualityCommitteeListResponse } from '@sigoa/shared';
import { Can } from '@/components/common/can';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { formatCommitteePeriod, isCommitteeEditable } from '../lib/committee-dates';

export interface CommitteeHistoryTableProps {
  readonly data: QualityCommitteeListResponse;
  readonly onPageChange: (page: number) => void;
  readonly onEditMembers: (committee: QualityCommitteeDto) => void;
}

export function CommitteeHistoryTable({
  data,
  onPageChange,
  onEditMembers,
}: CommitteeHistoryTableProps) {
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <section
      aria-labelledby="committee-history-heading"
      className="space-y-4 rounded-lg border border-border bg-card p-6 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 id="committee-history-heading" className="text-lg font-semibold text-foreground">
          Historial de Comités
        </h2>
        <p className="text-sm text-muted-foreground">
          Registro histórico de periodos del Comité de Calidad. Los periodos finalizados no pueden
          modificarse.
        </p>
      </div>

      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay Comités registrados en el historial.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Periodo
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Miembros
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Estado
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((committee) => {
                  const editable = isCommitteeEditable(committee.periodEnd);
                  const memberCount = committee.members.length;
                  const memberLabel = memberCount === 1 ? '1 miembro' : `${memberCount} miembros`;

                  return (
                    <tr key={committee.id}>
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {formatCommitteePeriod(committee.periodStart, committee.periodEnd)}
                      </td>
                      <td className="py-3 pr-4 text-foreground">{memberLabel}</td>
                      <td className="py-3 pr-4">
                        {committee.isCurrent ? (
                          <StatusBadge status="CURRENT" />
                        ) : (
                          <StatusBadge status={editable ? 'PLANNED' : 'HISTORICAL'} />
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {editable ? (
                          <Can permission="comite.editar">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onEditMembers(committee)}
                            >
                              <Pencil className="mr-1.5 size-3.5" aria-hidden="true" />
                              Editar miembros
                            </Button>
                          </Can>
                        ) : (
                          <span className="text-xs text-muted-foreground">Solo lectura</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">
                Página {data.page} de {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => onPageChange(data.page - 1)}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={data.page >= totalPages}
                  onClick={() => onPageChange(data.page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
