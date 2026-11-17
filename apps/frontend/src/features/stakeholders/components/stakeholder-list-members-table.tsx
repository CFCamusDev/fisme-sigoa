import type { StakeholderListMemberDto, StakeholderListTypeValue } from '@sigoa/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  STAKEHOLDER_LIST_COLUMNS,
  STAKEHOLDER_LIST_TYPE_LABELS,
} from '../lib/stakeholder-list-labels';

export interface StakeholderListMembersTableProps {
  readonly type: StakeholderListTypeValue;
  readonly year: number;
  readonly members: readonly StakeholderListMemberDto[];
}

export function StakeholderListMembersTable({
  type,
  year,
  members,
}: StakeholderListMembersTableProps) {
  const columns = STAKEHOLDER_LIST_COLUMNS[type];

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card text-card-foreground">
      <Table>
        <caption className="sr-only">
          Miembros de la lista de {STAKEHOLDER_LIST_TYPE_LABELS[type]} {year}
        </caption>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} scope="col">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              {columns.map((column, index) => {
                const raw = member[column.key];
                const display = raw === null || raw === undefined ? '—' : String(raw);
                return (
                  <TableCell
                    key={column.key}
                    className={index === 0 ? 'font-medium text-foreground' : 'text-foreground'}
                  >
                    {display}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
