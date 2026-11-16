import { listStakeholdersResponseSchema, type ListStakeholdersResponse } from '@sigoa/shared';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { StakeholderReader } from '../domain/ports/stakeholder-reader.js';
import type { SearchStakeholdersQuery } from './search-stakeholders.types.js';
import { mapStakeholderToDto } from './stakeholder-dto.js';

export interface SearchStakeholdersDependencies {
  readonly stakeholderReader: StakeholderReader;
  readonly permissionChecker: StakeholderPermissionChecker;
}

/**
 * Consulta paginada del registro maestro de constituyentes (HU-021, RF-021, RS-037).
 * Requiere `constituyente.ver` (GLOBAL); lectura pura sin auditoría.
 */
export class SearchStakeholdersUseCase {
  constructor(private readonly deps: SearchStakeholdersDependencies) {}

  async execute(query: SearchStakeholdersQuery): Promise<ListStakeholdersResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'constituyente.ver',
      scope: 'GLOBAL',
    });

    const trimmedSearch = query.search?.trim();
    const { items, total } = await this.deps.stakeholderReader.list({
      search: trimmedSearch && trimmedSearch.length > 0 ? trimmedSearch : undefined,
      kind: query.kind,
      status: query.status,
      document: query.document,
      page: query.page,
      pageSize: query.pageSize,
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);

    return listStakeholdersResponseSchema.parse({
      items: items.map(mapStakeholderToDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
    });
  }
}
