import { sessionDtoSchema, type SessionDto } from '@sigoa/shared';
import type { Session } from '../domain/entities/session.js';

export function buildSessionDto(session: Session): SessionDto {
  return sessionDtoSchema.parse({
    id: session.id,
    stakeholderType: session.stakeholderType,
    stakeholderListId: session.stakeholderListId,
    sessionDate: session.sessionDate,
    startTime: session.startTime,
    modality: session.modality,
    meetingUrl: session.meetingUrl,
    recordingUrl: session.recordingUrl,
    executionIds: [...session.executionIds],
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  });
}
