import type { StakeholderImportRowStatusValue } from '@sigoa/shared';

export interface StakeholderImportRowBadgeConfig {
  readonly status: 'ACTIVE' | 'REGISTERED' | 'INACTIVE' | 'VOIDED';
  readonly label: string;
}

export const STAKEHOLDER_IMPORT_ROW_BADGE: Record<
  StakeholderImportRowStatusValue,
  StakeholderImportRowBadgeConfig
> = {
  NEW: { status: 'ACTIVE', label: 'Nuevo' },
  EXISTING: { status: 'REGISTERED', label: 'Ya registrado' },
  ALREADY_IN_LIST: { status: 'INACTIVE', label: 'Ya en la lista' },
  INVALID: { status: 'VOIDED', label: 'Con errores' },
};
