import { nextTransitionResponseSchema, type NextTransitionResponse } from '@sigoa/shared';
import { ScheduleExecutionNotFoundError } from '../domain/errors/index.js';
import { nextAdvanceStatus } from '../domain/policies/process-execution-transitions.js';
import type {
  ProcessExecutionRepository,
  ProcessPermissionChecker,
} from '../domain/ports/index.js';
import type { ExecutionPreconditionEvaluator } from './execution-precondition-evaluator.js';
import type { GetNextTransitionQuery } from './get-next-transition.types.js';

export interface GetNextTransitionDependencies {
  readonly processExecutionRepository: ProcessExecutionRepository;
  readonly permissionChecker: ProcessPermissionChecker;
  readonly preconditionEvaluator: ExecutionPreconditionEvaluator;
}

/**
 * Consulta la siguiente transición disponible y el estado de sus precondiciones (HU-029, T1-D8).
 */
export class GetNextTransitionUseCase {
  constructor(private readonly deps: GetNextTransitionDependencies) {}

  async execute(query: GetNextTransitionQuery): Promise<NextTransitionResponse> {
    await this.deps.permissionChecker.assertAllowed({
      actorId: query.actorId,
      permission: 'ejecucion.ver',
      scope: 'GLOBAL',
    });

    const execution = await this.deps.processExecutionRepository.findById(query.executionId);
    if (!execution) {
      throw new ScheduleExecutionNotFoundError(query.executionId);
    }

    const nextStatus = nextAdvanceStatus(execution.status);
    if (!nextStatus) {
      return nextTransitionResponseSchema.parse({
        executionId: execution.id,
        status: execution.status,
        nextStatus: null,
        preconditions: [],
        canAdvance: false,
      });
    }

    const evaluation = await this.deps.preconditionEvaluator.evaluate(execution);

    return nextTransitionResponseSchema.parse({
      executionId: execution.id,
      status: execution.status,
      nextStatus,
      preconditions: [...evaluation.items],
      canAdvance: evaluation.allMet,
    });
  }
}
