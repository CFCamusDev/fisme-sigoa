import { Link } from '@tanstack/react-router';
import type { TemplateSummaryDto } from '@sigoa/shared';
import { StatusBadge } from '@/components/common/status-badge';
import { buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatTemplateType, formatVersionLabel } from '../lib/template-labels';

export interface TemplatesTableProps {
  readonly templates: readonly TemplateSummaryDto[];
}

export function TemplatesTable({ templates }: TemplatesTableProps) {
  return (
    <Table>
      <caption className="sr-only">
        Plantillas oficiales con su versión publicada y su borrador
      </caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Código</TableHead>
          <TableHead scope="col">Nombre</TableHead>
          <TableHead scope="col">Tipo</TableHead>
          <TableHead scope="col">Publicada</TableHead>
          <TableHead scope="col">Borrador</TableHead>
          <TableHead scope="col">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => (
          <TableRow key={template.id}>
            <TableCell className="font-semibold text-foreground">{template.code}</TableCell>
            <TableCell className="text-foreground">{template.name}</TableCell>
            <TableCell className="text-foreground">{formatTemplateType(template.type)}</TableCell>
            <TableCell>
              {template.published ? (
                <span className="inline-flex flex-wrap items-center gap-2 text-foreground">
                  {formatVersionLabel(template.published.number)}
                  <StatusBadge status={template.published.status} />
                </span>
              ) : (
                <span className="text-muted-foreground">Sin publicar</span>
              )}
            </TableCell>
            <TableCell>
              {template.draft ? (
                <span className="inline-flex flex-wrap items-center gap-2 text-foreground">
                  {formatVersionLabel(template.draft.number)}
                  <StatusBadge status={template.draft.status} />
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <Link
                to="/plantillas/$templateId"
                params={{ templateId: template.id }}
                aria-label={`Abrir ${template.code}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Abrir
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
