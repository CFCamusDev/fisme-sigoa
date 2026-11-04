import type { ChangeUserStatusRequest } from '@sigoa/shared';

export interface ChangeUserStatusCommand {
  readonly actorId: string;
  readonly ip: string;
  readonly userId: string;
  readonly input: ChangeUserStatusRequest;
}
