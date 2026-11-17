import {
  stakeholderListMemberDtoSchema,
  type AddStakeholderListMemberRequest,
  type StakeholderListMemberDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export type AddStakeholderListMemberInput = AddStakeholderListMemberRequest & {
  readonly listId: string;
};

/** Agrega un constituyente del registro maestro a una lista del Anexo 3. */
export async function addStakeholderListMember(
  input: AddStakeholderListMemberInput,
): Promise<StakeholderListMemberDto> {
  const { listId, ...body } = input;
  const response = await apiClient.post<unknown>(`/stakeholder-lists/${listId}/members`, body);
  return stakeholderListMemberDtoSchema.parse(response.data);
}
