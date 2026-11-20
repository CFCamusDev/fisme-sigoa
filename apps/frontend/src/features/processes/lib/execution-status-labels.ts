import type { ProcessExecutionStatusValue, PreconditionStateValue } from '@sigoa/shared';
import type { ApiError } from '@/lib/api-error';
import { STATUS } from '@/lib/status';

export const EXECUTION_FLOW_STEPS = [
  'PLANNED',
  'IN_PROGRESS',
  'CONSOLIDATING',
  'PENDING_APPROVAL',
  'CLOSED',
] as const satisfies readonly ProcessExecutionStatusValue[];

export const PRECONDITION_STATE_LABELS: Record<PreconditionStateValue, string> = {
  MET: 'Cumplida',
  UNMET: 'Pendiente',
  NOT_VERIFIABLE: 'No verificable',
};

export function getExecutionStatusLabel(status: ProcessExecutionStatusValue): string {
  return STATUS[status].label;
}

export function getTransitionErrorMessage(error: ApiError): string {
  if (error.message && error.message.trim().length > 0) {
    return error.message;
  }
  return 'No se pudo completar la operación sobre el estado de la ejecución.';
}
