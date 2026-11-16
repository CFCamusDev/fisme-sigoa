import {
  STAKEHOLDER_KINDS,
  editStakeholderRequestSchema,
  registerStakeholderRequestSchema,
  stakeholderKindSchema,
  type EditStakeholderRequest,
  type RegisterStakeholderRequest,
  type StakeholderDto,
} from '@sigoa/shared';
import { z } from 'zod';

export interface StakeholderFormValues {
  kind: (typeof STAKEHOLDER_KINDS)[number];
  fullName: string;
  dni: string;
  ruc: string;
  email: string;
  mobile: string;
  position: string;
  institution: string;
  sector: string;
  graduationYear: string;
  cycle: string;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function parseOptionalYear(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  if (!/^-?\d+$/.test(trimmed)) {
    return Number.NaN;
  }
  return Number(trimmed);
}

export function toRegisterStakeholderPayload(
  values: StakeholderFormValues,
): RegisterStakeholderRequest {
  if (values.kind === 'PERSON') {
    return {
      kind: 'PERSON',
      fullName: values.fullName.trim(),
      dni: values.dni.trim(),
      email: emptyToNull(values.email),
      mobile: emptyToNull(values.mobile),
      position: emptyToNull(values.position),
      institution: emptyToNull(values.institution),
      sector: emptyToNull(values.sector),
      graduationYear: parseOptionalYear(values.graduationYear),
      cycle: emptyToNull(values.cycle),
    };
  }

  return {
    kind: 'INSTITUTION',
    fullName: values.fullName.trim(),
    ruc: values.ruc.trim(),
    email: emptyToNull(values.email),
    mobile: emptyToNull(values.mobile),
    position: emptyToNull(values.position),
    sector: emptyToNull(values.sector),
  };
}

export function buildEditStakeholderPayload(
  values: StakeholderFormValues,
  dirtyFields: Partial<Record<keyof StakeholderFormValues, boolean>>,
): EditStakeholderRequest {
  const payload: Record<string, unknown> = {};

  if (dirtyFields.fullName) {
    payload.fullName = values.fullName.trim();
  }
  if (values.kind === 'PERSON' && dirtyFields.dni) {
    payload.dni = values.dni.trim();
  }
  if (values.kind === 'INSTITUTION' && dirtyFields.ruc) {
    payload.ruc = values.ruc.trim();
  }
  if (dirtyFields.email) {
    payload.email = emptyToNull(values.email);
  }
  if (dirtyFields.mobile) {
    payload.mobile = emptyToNull(values.mobile);
  }
  if (dirtyFields.position) {
    payload.position = emptyToNull(values.position);
  }
  if (values.kind === 'PERSON' && dirtyFields.institution) {
    payload.institution = emptyToNull(values.institution);
  }
  if (dirtyFields.sector) {
    payload.sector = emptyToNull(values.sector);
  }
  if (values.kind === 'PERSON' && dirtyFields.graduationYear) {
    payload.graduationYear = parseOptionalYear(values.graduationYear);
  }
  if (values.kind === 'PERSON' && dirtyFields.cycle) {
    payload.cycle = emptyToNull(values.cycle);
  }

  return editStakeholderRequestSchema.parse(payload);
}

export function getInitialStakeholderFormValues(
  stakeholder?: StakeholderDto,
): StakeholderFormValues {
  if (!stakeholder) {
    return {
      kind: 'PERSON',
      fullName: '',
      dni: '',
      ruc: '',
      email: '',
      mobile: '',
      position: '',
      institution: '',
      sector: '',
      graduationYear: '',
      cycle: '',
    };
  }

  return {
    kind: stakeholder.kind,
    fullName: stakeholder.fullName,
    dni: stakeholder.dni ?? '',
    ruc: stakeholder.ruc ?? '',
    email: stakeholder.email ?? '',
    mobile: stakeholder.mobile ?? '',
    position: stakeholder.position ?? '',
    institution: stakeholder.institution ?? '',
    sector: stakeholder.sector ?? '',
    graduationYear: stakeholder.graduationYear !== null ? String(stakeholder.graduationYear) : '',
    cycle: stakeholder.cycle ?? '',
  };
}

export const stakeholderFormSchema = z
  .object({
    kind: stakeholderKindSchema,
    fullName: z.string(),
    dni: z.string(),
    ruc: z.string(),
    email: z.string(),
    mobile: z.string(),
    position: z.string(),
    institution: z.string(),
    sector: z.string(),
    graduationYear: z.string(),
    cycle: z.string(),
  })
  .superRefine((values, ctx) => {
    const payload = toRegisterStakeholderPayload(values);
    const parsed = registerStakeholderRequestSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({
          code: 'custom',
          message: issue.message,
          path: issue.path,
        });
      }
    }
  });
