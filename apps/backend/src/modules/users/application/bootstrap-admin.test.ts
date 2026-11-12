import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { BootstrapAdminConfigError } from '../domain/errors/bootstrap-admin-config-error.js';
import { BootstrapAdminConflictError } from '../domain/errors/bootstrap-admin-conflict-error.js';
import type { BootstrapAdminRepository } from '../domain/ports/bootstrap-admin-repository.js';
import type { InitialPasswordHasher } from '../domain/ports/initial-password-hasher.js';
import { BootstrapAdminUseCase, type BootstrapAdminInputResult } from './bootstrap-admin.js';

const PASSWORD = 'Clave-Secreta-2026';
const EMAIL = 'admin.prueba@example.test';

const validInput: BootstrapAdminInputResult = {
  ok: true,
  value: {
    email: EMAIL,
    names: 'Ana',
    firstSurname: 'Quispe',
    secondSurname: 'Rojas',
    dni: '12345678',
    password: PASSWORD,
  },
};

function setup(input: BootstrapAdminInputResult = validInput) {
  const repository = mock<BootstrapAdminRepository>();
  const hasher = mock<InitialPasswordHasher>();
  const loadInput = vi.fn(() => input);
  const logger = { info: vi.fn() };
  repository.existsAdministrator.mockResolvedValue(false);
  repository.findUserByEmailOrDni.mockResolvedValue(null);
  repository.createAdministrator.mockResolvedValue('user-1');
  hasher.hash.mockResolvedValue('$argon2id$hash');
  const useCase = new BootstrapAdminUseCase({ repository, hasher, loadInput, logger });
  return { repository, hasher, loadInput, logger, useCase };
}

describe('BootstrapAdminUseCase (RNF-003, RNF-039)', () => {
  it('creates an active administrator with a hashed password and never logs it', async () => {
    const { useCase, repository, hasher, logger } = setup();

    await expect(useCase.execute()).resolves.toBe('CREATED');

    expect(hasher.hash).toHaveBeenCalledWith(PASSWORD);
    expect(repository.createAdministrator).toHaveBeenCalledWith({
      email: EMAIL,
      names: 'Ana',
      firstSurname: 'Quispe',
      secondSurname: 'Rojas',
      dni: '12345678',
      passwordHash: '$argon2id$hash',
    });
    const createArgs = JSON.stringify(repository.createAdministrator.mock.calls);
    expect(createArgs).not.toContain(PASSWORD);

    const logged = JSON.stringify(logger.info.mock.calls);
    expect(logged).toContain('user-1');
    expect(logged).not.toContain(PASSWORD);
    expect(logged).not.toContain(EMAIL);
  });

  it('skips without reading variables when an administrator already exists', async () => {
    const { useCase, repository, loadInput, hasher } = setup();
    repository.existsAdministrator.mockResolvedValue(true);

    await expect(useCase.execute()).resolves.toBe('SKIPPED');

    expect(loadInput).not.toHaveBeenCalled();
    expect(hasher.hash).not.toHaveBeenCalled();
    expect(repository.createAdministrator).not.toHaveBeenCalled();
  });

  it('fails naming the variable to fix', async () => {
    const { useCase, repository } = setup({
      ok: false,
      issues: [{ variable: 'ADMIN_INITIAL_PASSWORD', message: 'es obligatoria' }],
    });

    const error = await useCase.execute().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BootstrapAdminConfigError);
    expect((error as BootstrapAdminConfigError).message).toContain('ADMIN_INITIAL_PASSWORD');
    expect((error as BootstrapAdminConfigError).variables).toEqual(['ADMIN_INITIAL_PASSWORD']);
    expect(repository.createAdministrator).not.toHaveBeenCalled();
  });

  it.each([
    ['EMAIL', 'ADMIN_EMAIL'],
    ['DNI', 'ADMIN_DNI'],
  ] as const)(
    'fails without promoting the account when the %s is already used',
    async (found, variable) => {
      const { useCase, repository, hasher } = setup();
      repository.findUserByEmailOrDni.mockResolvedValue(found);

      const error = await useCase.execute().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BootstrapAdminConflictError);
      expect((error as BootstrapAdminConflictError).variable).toBe(variable);
      expect((error as BootstrapAdminConflictError).message).toContain(variable);
      expect(hasher.hash).not.toHaveBeenCalled();
      expect(repository.createAdministrator).not.toHaveBeenCalled();
    },
  );

  it('never exposes the password or the email in the message of any error', async () => {
    const conflict = setup();
    conflict.repository.findUserByEmailOrDni.mockResolvedValue('EMAIL');
    const conflictError = (await conflict.useCase.execute().catch((e: unknown) => e)) as Error;
    expect(conflictError.message).not.toContain(PASSWORD);
    expect(conflictError.message).not.toContain(EMAIL);

    const config = setup({
      ok: false,
      issues: [{ variable: 'ADMIN_DNI', message: 'debe tener exactamente 8 dígitos' }],
    });
    const configError = (await config.useCase.execute().catch((e: unknown) => e)) as Error;
    expect(configError.message).not.toContain(PASSWORD);
  });

  it('propagates repository failures so the seed transaction rolls back', async () => {
    const { useCase, repository } = setup();
    repository.createAdministrator.mockRejectedValue(new Error('db down'));

    await expect(useCase.execute()).rejects.toThrow('db down');
  });
});
