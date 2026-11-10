import { programDtoSchema, type ProgramDto } from '@sigoa/shared';
import { ProgramNotFoundError } from '../domain/errors/program-not-found-error.js';
import type { ParametersPermissionChecker } from '../domain/ports/parameters-permission-checker.js';
import type { ProgramReader } from '../domain/ports/program-reader.js';
import type { GetProgramQuery } from './get-program.types.js';
import { mapProgramToDto } from './program-dto.js';

export interface GetProgramUseCaseDependencies {
  readonly programReader: ProgramReader;
  readonly permissionChecker: ParametersPermissionChecker;
}

export class GetProgramUseCase {
  constructor(private readonly deps: GetProgramUseCaseDependencies) {}

  async execute(query: GetProgramQuery): Promise<ProgramDto> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'parametro.ver',
      scope: 'GLOBAL',
    });

    const program = await this.deps.programReader.getCurrent();
    if (!program) {
      throw new ProgramNotFoundError('No existe un programa configurado.');
    }

    const dto = mapProgramToDto(program);
    return programDtoSchema.parse(dto);
  }
}
