# ------------------------------------------------------------------------------
# Etapa 1: Build y preparación de dependencias en monorepo
# ------------------------------------------------------------------------------
FROM node:22-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copia de manifiestos y lockfile para maximizar el uso de caché
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

RUN pnpm install --frozen-lockfile

# Copia de código fuente necesario para la compilación
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/backend/ ./apps/backend/

# Compilación de paquetes del monorepo
RUN pnpm --filter @sigoa/shared build
RUN pnpm --filter backend db:generate
RUN pnpm --filter backend build

# Aislamiento de dependencias de producción para el runtime con --legacy de pnpm v10
RUN pnpm --filter backend deploy --legacy --prod /prod/backend

# ------------------------------------------------------------------------------
# Etapa 2: Migrator (servicio de una sola ejecución para aplicar migraciones)
# ------------------------------------------------------------------------------
FROM build AS migrator

WORKDIR /app/apps/backend
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm run db:provision-app-role"]

# ------------------------------------------------------------------------------
# Etapa 3: Runtime de producción con Chromium headless (Puppeteer)
# ------------------------------------------------------------------------------
FROM node:22-slim AS runtime

# Instalación de Chromium headless del sistema y fuentes para generación de PDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    openssl \
 && rm -rf /var/lib/apt/lists/*

# Configuración de entorno para Puppeteer y Node.js
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Copia del artefacto de backend empaquetado con permisos de usuario no privilegiado
COPY --from=build --chown=node:node /prod/backend ./

USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
