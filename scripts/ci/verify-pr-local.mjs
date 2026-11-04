#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Valida el nombre de la rama según convenciones institucionales (AGENTS §8.1).
 * Formato esperado: ^(feature|fix|bug|docs|refactor|test|chore)/HU-[0-9]{3}-[a-z0-9-]+$
 * @param {string} branchName
 * @returns {{ valid: boolean, hu?: string, error?: string }}
 */
export function validateBranchName(branchName) {
  if (!branchName || typeof branchName !== 'string') {
    return { valid: false, error: 'El nombre de rama no puede estar vacío.' };
  }

  const trimmed = branchName.trim();
  if (trimmed === 'main' || trimmed === 'develop') {
    return {
      valid: false,
      error: `La rama '${trimmed}' es una rama protegida. No se permite trabajar directamente sobre ella.`,
    };
  }

  const regex = /^(feature|fix|bug|docs|refactor|test|chore)\/(HU-[0-9]{3})-[a-z0-9-]+$/;
  const match = trimmed.match(regex);
  if (!match) {
    return {
      valid: false,
      error: `Rama '${trimmed}' inválida. Formato: tipo/HU-xxx-descripcion (tipos: feature, fix, bug, docs, refactor, test, chore).`,
    };
  }

  return {
    valid: true,
    hu: match[2],
  };
}

/**
 * Valida el título del Pull Request contra la convención institucional y la HU de la rama.
 * @param {string|undefined} title
 * @param {string} [branchHu]
 * @returns {{ valid: boolean, error?: string, skipped?: boolean, expectedFormat?: string }}
 */
export function validatePrTitle(title, branchHu) {
  const expectedFormat = 'tipo(módulo): HU-xxx descripción';
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return {
      valid: true,
      skipped: true,
      expectedFormat,
    };
  }

  const trimmed = title.trim();
  const titleRegex =
    /^(feat|fix|docs|refactor|test|chore|perf|build|ci)\([a-z0-9-]+\):\s*(HU-[0-9]{3})\s+.+$/;
  const match = trimmed.match(titleRegex);

  if (!match) {
    return {
      valid: false,
      error: `Título '${trimmed}' con formato inválido. Formato esperado: ${expectedFormat}`,
    };
  }

  const titleHu = match[2];
  if (branchHu && titleHu !== branchHu) {
    return {
      valid: false,
      error: `La HU del título (${titleHu}) no coincide con la HU de la rama (${branchHu}).`,
    };
  }

  return { valid: true };
}

/**
 * Valida un mensaje de commit según AGENTS §8.2.
 * @param {string} rawMessage
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validateCommitMessage(rawMessage) {
  const violations = [];
  if (!rawMessage || typeof rawMessage !== 'string') {
    return { valid: false, violations: ['Mensaje de commit vacío.'] };
  }

  const message = rawMessage.trim();

  // 1. Debe incluir pie obligatorio Refs: HU-xxx, T-xxx-yy
  const refsRegex = /^Refs:\s*HU-\d{3}(?:,\s*T-\d{3}-\d{2})+$/m;
  if (!refsRegex.test(message)) {
    violations.push('Falta el pie obligatorio de trazabilidad "Refs: HU-xxx, T-xxx-yy".');
  }

  // 2. Prohibido Co-Authored-By
  if (/co-authored-by/i.test(message)) {
    violations.push('Prohibido el uso de "Co-Authored-By" en mensajes de commit (AGENTS §8.2).');
  }

  // 3. Prohibido "Generated with"
  if (/generated\s+with/i.test(message)) {
    violations.push('Prohibido "Generated with" en mensajes de commit (AGENTS §8.2).');
  }

  // 4. Prohibido nombres de herramientas de IA
  const aiToolsRegex = /\b(claude|chatgpt|copilot|antigravity|cursor|gemini|deepseek)\b/i;
  if (aiToolsRegex.test(message)) {
    violations.push('Prohibido mencionar herramientas de IA en mensajes de commit (AGENTS §8.2).');
  }

  // 5. Prohibido emojis
  const emojiRegex = /\p{Extended_Pictographic}/u;
  if (emojiRegex.test(message)) {
    violations.push('Prohibido el uso de emojis en mensajes de commit (AGENTS §8.2).');
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Valida que los archivos modificados no incluyan archivos locales, secretos ni excluidos (AGENTS §6 y §11).
 * @param {string[]} fileList
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validateForbiddenFiles(fileList) {
  const violations = [];
  if (!Array.isArray(fileList)) {
    return { valid: true, violations: [] };
  }

  for (const rawPath of fileList) {
    const norm = rawPath.replace(/\\/g, '/').trim();
    if (!norm) continue;

    // Regla AGENTS §11: Archivos locales que nunca se suben
    if (norm === 'AGENTS.md' || norm.endsWith('/AGENTS.md')) {
      violations.push(`Archivo prohibido en commits: ${norm} (AGENTS §11).`);
      continue;
    }
    if (norm === 'CLAUDE.md' || norm.endsWith('/CLAUDE.md')) {
      violations.push(`Archivo prohibido en commits: ${norm} (AGENTS §11).`);
      continue;
    }
    if (norm.startsWith('.agents/') || norm.includes('/.agents/')) {
      violations.push(`Carpeta local prohibida en commits: ${norm} (AGENTS §11).`);
      continue;
    }
    if (norm.startsWith('.claude/') || norm.includes('/.claude/')) {
      violations.push(`Carpeta local prohibida en commits: ${norm} (AGENTS §11).`);
      continue;
    }
    if (norm.startsWith('docs/plans/') || norm.includes('/docs/plans/')) {
      violations.push(`Planes locales prohibidos en commits: ${norm} (AGENTS §11).`);
      continue;
    }
    if (norm.startsWith('docs/diseno/') || norm.includes('/docs/diseno/')) {
      violations.push(`Insumos de diseño prohibidos en commits: ${norm} (AGENTS §11).`);
      continue;
    }
    if (norm === 'docs/backlog.csv' || norm.endsWith('/docs/backlog.csv')) {
      violations.push(`Backlog local prohibido en commits: ${norm} (AGENTS §11).`);
      continue;
    }

    // Archivos .md en docs/: solo se permite docs/DEFINITION_OF_DONE.md
    if (/^docs\/.*\.md$/i.test(norm) && norm !== 'docs/DEFINITION_OF_DONE.md') {
      violations.push(
        `Archivos markdown en docs/ no se versionan salvo DEFINITION_OF_DONE.md: ${norm} (AGENTS §11).`,
      );
      continue;
    }

    // Regla AGENTS §6: Archivos de entorno (.env). Solo se permite .env.example
    const baseName = path.basename(norm);
    if (baseName.startsWith('.env') && !baseName.endsWith('.env.example')) {
      violations.push(`Archivo de entorno real prohibido en commits: ${norm} (AGENTS §6).`);
      continue;
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Construye el plan de verificaciones según el modo ('quick' | 'standard' | 'full').
 * @param {'quick'|'standard'|'full'} mode
 * @param {{ only?: string[], baseBranch?: string }} [options={}]
 * @returns {Array<{ id: string, name: string, group: string, command?: string, actionSuggestion?: string, timeoutMs?: number }>}
 */
export function buildExecutionPlan(mode, options = {}) {
  const plan = [];

  // 1. Grupo Convenciones (todos los modos)
  plan.push({
    id: 'branch-name',
    name: 'Nombre de la rama (AGENTS §8.1)',
    group: 'convenciones',
    actionSuggestion:
      'Renombra la rama siguiendo tipo/HU-xxx-descripcion (ej. feature/HU-002-logout-refresh).',
  });
  plan.push({
    id: 'commit-messages',
    name: 'Mensajes de commit (AGENTS §8.2)',
    group: 'convenciones',
    actionSuggestion:
      'Corrige los mensajes con git rebase -i asegurando Conventional Commits y pie Refs: HU-xxx, T-xxx-yy.',
  });
  plan.push({
    id: 'forbidden-files',
    name: 'Archivos prohibidos y secretos (AGENTS §6 y §11)',
    group: 'convenciones',
    actionSuggestion:
      'Elimina del commit archivos locales (AGENTS.md, plans, .env) o quítalos con git rm --cached.',
  });
  plan.push({
    id: 'branch-sync',
    name: 'Sincronía con rama base y sin conflictos',
    group: 'convenciones',
    actionSuggestion: 'Ejecuta git fetch origin develop && git rebase origin/develop para sincronizar.',
  });

  // 2. Calidad rápida y seguridad
  plan.push({
    id: 'env-parity',
    name: 'Paridad de variables de entorno (AGENTS §6)',
    group: 'calidad',
    command: 'pnpm check:env-parity',
    actionSuggestion:
      'Declara las variables faltantes en .env.example, deploy/stack.env.example o apps/backend/.env.example.',
    timeoutMs: 30_000,
  });
  plan.push({
    id: 'audit',
    name: 'Auditoría de dependencias (pnpm audit high/critical)',
    group: 'seguridad',
    command: 'pnpm audit --audit-level high',
    actionSuggestion: 'Actualiza o reemplaza dependencias con vulnerabilidades altas o críticas.',
    timeoutMs: 60_000,
  });
  plan.push({
    id: 'format',
    name: 'Verificación de formato Prettier',
    group: 'calidad',
    command: 'pnpm format:check',
    actionSuggestion: 'Ejecuta pnpm format para corregir el estilo de formato.',
    timeoutMs: 60_000,
  });
  plan.push({
    id: 'lint',
    name: 'Linter y tokens de diseño',
    group: 'calidad',
    command: 'pnpm lint',
    actionSuggestion: 'Corrige los errores de ESLint o violaciones de tokens de diseño.',
    timeoutMs: 120_000,
  });
  plan.push({
    id: 'depcruise',
    name: 'Arquitectura hexagonal (dependency-cruiser)',
    group: 'calidad',
    command: 'pnpm depcruise',
    actionSuggestion:
      'Respeta las fronteras de módulos (domain no importa infraestructura ni otros módulos).',
    timeoutMs: 60_000,
  });
  plan.push({
    id: 'typecheck',
    name: 'Comprobación estática de tipos (TypeScript)',
    group: 'calidad',
    command: 'pnpm typecheck',
    actionSuggestion: 'Corrige los errores de tipos reportados por tsc.',
    timeoutMs: 120_000,
  });
  plan.push({
    id: 'compose-config',
    name: 'Sintaxis y configuración de Docker Compose de producción',
    group: 'imagenes',
    command:
      'docker compose --env-file deploy/stack.env.example -f docker-compose.prod.yml config',
    actionSuggestion:
      'Verifica las variables y sintaxis en docker-compose.prod.yml y deploy/stack.env.example.',
    timeoutMs: 60_000,
  });
  plan.push({
    id: 'compose-hardening',
    name: 'Endurecimiento de Docker Compose de producción',
    group: 'imagenes',
    command:
      'docker compose --env-file deploy/stack.env.example -f docker-compose.prod.yml config --format json | node scripts/ci/verify-compose-hardening.mjs',
    actionSuggestion:
      'Corrige el seccomp, no-new-privileges o límites de recursos en docker-compose.prod.yml.',
    timeoutMs: 60_000,
  });

  // 3. Pasos adicionales para standard y full
  if (mode === 'standard' || mode === 'full') {
    plan.push({
      id: 'lockfile-consistency',
      name: 'Consistencia del lockfile (pnpm install --frozen-lockfile --lockfile-only)',
      group: 'calidad',
      command: 'pnpm install --frozen-lockfile --lockfile-only',
      actionSuggestion: 'Ejecuta pnpm install localmente para actualizar pnpm-lock.yaml.',
      timeoutMs: 60_000,
    });
    plan.push({
      id: 'disposable-db',
      name: 'Base de datos desechable y migraciones desde cero',
      group: 'calidad',
      command: 'pnpm --filter backend exec prisma migrate deploy',
      actionSuggestion: 'Revisa las migraciones de Prisma en prisma/migrations/.',
      timeoutMs: 120_000,
    });
    plan.push({
      id: 'integration-tests',
      name: 'Pruebas de integración con PostgreSQL real',
      group: 'calidad',
      command: 'pnpm --filter backend test:integration',
      actionSuggestion: 'Verifica la conectividad a PostgreSQL y corrige los tests de integración.',
      timeoutMs: 180_000,
    });
    plan.push({
      id: 'test-coverage',
      name: 'Pruebas unitarias con cobertura >= 80%',
      group: 'calidad',
      command: 'pnpm test:coverage',
      actionSuggestion: 'Añade pruebas para alcanzar el umbral mínimo del 80% de cobertura.',
      timeoutMs: 300_000,
    });
    plan.push({
      id: 'build',
      name: 'Compilación y empaquetado de artefactos',
      group: 'calidad',
      command: 'pnpm build',
      actionSuggestion: 'Corrige los errores de compilación en vite build o tsc build.',
      timeoutMs: 180_000,
    });
  }

  // 4. Pasos adicionales exclusivos para full
  if (mode === 'full') {
    plan.push({
      id: 'pdf-stability',
      name: 'Estabilidad de PDF con Chromium real (3 pasadas)',
      group: 'calidad',
      command:
        'pnpm --filter backend exec vitest run --project integration src/shared/pdf',
      actionSuggestion: 'Verifica el arranque de Chromium y timeouts de Puppeteer.',
      timeoutMs: 180_000,
    });
    plan.push({
      id: 'e2e',
      name: 'Pruebas end-to-end con Playwright',
      group: 'e2e',
      command: 'pnpm test:e2e',
      actionSuggestion: 'Revisa los reportes en apps/frontend/test-results/.',
      timeoutMs: 600_000,
    });
    plan.push({
      id: 'docker-smoke',
      name: 'Pruebas de humo de imágenes Docker y tipografía',
      group: 'imagenes',
      command: 'bash scripts/ci/smoke-image.sh',
      actionSuggestion: 'Asegúrate de que el demonio de Docker esté corriendo y las imágenes compilen.',
      timeoutMs: 600_000,
    });
  }

  // Filtro si se especificó options.only
  if (Array.isArray(options.only) && options.only.length > 0) {
    const onlySet = new Set(options.only);
    return plan.filter((check) => onlySet.has(check.id));
  }

  return plan;
}

/**
 * Calcula el estado global y código de salida según el resultado de los checks y el modo.
 * @param {Array<{ id: string, status: 'ok'|'failed'|'omitted' }>} checks
 * @param {'quick'|'standard'|'full'} mode
 * @returns {{ overallStatus: 'ok'|'failed'|'omitted', exitCode: 0|1|2 }}
 */
export function computeOverallStatus(checks, mode) {
  const hasFailures = checks.some((c) => c.status === 'failed');
  if (hasFailures) {
    return { overallStatus: 'failed', exitCode: 1 };
  }

  const hasOmitted = checks.some((c) => c.status === 'omitted');
  if (hasOmitted) {
    // En modo quick, los omitidos se tratan como advertencia no bloqueante
    if (mode === 'quick') {
      return { overallStatus: 'ok', exitCode: 0 };
    }
    return { overallStatus: 'omitted', exitCode: 2 };
  }

  return { overallStatus: 'ok', exitCode: 0 };
}

/**
 * Construye el objeto JSON para last-report.json.
 * @param {Object} data
 * @returns {Object}
 */
export function createReportJson(data) {
  const { overallStatus, exitCode } = computeOverallStatus(data.checks || [], data.mode);
  return {
    version: '1.0.0',
    branch: data.branch,
    headSha: data.headSha,
    baseSha: data.baseSha,
    mode: data.mode,
    clean: Boolean(data.clean),
    repeat: data.repeat || 1,
    cleanWorkingTree: Boolean(data.cleanWorkingTree),
    startedAt: data.startedAt,
    completedAt: data.completedAt,
    overallStatus,
    exitCode,
    checks: data.checks || [],
  };
}

/**
 * Formatea una tabla amigable para terminal con los resultados.
 * @param {Object} report
 * @returns {string}
 */
export function formatReportTable(report) {
  const lines = [];
  lines.push('');
  lines.push('======================================================================');
  lines.push(` REPORTE DE VERIFICACIÓN LOCAL DE PR (Modo: ${report.mode})`);
  lines.push(` Rama: ${report.branch} | Commit: ${report.headSha}`);
  lines.push('======================================================================');

  for (const check of report.checks) {
    let icon = '✔';
    if (check.status === 'failed') icon = '✖';
    else if (check.status === 'omitted') icon = '⚠';

    const dur = check.durationMs !== undefined ? `(${(check.durationMs / 1000).toFixed(1)}s)` : '';
    lines.push(` ${icon} [${check.status.toUpperCase()}] ${check.name} ${dur}`);
    if (check.reason) {
      lines.push(`     Motivo: ${check.reason}`);
    }
    if (check.error) {
      lines.push(`     Error: ${check.error}`);
    }
    if (check.actionSuggestion && check.status === 'failed') {
      lines.push(`     👉 Acción sugerida: ${check.actionSuggestion}`);
    }
  }

  lines.push('----------------------------------------------------------------------');
  lines.push(` Resultado global: ${report.overallStatus.toUpperCase()} (Código: ${report.exitCode})`);
  lines.push('======================================================================');
  lines.push('');

  return lines.join('\n');
}
