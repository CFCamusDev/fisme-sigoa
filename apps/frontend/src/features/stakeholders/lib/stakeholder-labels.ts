import type { StakeholderDto, StakeholderKindValue } from '@sigoa/shared';

export const STAKEHOLDER_KIND_LABELS: Record<StakeholderKindValue, string> = {
  PERSON: 'Persona',
  INSTITUTION: 'Institución',
};

export function getStakeholderDocumentLabel(
  stakeholder: Pick<StakeholderDto, 'kind' | 'dni' | 'ruc'>,
): string {
  if (stakeholder.kind === 'PERSON') {
    return stakeholder.dni ? `DNI ${stakeholder.dni}` : 'Sin DNI';
  }
  return stakeholder.ruc ? `RUC ${stakeholder.ruc}` : 'Sin RUC';
}
