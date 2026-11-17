import {
  copyStakeholderListResponseSchema,
  type CopyStakeholderListRequest,
  type CopyStakeholderListResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export type CopyStakeholderListInput = CopyStakeholderListRequest & {
  readonly sourceListId: string;
};

/** Copia una lista del Anexo 3 hacia un nuevo año posterior. */
export async function copyStakeholderList(
  input: CopyStakeholderListInput,
): Promise<CopyStakeholderListResponse> {
  const { sourceListId, year } = input;
  const response = await apiClient.post<unknown>(`/stakeholder-lists/${sourceListId}/copy`, {
    year,
  });
  return copyStakeholderListResponseSchema.parse(response.data);
}
