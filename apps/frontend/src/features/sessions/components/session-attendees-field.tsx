import { useId, useMemo, useState } from 'react';
import {
  SESSION_ATTENDEE_POSITION_MAX_LENGTH,
  type SessionAttendeeRosterItem,
  type StakeholderListTypeValue,
} from '@sigoa/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface SessionAttendeesFieldProps {
  readonly items: readonly SessionAttendeeRosterItem[];
  readonly selected: ReadonlyMap<string, string>;
  readonly stakeholderType?: StakeholderListTypeValue;
  readonly disabled?: boolean;
  readonly onToggle: (member: SessionAttendeeRosterItem, checked: boolean) => void;
  readonly onPositionChange: (listMemberId: string, position: string) => void;
}

export function SessionAttendeesField({
  items,
  selected,
  stakeholderType,
  disabled = false,
  onToggle,
  onPositionChange,
}: SessionAttendeesFieldProps) {
  const baseId = useId();
  const searchId = `${baseId}-search`;
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((member) => {
      const nameMatch = member.fullName.toLowerCase().includes(query);
      const institutionMatch = member.institution?.toLowerCase().includes(query) ?? false;
      const rucMatch = member.ruc?.toLowerCase().includes(query) ?? false;
      const repMatch = member.representative?.toLowerCase().includes(query) ?? false;
      return nameMatch || institutionMatch || rucMatch || repMatch;
    });
  }, [items, search]);

  const countLabel = selected.size === 1 ? '1 asistente' : `${selected.size} asistentes`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-sm space-y-1.5">
          <Label htmlFor={searchId}>Buscar en la lista</Label>
          <Input
            id={searchId}
            type="search"
            value={search}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o institución…"
          />
        </div>
        <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
          {countLabel}
        </p>
      </div>

      <fieldset className="space-y-2 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium text-foreground">
          Miembros de la lista del Anexo 3
        </legend>

        {filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay miembros que coincidan con la búsqueda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filteredItems.map((member) => {
              const checkboxId = `${baseId}-member-${member.listMemberId}`;
              const positionId = `${baseId}-position-${member.listMemberId}`;
              const isChecked = selected.has(member.listMemberId);
              const positionValue = selected.get(member.listMemberId) ?? '';

              return (
                <li
                  key={member.listMemberId}
                  className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id={checkboxId}
                      checked={isChecked}
                      disabled={disabled}
                      onChange={(event) => onToggle(member, event.target.checked)}
                    />
                    <Label htmlFor={checkboxId} className="cursor-pointer font-normal">
                      <span className="font-medium text-foreground">{member.fullName}</span>
                      {stakeholderType === 'EMPLOYER' ? (
                        <>
                          {member.ruc && (
                            <span className="ml-1.5 text-muted-foreground">· RUC {member.ruc}</span>
                          )}
                          {member.representative && (
                            <span className="ml-1.5 text-muted-foreground">
                              · Representante: {member.representative}
                            </span>
                          )}
                          {member.institution && member.institution !== member.fullName && (
                            <span className="ml-1.5 text-muted-foreground">
                              · {member.institution}
                            </span>
                          )}
                        </>
                      ) : (
                        member.institution && (
                          <span className="ml-1.5 text-muted-foreground">
                            · {member.institution}
                          </span>
                        )
                      )}
                    </Label>
                  </div>

                  {isChecked && (
                    <div className="w-full sm:max-w-xs">
                      <Label htmlFor={positionId} className="sr-only">
                        Cargo de {member.fullName}
                      </Label>
                      <Input
                        id={positionId}
                        type="text"
                        value={positionValue}
                        maxLength={SESSION_ATTENDEE_POSITION_MAX_LENGTH}
                        disabled={disabled}
                        placeholder="Cargo en la sesión (opcional)"
                        onChange={(event) =>
                          onPositionChange(member.listMemberId, event.target.value)
                        }
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>
    </div>
  );
}
