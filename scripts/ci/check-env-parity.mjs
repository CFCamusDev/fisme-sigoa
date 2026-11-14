#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {Object} EnvParityInputs
 * @property {string[]} backendVariables
 * @property {string[]} productionRequiredVariables
 * @property {string[]} strictRequiredVariables
 * @property {string} backendExampleContent
 * @property {string} composeDevContent
 * @property {string} composeProdContent
 * @property {string} rootExampleContent
 * @property {string} stackExampleContent
 * @property {string} prChecksContent
 * @property {string[]} frontendVariables
 * @property {string} frontendExampleContent
 * @property {string} frontendDockerfileContent
 */

/**
 * Parsea declaraciones de variables en un archivo .env o .env.example.
 * Acepta tanto variables activas como comentadas (# VAR=val o #VAR=val).
 * @param {string} content
 * @returns {Set<string>}
 */
export function parseEnvDeclarations(content) {
  const vars = new Set();
  if (!content) return vars;

  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Acepta VAR=..., export VAR=..., # VAR=..., #VAR=...
    const match = line.match(/^(?:#\s*)?(?:export\s+)?([A-Z0-9_]+)\s*[:=]/);
    if (match && match[1]) {
      vars.add(match[1]);
    }
  }

  return vars;
}

/**
 * Extrae variables del bloque environment de un servicio en Docker Compose.
 * Soporta formato objeto (VAR: val) y formato array (- VAR=val o - VAR).
 * @param {string} composeContent
 * @param {string} [serviceName='backend']
 * @returns {Set<string>}
 */
export function extractComposeEnvironmentKeys(composeContent, serviceName = 'backend') {
  const keys = new Set();
  if (!composeContent) return keys;

  const lines = composeContent.split('\n');
  let inService = false;
  let serviceIndent = -1;
  let inEnv = false;
  let envIndent = -1;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);

    const serviceMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*$/);
    if (serviceMatch) {
      if (serviceMatch[2] === serviceName) {
        inService = true;
        serviceIndent = serviceMatch[1].length;
        inEnv = false;
        continue;
      } else if (inService && serviceMatch[1].length <= serviceIndent) {
        inService = false;
        inEnv = false;
      }
    }

    if (inService) {
      const envHeaderMatch = line.match(/^(\s*)environment:\s*$/);
      if (envHeaderMatch && envHeaderMatch[1].length > serviceIndent) {
        inEnv = true;
        envIndent = envHeaderMatch[1].length;
        continue;
      }

      if (inEnv) {
        if (indent <= envIndent) {
          inEnv = false;
        } else {
          const keyMatch = line.trim().match(/^(?:-\s*)?([A-Z0-9_]+)\s*[:=]/);
          if (keyMatch && keyMatch[1]) {
            keys.add(keyMatch[1]);
          }
        }
      }
    }
  }

  return keys;
}

/**
 * Extrae build.args de un servicio en Docker Compose.
 * @param {string} composeContent
 * @param {string} [serviceName='frontend']
 * @returns {Set<string>}
 */
export function extractComposeBuildArgs(composeContent, serviceName = 'frontend') {
  const keys = new Set();
  if (!composeContent) return keys;

  const lines = composeContent.split('\n');
  let inService = false;
  let serviceIndent = -1;
  let inArgs = false;
  let argsIndent = -1;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);

    const serviceMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*$/);
    if (serviceMatch) {
      if (serviceMatch[2] === serviceName) {
        inService = true;
        serviceIndent = serviceMatch[1].length;
        inArgs = false;
        continue;
      } else if (inService && serviceMatch[1].length <= serviceIndent) {
        inService = false;
        inArgs = false;
      }
    }

    if (inService) {
      const argsHeaderMatch = line.match(/^(\s*)args:\s*$/);
      if (argsHeaderMatch && argsHeaderMatch[1].length > serviceIndent) {
        inArgs = true;
        argsIndent = argsHeaderMatch[1].length;
        continue;
      }

      if (inArgs) {
        if (indent <= argsIndent) {
          inArgs = false;
        } else {
          const keyMatch = line.trim().match(/^(?:-\s*)?([A-Z0-9_]+)\s*[:=]/);
          if (keyMatch && keyMatch[1]) {
            keys.add(keyMatch[1]);
          }
        }
      }
    }
  }

  return keys;
}

/**
 * Extrae variables requeridas en un archivo compose con sintaxis ${VAR:?...}
 * @param {string} composeContent
 * @returns {Set<string>}
 */
export function extractRequiredComposeEnvVars(composeContent) {
  const vars = new Set();
  if (!composeContent) return vars;

  const regex = /\$\{([A-Z0-9_]+):\?[^}]*\}/g;
  let match;
  while ((match = regex.exec(composeContent)) !== null) {
    vars.add(match[1]);
  }
  return vars;
}

/**
 * Extrae variables del bloque env de un job específico en pr-checks.yml.
 * @param {string} workflowContent
 * @param {string} jobName
 * @returns {Set<string>}
 */
export function extractJobEnvs(workflowContent, jobName) {
  const vars = new Set();
  if (!workflowContent) return vars;

  const lines = workflowContent.split('\n');
  let inJob = false;
  let jobIndent = -1;
  let inEnv = false;
  let envIndent = -1;

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);

    const jobMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*$/);
    if (jobMatch) {
      if (jobMatch[2] === jobName) {
        inJob = true;
        jobIndent = jobMatch[1].length;
        inEnv = false;
        continue;
      } else if (inJob && jobMatch[1].length <= jobIndent) {
        inJob = false;
        inEnv = false;
      }
    }

    if (inJob) {
      const envHeaderMatch = line.match(/^(\s*)env:\s*$/);
      if (envHeaderMatch && envHeaderMatch[1].length > jobIndent) {
        inEnv = true;
        envIndent = envHeaderMatch[1].length;
        continue;
      }

      if (inEnv) {
        if (indent <= envIndent) {
          inEnv = false;
        } else {
          const keyMatch = line.trim().match(/^([A-Z0-9_]+)\s*:/);
          if (keyMatch && keyMatch[1]) {
            vars.add(keyMatch[1]);
          }
        }
      }
    }
  }

  return vars;
}

/**
 * Extrae instrucciones ARG de un Dockerfile.
 * @param {string} dockerfileContent
 * @returns {Set<string>}
 */
export function extractDockerfileArgs(dockerfileContent) {
  const args = new Set();
  if (!dockerfileContent) return args;

  const lines = dockerfileContent.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(/^ARG\s+([A-Z0-9_]+)/i);
    if (match && match[1]) {
      args.add(match[1]);
    }
  }

  return args;
}

/**
 * Función pura que analiza las entradas y devuelve la lista de violaciones de paridad.
 * @param {EnvParityInputs} inputs
 * @returns {string[]}
 */
export function checkEnvParity(inputs) {
  const errors = [];

  if (!inputs.backendVariables || inputs.backendVariables.length === 0) {
    return ['No se pudieron leer las variables del backend desde env.ts o la lista está vacía.'];
  }

  const backendExampleVars = parseEnvDeclarations(inputs.backendExampleContent);
  const composeDevBackendVars = extractComposeEnvironmentKeys(inputs.composeDevContent, 'backend');
  const composeProdBackendVars = extractComposeEnvironmentKeys(inputs.composeProdContent, 'backend');
  const rootExampleVars = parseEnvDeclarations(inputs.rootExampleContent);
  const stackExampleVars = parseEnvDeclarations(inputs.stackExampleContent);
  const frontendExampleVars = parseEnvDeclarations(inputs.frontendExampleContent);
  const dockerfileArgs = extractDockerfileArgs(inputs.frontendDockerfileContent);
  const composeDevFrontendArgs = extractComposeBuildArgs(inputs.composeDevContent, 'frontend');
  const composeProdFrontendArgs = extractComposeBuildArgs(inputs.composeProdContent, 'frontend');
  const composeDevFrontendEnv = extractComposeEnvironmentKeys(inputs.composeDevContent, 'frontend');
  const composeProdFrontendEnv = extractComposeEnvironmentKeys(inputs.composeProdContent, 'frontend');

  // Regla C1: Toda variable de env.ts debe estar declarada en apps/backend/.env.example
  for (const variable of inputs.backendVariables) {
    if (!backendExampleVars.has(variable)) {
      errors.push(
        `[C1] ${variable}: falta declarar en apps/backend/.env.example. Acción: agrega la variable con un valor de ejemplo o comentada.`,
      );
    }
  }

  // Regla C2: Toda variable de env.ts debe llegar al contenedor en docker-compose.yml y docker-compose.prod.yml
  for (const variable of inputs.backendVariables) {
    if (!composeDevBackendVars.has(variable)) {
      errors.push(
        `[C2] ${variable}: no llega al contenedor en docker-compose.yml. Acción: agrega "${variable}: \${${variable}:-...}" en environment del servicio backend.`,
      );
    }
    if (!composeProdBackendVars.has(variable)) {
      errors.push(
        `[C2] ${variable}: no llega al contenedor en docker-compose.prod.yml. Acción: agrega "${variable}: \${${variable}:-...}" en environment del servicio backend.`,
      );
    }
  }

  // Regla C3: Ejemplos del operador (deploy/stack.env.example)
  // (a) Variables requeridas en producción
  const isDatabaseUrlDerivedInStack =
    stackExampleVars.has('APP_DB_USER') &&
    stackExampleVars.has('APP_DB_PASSWORD') &&
    stackExampleVars.has('DB_NAME');

  for (const variable of inputs.productionRequiredVariables) {
    if (variable === 'DATABASE_URL' && isDatabaseUrlDerivedInStack) {
      // Excepción documentada: DATABASE_URL se deriva en el compose de producción
      continue;
    }
    if (!stackExampleVars.has(variable)) {
      errors.push(
        `[C3] ${variable}: requerida en producción pero no declarada en deploy/stack.env.example. Acción: declara la variable con su valor de ejemplo.`,
      );
    }
  }

  // (b) Variables requeridas en docker-compose.prod.yml con ${VAR:?...}
  const requiredInProdCompose = extractRequiredComposeEnvVars(inputs.composeProdContent);
  for (const variable of requiredInProdCompose) {
    if (!stackExampleVars.has(variable)) {
      errors.push(
        `[C3] ${variable}: requerida en docker-compose.prod.yml pero no declarada en deploy/stack.env.example. Acción: declara la variable en el archivo de ejemplo.`,
      );
    }
  }

  // Regla C4: Variables requeridas sin defaults en jobs de CI (pr-checks.yml)
  const calidadJobs = ['estaticas', 'unitarias', 'integracion'];
  const e2eJobs = ['e2e'];

  for (const jobId of [...calidadJobs, ...e2eJobs]) {
    const jobEnvs = extractJobEnvs(inputs.prChecksContent, jobId);
    for (const variable of inputs.strictRequiredVariables) {
      if (!jobEnvs.has(variable)) {
        errors.push(
          `[C4] ${variable}: obligatoria sin valor por defecto y ausente en el env del job "${jobId}" de .github/workflows/pr-checks.yml. Acción: agrega "${variable}: ..." en env: del job.`,
        );
      }
    }
  }

  // Regla C5: Frontend (variables VITE_*)
  for (const variable of inputs.frontendVariables) {
    if (!frontendExampleVars.has(variable)) {
      errors.push(
        `[C5] ${variable}: no declarada en apps/frontend/.env.example. Acción: agrégala con un valor de ejemplo.`,
      );
    }
    if (!rootExampleVars.has(variable)) {
      errors.push(
        `[C5] ${variable}: no declarada en .env.example (raíz). Acción: agrégala con un valor de ejemplo.`,
      );
    }
    if (!stackExampleVars.has(variable)) {
      errors.push(
        `[C5] ${variable}: no declarada en deploy/stack.env.example. Acción: agrégala con un valor de ejemplo.`,
      );
    }
    if (!dockerfileArgs.has(variable)) {
      errors.push(
        `[C5] ${variable}: no declarada como ARG en apps/frontend/Dockerfile. Acción: agrega "ARG ${variable}".`,
      );
    }
    const arrivesInDev = composeDevFrontendArgs.has(variable) || composeDevFrontendEnv.has(variable);
    if (!arrivesInDev) {
      errors.push(
        `[C5] ${variable}: no llega como argumento o environment en docker-compose.yml. Acción: agrégala en build.args del servicio frontend.`,
      );
    }
    const arrivesInProd = composeProdFrontendArgs.has(variable) || composeProdFrontendEnv.has(variable);
    if (!arrivesInProd) {
      errors.push(
        `[C5] ${variable}: no llega como argumento o environment en docker-compose.prod.yml. Acción: agrégala en build.args del servicio frontend.`,
      );
    }
  }

  return errors;
}

/**
 * Lee claves de variables del backend desde el texto de apps/backend/src/config/env.ts
 * @param {string} envTsContent
 * @returns {string[]}
 */
export function extractBackendVariableNames(envTsContent) {
  const vars = [];
  if (!envTsContent) return vars;

  // Busca el bloque z.object({...}) hasta el cierre previo a .superRefine o .transform
  const objectMatch = envTsContent.match(
    /export\s+const\s+envSchema\s*=\s*z\s*\.object\s*\(\s*\{([\s\S]*?)\n\s{2}\}\)\s*\n\s{2}\.(?:superRefine|transform)/,
  );
  if (!objectMatch) {
    // Alternativa simple por si no tiene superRefine
    const fallbackMatch = envTsContent.match(/export\s+const\s+envSchema\s*=\s*z\s*\.object\s*\(\s*\{([\s\S]*?)\}\s*\)/);
    if (!fallbackMatch) return vars;
    const lines = fallbackMatch[1].split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('/*')) continue;
      const match = line.match(/^([A-Z0-9_]+)\s*:/);
      if (match && match[1]) vars.push(match[1]);
    }
    return vars;
  }

  const lines = objectMatch[1].split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

    const match = line.match(/^([A-Z0-9_]+)\s*:/);
    if (match && match[1]) {
      vars.push(match[1]);
    }
  }

  return vars;
}

/**
 * Lee claves de variables de frontend desde apps/frontend/src/lib/env.ts
 * @param {string} envTsContent
 * @returns {string[]}
 */
export function extractFrontendVariableNames(envTsContent) {
  const vars = [];
  if (!envTsContent) return vars;

  const objectMatch = envTsContent.match(/export\s+const\s+envSchema\s*=\s*z\s*\.object\s*\(\s*\{([\s\S]*?)\}\s*\)/);
  if (!objectMatch) return vars;

  const lines = objectMatch[1].split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

    const match = line.match(/^([A-Z0-9_]+)\s*:/);
    if (match && match[1]) {
      vars.push(match[1]);
    }
  }

  return vars;
}

/**
 * Recolecta las entradas reales desde el disco o parámetros inyectados.
 * @param {string} rootDir
 * @param {Object} [overrides={}]
 * @returns {Promise<EnvParityInputs>}
 */
export async function collectInputs(rootDir, overrides = {}) {
  const readFileSafe = (relPath) => {
    try {
      return fs.readFileSync(path.resolve(rootDir, relPath), 'utf-8');
    } catch {
      return '';
    }
  };

  const backendEnvTs = readFileSafe('apps/backend/src/config/env.ts');
  const frontendEnvTs = readFileSafe('apps/frontend/src/lib/env.ts');

  const backendVariables = overrides.backendVariables ?? extractBackendVariableNames(backendEnvTs);
  const frontendVariables = overrides.frontendVariables ?? extractFrontendVariableNames(frontendEnvTs);

  let envSchema = overrides.envSchema;
  if (!envSchema) {
    try {
      // Import dinámico de env.ts aprovechando el soporte nativo de TS en Node 22
      const imported = await import(path.resolve(rootDir, 'apps/backend/src/config/env.ts'));
      envSchema = imported.envSchema;
    } catch {
      // Fallback si no se puede importar dinámicamente
      envSchema = null;
    }
  }

  let productionRequiredVariables = overrides.productionRequiredVariables;
  let strictRequiredVariables = overrides.strictRequiredVariables;

  if (envSchema && (!productionRequiredVariables || !strictRequiredVariables)) {
    // Sondeo de variables requeridas sin nada
    const strictResult = envSchema.safeParse({});
    const strictSet = new Set();
    if (!strictResult.success) {
      for (const issue of strictResult.error.issues) {
        if (issue.path && issue.path[0]) {
          strictSet.add(issue.path[0].toString());
        }
      }
    }
    strictRequiredVariables = strictRequiredVariables ?? Array.from(strictSet);

    // Sondeo de variables requeridas en producción (inyectando dummy DB para que superRefine evalúe)
    const prodResult = envSchema.safeParse({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://dummy:dummy@localhost:5432/dummy' });
    const prodSet = new Set(strictSet);
    if (!prodResult.success) {
      for (const issue of prodResult.error.issues) {
        if (issue.path && issue.path[0]) {
          prodSet.add(issue.path[0].toString());
        }
      }
    }
    productionRequiredVariables = productionRequiredVariables ?? Array.from(prodSet);
  }

  return {
    backendVariables,
    productionRequiredVariables: productionRequiredVariables ?? ['DATABASE_URL', 'AUTH_JWT_SECRET', 'APP_PUBLIC_URL'],
    strictRequiredVariables: strictRequiredVariables ?? ['DATABASE_URL'],
    backendExampleContent: overrides.backendExampleContent ?? readFileSafe('apps/backend/.env.example'),
    composeDevContent: overrides.composeDevContent ?? readFileSafe('docker-compose.yml'),
    composeProdContent: overrides.composeProdContent ?? readFileSafe('docker-compose.prod.yml'),
    rootExampleContent: overrides.rootExampleContent ?? readFileSafe('.env.example'),
    stackExampleContent: overrides.stackExampleContent ?? readFileSafe('deploy/stack.env.example'),
    prChecksContent: overrides.prChecksContent ?? readFileSafe('.github/workflows/pr-checks.yml'),
    frontendVariables,
    frontendExampleContent: overrides.frontendExampleContent ?? readFileSafe('apps/frontend/.env.example'),
    frontendDockerfileContent: overrides.frontendDockerfileContent ?? readFileSafe('apps/frontend/Dockerfile'),
  };
}

async function runCli() {
  const rootDir = process.cwd();
  try {
    const inputs = await collectInputs(rootDir);
    const errors = checkEnvParity(inputs);

    if (errors.length > 0) {
      console.error(`\x1b[31m✖ Se detectaron ${errors.length} violaciones de paridad de variables de entorno:\x1b[0m\n`);
      for (const err of errors) {
        console.error(`  • ${err}`);
      }
      console.error('\nConsulta la regla de negocio AGENTS.md §6 para corregir cada archivo.');
      process.exit(1);
    }

    console.log('\x1b[32m✔ Paridad de variables de entorno verificada con éxito (C1-C5 sin violaciones).\x1b[0m');
    process.exit(0);
  } catch (err) {
    console.error('\x1b[31mError ejecutando la comprobación de paridad de entorno:\x1b[0m', err);
    process.exit(1);
  }
}

// Ejecutar si se invoca como CLI directo
if (process.argv[1] && (process.argv[1].endsWith('check-env-parity.mjs') || process.argv[1].endsWith('check-env-parity'))) {
  runCli();
}
