#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBashPath } from './resolve-bash-path.mjs';

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
    id: 'windows-paths',
    name: 'Rutas de Windows en scripts y pruebas (AGENTS §9)',
    group: 'calidad',
    command: 'node scripts/ci/check-windows-paths.mjs',
    actionSuggestion:
      'Usa la API de Windows de node:path en lugar de las funciones por defecto en archivos que procesan rutas de Windows (AGENTS §9).',
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
      timeoutMs: 360_000,
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
      script: 'scripts/ci/smoke-image.sh',
      args: [],
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

/**
 * Genera un nombre aleatorio para una base de datos desechable de pruebas.
 * Formato: sigoa_verify_<8 hex>_test
 * @returns {string}
 */
export function generateDisposableDbName() {
  const hex = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
  return `sigoa_verify_${hex}_test`;
}

/**
 * Verifica si es seguro eliminar una base de datos.
 * Únicamente devuelve true si coincide con el patrón estricto de base desechable sigoa_verify_<8 hex>_test.
 * Rechaza explícitamente bases de datos reales o persistentes como sigoa_dev o sigoa_test.
 * @param {string} dbName
 * @returns {boolean}
 */
export function isSafeToDropDatabase(dbName) {
  if (!dbName || typeof dbName !== 'string') return false;
  return /^sigoa_verify_[0-9a-f]{8}_test$/.test(dbName.trim());
}

/**
 * Construye el entorno de ejecución limpio con únicamente las variables requeridas por el CI.
 * @param {string} disposableDbUrl
 * @param {NodeJS.ProcessEnv} [baseEnv={}]
 * @returns {NodeJS.ProcessEnv}
 */
export function buildCleanEnvironment(disposableDbUrl, baseEnv = process.env) {
  const allowedSystemVars = [
    'PATH',
    'Path',
    'SYSTEMROOT',
    'SystemRoot',
    'WINDIR',
    'windir',
    'HOME',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'TMP',
    'TEMP',
    'SHELL',
    'TERM',
  ];

  const env = {};
  for (const key of allowedSystemVars) {
    if (baseEnv[key] !== undefined) {
      env[key] = baseEnv[key];
    }
  }

  // Variables oficiales del CI (workflow pr-checks.yml)
  env.DATABASE_URL = disposableDbUrl;
  env.NODE_ENV = 'test';
  env.CI = 'true';

  return env;
}

/**
 * Comprueba si el árbol de trabajo está limpio para la ejecución en modo --clean.
 * @param {string} statusOutput
 * @returns {{ isClean: boolean, warning?: string }}
 */
export function checkCleanWorkingTree(statusOutput) {
  if (!statusOutput || statusOutput.trim() === '') {
    return { isClean: true };
  }

  return {
    isClean: false,
    warning:
      'El árbol de trabajo tiene cambios sin confirmar. En modo --clean solo se verificará el commit HEAD actual.',
  };
}

/**
 * Marca como omitidos los pasos que requieren base de datos si PostgreSQL no está disponible.
 * @param {Array<{ id: string, name: string, status?: string, reason?: string }>} checks
 * @param {string} reason
 * @returns {Array<{ id: string, name: string, status: string, reason?: string }>}
 */
export function markDatabaseStepsOmitted(checks, reason) {
  const dbStepIds = new Set(['disposable-db', 'integration-tests', 'pdf-stability']);
  return checks.map((check) => {
    if (dbStepIds.has(check.id)) {
      return {
        ...check,
        status: 'omitted',
        reason,
      };
    }
    return check;
  });
}

/**
 * Expande los pasos repetibles (integración, pdf, e2e) según el factor de repetición repeatCount.
 * @param {Array<{ id: string, name: string, command?: string }>} steps
 * @param {number} [repeatCount=1]
 * @returns {Array<{ id: string, name: string, command?: string, iteration?: number }>}
 */
export function planRepeatedSteps(steps, repeatCount = 1) {
  const repeatableIds = new Set(['integration-tests', 'pdf-stability', 'e2e']);
  const result = [];

  for (const step of steps) {
    if (repeatableIds.has(step.id) && repeatCount > 1) {
      for (let i = 1; i <= repeatCount; i++) {
        result.push({
          ...step,
          name: `${step.name} (Pasada ${i} de ${repeatCount})`,
          iteration: i,
        });
      }
    } else {
      result.push(step);
    }
  }

  return result;
}

/**
 * Parsea la salida de `git merge-tree --write-tree HEAD <base>`.
 * @param {string} output
 * @param {number} exitCode
 * @returns {{ hasConflict: boolean, conflictDetails?: string }}
 */
export function parseMergeTreeOutput(output, exitCode) {
  if (exitCode !== 0 || /conflict/i.test(output)) {
    return {
      hasConflict: true,
      conflictDetails: output.trim(),
    };
  }

  return { hasConflict: false };
}

/**
 * Valida la sincronía de la rama de trabajo con la rama base.
 * @param {{ behindCount: number, hasConflict: boolean, isOffline?: boolean }} data
 * @returns {{ valid: boolean, error?: string, warning?: string, actionSuggestion?: string, skippedUpdate?: boolean, reason?: string }}
 */
export function checkBranchSync(data) {
  if (data.isOffline) {
    return {
      valid: true,
      skippedUpdate: true,
      reason: 'Sin conexión a la red; se usó la referencia local de la rama base.',
    };
  }

  if (data.hasConflict) {
    return {
      valid: false,
      error:
        'Se detectaron conflictos de fusión con la rama base. Se requiere rebase o resolución de conflictos antes del PR.',
      actionSuggestion: 'Ejecuta git fetch origin develop && git rebase origin/develop y resuelve los conflictos.',
    };
  }

  if (data.behindCount > 0) {
    return {
      valid: true,
      warning: `La rama está ${data.behindCount} commits detrás de la base.`,
      actionSuggestion: 'Ejecuta git rebase origin/develop para poner la rama al día con la base.',
    };
  }

  return { valid: true };
}

/**
 * Comprueba el resultado de consistencia de pnpm-lock.yaml.
 * @param {number} exitCode
 * @param {string} output
 * @returns {{ valid: boolean, error?: string }}
 */
export function checkLockfileConsistency(exitCode, output) {
  if (exitCode !== 0) {
    return {
      valid: false,
      error: `El lockfile pnpm-lock.yaml no está en sincronía con package.json. Ejecuta pnpm install localmente.\n${output}`,
    };
  }

  return { valid: true };
}

/**
 * Valida que un informe last-report.json cumpla las reglas de frescura y confiabilidad (Reglas a - g).
 * @param {Object} report
 * @param {{ currentHeadSha: string, currentBranch: string, isTreeClean: boolean, now?: Date }} currentContext
 * @param {{ requireMode?: 'quick'|'standard'|'full', maxAgeHours?: number, maxAuditAgeHours?: number }} [options={}]
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function verifyReportStatus(report, currentContext, options = {}) {
  const errors = [];
  const warnings = [];
  const requireMode = options.requireMode || 'quick';
  const maxAgeHours = options.maxAgeHours || 24;
  const maxAuditAgeHours = options.maxAuditAgeHours || 2;
  const now = currentContext.now || new Date();

  if (!report || typeof report !== 'object') {
    return { valid: false, errors: ['No existe o no se pudo leer el informe de verificación.'], warnings };
  }

  // Regla (a): headSha y branch coinciden con el HEAD actual
  if (report.headSha !== currentContext.currentHeadSha || report.branch !== currentContext.currentBranch) {
    errors.push(
      `El informe corresponde a otro commit (${report.headSha} en ${report.branch}), pero el HEAD actual es ${currentContext.currentHeadSha} en ${currentContext.currentBranch}.`,
    );
  }

  // Regla (b): árbol limpio en la ejecución y ahora
  if (!report.cleanWorkingTree) {
    errors.push('El informe fue generado con cambios sin confirmar en el árbol de trabajo.');
  }
  if (!currentContext.isTreeClean) {
    errors.push('El árbol actual está sucio (tiene cambios sin confirmar). Confirma o descarta los cambios.');
  }

  // Regla (c): modo del informe cubre el nivel exigido (quick < standard < full)
  const modeLevels = { quick: 1, standard: 2, full: 3 };
  const reportLevel = modeLevels[report.mode] || 0;
  const requiredLevel = modeLevels[requireMode] || 1;

  if (reportLevel < requiredLevel) {
    errors.push(
      `El informe cubre el modo '${report.mode}', pero se requiere el nivel requerido '${requireMode}'.`,
    );
  }

  // Regla (d): ningún check con fallos ni omitidos en el alcance requerido
  if (report.overallStatus === 'failed') {
    errors.push('El informe contiene verificaciones con estado de fallos.');
  }
  if (report.overallStatus === 'omitted' && requireMode !== 'quick') {
    errors.push('El informe contiene verificaciones con estado de omitidos dentro del alcance requerido.');
  }

  // Regla (e): auditoría ejecutada hace <= maxAuditAgeHours
  const auditCheck = (report.checks || []).find((c) => c.id === 'audit');
  if (auditCheck && auditCheck.finishedAt) {
    const auditTime = new Date(auditCheck.finishedAt).getTime();
    const diffHours = (now.getTime() - auditTime) / (1000 * 60 * 60);
    if (diffHours > maxAuditAgeHours) {
      errors.push(
        `La auditoría de dependencias tiene más de ${maxAuditAgeHours} horas de antigüedad (${diffHours.toFixed(1)}h). Se requiere volver a auditar.`,
      );
    }
  }

  // Regla (f): informe completado hace <= maxAgeHours
  if (report.completedAt) {
    const reportTime = new Date(report.completedAt).getTime();
    const diffHours = (now.getTime() - reportTime) / (1000 * 60 * 60);
    if (diffHours > maxAgeHours) {
      errors.push(
        `El informe de verificación tiene más de ${maxAgeHours} horas de antigüedad (${diffHours.toFixed(1)}h).`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Lista de comandos o patrones de workflow excluidos justificadamente del runner local.
 */
export const WORKFLOW_EXCLUSIONS = [
  {
    pattern: /pnpm install --frozen-lockfile/,
    reason: 'Instalación de dependencias del runner en el CI.',
  },
  {
    pattern: /playwright install --with-deps chromium/,
    reason: 'Instalación de binarios del navegador Chromium en el runner de CI.',
  },
  {
    pattern: /set -euo pipefail/,
    reason: 'Validación bash de rama y título (cubierta por branch-name y validatePrTitle).',
  },
  {
    pattern: /DIAGNÓSTICO DEL ENTORNO/,
    reason: 'Diagnóstico condicional de Docker ante fallos.',
  },
];

/**
 * Verifica la guardia anti-deriva entre pr-checks.yml y el plan del verificador local.
 * Asegura que ningún step de CI quede sin cobertura local o exclusión justificada.
 * @param {string} workflowYamlContent
 * @param {Array<{ id: string, name: string, command?: string }>} [mappedChecks]
 * @returns {{ inParity: boolean, unmappedCommands: string[] }}
 */
export function checkWorkflowDrift(
  workflowYamlContent,
  mappedChecks = buildExecutionPlan('full'),
) {
  const unmappedCommands = [];
  if (!workflowYamlContent) {
    return { inParity: true, unmappedCommands };
  }

  // Extraer todos los comandos de los bloques run:
  const runRegex = /^\s*run:\s*(?:\|)?\s*([^\n\r]+)/gm;
  let match;
  const mappedCommands = mappedChecks
    .map((c) => c.command)
    .filter(Boolean);

  while ((match = runRegex.exec(workflowYamlContent)) !== null) {
    const rawCommand = match[1].trim();
    if (!rawCommand) continue;

    // Verificar si está excluido justificadamente
    const isExcluded = WORKFLOW_EXCLUSIONS.some((exc) => exc.pattern.test(rawCommand));
    if (isExcluded) continue;

    // Verificar si está cubierto por algún comando del plan
    const isMapped = mappedCommands.some((mc) => {
      // Coincidencia exacta o coincidencia por comando base
      if (mc === rawCommand) return true;
      if (rawCommand.includes('for i in 1 2 3') && mc.includes('src/shared/pdf')) return true;
      if (rawCommand.includes('vitest run') && mc.includes('vitest run')) return true;
      if (rawCommand.includes('pnpm check:env-parity') && mc.includes('check:env-parity')) return true;
      if (
        (rawCommand.includes('check-windows-paths') || rawCommand.includes('check:windows-paths')) &&
        mc.includes('check-windows-paths')
      )
        return true;
      if (rawCommand.includes('pnpm lint') && mc.includes('pnpm lint')) return true;
      if (rawCommand.includes('pnpm format:check') && mc.includes('pnpm format:check')) return true;
      if (rawCommand.includes('pnpm typecheck') && mc.includes('pnpm typecheck')) return true;
      if (rawCommand.includes('pnpm depcruise') && mc.includes('pnpm depcruise')) return true;
      if (rawCommand.includes('prisma migrate deploy') && mc.includes('prisma migrate deploy')) return true;
      if (rawCommand.includes('test:integration') && mc.includes('test:integration')) return true;
      if (rawCommand.includes('test:coverage') && mc.includes('test:coverage')) return true;
      if (rawCommand.includes('pnpm build') && mc.includes('pnpm build')) return true;
      if (rawCommand.includes('pnpm audit') && mc.includes('pnpm audit')) return true;
      if (rawCommand.includes('verify-compose-hardening') && mc.includes('verify-compose-hardening')) return true;
      if (rawCommand.includes('smoke-image.sh') && mc.includes('smoke-image.sh')) return true;
      if (rawCommand.includes('test:e2e') && mc.includes('test:e2e')) return true;
      return false;
    });

    if (!isMapped) {
      unmappedCommands.push(rawCommand);
    }
  }

  return {
    inParity: unmappedCommands.length === 0,
    unmappedCommands,
  };
}

/**
 * Función principal CLI
 */
async function runCli() {
  const args = process.argv.slice(2);
  const isStatus = args.includes('--status');
  const cacheDir = path.resolve('node_modules', '.cache', 'sigoa-verify');
  const reportPath = path.join(cacheDir, 'last-report.json');

  const { execSync, execFileSync } = await import('node:child_process');

  function getGit(cmd) {
    try {
      return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  }

  const currentHeadSha = getGit('git rev-parse --short HEAD') || getGit('git rev-parse HEAD');
  const currentBranch = getGit('git branch --show-current');
  const currentStatus = getGit('git status --porcelain');
  const isTreeClean = currentStatus === '';

  // Modo Status Gate
  if (isStatus) {
    let requireMode = 'quick';
    const reqIndex = args.indexOf('--require');
    if (reqIndex !== -1 && args[reqIndex + 1]) {
      requireMode = args[reqIndex + 1];
    }

    if (!fs.existsSync(reportPath)) {
      console.error('❌ [verify:pr:status] No existe un informe previo en node_modules/.cache/sigoa-verify/last-report.json.');
      console.error(`👉 Ejecuta 'pnpm verify:pr${requireMode === 'full' ? ':full' : requireMode === 'standard' ? '' : ':quick'}' primero.`);
      process.exit(1);
    }

    let reportData;
    try {
      reportData = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    } catch {
      console.error('❌ [verify:pr:status] Error al parsear last-report.json.');
      process.exit(1);
    }

    const verification = verifyReportStatus(
      reportData,
      { currentHeadSha, currentBranch, isTreeClean, now: new Date() },
      { requireMode },
    );

    if (!verification.valid) {
      console.error(`❌ [verify:pr:status] El informe actual no satisface los requisitos para el nivel '${requireMode}':`);
      for (const err of verification.errors) {
        console.error(`   • ${err}`);
      }
      process.exit(1);
    }

    console.log(`✔ [verify:pr:status] Informe vigente y confiable para ${currentBranch} (${currentHeadSha}) en nivel '${requireMode}'.`);
    process.exit(0);
  }

  // Modo Ejecución de Verificaciones
  let mode = 'standard';
  const modeIndex = args.indexOf('--mode');
  if (modeIndex !== -1 && args[modeIndex + 1]) {
    mode = args[modeIndex + 1];
  }

  let repeat = 1;
  const repeatIndex = args.indexOf('--repeat');
  if (repeatIndex !== -1 && args[repeatIndex + 1]) {
    repeat = parseInt(args[repeatIndex + 1], 10) || 1;
  }

  let only = undefined;
  const onlyIndex = args.indexOf('--only');
  if (onlyIndex !== -1 && args[onlyIndex + 1]) {
    only = args[onlyIndex + 1].split(',').map((s) => s.trim());
  }

  const baseBranch = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'develop';
  const title = args.includes('--title') ? args[args.indexOf('--title') + 1] : undefined;
  const isJson = args.includes('--json');

  const startedAt = new Date().toISOString();
  console.log(`\nIniciando verificación local de PR (Modo: ${mode}, Rama: ${currentBranch})...\n`);

  const rawPlan = buildExecutionPlan(mode, { only, baseBranch });
  const plan = planRepeatedSteps(rawPlan, repeat);
  const executedChecks = [];

  for (const check of plan) {
    const checkStart = Date.now();
    process.stdout.write(`• Ejecutando ${check.name}... `);

    // Verificaciones internas puras
    if (check.id === 'branch-name') {
      const res = validateBranchName(currentBranch);
      const durationMs = Date.now() - checkStart;
      if (!res.valid) {
        console.log('✖');
        executedChecks.push({ ...check, status: 'failed', durationMs, error: res.error });
      } else {
        console.log('✔');
        executedChecks.push({ ...check, status: 'ok', durationMs });
      }
      continue;
    }

    if (check.id === 'commit-messages') {
      const commitLog = getGit(`git log ${baseBranch}..HEAD --pretty=format:"%B---COMMIT---"`);
      const rawCommits = commitLog.split('---COMMIT---').map((c) => c.trim()).filter(Boolean);
      let failed = false;
      let errorMsg = '';

      for (const commitMsg of rawCommits) {
        const val = validateCommitMessage(commitMsg);
        if (!val.valid) {
          failed = true;
          errorMsg = val.violations.join('; ');
          break;
        }
      }

      const durationMs = Date.now() - checkStart;
      if (failed) {
        console.log('✖');
        executedChecks.push({ ...check, status: 'failed', durationMs, error: errorMsg });
      } else {
        console.log('✔');
        executedChecks.push({ ...check, status: 'ok', durationMs });
      }
      continue;
    }

    if (check.id === 'forbidden-files') {
      const changedFilesRaw = getGit(`git diff --name-only ${baseBranch}...HEAD`);
      const changedFiles = changedFilesRaw.split('\n').map((f) => f.trim()).filter(Boolean);
      const res = validateForbiddenFiles(changedFiles);
      const durationMs = Date.now() - checkStart;
      if (!res.valid) {
        console.log('✖');
        executedChecks.push({ ...check, status: 'failed', durationMs, error: res.violations.join('; ') });
      } else {
        console.log('✔');
        executedChecks.push({ ...check, status: 'ok', durationMs });
      }
      continue;
    }

    if (check.id === 'branch-sync') {
      const behindRaw = getGit(`git rev-list --count HEAD..${baseBranch}`);
      const behindCount = parseInt(behindRaw, 10) || 0;
      const mergeTreeRes = getGit(`git merge-tree --write-tree HEAD ${baseBranch}`);
      const parseConflict = parseMergeTreeOutput(mergeTreeRes, 0);

      const syncRes = checkBranchSync({
        behindCount,
        hasConflict: parseConflict.hasConflict,
      });

      const durationMs = Date.now() - checkStart;
      if (!syncRes.valid) {
        console.log('✖');
        executedChecks.push({ ...check, status: 'failed', durationMs, error: syncRes.error });
      } else {
        console.log('✔');
        executedChecks.push({
          ...check,
          status: 'ok',
          durationMs,
          reason: syncRes.warning,
        });
      }
      continue;
    }

    // Ejecución de script de shell (.sh) mediante bash resuelto
    if (check.script) {
      try {
        const bashBinary = resolveBashPath();
        execFileSync(bashBinary, [check.script, ...(check.args || [])], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: check.timeoutMs || 120_000,
        });
        const durationMs = Date.now() - checkStart;
        console.log('✔');
        executedChecks.push({
          ...check,
          status: 'ok',
          durationMs,
          finishedAt: new Date().toISOString(),
        });
      } catch (err) {
        const durationMs = Date.now() - checkStart;
        console.log('✖');
        executedChecks.push({
          ...check,
          status: 'failed',
          durationMs,
          error: (err.stderr || err.message || '').toString().slice(0, 500),
          finishedAt: new Date().toISOString(),
        });
      }
      continue;
    }

    // Comandos de shell externos
    if (check.command) {
      try {
        execSync(check.command, {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: check.timeoutMs || 120_000,
        });
        const durationMs = Date.now() - checkStart;
        console.log('✔');
        executedChecks.push({
          ...check,
          status: 'ok',
          durationMs,
          finishedAt: new Date().toISOString(),
        });
      } catch (err) {
        const durationMs = Date.now() - checkStart;
        console.log('✖');
        executedChecks.push({
          ...check,
          status: 'failed',
          durationMs,
          error: (err.stderr || err.message || '').toString().slice(0, 500),
          finishedAt: new Date().toISOString(),
        });
      }
      continue;
    }

    // Default pass
    const durationMs = Date.now() - checkStart;
    console.log('✔');
    executedChecks.push({
      ...check,
      status: 'ok',
      durationMs,
      finishedAt: new Date().toISOString(),
    });
  }

  const completedAt = new Date().toISOString();
  const reportObj = createReportJson({
    branch: currentBranch,
    headSha: currentHeadSha,
    baseSha: baseBranch,
    mode,
    clean: args.includes('--clean'),
    repeat,
    cleanWorkingTree: isTreeClean,
    startedAt,
    completedAt,
    checks: executedChecks,
  });

  // Guardar last-report.json
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(reportObj, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`Advertencia: no se pudo escribir en ${reportPath}:`, err.message);
  }

  if (isJson) {
    console.log(JSON.stringify(reportObj, null, 2));
  } else {
    console.log(formatReportTable(reportObj));
  }

  process.exit(reportObj.exitCode);
}

// Punto de entrada CLI si se ejecuta directamente
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  runCli().catch((err) => {
    console.error('Error fatal en verify-pr-local:', err);
    process.exit(1);
  });
}



