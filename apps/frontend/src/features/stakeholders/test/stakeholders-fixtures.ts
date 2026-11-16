import type { ListStakeholdersResponse, StakeholderDto } from '@sigoa/shared';

export const PERSON_STAKEHOLDER: StakeholderDto = {
  id: 'stk-person-1',
  kind: 'PERSON',
  fullName: 'Ana Lucia Torres',
  dni: '45678912',
  ruc: null,
  email: 'ana.torres@example.com',
  mobile: '987654321',
  position: 'Egresada',
  institution: 'UNTRM',
  sector: 'Educacion',
  graduationYear: 2022,
  cycle: null,
  status: 'ACTIVE',
  voidReason: null,
  voidedAt: null,
  voidedBy: null,
  createdAt: '2026-11-16T10:00:00.000Z',
  updatedAt: '2026-11-16T10:00:00.000Z',
};

export const INSTITUTION_STAKEHOLDER: StakeholderDto = {
  id: 'stk-inst-1',
  kind: 'INSTITUTION',
  fullName: 'Tech Amazonas SAC',
  dni: null,
  ruc: '20123456789',
  email: 'contacto@techamazonas.pe',
  mobile: null,
  position: 'Gerencia TI',
  institution: null,
  sector: 'Tecnologia',
  graduationYear: null,
  cycle: null,
  status: 'ACTIVE',
  voidReason: null,
  voidedAt: null,
  voidedBy: null,
  createdAt: '2026-11-16T10:05:00.000Z',
  updatedAt: '2026-11-16T10:05:00.000Z',
};

export const VOIDED_STAKEHOLDER: StakeholderDto = {
  id: 'stk-void-1',
  kind: 'PERSON',
  fullName: 'Mario Vega',
  dni: '33445566',
  ruc: null,
  email: null,
  mobile: null,
  position: 'Empleador',
  institution: 'Norte SAC',
  sector: 'Servicios',
  graduationYear: null,
  cycle: null,
  status: 'VOIDED',
  voidReason: 'Constituyente dado de baja por solicitud expresa',
  voidedAt: '2026-11-16T12:00:00.000Z',
  voidedBy: 'usr-1',
  createdAt: '2026-11-16T09:00:00.000Z',
  updatedAt: '2026-11-16T12:00:00.000Z',
};

export function makeListResponse(
  items: StakeholderDto[],
  overrides: Partial<Omit<ListStakeholdersResponse, 'items'>> = {},
): ListStakeholdersResponse {
  const total = overrides.total ?? items.length;
  const pageSize = overrides.pageSize ?? 20;
  return {
    items,
    page: overrides.page ?? 1,
    pageSize,
    total,
    totalPages: overrides.totalPages ?? (total === 0 ? 0 : Math.ceil(total / pageSize)),
  };
}
