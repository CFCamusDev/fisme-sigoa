import { useId, useState, type FormEvent } from 'react';
import {
  STAKEHOLDER_LIST_YEAR_MAX,
  type CopyStakeholderListResponse,
  type StakeholderListDto,
} from '@sigoa/shared';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCopyStakeholderList } from '../hooks/use-copy-stakeholder-list';
import { getStakeholderListErrorMessage } from '../lib/stakeholder-list-error-message';
import { STAKEHOLDER_LIST_TYPE_LABELS } from '../lib/stakeholder-list-labels';

export interface CopyStakeholderListFormProps {
  readonly sourceList: StakeholderListDto;
  readonly onCopied: (response: CopyStakeholderListResponse) => void;
  readonly onCancel: () => void;
}

export function CopyStakeholderListForm({
  sourceList,
  onCopied,
  onCancel,
}: CopyStakeholderListFormProps) {
  const uid = useId();
  const [targetYear, setTargetYear] = useState(String(sourceList.year + 1));
  const [formError, setFormError] = useState<string | null>(null);

  const copyMutation = useCopyStakeholderList();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedYear = Number(targetYear);
    if (
      !Number.isInteger(parsedYear) ||
      parsedYear <= sourceList.year ||
      parsedYear > STAKEHOLDER_LIST_YEAR_MAX
    ) {
      setFormError(
        `El año destino debe ser un entero entre ${sourceList.year + 1} y ${STAKEHOLDER_LIST_YEAR_MAX}.`,
      );
      return;
    }

    setFormError(null);
    try {
      const result = await copyMutation.mutateAsync({
        sourceListId: sourceList.id,
        year: parsedYear,
      });
      onCopied(result);
    } catch (error) {
      setFormError(getStakeholderListErrorMessage(error));
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6 text-card-foreground">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">
          Copiar lista de {STAKEHOLDER_LIST_TYPE_LABELS[sourceList.type]} {sourceList.year}
        </h3>
        <p className="text-sm text-muted-foreground">
          Se creará una nueva lista para el año destino con los miembros activos y completos del
          registro maestro.
        </p>
      </div>
      <div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError ? (
            <Alert variant="danger" role="alert">
              <AlertTriangle className="size-4" aria-hidden="true" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="max-w-xs space-y-1.5">
            <Label htmlFor={`${uid}-target-year`}>Año destino</Label>
            <Input
              id={`${uid}-target-year`}
              type="number"
              min={sourceList.year + 1}
              max={STAKEHOLDER_LIST_YEAR_MAX}
              value={targetYear}
              onChange={(event) => setTargetYear(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={copyMutation.isPending}>
              {copyMutation.isPending ? 'Copiando…' : 'Copiar lista'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={copyMutation.isPending}
              onClick={onCancel}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
