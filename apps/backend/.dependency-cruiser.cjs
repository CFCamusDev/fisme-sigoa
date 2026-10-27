const path = require('node:path');

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-no-infrastructure-libs',
      comment:
        'RNF-026: La capa domain no debe importar librerías de infraestructura externa.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: {
        path: [
          '(^|/)express(/|$)',
          '(^|/)@prisma(/|$)',
          '(^|/)pg(/|$)',
          '(^|/)pino(/|$)',
          '(^|/)pino-http(/|$)',
          '(^|/)helmet(/|$)',
          '(^|/)cors(/|$)',
          '(^|/)express-rate-limit(/|$)',
          'shared/prisma/generated',
        ],
      },
    },
    {
      name: 'domain-no-other-layers',
      comment:
        'RNF-026: La capa domain no puede depender de application ni de infrastructure.',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: { path: '^src/modules/[^/]+/(application|infrastructure)' },
    },
    {
      name: 'domain-allowlist',
      comment:
        'RNF-026: La capa domain solo puede importar su propio domain, shared/errors, @sigoa/shared o módulos nativos.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/domain' },
      to: {
        dependencyTypesNot: ['core'],
        pathNot: [
          '^src/modules/$1/domain',
          '^src/shared/errors',
          '(^|/)@sigoa/shared(/|$)',
          '^node:',
        ],
      },
    },
    {
      name: 'application-no-infrastructure',
      comment:
        'RNF-026: La capa application no puede importar infrastructure ni librerías de transporte/BD.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/application' },
      to: {
        path: [
          '^src/modules/[^/]+/infrastructure',
          '(^|/)express(/|$)',
          '(^|/)@prisma(/|$)',
          '(^|/)pg(/|$)',
          '(^|/)helmet(/|$)',
          '(^|/)cors(/|$)',
          '(^|/)express-rate-limit(/|$)',
          '^src/shared/(prisma|middleware|seed)',
          'shared/prisma/generated',
        ],
      },
    },
    {
      name: 'module-isolation',
      comment:
        'RNF-026: Un módulo no puede importar directamente del interior de otro módulo.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)' },
      to: { path: '^src/modules/(?!$1)[^/]+' },
    },
    {
      name: 'shared-no-modules',
      comment: 'RNF-026: shared no puede importar ningún módulo.',
      severity: 'error',
      from: { path: '^src/shared' },
      to: { path: '^src/modules' },
    },
    {
      name: 'prisma-only-in-infrastructure',
      comment:
        'RNF-026: El cliente Prisma solo puede importarse en infrastructure, shared/prisma, server.ts o seed.ts.',
      severity: 'error',
      from: {
        pathNot: [
          '^src/modules/[^/]+/infrastructure',
          '^src/shared/prisma',
          '^src/test/',
          '\\.integration\\.test\\.ts$',
          '^src/server\\.ts$',
          '^src/seed\\.ts$',
        ],
      },
      to: {
        path: [
          'shared/prisma/generated',
          '(^|/)@prisma/client(/|$)',
          '(^|/)@prisma/adapter-pg(/|$)',
        ],
      },
    },
    {
      name: 'no-circular',
      comment: 'Prohibir dependencias circulares en el código fuente.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-test-in-production-code',
      comment: 'El código de producción no puede importar archivos de prueba.',
      severity: 'error',
      from: { pathNot: '(\\.(test|spec)\\.ts$|^src/test/)' },
      to: { path: '(\\.(test|spec)\\.ts$|^src/test/)' },
    },
  ],
  options: {
    doNotFollow: {
      path: ['node_modules', 'src/shared/prisma/generated'],
    },
    exclude: {
      path: ['src/shared/prisma/generated', 'dist', 'coverage'],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: path.resolve(__dirname, 'tsconfig.json'),
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
  },
};
