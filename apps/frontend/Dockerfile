# ------------------------------------------------------------------------------
# Etapa 1: Build de la SPA con Vite en monorepo
# ------------------------------------------------------------------------------
FROM node:22-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copia de manifiestos y lockfile para maximizar el uso de caché
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/

RUN pnpm install --frozen-lockfile

# Copia de código fuente necesario para la compilación
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/frontend/ ./apps/frontend/

# Compilación de la librería compartida
RUN pnpm --filter @sigoa/shared build

# Argumento de construcción inyectado para la URL del backend
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

# Compilación de producción de Vite
RUN pnpm --filter frontend build

# ------------------------------------------------------------------------------
# Etapa 2: Servidor web de producción con Nginx Alpine
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Configuración personalizada de Nginx para SPA (TanStack Router)
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copia de los archivos estáticos compilados
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
