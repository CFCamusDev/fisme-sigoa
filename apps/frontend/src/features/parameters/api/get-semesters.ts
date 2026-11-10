import { listSemestersResponseSchema, type ListSemestersResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function getSemesters(): Promise<ListSemestersResponse> {
  const response = await apiClient.get<unknown>('/semesters');
  return listSemestersResponseSchema.parse(response.data);
}
