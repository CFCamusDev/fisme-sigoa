import type { PrismaClient } from '../../../../../shared/prisma/generated/client.js';

export const DEFAULT_PROGRAM_CODE = 'EPIS';
export const DEFAULT_PROGRAM_NAME = 'Escuela Profesional de Ingeniería de Sistemas';
export const DEFAULT_PROGRAM_FACULTY = 'Facultad de Ingeniería de Sistemas y Mecánica Eléctrica';

/**
 * Seed inicial del programa EPIS (HU-009, T-009-06, RF-009, D3).
 * Si la tabla de programas está vacía, registra los datos institucionales oficiales de la EPIS.
 * Si ya existe una fila (incluso con código modificado), no altera ni inserta nada para respetar D3.
 */
export async function seedProgram(prisma: PrismaClient): Promise<void> {
  const existingCount = await prisma.program.count();
  if (existingCount > 0) {
    return;
  }

  await prisma.program.create({
    data: {
      code: DEFAULT_PROGRAM_CODE,
      name: DEFAULT_PROGRAM_NAME,
      faculty: DEFAULT_PROGRAM_FACULTY,
      createdBy: 'SEED',
      updatedBy: 'SEED',
    },
  });
}
