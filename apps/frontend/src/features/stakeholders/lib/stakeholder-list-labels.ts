import type {
  StakeholderKindValue,
  StakeholderListMemberDto,
  StakeholderListTypeValue,
} from '@sigoa/shared';

export const STAKEHOLDER_LIST_TYPE_LABELS: Record<StakeholderListTypeValue, string> = {
  ADVISORY_BOARD: 'Comité Consultivo',
  EMPLOYER: 'Empleadores',
  GRADUATE: 'Graduados',
  STUDENT: 'Estudiantes',
  TEACHER: 'Docentes',
};

export interface StakeholderListColumnDefinition {
  readonly key: keyof Pick<
    StakeholderListMemberDto,
    | 'fullName'
    | 'institution'
    | 'ruc'
    | 'sector'
    | 'representative'
    | 'activity'
    | 'email'
    | 'mobile'
    | 'position'
    | 'graduationYear'
    | 'cycle'
  >;
  readonly label: string;
}

export const STAKEHOLDER_LIST_COLUMNS: Record<
  StakeholderListTypeValue,
  readonly StakeholderListColumnDefinition[]
> = {
  ADVISORY_BOARD: [
    { key: 'fullName', label: 'Nombre' },
    { key: 'activity', label: 'Actividad' },
    { key: 'institution', label: 'Institución' },
    { key: 'email', label: 'Correo' },
    { key: 'mobile', label: 'Celular' },
  ],
  EMPLOYER: [
    { key: 'institution', label: 'Institución' },
    { key: 'ruc', label: 'RUC' },
    { key: 'sector', label: 'Sector' },
    { key: 'representative', label: 'Representante' },
    { key: 'email', label: 'Correo' },
    { key: 'mobile', label: 'Celular' },
    { key: 'position', label: 'Cargo' },
  ],
  GRADUATE: [
    { key: 'fullName', label: 'Nombres' },
    { key: 'graduationYear', label: 'Año de egreso' },
    { key: 'email', label: 'Correo' },
    { key: 'mobile', label: 'Celular' },
  ],
  STUDENT: [
    { key: 'fullName', label: 'Nombres' },
    { key: 'cycle', label: 'Ciclo' },
    { key: 'email', label: 'Correo' },
    { key: 'mobile', label: 'Celular' },
  ],
  TEACHER: [
    { key: 'fullName', label: 'Nombres' },
    { key: 'email', label: 'Correo' },
    { key: 'mobile', label: 'Celular' },
  ],
};

export interface StakeholderListExtraFieldConfig {
  readonly key: 'activity' | 'representative';
  readonly label: string;
  readonly placeholder: string;
}

export const STAKEHOLDER_LIST_EXTRA_FIELD: Partial<
  Record<StakeholderListTypeValue, StakeholderListExtraFieldConfig>
> = {
  ADVISORY_BOARD: {
    key: 'activity',
    label: 'Actividad',
    placeholder: 'Ej. Evaluación curricular',
  },
  EMPLOYER: {
    key: 'representative',
    label: 'Representante legal',
    placeholder: 'Nombre completo del representante',
  },
};

export const STAKEHOLDER_LIST_PICKER_KIND: Record<
  StakeholderListTypeValue,
  StakeholderKindValue | undefined
> = {
  ADVISORY_BOARD: undefined,
  EMPLOYER: 'INSTITUTION',
  GRADUATE: 'PERSON',
  STUDENT: 'PERSON',
  TEACHER: 'PERSON',
};
