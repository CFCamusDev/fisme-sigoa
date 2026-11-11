import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../../..');
const ADMIN_VARIABLES = [
  'ADMIN_EMAIL',
  'ADMIN_FULL_NAME',
  'ADMIN_DNI',
  'ADMIN_INITIAL_PASSWORD',
] as const;

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

/** Devuelve el texto de un servicio de compose (desde `  nombre:` hasta el siguiente servicio). */
function serviceBlock(compose: string, service: string): string {
  const lines = compose.split('\n');
  const start = lines.findIndex((line) => line === `  ${service}:`);
  if (start === -1) {
    throw new Error(`Servicio ${service} no encontrado`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {0,2}\S/.test(line));
  return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
}

function serviceNames(compose: string): string[] {
  const servicesStart = compose.indexOf('\nservices:\n');
  const afterServices = compose.slice(servicesStart + '\nservices:\n'.length);
  const topLevelEnd = afterServices.search(/\n\S/);
  const block = topLevelEnd === -1 ? afterServices : afterServices.slice(0, topLevelEnd);
  return [...block.matchAll(/^ {2}([a-z_]+):$/gm)].map((match) => match[1] as string);
}

describe('ADMIN variables in the deployment files (HU-079, RNF-039)', () => {
  it('declares ADMIN variables in the stack example and only passes them to migrate', () => {
    const stackExample = readRepoFile('deploy/stack.env.example');
    for (const variable of ADMIN_VARIABLES) {
      expect(stackExample).toMatch(new RegExp(`^${variable}=`, 'm'));
    }
    expect(stackExample).toMatch(/ADMIN_INITIAL_PASSWORD/);
    expect(stackExample.toLowerCase()).toContain('quita admin_initial_password');

    const prod = readRepoFile('docker-compose.prod.yml');
    const services = serviceNames(prod);
    expect(services).toEqual(
      expect.arrayContaining(['postgres', 'migrate', 'backend', 'frontend', 'backup']),
    );
    for (const variable of ADMIN_VARIABLES) {
      expect(serviceBlock(prod, 'migrate')).toContain(`${variable}: \${${variable}:-}`);
    }
    for (const service of services.filter((name) => name !== 'migrate')) {
      expect(serviceBlock(prod, service)).not.toContain('ADMIN_');
    }
  });

  it('declares ADMIN variables in both .env.example files and in the development compose', () => {
    for (const file of ['.env.example', 'apps/backend/.env.example']) {
      const content = readRepoFile(file);
      for (const variable of ADMIN_VARIABLES) {
        expect(content, `${file} debe declarar ${variable}`).toMatch(
          new RegExp(`^${variable}=`, 'm'),
        );
      }
    }

    const dev = readRepoFile('docker-compose.yml');
    for (const variable of ADMIN_VARIABLES) {
      expect(serviceBlock(dev, 'migrate')).toContain(`${variable}: \${${variable}:-`);
      expect(serviceBlock(dev, 'backend')).not.toContain(variable);
    }
  });

  it('runs db:seed after db:provision-app-role in the migrator image', () => {
    const dockerfile = readRepoFile('apps/backend/Dockerfile');
    const migrator = dockerfile.slice(dockerfile.indexOf('FROM build AS migrator'));
    const cmd = migrator.split('\n').find((line) => line.startsWith('CMD ')) ?? '';

    const migrate = cmd.indexOf('prisma migrate deploy');
    const provision = cmd.indexOf('db:provision-app-role');
    const seed = cmd.indexOf('db:seed');
    expect(migrate).toBeGreaterThan(-1);
    expect(provision).toBeGreaterThan(migrate);
    expect(seed).toBeGreaterThan(provision);
    expect(cmd.slice(migrate, seed)).not.toContain(';');
  });
});
