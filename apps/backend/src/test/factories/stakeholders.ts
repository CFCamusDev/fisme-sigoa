import type { PrismaClient } from '../../shared/prisma/generated/client.js';

let sequence = 0;

export interface CreateStakeholderRowOptions {
  readonly id?: string;
  readonly kind?: 'PERSON' | 'INSTITUTION';
  readonly fullName?: string;
  readonly dni?: string | null;
  readonly ruc?: string | null;
  readonly email?: string | null;
  readonly mobile?: string | null;
  readonly position?: string | null;
  readonly institution?: string | null;
  readonly sector?: string | null;
  readonly graduationYear?: number | null;
  readonly cycle?: string | null;
  readonly status?: 'ACTIVE' | 'VOIDED';
  readonly voidReason?: string | null;
  readonly voidedAt?: Date | null;
  readonly voidedBy?: string | null;
  readonly createdBy?: string;
}

function nextDni(): string {
  sequence += 1;
  return String(40_000_000 + sequence).slice(0, 8);
}

function nextRuc(): string {
  sequence += 1;
  return `20${String(100_000_000 + sequence).slice(0, 9)}`;
}

/** Inserta un constituyente ficticio en la tabla `stakeholders` para pruebas de integración. */
export async function createStakeholderRow(
  prisma: PrismaClient,
  options: CreateStakeholderRowOptions = {},
): Promise<string> {
  const kind = options.kind ?? 'PERSON';
  const dni = kind === 'PERSON' ? (options.dni === undefined ? nextDni() : options.dni) : null;
  const ruc = kind === 'INSTITUTION' ? (options.ruc === undefined ? nextRuc() : options.ruc) : null;
  const status = options.status ?? 'ACTIVE';
  const voidedAt = status === 'VOIDED' ? (options.voidedAt ?? new Date()) : null;

  const row = await prisma.stakeholder.create({
    data: {
      ...(options.id ? { id: options.id } : {}),
      kind,
      fullName:
        options.fullName ??
        (kind === 'PERSON' ? `Constituyente Persona ${dni}` : `Institucion ${ruc}`),
      dni,
      ruc,
      email: options.email ?? null,
      mobile: options.mobile ?? null,
      position: options.position ?? null,
      institution: kind === 'PERSON' ? (options.institution ?? null) : null,
      sector: options.sector ?? null,
      graduationYear: kind === 'PERSON' ? (options.graduationYear ?? null) : null,
      cycle: kind === 'PERSON' ? (options.cycle ?? null) : null,
      status,
      voidReason: status === 'VOIDED' ? (options.voidReason ?? 'Motivo de prueba') : null,
      voidedAt,
      voidedBy: status === 'VOIDED' ? (options.voidedBy ?? 'SEED') : null,
      createdBy: options.createdBy ?? 'SEED',
    },
  });

  return row.id;
}
