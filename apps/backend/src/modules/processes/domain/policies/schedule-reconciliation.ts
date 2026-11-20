import { ScheduleActivity } from '../entities/schedule-activity.js';
import { SCHEDULE_MAX_ITEMS } from '../entities/schedule-activity-status.js';
import { InvalidScheduleDataError } from '../errors/invalid-schedule-data-error.js';
import { ScheduleActivityInUseError } from '../errors/schedule-activity-in-use-error.js';

export interface ReconcileScheduleItemInput {
  readonly id?: string;
  readonly activity: string;
  readonly responsible: string;
  readonly goal?: string | null;
  readonly indicator?: string | null;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
}

export interface ReconcileScheduleInput {
  readonly executionId: string;
  readonly existing: readonly ScheduleActivity[];
  readonly incoming: readonly ReconcileScheduleItemInput[];
  readonly actorId: string;
  readonly now: Date;
  readonly idGenerator: () => string;
}

export interface UpdatedScheduleActivity {
  readonly before: ScheduleActivity;
  readonly after: ScheduleActivity;
}

export interface ScheduleReconciliationResult {
  readonly orderedActivities: readonly ScheduleActivity[];
  readonly toCreate: readonly ScheduleActivity[];
  readonly toUpdate: readonly UpdatedScheduleActivity[];
  readonly toDelete: readonly ScheduleActivity[];
}

function hasActivityChanged(before: ScheduleActivity, after: ScheduleActivity): boolean {
  return (
    before.number !== after.number ||
    before.activity !== after.activity ||
    before.responsible !== after.responsible ||
    before.goal !== after.goal ||
    before.indicator !== after.indicator ||
    before.startDate !== after.startDate ||
    before.endDate !== after.endDate
  );
}

export function reconcileSchedule(input: ReconcileScheduleInput): ScheduleReconciliationResult {
  if (input.incoming.length > SCHEDULE_MAX_ITEMS) {
    throw new InvalidScheduleDataError(
      `El cronograma no puede tener más de ${SCHEDULE_MAX_ITEMS} actividades.`,
    );
  }

  const existingById = new Map<string, ScheduleActivity>();
  for (const item of input.existing) {
    existingById.set(item.id, item);
  }

  const seenIncomingIds = new Set<string>();
  const orderedActivities: ScheduleActivity[] = [];
  const toCreate: ScheduleActivity[] = [];
  const toUpdate: UpdatedScheduleActivity[] = [];

  input.incoming.forEach((rawItem, index) => {
    const number = index + 1;

    if (rawItem.id === undefined) {
      const created = ScheduleActivity.create({
        id: input.idGenerator(),
        executionId: input.executionId,
        number,
        activity: rawItem.activity,
        responsible: rawItem.responsible,
        goal: rawItem.goal,
        indicator: rawItem.indicator,
        startDate: rawItem.startDate,
        endDate: rawItem.endDate,
        actorId: input.actorId,
        now: input.now,
      });
      orderedActivities.push(created);
      toCreate.push(created);
      return;
    }

    if (seenIncomingIds.has(rawItem.id)) {
      throw new InvalidScheduleDataError(
        `El identificador de actividad «${rawItem.id}» está repetido en la solicitud.`,
      );
    }
    seenIncomingIds.add(rawItem.id);

    const existingItem = existingById.get(rawItem.id);
    if (!existingItem) {
      throw new InvalidScheduleDataError(
        `La actividad «${rawItem.id}» no pertenece al cronograma de esta ejecución.`,
      );
    }

    const updatedContent = existingItem.applyChanges({
      activity: rawItem.activity,
      responsible: rawItem.responsible,
      goal: rawItem.goal,
      indicator: rawItem.indicator,
      startDate: rawItem.startDate,
      endDate: rawItem.endDate,
      actorId: input.actorId,
      now: input.now,
    });
    const renumbered = updatedContent.renumber(number, input.actorId, input.now);

    if (hasActivityChanged(existingItem, renumbered)) {
      orderedActivities.push(renumbered);
      toUpdate.push({ before: existingItem, after: renumbered });
    } else {
      orderedActivities.push(existingItem);
    }
  });

  const toDelete: ScheduleActivity[] = [];
  for (const existingItem of input.existing) {
    if (!seenIncomingIds.has(existingItem.id)) {
      if (existingItem.status !== 'PENDING') {
        throw new ScheduleActivityInUseError();
      }
      toDelete.push(existingItem);
    }
  }

  return {
    orderedActivities,
    toCreate,
    toUpdate,
    toDelete,
  };
}
