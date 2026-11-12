import { InvalidRoleDataError } from '../errors/invalid-role-data-error.js';

const MAX_ROLE_CODE_LENGTH = 64;

export function deriveRoleCode(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new InvalidRoleDataError('El nombre no genera un código de rol válido', [
      { path: 'name', message: 'El nombre es obligatorio' },
    ]);
  }

  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_ROLE_CODE_LENGTH)
    .replace(/_+$/, '');

  if (!normalized) {
    throw new InvalidRoleDataError('El nombre no genera un código de rol válido', [
      { path: 'name', message: 'El nombre debe contener al menos un carácter alfanumérico' },
    ]);
  }

  return normalized;
}
