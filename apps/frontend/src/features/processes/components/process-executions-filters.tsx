import { useId } from 'react';
import {
  PROCESS_EXECUTION_STATUSES,
  PROCESS_EXECUTION_YEAR_MAX,
  PROCESS_EXECUTION_YEAR_MIN,
  PROCESS_TYPES,
  type ProcessExecutionStatusValue,
  type ProcessTypeValue,
} from '@sigoa/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { STATUS } from '@/lib/status';
import { PROCESS_TYPE_LABELS } from '../lib/process-type-labels';

export interface ProcessExecutionsFiltersState {
  readonly type: ProcessTypeValue | '';
  readonly year: string;
  readonly status: ProcessExecutionStatusValue | '';
}

export interface ProcessExecutionsFiltersProps {
  readonly value: ProcessExecutionsFiltersState;
  readonly onChange: (next: ProcessExecutionsFiltersState) => void;
  readonly onReset: () => void;
}

export function ProcessExecutionsFilters({
  value,
  onChange,
  onReset,
}: ProcessExecutionsFiltersProps) {
  const uid = useId();
  const hasActive = Boolean(value.type || value.year || value.status);

  return (
    <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground md:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-filter-type`}>Proceso</Label>
        <Select
          id={`${uid}-filter-type`}
          value={value.type}
          onChange={(event) =>
            onChange({ ...value, type: event.target.value as ProcessTypeValue | '' })
          }
        >
          <option value="">Todos los procesos</option>
          {PROCESS_TYPES.map((type) => (
            <option key={type} value={type}>
              {PROCESS_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-filter-year`}>Año</Label>
        <Input
          id={`${uid}-filter-year`}
          type="number"
          min={PROCESS_EXECUTION_YEAR_MIN}
          max={PROCESS_EXECUTION_YEAR_MAX}
          placeholder="Todos los años"
          value={value.year}
          onChange={(event) => onChange({ ...value, year: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-filter-status`}>Estado</Label>
        <Select
          id={`${uid}-filter-status`}
          value={value.status}
          onChange={(event) =>
            onChange({
              ...value,
              status: event.target.value as ProcessExecutionStatusValue | '',
            })
          }
        >
          <option value="">Todos los estados</option>
          {PROCESS_EXECUTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS[status].label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-end">
        <Button type="button" variant="outline" onClick={onReset} disabled={!hasActive}>
          Limpiar filtros
        </Button>
      </div>
    </div>
  );
}
