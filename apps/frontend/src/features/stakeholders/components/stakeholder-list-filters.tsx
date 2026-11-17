import { useId, useState, type FormEvent } from 'react';
import {
  STAKEHOLDER_LIST_TYPES,
  STAKEHOLDER_LIST_YEAR_MAX,
  STAKEHOLDER_LIST_YEAR_MIN,
  type StakeholderListTypeValue,
} from '@sigoa/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { STAKEHOLDER_LIST_TYPE_LABELS } from '../lib/stakeholder-list-labels';

export interface StakeholderListFiltersValue {
  readonly type: StakeholderListTypeValue;
  readonly year: number;
}

export interface StakeholderListFiltersProps {
  readonly value: StakeholderListFiltersValue;
  readonly onApply: (next: StakeholderListFiltersValue) => void;
}

export function StakeholderListFilters({ value, onApply }: StakeholderListFiltersProps) {
  const uid = useId();
  const [typeInput, setTypeInput] = useState<StakeholderListTypeValue>(value.type);
  const [yearInput, setYearInput] = useState(String(value.year));
  const [yearError, setYearError] = useState<string | null>(null);

  if (value.type !== typeInput && document.activeElement?.id !== `${uid}-type`) {
    setTypeInput(value.type);
  }
  if (String(value.year) !== yearInput && document.activeElement?.id !== `${uid}-year`) {
    setYearInput(String(value.year));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedYear = Number(yearInput);
    if (
      !Number.isInteger(parsedYear) ||
      parsedYear < STAKEHOLDER_LIST_YEAR_MIN ||
      parsedYear > STAKEHOLDER_LIST_YEAR_MAX
    ) {
      setYearError(
        `El año debe ser un entero entre ${STAKEHOLDER_LIST_YEAR_MIN} y ${STAKEHOLDER_LIST_YEAR_MAX}.`,
      );
      return;
    }
    setYearError(null);
    onApply({ type: typeInput, year: parsedYear });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground md:grid-cols-4 md:items-end"
    >
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`${uid}-type`}>Tipo de lista</Label>
        <Select
          id={`${uid}-type`}
          value={typeInput}
          onChange={(event) => setTypeInput(event.target.value as StakeholderListTypeValue)}
        >
          {STAKEHOLDER_LIST_TYPES.map((typeOption) => (
            <option key={typeOption} value={typeOption}>
              {STAKEHOLDER_LIST_TYPE_LABELS[typeOption]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-year`}>Año</Label>
        <Input
          id={`${uid}-year`}
          type="number"
          min={STAKEHOLDER_LIST_YEAR_MIN}
          max={STAKEHOLDER_LIST_YEAR_MAX}
          value={yearInput}
          onChange={(event) => setYearInput(event.target.value)}
        />
        {yearError ? <p className="text-xs text-destructive">{yearError}</p> : null}
      </div>

      <div>
        <Button type="submit" variant="outline" className="w-full md:w-auto">
          Ver lista
        </Button>
      </div>
    </form>
  );
}
