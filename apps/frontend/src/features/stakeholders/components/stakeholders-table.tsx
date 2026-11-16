import { Fragment } from 'react';
import type { StakeholderDto } from '@sigoa/shared';
import { Can } from '@/components/common/can';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/date';
import { STAKEHOLDER_KIND_LABELS, getStakeholderDocumentLabel } from '../lib/stakeholder-labels';

export interface StakeholdersTableProps {
  readonly items: readonly StakeholderDto[];
  readonly onEdit: (stakeholder: StakeholderDto) => void;
  readonly onVoid: (stakeholder: StakeholderDto) => void;
}

export function StakeholdersTable({ items, onEdit, onVoid }: StakeholdersTableProps) {
  return (
    <div className="rounded-lg border border-border bg-card text-card-foreground">
      <Table>
        <caption className="sr-only">Registro maestro de constituyentes</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Nombre o razón social</TableHead>
            <TableHead scope="col">Tipo</TableHead>
            <TableHead scope="col">Documento</TableHead>
            <TableHead scope="col">Cargo / Institución</TableHead>
            <TableHead scope="col">Estado</TableHead>
            <TableHead scope="col" className="text-right">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const detailParts = [item.position, item.institution].filter((part): part is string =>
              Boolean(part),
            );
            const detail = detailParts.length > 0 ? detailParts.join(' · ') : '—';

            return (
              <Fragment key={item.id}>
                <TableRow>
                  <TableCell className="font-medium text-foreground">{item.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {STAKEHOLDER_KIND_LABELS[item.kind]}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {getStakeholderDocumentLabel(item)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{detail}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {item.status === 'ACTIVE' ? (
                      <Can permission="constituyente.editar">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(item)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onVoid(item)}
                          >
                            Anular
                          </Button>
                        </div>
                      </Can>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin acciones</span>
                    )}
                  </TableCell>
                </TableRow>
                {item.status === 'VOIDED' && item.voidReason ? (
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={6} className="py-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Motivo de anulación:</span>{' '}
                      {item.voidReason}
                      {item.voidedAt ? ` (${formatDate(item.voidedAt)})` : ''}
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
