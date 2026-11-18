import { z } from 'zod';
import { SESSION_ID_MAX_LENGTH } from './sessions.js';

export const SESSION_ATTENDEES_MAX = 500;
export const SESSION_ATTENDEE_POSITION_MAX_LENGTH = 120;

const attendeeMemberIdSchema = z
  .string()
  .trim()
  .min(1, 'El identificador del miembro es obligatorio')
  .max(
    SESSION_ID_MAX_LENGTH,
    `El identificador del miembro no puede exceder ${SESSION_ID_MAX_LENGTH} caracteres`,
  );

const optionalNullablePositionSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .trim()
    .max(
      SESSION_ATTENDEE_POSITION_MAX_LENGTH,
      `El cargo del asistente no puede superar los ${SESSION_ATTENDEE_POSITION_MAX_LENGTH} caracteres`,
    )
    .nullable()
    .optional(),
);

export const registerSessionAttendeeEntrySchema = z
  .object({
    listMemberId: attendeeMemberIdSchema,
    position: optionalNullablePositionSchema,
  })
  .strict();

export type RegisterSessionAttendeeEntry = z.infer<typeof registerSessionAttendeeEntrySchema>;

export const registerSessionAttendeesRequestSchema = z
  .object({
    attendees: z
      .array(registerSessionAttendeeEntrySchema)
      .max(
        SESSION_ATTENDEES_MAX,
        `No se pueden registrar más de ${SESSION_ATTENDEES_MAX} asistentes por sesión`,
      )
      .refine(
        (entries) => new Set(entries.map((entry) => entry.listMemberId)).size === entries.length,
        'No se pueden registrar asistentes repetidos en la sesión',
      ),
  })
  .strict();

export type RegisterSessionAttendeesRequest = z.infer<typeof registerSessionAttendeesRequestSchema>;

export const sessionAttendeeRosterItemSchema = z
  .object({
    listMemberId: z.string(),
    fullName: z.string(),
    institution: z.string().nullable(),
    memberPosition: z.string().nullable(),
    attended: z.boolean(),
    position: z.string().nullable(),
  })
  .strict();

export type SessionAttendeeRosterItem = z.infer<typeof sessionAttendeeRosterItemSchema>;

export const sessionAttendeesResponseSchema = z
  .object({
    sessionId: z.string(),
    stakeholderListId: z.string().nullable(),
    attendeeCount: z.number().int().nonnegative(),
    items: z.array(sessionAttendeeRosterItemSchema),
  })
  .strict();

export type SessionAttendeesResponse = z.infer<typeof sessionAttendeesResponseSchema>;
