import type { StakeholderDto } from '@sigoa/shared';
import { Can } from '@/components/common/can';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { STAKEHOLDER_KIND_LABELS, getStakeholderDocumentLabel } from '../lib/stakeholder-labels';

export interface DuplicateStakeholderAlertProps {
  readonly stakeholder: StakeholderDto;
  readonly onEditExisting?: (stakeholder: StakeholderDto) => void;
}

/** Aviso mostrado ante un 409 por documento duplicado con los datos del registro existente (CA2). */
export function DuplicateStakeholderAlert({
  stakeholder,
  onEditExisting,
}: DuplicateStakeholderAlertProps) {
  return (
    <Alert variant="warning" role="region" aria-label="Registro existente encontrado">
      <AlertTitle>Ya existe un constituyente con este documento</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{stakeholder.fullName}</span>
          <span>· {STAKEHOLDER_KIND_LABELS[stakeholder.kind]}</span>
          <span>· {getStakeholderDocumentLabel(stakeholder)}</span>
          <StatusBadge status={stakeholder.status} />
        </div>
        {stakeholder.status === 'ACTIVE' && onEditExisting ? (
          <Can permission="constituyente.editar">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEditExisting(stakeholder)}
            >
              Editar este constituyente
            </Button>
          </Can>
        ) : (
          <p className="text-xs">
            Este registro se encuentra anulado y conserva el documento de forma histórica.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
