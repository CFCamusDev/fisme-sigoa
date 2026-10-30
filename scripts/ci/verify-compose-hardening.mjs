#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export function verifyHardening(config) {
  const errors = [];
  const backend = config.services?.backend;

  if (!backend) {
    return ['No se encontró el servicio "backend" en la configuración de Docker Compose.'];
  }

  // 1. cap_drop: ALL
  const capDrop = backend.cap_drop ?? [];
  if (!capDrop.includes('ALL')) {
    errors.push('El servicio "backend" debe incluir "cap_drop: [ALL]".');
  }

  // 2. security_opt: no-new-privileges y seccomp
  const securityOpt = backend.security_opt ?? [];
  const hasNoNewPrivileges = securityOpt.some((opt) => opt === 'no-new-privileges:true');
  const hasSeccomp = securityOpt.some((opt) =>
    opt.includes('seccomp=./deploy/seccomp/chromium.json') || opt.includes('chromium.json'),
  );

  if (!hasNoNewPrivileges) {
    errors.push('El servicio "backend" debe incluir "security_opt: [no-new-privileges:true]".');
  }
  if (!hasSeccomp) {
    errors.push('El servicio "backend" debe configurar el perfil seccomp "./deploy/seccomp/chromium.json".');
  }

  // 3. read_only: true
  if (backend.read_only !== true) {
    errors.push('El servicio "backend" debe tener "read_only: true" para el sistema de archivos raíz.');
  }

  // 4. tmpfs: /tmp
  const tmpfs = backend.tmpfs ?? [];
  const hasTmpfs = Array.isArray(tmpfs)
    ? tmpfs.some((t) => typeof t === 'string' && t.includes('/tmp'))
    : typeof tmpfs === 'object' && Object.keys(tmpfs).some((k) => k.includes('/tmp'));

  if (!hasTmpfs) {
    errors.push('El servicio "backend" debe montar un tmpfs en "/tmp" (ej. /tmp:size=256M).');
  }

  // 5. PDF_CHROMIUM_NO_SANDBOX por defecto false
  const env = backend.environment ?? {};
  const noSandboxVal = env.PDF_CHROMIUM_NO_SANDBOX;
  if (noSandboxVal === 'true' || noSandboxVal === true) {
    errors.push('PDF_CHROMIUM_NO_SANDBOX no debe estar en true por defecto; el sandbox debe estar habilitado.');
  }

  return errors;
}

// Ejecución
async function run() {
  let config;
  try {
    if (!process.stdin.isTTY) {
      const chunks = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw) {
        config = JSON.parse(raw);
      }
    }

    if (!config) {
      const cmd =
        'docker compose --env-file deploy/stack.env.example -f docker-compose.prod.yml config --format json';
      const output = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      config = JSON.parse(output);
    }
  } catch (err) {
    console.error('❌ Error al obtener la configuración de Docker Compose:', err.message);
    process.exit(1);
  }

  const errors = verifyHardening(config);
  if (errors.length > 0) {
    console.error('\n❌ Se encontraron fallas en el endurecimiento del contenedor backend:\n');
    for (const err of errors) {
      console.error(` - ${err}`);
    }
    process.exit(1);
  }

  console.log('✅ Endurecimiento de Docker Compose verificado exitosamente (sandbox activo, cap_drop ALL, read_only, seccomp).');
  process.exit(0);
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
if (isMainModule || process.argv[1]?.endsWith('verify-compose-hardening.mjs')) {
  void run();
}
