import { sessionDtoSchema, type SessionDto, type UpdateSessionRequest } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface UpdateSessionVariables {
  readonly id: string;
  readonly data: UpdateSessionRequest;
}

export async function updateSession({ id, data }: UpdateSessionVariables): Promise<SessionDto> {
  const response = await apiClient.patch<unknown>(`/sessions/${id}`, data);
  return sessionDtoSchema.parse(response.data);
}
