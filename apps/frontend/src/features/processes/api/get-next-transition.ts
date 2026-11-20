import { nextTransitionResponseSchema, type NextTransitionResponse } from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Consulta la siguiente transición disponible y sus precondiciones para una ejecución. */
export async function getNextTransition(executionId: string): Promise<NextTransitionResponse> {
  const response = await apiClient.get<unknown>(
    `/process-executions/${executionId}/next-transition`,
  );
  return nextTransitionResponseSchema.parse(response.data);
}
