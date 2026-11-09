import type { MyPermissionsResponse } from '@sigoa/shared';
import { computeEffectivePermissions, type GrantReader } from '../domain/index.js';

export interface GetMyPermissionsCommand {
  readonly actorId: string;
}

export interface GetMyPermissionsDependencies {
  readonly grantReader: GrantReader;
}

export class GetMyPermissionsUseCase {
  public constructor(private readonly deps: GetMyPermissionsDependencies) {}

  public async execute(command: GetMyPermissionsCommand): Promise<MyPermissionsResponse> {
    const grants = await this.deps.grantReader.findGrantsByUserId(command.actorId);
    const effective = computeEffectivePermissions(grants);

    const permissions = Array.from(effective.entries())
      .map(([code, scope]) => ({ code, scope }))
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      permissions,
    };
  }
}
