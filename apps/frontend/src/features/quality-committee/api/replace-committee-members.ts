import {
  qualityCommitteeSchema,
  type QualityCommitteeDto,
  type ReplaceCommitteeMembersRequest,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface ReplaceCommitteeMembersVariables {
  readonly committeeId: string;
  readonly body: ReplaceCommitteeMembersRequest;
}

export async function replaceCommitteeMembers({
  committeeId,
  body,
}: ReplaceCommitteeMembersVariables): Promise<QualityCommitteeDto> {
  const response = await apiClient.put<unknown>(
    `/quality-committees/${encodeURIComponent(committeeId)}/members`,
    body,
  );
  return qualityCommitteeSchema.parse(response.data);
}
