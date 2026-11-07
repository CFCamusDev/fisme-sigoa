import type { UserAccessDto } from '@sigoa/shared';
import { UserAccessSubjectNotFoundError } from '../domain/errors/user-access-subject-not-found-error.js';
import type { UserAccessSubjectRepository } from '../domain/ports/user-access-subject-repository.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';
import type { UserAccessAssembler } from './user-access-assembler.js';

export interface GetUserEffectiveAccessDependencies {
  readonly subject: UserAccessSubjectRepository;
  readonly authorizer: PermissionAuthorizer;
  readonly assembler: UserAccessAssembler;
}

export class GetUserEffectiveAccessUseCase {
  constructor(private readonly deps: GetUserEffectiveAccessDependencies) {}

  async execute(command: { actorId: string; userId: string }): Promise<UserAccessDto> {
    await this.deps.authorizer.assertAllowed({
      actorId: command.actorId,
      permission: 'usuario.ver',
      scope: 'GLOBAL',
    });
    if (!(await this.deps.subject.findById(command.userId)))
      throw new UserAccessSubjectNotFoundError();
    return this.deps.assembler.build(command.userId);
  }
}
