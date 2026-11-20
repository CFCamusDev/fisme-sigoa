import type { ProcessExecution } from '../domain/entities/process-execution.js';
import type {
  ExecutionPreconditionCode,
  ExecutionPreconditionResult,
} from '../domain/entities/process-execution-precondition.js';
import {
  evaluatePreconditions,
  requiredPreconditions,
  type EvaluatedPreconditions,
} from '../domain/policies/process-execution-transitions.js';
import type { ExecutionPreconditionProvider } from '../domain/ports/execution-precondition-provider.js';

export class ExecutionPreconditionEvaluator {
  constructor(private readonly providers: readonly ExecutionPreconditionProvider[] = []) {}

  async evaluate(execution: ProcessExecution): Promise<EvaluatedPreconditions> {
    const required = requiredPreconditions(execution.type, execution.status);
    if (required.length === 0) {
      return { allMet: true, items: [], unmet: [] };
    }

    const requiredSet = new Set<ExecutionPreconditionCode>(required);
    const matchingProviders = this.providers.filter((provider) =>
      provider.codes.some((code) => requiredSet.has(code)),
    );

    const collected: ExecutionPreconditionResult[] = [];
    for (const provider of matchingProviders) {
      const results = await provider.evaluate(execution);
      collected.push(...results);
    }

    return evaluatePreconditions(required, collected);
  }
}
