import type { CreateUserRequest } from '@sigoa/shared';

export interface CreateUserCommand {
  actorId: string;
  ip: string;
  input: CreateUserRequest;
}
