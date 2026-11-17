import type {
  ListStakeholderListsResponse,
  StakeholderListDto,
  StakeholderListMemberDto,
} from '@sigoa/shared';

export const EMPLOYER_LIST_MEMBER: StakeholderListMemberDto = {
  id: 'mem-emp-1',
  listId: 'list-emp-2027',
  stakeholderId: 'stk-inst-1',
  fullName: 'Tech Amazonas SAC',
  institution: 'Tech Amazonas SAC',
  ruc: '20123456789',
  sector: 'Tecnologia',
  representative: 'Carlos Mendoza',
  activity: null,
  email: 'contacto@techamazonas.pe',
  mobile: '987654321',
  position: 'Gerencia TI',
  graduationYear: null,
  cycle: null,
  createdAt: '2026-11-16T10:10:00.000Z',
};

export const GRADUATE_LIST_MEMBER: StakeholderListMemberDto = {
  id: 'mem-grad-1',
  listId: 'list-grad-2027',
  stakeholderId: 'stk-person-1',
  fullName: 'Ana Lucia Torres',
  institution: null,
  ruc: null,
  sector: null,
  representative: null,
  activity: null,
  email: 'ana.torres@example.com',
  mobile: '987654321',
  position: null,
  graduationYear: 2022,
  cycle: null,
  createdAt: '2026-11-16T10:10:00.000Z',
};

export const EMPLOYER_LIST_DTO: StakeholderListDto = {
  id: 'list-emp-2027',
  programId: 'prog-1',
  type: 'EMPLOYER',
  year: 2027,
  studyPlanNumber: '2024-II',
  version: 'v1.0',
  memberCount: 1,
  members: [EMPLOYER_LIST_MEMBER],
  createdAt: '2026-11-16T10:00:00.000Z',
  updatedAt: '2026-11-16T10:00:00.000Z',
};

export const GRADUATE_LIST_DTO: StakeholderListDto = {
  id: 'list-grad-2027',
  programId: 'prog-1',
  type: 'GRADUATE',
  year: 2027,
  studyPlanNumber: null,
  version: null,
  memberCount: 0,
  members: [],
  createdAt: '2026-11-16T10:00:00.000Z',
  updatedAt: '2026-11-16T10:00:00.000Z',
};

export function makeStakeholderListsResponse(
  items: StakeholderListDto[] = [EMPLOYER_LIST_DTO],
): ListStakeholderListsResponse {
  return {
    items,
    page: 1,
    pageSize: 20,
    total: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  };
}
