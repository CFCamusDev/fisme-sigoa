import { Link } from '@tanstack/react-router';
import type { CatalogVersionHistoryDto, CatalogVersionStatusValue } from '@sigoa/shared';
import { StatusBadge } from '@/components/common/status-badge';
import { formatDate } from '@/lib/date';

const TYPE_LABEL: Record<CatalogVersionHistoryDto['resolutions'][number]['type'], string> = {
  EDUCATIONAL_OBJECTIVE: 'Objetivos educacionales',
  GRADUATE_ATTRIBUTE: 'Atributos del graduado',
  IMPROVEMENT_PLAN: 'Plan de mejora',
};

export interface CatalogVersionHistoryPanelProps {
  readonly history: CatalogVersionHistoryDto;
  readonly status: CatalogVersionStatusValue;
  /** Título de la sección; por defecto «Resolución y vigencia». */
  readonly heading?: string;
  readonly headingLevel?: 2 | 3;
}

/** Hasta cuándo rige una versión: la vigente sigue rigiendo y una histórica tiene fecha de fin. */
function describeEnd(
  status: CatalogVersionStatusValue,
  validFrom: string | null,
  validUntil: string | null,
): string {
  if (status === 'APPROVED') {
    return 'Vigente actualmente';
  }
  if (validUntil) {
    return formatDate(validUntil);
  }
  return validFrom ? 'Sin fecha de término registrada' : '—';
}

/** Resolución y fechas de vigencia de una versión (HU-017, CA2, RN-021). Solo tokens de diseño. */
export function CatalogVersionHistoryPanel({
  history,
  status,
  heading = 'Resolución y vigencia',
  headingLevel = 2,
}: CatalogVersionHistoryPanelProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const hasResolutions = history.resolutions.length > 0;

  return (
    <section className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
      <Heading className="text-base font-semibold text-foreground">{heading}</Heading>

      {!hasResolutions && (
        <p className="mt-2 text-sm text-muted-foreground">Sin resolución registrada</p>
      )}

      <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-foreground">Vigente desde</dt>
          <dd className="text-foreground">{formatDate(history.validFrom)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">Vigente hasta</dt>
          <dd className="text-foreground">
            {describeEnd(status, history.validFrom, history.validUntil)}
          </dd>
        </div>
      </dl>

      {hasResolutions && (
        <ul className="mt-4 divide-y divide-border">
          {history.resolutions.map((resolution) => (
            <li
              key={resolution.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm"
            >
              <span className="font-semibold text-foreground">
                Resolución N.° {resolution.number}
              </span>
              <span className="text-muted-foreground">{TYPE_LABEL[resolution.type]}</span>
              <span className="text-foreground">Emitida el {formatDate(resolution.issuedOn)}</span>
              <StatusBadge status={resolution.status} />
              <span className="text-muted-foreground">
                {resolution.hasPdf ? 'PDF firmado disponible' : 'Sin PDF firmado'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-sm">
        <Link
          to="/resoluciones"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          Ver las resoluciones
        </Link>
      </p>
    </section>
  );
}
