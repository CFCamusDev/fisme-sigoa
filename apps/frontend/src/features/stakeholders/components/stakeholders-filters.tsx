import { useId, useState, type FormEvent } from 'react';
import type { StakeholderKindValue, StakeholderStatusValue } from '@sigoa/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export interface StakeholdersFiltersState {
  readonly search: string;
  readonly kind: StakeholderKindValue | '';
  readonly status: StakeholderStatusValue | '';
}

export interface StakeholdersFiltersProps {
  readonly value: StakeholdersFiltersState;
  readonly onApply: (next: StakeholdersFiltersState) => void;
}

export function StakeholdersFilters({ value, onApply }: StakeholdersFiltersProps) {
  const uid = useId();
  const [searchInput, setSearchInput] = useState(value.search);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply({
      ...value,
      search: searchInput.trim(),
    });
  }

  function handleReset() {
    setSearchInput('');
    onApply({ search: '', kind: '', status: '' });
  }

  const hasFilters = Boolean(value.search || value.kind || value.status);

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground md:grid-cols-4 md:items-end"
    >
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor={`${uid}-search`}>Buscar por nombre, DNI o RUC</Label>
        <div className="flex gap-2">
          <Input
            id={`${uid}-search`}
            type="search"
            placeholder="Ej. Ana Torres, 45678912 o 20123456789"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <Button type="submit">Buscar</Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-kind`}>Tipo</Label>
        <Select
          id={`${uid}-kind`}
          value={value.kind}
          onChange={(event) =>
            onApply({
              ...value,
              kind: event.target.value as StakeholderKindValue | '',
            })
          }
        >
          <option value="">Todos</option>
          <option value="PERSON">Persona</option>
          <option value="INSTITUTION">Institución</option>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-status`}>Estado</Label>
        <div className="flex gap-2">
          <Select
            id={`${uid}-status`}
            value={value.status}
            onChange={(event) =>
              onApply({
                ...value,
                status: event.target.value as StakeholderStatusValue | '',
              })
            }
          >
            <option value="">Todos</option>
            <option value="ACTIVE">Activo</option>
            <option value="VOIDED">Anulado</option>
          </Select>
          {hasFilters ? (
            <Button type="button" variant="outline" onClick={handleReset}>
              Limpiar
            </Button>
          ) : null}
        </div>
      </div>
    </form>
  );
}
