import type { StakeholderListType } from '../entities/stakeholder-list-enums.js';

export const STAKEHOLDER_IMPORT_COLUMN_KEYS = [
  'document',
  'fullName',
  'institution',
  'sector',
  'representative',
  'activity',
  'position',
  'graduationYear',
  'cycle',
  'email',
  'mobile',
] as const;

export type StakeholderImportColumnKey = (typeof STAKEHOLDER_IMPORT_COLUMN_KEYS)[number];

export interface StakeholderImportColumnDefinition {
  readonly key: StakeholderImportColumnKey;
  readonly header: string;
  readonly textFormat?: boolean;
  readonly integerFormat?: boolean;
}

export const STAKEHOLDER_IMPORT_COLUMNS_BY_TYPE: Record<
  StakeholderListType,
  readonly StakeholderImportColumnDefinition[]
> = {
  EMPLOYER: [
    { key: 'document', header: 'RUC', textFormat: true },
    { key: 'fullName', header: 'Institución' },
    { key: 'sector', header: 'Sector' },
    { key: 'representative', header: 'Representante' },
    { key: 'email', header: 'Correo' },
    { key: 'mobile', header: 'Celular', textFormat: true },
    { key: 'position', header: 'Cargo' },
  ],
  ADVISORY_BOARD: [
    { key: 'document', header: 'DNI o RUC', textFormat: true },
    { key: 'fullName', header: 'Nombre o razón social' },
    { key: 'institution', header: 'Institución' },
    { key: 'activity', header: 'Actividad' },
    { key: 'email', header: 'Correo' },
    { key: 'mobile', header: 'Celular', textFormat: true },
  ],
  GRADUATE: [
    { key: 'document', header: 'DNI', textFormat: true },
    { key: 'fullName', header: 'Nombres completos' },
    { key: 'graduationYear', header: 'Año de egreso', integerFormat: true },
    { key: 'email', header: 'Correo' },
    { key: 'mobile', header: 'Celular', textFormat: true },
  ],
  STUDENT: [
    { key: 'document', header: 'DNI', textFormat: true },
    { key: 'fullName', header: 'Nombres completos' },
    { key: 'cycle', header: 'Ciclo' },
    { key: 'email', header: 'Correo' },
    { key: 'mobile', header: 'Celular', textFormat: true },
  ],
  TEACHER: [
    { key: 'document', header: 'DNI', textFormat: true },
    { key: 'fullName', header: 'Nombres completos' },
    { key: 'email', header: 'Correo' },
    { key: 'mobile', header: 'Celular', textFormat: true },
  ],
};

export function getStakeholderImportColumns(
  listType: StakeholderListType,
): readonly StakeholderImportColumnDefinition[] {
  return STAKEHOLDER_IMPORT_COLUMNS_BY_TYPE[listType];
}
