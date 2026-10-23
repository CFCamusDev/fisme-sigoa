import process from 'node:process';
import { defineConfig } from 'prisma/config';

// Carga segura de .env si existe (Node.js >= 20.12 nativo)
try {
  process.loadEnvFile?.();
} catch {
  // Ignora si el archivo .env no existe en el entorno
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
