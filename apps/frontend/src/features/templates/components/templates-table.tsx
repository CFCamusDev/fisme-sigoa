import type { TemplateSummaryDto } from '@sigoa/shared';
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
import { formatTemplateType, formatVersionLabel } from '../lib/template-labels';

export interface TemplatesTableProps {
  readonly templates: readonly TemplateSummaryDto[];
  readonly selectedId?: string;
  readonly onOpen: (templateId: string) => void;
  /** Con cambios sin guardar solo la plantilla abierta sigue disponible. */
  readonly openDisabled?: boolean;
  readonly disabledHintId?: string;
}

export function TemplatesTable({
  templates,
  selectedId,
  onOpen,
  openDisabled = false,
  disabledHintId,
}: TemplatesTableProps) {
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
        {templates.map((template) => {
          const selected = template.id === selectedId;
          return (
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
                <Button
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  size="sm"
                  aria-label={`Abrir ${template.code}`}
                  aria-current={selected ? 'true' : undefined}
                  aria-describedby={openDisabled && !selected ? disabledHintId : undefined}
                  disabled={openDisabled && !selected}
                  onClick={() => onOpen(template.id)}
                >
                  Abrir
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
