import type { SessionModality } from '../domain/entities/session-modality.js';
import type { SessionStakeholderType } from '../domain/entities/session-stakeholder-type.js';

export interface EditSessionCommand {
  readonly actorId: string;
  readonly ip?: string | null;
  readonly sessionId: string;
  readonly stakeholderType?: SessionStakeholderType;
  readonly stakeholderListId?: string | null;
  readonly sessionDate?: string;
  readonly startTime?: string;
  readonly modality?: SessionModality;
  readonly meetingUrl?: string | null;
  readonly recordingUrl?: string | null;
  readonly executionIds?: readonly string[];
}
