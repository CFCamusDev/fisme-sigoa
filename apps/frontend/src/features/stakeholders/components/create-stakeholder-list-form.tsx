import { useId, useState, type FormEvent } from 'react';
import {
  STAKEHOLDER_LIST_STUDY_PLAN_NUMBER_MAX_LENGTH,
  STAKEHOLDER_LIST_VERSION_MAX_LENGTH,
  type StakeholderListDto,
  type StakeholderListTypeValue,
} from '@sigoa/shared';
import { AlertTriangle } from 'lucide-react';
import { useReportBusy } from '@/components/common/form-busy-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateStakeholderList } from '../hooks/use-create-stakeholder-list';
import { getStakeholderListErrorMessage } from '../lib/stakeholder-list-error-message';
import { STAKEHOLDER_LIST_TYPE_LABELS } from '../lib/stakeholder-list-labels';

export interface CreateStakeholderListFormProps {
  readonly type: StakeholderListTypeValue;
  readonly year: number;
  readonly inDialog?: boolean;
  readonly onCancel?: () => void;
  readonly onCreated: (list: StakeholderListDto) => void;
}

export function CreateStakeholderListForm({
  type,
  year,
  inDialog = false,
  onCancel,
  onCreated,
}: CreateStakeholderListFormProps) {
  const uid = useId();
  const [studyPlanNumber, setStudyPlanNumber] = useState('');
  const [version, setVersion] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useCreateStakeholderList();
  useReportBusy(createMutation.isPending);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPlan = studyPlanNumber.trim();
    const trimmedVersion = version.trim();

    if (trimmedPlan.length > STAKEHOLDER_LIST_STUDY_PLAN_NUMBER_MAX_LENGTH) {
      setFormError(
        `El número de plan de estudios no puede exceder ${STAKEHOLDER_LIST_STUDY_PLAN_NUMBER_MAX_LENGTH} caracteres.`,
      );
      return;
    }
    if (trimmedVersion.length > STAKEHOLDER_LIST_VERSION_MAX_LENGTH) {
      setFormError(
        `La versión no puede exceder ${STAKEHOLDER_LIST_VERSION_MAX_LENGTH} caracteres.`,
      );
      return;
    }

    setFormError(null);
    try {
      const created = await createMutation.mutateAsync({
        type,
        year,
        studyPlanNumber: trimmedPlan || null,
        version: trimmedVersion || null,
      });
      onCreated(created);
    } catch (error) {
      setFormError(getStakeholderListErrorMessage(error));
    }
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError ? (
        <Alert variant="danger" role="alert">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-plan`}>N.° de plan de estudios (opcional)</Label>
          <Input
            id={`${uid}-plan`}
            type="text"
            maxLength={STAKEHOLDER_LIST_STUDY_PLAN_NUMBER_MAX_LENGTH}
            value={studyPlanNumber}
            onChange={(event) => setStudyPlanNumber(event.target.value)}
            placeholder="Ej. 2024-II"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${uid}-version`}>Versión (opcional)</Label>
          <Input
            id={`${uid}-version`}
            type="text"
            maxLength={STAKEHOLDER_LIST_VERSION_MAX_LENGTH}
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder="Ej. v1.0"
          />
        </div>
      </div>

      <div className={inDialog ? 'flex justify-end gap-2 pt-2' : undefined}>
        {inDialog && onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={createMutation.isPending}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Guardando…' : 'Crear lista'}
        </Button>
      </div>
    </form>
  );

  if (inDialog) {
    return formContent;
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-card-foreground">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          Crear lista de {STAKEHOLDER_LIST_TYPE_LABELS[type]} {year}
        </h2>
        <p className="text-sm text-muted-foreground">
          Completa los datos opcionales de cabecera del Anexo 3 para habilitar la lista.
        </p>
      </div>
      <div>{formContent}</div>
    </div>
  );
}
