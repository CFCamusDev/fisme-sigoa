import { describe, expect, it } from 'vitest';
// @ts-expect-error script sin archivo de declaraciones .d.ts
import { checkEnvParity, type EnvParityInputs } from '../../../../scripts/ci/check-env-parity.mjs';

describe('checkEnvParity pure logic (T-002-19)', () => {
  const validInputs: EnvParityInputs = {
    backendVariables: ['PORT', 'NODE_ENV', 'DATABASE_URL', 'AUTH_JWT_SECRET'],
    productionRequiredVariables: ['DATABASE_URL', 'AUTH_JWT_SECRET'],
    strictRequiredVariables: ['DATABASE_URL'],
    backendExampleContent: `
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://user:pass@localhost:5432/db"
# AUTH_JWT_SECRET=optional_in_dev
`,
    composeDevContent: `
services:
  backend:
    environment:
      PORT: 3000
      NODE_ENV: development
      DATABASE_URL: \${DATABASE_URL}
      AUTH_JWT_SECRET: \${AUTH_JWT_SECRET:-secret}
  frontend:
    build:
      args:
        VITE_API_URL: \${VITE_API_URL}
`,
    composeProdContent: `
services:
  backend:
    environment:
      PORT: 3000
      NODE_ENV: production
      DATABASE_URL: postgresql://\${APP_DB_USER:?err}:\${APP_DB_PASSWORD:?err}@db:5432/\${DB_NAME:?err}
      AUTH_JWT_SECRET: \${AUTH_JWT_SECRET:?err}
  frontend:
    build:
      args:
        VITE_API_URL: \${VITE_API_URL}
`,
    rootExampleContent: `
PORT=3000
DATABASE_URL="postgresql://localhost:5432/db"
VITE_API_URL="http://localhost:3000"
`,
    stackExampleContent: `
APP_DB_USER=sigoa
APP_DB_PASSWORD=secret
DB_NAME=sigoa
AUTH_JWT_SECRET=supersecretlongsecret32charactersminimum!
VITE_API_URL=https://api.untrm.edu.pe
`,
    prChecksContent: `
jobs:
  calidad:
    env:
      DATABASE_URL: postgresql://test
  e2e:
    env:
      DATABASE_URL: postgresql://test
`,
    frontendVariables: ['VITE_API_URL'],
    frontendExampleContent: `
VITE_API_URL="http://localhost:3000"
`,
    frontendDockerfileContent: `
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
`,
  };

  it('passes when every variable is declared and wired', () => {
    const errors: string[] = checkEnvParity(validInputs);
    expect(errors).toEqual([]);
  });

  it('fails when a variable is missing from the backend example (C1)', () => {
    const inputs: EnvParityInputs = {
      ...validInputs,
      backendExampleContent: `
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://localhost:5432/db"
`, // falta AUTH_JWT_SECRET
    };

    const errors: string[] = checkEnvParity(inputs);
    expect(errors.some((e: string) => e.includes('AUTH_JWT_SECRET') && e.includes('C1'))).toBe(
      true,
    );
    expect(errors.some((e: string) => e.includes('apps/backend/.env.example'))).toBe(true);
  });

  it('fails when a variable is not wired in the development compose (C2)', () => {
    const inputs: EnvParityInputs = {
      ...validInputs,
      composeDevContent: `
services:
  backend:
    environment:
      PORT: 3000
      NODE_ENV: development
      DATABASE_URL: \${DATABASE_URL}
`, // falta AUTH_JWT_SECRET
    };

    const errors: string[] = checkEnvParity(inputs);
    expect(errors.some((e: string) => e.includes('AUTH_JWT_SECRET') && e.includes('C2'))).toBe(
      true,
    );
    expect(errors.some((e: string) => e.includes('docker-compose.yml'))).toBe(true);
  });

  it('fails when a variable is not wired in the production compose (C2)', () => {
    const inputs: EnvParityInputs = {
      ...validInputs,
      composeProdContent: `
services:
  backend:
    environment:
      PORT: 3000
      NODE_ENV: production
      DATABASE_URL: postgresql://db
`, // falta AUTH_JWT_SECRET
    };

    const errors: string[] = checkEnvParity(inputs);
    expect(errors.some((e: string) => e.includes('AUTH_JWT_SECRET') && e.includes('C2'))).toBe(
      true,
    );
    expect(errors.some((e: string) => e.includes('docker-compose.prod.yml'))).toBe(true);
  });

  it('fails when a mandatory compose variable is not declared in the stack example (C3b)', () => {
    const inputs: EnvParityInputs = {
      ...validInputs,
      composeProdContent: `
services:
  backend:
    environment:
      PORT: 3000
      NODE_ENV: production
      DATABASE_URL: \${DATABASE_URL}
      AUTH_JWT_SECRET: \${AUTH_JWT_SECRET}
      EXTRA_COMPOSE_VAR: \${EXTRA_COMPOSE_VAR:?error}
`,
    };

    const errors: string[] = checkEnvParity(inputs);
    expect(errors.some((e: string) => e.includes('EXTRA_COMPOSE_VAR') && e.includes('C3'))).toBe(
      true,
    );
    expect(errors.some((e: string) => e.includes('deploy/stack.env.example'))).toBe(true);
  });

  it('fails when a production-required variable is not in the stack example (C3a)', () => {
    const inputs: EnvParityInputs = {
      ...validInputs,
      stackExampleContent: `
APP_DB_USER=sigoa
APP_DB_PASSWORD=secret
DB_NAME=sigoa
VITE_API_URL=https://api.untrm.edu.pe
`, // falta AUTH_JWT_SECRET
    };

    const errors: string[] = checkEnvParity(inputs);
    expect(errors.some((e: string) => e.includes('AUTH_JWT_SECRET') && e.includes('C3'))).toBe(
      true,
    );
  });

  it('accepts DATABASE_URL derived from the database variables in stack example (C3a)', () => {
    // DATABASE_URL no está en stack.env.example pero APP_DB_USER, APP_DB_PASSWORD y DB_NAME sí están
    const errors: string[] = checkEnvParity(validInputs);
    expect(errors.some((e: string) => e.includes('DATABASE_URL') && e.includes('C3'))).toBe(false);
  });

  it('fails when a variable without default is missing from a test job env (C4)', () => {
    const inputs: EnvParityInputs = {
      ...validInputs,
      prChecksContent: `
jobs:
  calidad:
    steps:
      - run: pnpm test
  e2e:
    env:
      DATABASE_URL: postgresql://test
`, // falta DATABASE_URL en calidad
    };

    const errors: string[] = checkEnvParity(inputs);
    expect(errors.some((e: string) => e.includes('DATABASE_URL') && e.includes('C4'))).toBe(true);
    expect(errors.some((e: string) => e.includes('pr-checks.yml') && e.includes('calidad'))).toBe(
      true,
    );
  });

  it('fails when a VITE variable is missing from frontend example, compose or Dockerfile (C5)', () => {
    const missingInExample: EnvParityInputs = {
      ...validInputs,
      frontendExampleContent: '',
    };
    expect(
      checkEnvParity(missingInExample).some(
        (e: string) =>
          e.includes('VITE_API_URL') &&
          e.includes('C5') &&
          e.includes('apps/frontend/.env.example'),
      ),
    ).toBe(true);

    const missingInDockerfile: EnvParityInputs = {
      ...validInputs,
      frontendDockerfileContent: 'FROM nginx',
    };
    expect(
      checkEnvParity(missingInDockerfile).some(
        (e: string) => e.includes('VITE_API_URL') && e.includes('C5') && e.includes('Dockerfile'),
      ),
    ).toBe(true);
  });

  it('names the variable, the rule and the file in every message', () => {
    const inputs: EnvParityInputs = {
      ...validInputs,
      backendExampleContent: '', // faltarán variables
    };

    const errors: string[] = checkEnvParity(inputs);
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) {
      expect(error).toMatch(/C[1-5]/);
      expect(error).toMatch(/\.env|\.yml|\.yaml|Dockerfile/);
    }
  });

  it('accepts commented declarations in the examples', () => {
    const inputs: EnvParityInputs = {
      ...validInputs,
      backendExampleContent: `
# PORT=3000
# NODE_ENV=development
# DATABASE_URL=test
# AUTH_JWT_SECRET=test
`,
    };

    const errors: string[] = checkEnvParity(inputs);
    expect(errors.filter((e: string) => e.includes('C1'))).toEqual([]);
  });

  it('fails loudly when the variable names cannot be read from env.ts', () => {
    const inputs: EnvParityInputs = {
      ...validInputs,
      backendVariables: [],
    };

    const errors: string[] = checkEnvParity(inputs);
    expect(
      errors.some((e: string) => e.includes('No se pudieron leer') || e.includes('vacío')),
    ).toBe(true);
  });
});

describe('checkEnvParity repository contract (T-002-20)', () => {
  it('the real repository is in parity', async () => {
    // @ts-expect-error script sin archivo de declaraciones .d.ts
    const { collectInputs } = await import('../../../../scripts/ci/check-env-parity.mjs');
    const path = await import('node:path');
    const rootDir = path.resolve(__dirname, '../../../../');
    const inputs = await collectInputs(rootDir);
    const errors: string[] = checkEnvParity(inputs);
    expect(errors).toEqual([]);
  });
});
