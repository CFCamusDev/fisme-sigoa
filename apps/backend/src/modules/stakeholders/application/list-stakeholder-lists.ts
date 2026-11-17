import {
  listStakeholderListsResponseSchema,
  type ListStakeholderListsResponse,
} from '@sigoa/shared';
import type { StakeholderListReader } from '../domain/ports/stakeholder-list-reader.js';
import type { StakeholderPermissionChecker } from '../domain/ports/stakeholder-permission-checker.js';
import type { ListStakeholderListsQueryInput } from './list-stakeholder-lists.types.js';
import { mapStakeholderListToDto } from './stakeholder-list-dto.js';

export interface ListStakeholderListsDependencies {
  readonly stakeholderListReader: StakeholderListReader;
  readonly permissionChecker: StakeholderPermissionChecker;
}

/**
 * Lista las listas del Anexo 3 filtradas por tipo y año, incluyendo miembros solo cuando se
 * solicitan explícitamente (HU-022, RF-022, RS-002, RNF-012).
 */
export class ListStakeholderListsUseCase {
  constructor(private readonly deps: ListStakeholderListsDependencies) {}

  async execute(query: ListStakeholderListsQueryInput): Promise<ListStakeholderListsResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'constituyente.ver',
      scope: 'GLOBAL',
    });

    const pageResult = await this.deps.stakeholderListReader.list({
      type: query.type,
      year: query.year,
      includeMembers: query.includeMembers,
      page: query.page,
      pageSize: query.pageSize,
    });

    const totalPages = pageResult.total === 0 ? 0 : Math.ceil(pageResult.total / query.pageSize);

    return listStakeholderListsResponseSchema.parse({
      items: pageResult.items.map((item) =>
        mapStakeholderListToDto(item.list, item.memberCount, item.members),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total: pageResult.total,
      totalPages,
    });
  }
}
