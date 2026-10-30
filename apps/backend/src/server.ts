import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { loadEnvFileIfPresent } from './config/load-env-file.js';
import {
  getPrismaClient,
  PrismaUnitOfWork,
  createPrismaAuditServices,
} from './shared/prisma/index.js';
import { setupAppRoutes } from './routes.js';

// Carga .env si está presente en el entorno local (desarrollo)
loadEnvFileIfPresent();

const env = loadEnv();

const prisma = getPrismaClient(env);
const unitOfWork = new PrismaUnitOfWork(prisma);
const auditServices = createPrismaAuditServices(unitOfWork);

const app = createApp({
  env,
  setupRoutes: (instance) => {
    setupAppRoutes(instance, {
      unitOfWork,
      auditLogger: auditServices.auditLogger,
    });
  },
});

export const server = app.listen(env.PORT, () => {
  // Punto de entrada del servidor backend
});
