import type { UpdateUserRequest } from '@sigoa/shared';

export interface EditUserCommand {
  readonly actorId: string;
  readonly ip: string;
  readonly userId: string;
  readonly input: UpdateUserRequest;
}
