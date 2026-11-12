import { listSemestersResponseSchema, type ListSemestersResponse } from '@sigoa/shared';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { SemesterReader } from '../domain/ports/semester-reader.js';
import type { ListSemestersQuery } from './list-semesters.types.js';
import { mapSemesterToDto } from './semester-dto.js';

export interface ListSemestersDependencies {
  readonly semesterReader: SemesterReader;
  readonly permissionChecker: ParametersPermissionChecker;
}

export class ListSemestersUseCase {
  private readonly semesterReader: SemesterReader;
  private readonly permissionChecker: ParametersPermissionChecker;

  constructor(deps: ListSemestersDependencies) {
    this.semesterReader = deps.semesterReader;
    this.permissionChecker = deps.permissionChecker;
  }

  async execute(query: ListSemestersQuery): Promise<ListSemestersResponse> {
    await this.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'parametro.ver',
      scope: 'GLOBAL',
    });

    const semesters = await this.semesterReader.list();
    const items = semesters.map(mapSemesterToDto);

    return listSemestersResponseSchema.parse({ items });
  }
}
