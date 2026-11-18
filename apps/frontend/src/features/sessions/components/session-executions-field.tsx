import { useId } from 'react';
import type { ProcessExecutionDto } from '@sigoa/shared';
import { Checkbox } from '@/components/ui/checkbox';

export interface SessionExecutionsFieldProps {
  readonly linkableExecutions: readonly ProcessExecutionDto[];
  readonly selectedIds: readonly string[];
  readonly lockedIds?: readonly string[];
  readonly isLoading?: boolean;
  readonly errorMessage?: string;
  readonly onChange: (nextIds: string[]) => void;
}

export function SessionExecutionsField({
  linkableExecutions,
  selectedIds,
  lockedIds = [],
  isLoading = false,
  errorMessage,
  onChange,
}: SessionExecutionsFieldProps) {
  const baseId = useId();
  const lockedSet = new Set(lockedIds);
  const linkableSet = new Set(linkableExecutions.map((e) => e.id));
  const extraLockedIds = selectedIds.filter((id) => !linkableSet.has(id) && lockedSet.has(id));

  function handleToggle(id: string, checked: boolean) {
    if (lockedSet.has(id) && !linkableSet.has(id)) {
      return;
    }
    if (checked) {
      if (!selectedIds.includes(id)) {
        onChange([...selectedIds, id]);
      }
      return;
    }
    onChange(selectedIds.filter((item) => item !== id));
  }

  return (
    <fieldset className="space-y-2 rounded-md border border-border bg-card p-3 text-card-foreground">
      <legend className="px-1 text-sm font-medium text-foreground">Ejecuciones vinculadas</legend>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando ejecuciones disponibles…</p>
      ) : linkableExecutions.length === 0 && extraLockedIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay ejecuciones en estado Planificado o En ejecución.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {linkableExecutions.map((execution) => {
            const checkboxId = `${baseId}-${execution.id}`;
            const isChecked = selectedIds.includes(execution.id);
            return (
              <label
                key={execution.id}
                htmlFor={checkboxId}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1 text-sm text-foreground hover:bg-muted"
              >
                <Checkbox
                  id={checkboxId}
                  checked={isChecked}
                  onChange={(event) => handleToggle(execution.id, event.target.checked)}
                />
                <span>{execution.name}</span>
              </label>
            );
          })}

          {extraLockedIds.map((executionId) => {
            const checkboxId = `${baseId}-locked-${executionId}`;
            return (
              <label
                key={executionId}
                htmlFor={checkboxId}
                className="flex items-center gap-2 rounded-sm px-1 py-1 text-sm text-muted-foreground"
              >
                <Checkbox id={checkboxId} checked disabled onChange={() => undefined} />
                <span>Ejecución vinculada ({executionId}) — cerrada</span>
              </label>
            );
          })}
        </div>
      )}

      {extraLockedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Las ejecuciones cerradas vinculadas previamente no pueden modificarse.
        </p>
      )}

      {errorMessage && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </fieldset>
  );
}
