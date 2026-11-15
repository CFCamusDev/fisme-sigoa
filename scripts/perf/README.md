# Rendimiento de pruebas y verificación (HU-078)

Cómo medir los tiempos de las pruebas, cómo ejecutar la verificación local de forma rápida y qué variables la ajustan. Nada de esto cambia lo que ejecuta el CI: `pnpm test` y `pnpm verify:pr:*` conservan su significado.

## Medir

```bash
pnpm perf:tests
```

Ejecuta cada grupo (unitarias de backend, integración, frontend, shared, PDF, E2E y `verify:pr:full --repeat 3`) y escribe `tmp/perf/report.json` y `tmp/perf/report.md` comparados con la línea base del 10/11/2026 (`scripts/perf/baseline-2026-11-10.json`). `tmp/` no se versiona.

```bash
node scripts/perf/measure-tests.mjs --only backend-integration,e2e
node scripts/perf/measure-tests.mjs --out-dir tmp/perf-otro
```

`--only` recibe grupos separados por coma: `backend-unit`, `backend-integration`, `frontend`, `shared`, `pdf`, `e2e`, `verify-full-repeat-3`.

## Desempeño de la API (RNF-018)

```bash
SIGOA_PERF_EMAIL=... SIGOA_PERF_PASSWORD=... pnpm perf:api --base-url http://localhost:3000
```

Inicia sesión una vez y lanza 20 usuarios virtuales concurrentes durante 30 s sobre las consultas existentes (`/me/permissions`, `/users`, `/roles`, `/semesters`, `/parameters`, `/response-scales`, `/program`). Escribe `tmp/perf/api-report.md` y `api-report.json` con p50, p95, p99, errores y respuestas 429, y sale con código 1 si el p95 de consultas es ≥ 500 ms o el de escrituras ≥ 1 s.

| Opción          | Efecto                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `--users N`     | Usuarios concurrentes (20 por defecto).                                                                                                        |
| `--duration S`  | Segundos de medición (30 por defecto).                                                                                                         |
| `--think-ms MS` | Pausa entre peticiones de cada usuario (100 por defecto).                                                                                      |
| `--writes`      | Añade un `PATCH /program` con el nombre actual (no cambia datos, pero deja un registro de auditoría por petición); solo en entornos de prueba. |
| `--out-dir DIR` | Carpeta del informe (`tmp/perf`).                                                                                                              |

El limitador general (`RATE_LIMIT_GENERAL_MAX`, 300 por minuto y por IP) cuenta las peticiones de todos los usuarios virtuales. Para medir el servidor y no el limitador, levanta el backend de prueba con un valor mayor; cualquier 429 hace fallar la medición. Las credenciales se leen del entorno, nunca de la línea de comandos.

## Ejecutar menos pruebas mientras desarrollas

| Comando              | Qué hace                                                                                                                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test:affected` | `vitest related` solo con los archivos cambiados desde `develop` (más los nuevos sin seguimiento), por paquete: backend (proyecto `unit`), frontend y shared. Sin archivos de código cambiados, no ejecuta nada. `--base <ref>` cambia la base; `--dry-run` solo muestra los comandos. |
| `pnpm test:fast`     | Todas las unitarias de backend, frontend y shared, sin integración ni E2E.                                                                                                                                                                                                             |
| `pnpm test`          | Sin cambios: todo, incluida la integración.                                                                                                                                                                                                                                            |

`test:affected` es una ayuda local: depende del grafo de importaciones. Antes del PR corre la verificación completa.

## Verificación local (`verify-pr-local`)

| Comando                                | Cobertura                                                            |
| -------------------------------------- | -------------------------------------------------------------------- |
| `pnpm verify:pr:quick`                 | Convenciones, calidad estática, auditoría y Docker Compose.          |
| `pnpm verify:pr`                       | Lo anterior más integración con PostgreSQL, cobertura y compilación. |
| `pnpm verify:pr:full`                  | Lo anterior más PDF con Chromium, E2E y pruebas de humo de Docker.   |
| `pnpm verify:pr:status --require full` | Comprueba que el último informe sirve para el `HEAD` actual.         |

Las comprobaciones se reparten en grupos (`convenciones`, `integracion`, `e2e`, `cobertura`, `estaticas`, `imagenes`) que corren en paralelo. La preparación (`build:shared`, `db:generate` y la migración de una plantilla de base de datos) se hace una sola vez antes de los grupos; cada grupo con base de datos usa su propia base desechable `sigoa_verify_<hex>_test`, clonada de esa plantilla, y se elimina al terminar. El grupo `e2e` corre solo, al final, porque es sensible al tiempo.

Opciones (después de `node scripts/ci/verify-pr-local.mjs`, o añadidas a `pnpm verify:pr:full`):

| Opción                        | Efecto                                                                                                                                                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--jobs N`                    | Grupos a la vez (3 por defecto; entero positivo). `--jobs 1` los ejecuta en serie.                                                                                                                                                                                |
| `--repeat N`                  | Repite N veces los pasos con recursos reales (integración, PDF y E2E).                                                                                                                                                                                            |
| `--repeat-scope changed\|all` | Con `changed` (por defecto si hay `--repeat`): el paso completo corre una vez y solo las pruebas nuevas o modificadas de la rama se repiten N-1 veces más (hasta 10 archivos, los primeros por orden alfabético, con aviso). Con `all`: el paso completo N veces. |
| `--force-all`                 | Ejecuta `docker-smoke`, `pdf-stability` y `fresh-deploy` aunque el diff no toque su alcance.                                                                                                                                                                      |
| `--only id1,id2`              | Solo esas comprobaciones.                                                                                                                                                                                                                                         |

**Omitido por alcance.** `docker-smoke`, `pdf-stability` y `fresh-deploy` (prueba de despliegue desde cero, `scripts/ci/smoke-fresh-deploy.sh`) se omiten cuando el diff contra `develop` no toca `Dockerfile*`, `docker-compose*`, `deploy/`, `pnpm-lock.yaml`, `scripts/ci/smoke-image.sh`, `scripts/ci/smoke-fresh-deploy.sh`, `apps/backend/prisma/`, `apps/backend/src/seed*`, `apps/backend/src/shared/pdf/`, `apps/backend/src/shared/branding/` ni `docs/despliegue.md`. Se listan en el informe como «omitido por alcance» y no bloquean `--require full`. En el CI (variable `CI`) y con `--force-all` nunca se omiten, y si no se puede calcular el diff se ejecuta todo.

### Presupuestos de tiempo

`scripts/ci/perf-budget.json` fija los segundos de cada grupo y el total de cada modo. Superarlos solo agrega la sección «Advertencias de tiempo» al informe (y `timings` en `last-report.json`): nunca cambia el resultado ni el código de salida. Con `--repeat-scope all` el presupuesto de integración y E2E se multiplica por las pasadas. Si el archivo falta o es inválido, se advierte y se continúa sin presupuestos.

## Variables

Todas son opcionales y solo afectan a las pruebas; ninguna es de producción.

| Variable          | Valor por defecto                                   | Efecto                                                                                                                                                                |
| ----------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEST_DB_WORKERS` | `min(4, núcleos/2)`, mínimo 1; en el CI (`CI`) es 1 | Workers de integración, cada uno con su base `<base>_wN_test` clonada de la plantilla `<base>_tpl_test`. Con 1 worker se usa la base de siempre. Entero entre 1 y 32. |
| `TEST_DB_RESET`   | incremental                                         | `truncate` restaura el `TRUNCATE` de todas las tablas entre pruebas; por defecto solo se limpian las tablas con filas.                                                |
| `E2E_WORKERS`     | 2 en local, 1 en el CI                              | Workers de Playwright; cada uno levanta su propio backend y frontend en puertos libres y usa su propia base de datos. Entero entre 1 y 32.                            |

Los nombres de las bases de pruebas siempre terminan en `_test` y `assertTestDatabase` se aplica antes de crear o eliminar cualquiera.

## Estabilidad de los E2E

```bash
node scripts/perf/e2e-stability.mjs --runs 3 --workers 3
```

Ejecuta la suite completa varias veces seguidas sin reintentos. Una prueba que solo pasa al reintentar (inestable), una fallida o una omitida cuentan como fallo. No forma parte del CI.

## Variantes de Vitest medidas el 14/11/2026 (T-080-02)

Mediciones en local (Windows, 3 corridas por variante, criterio de adopción: reducción ≥ 10 % en mediana y 3 corridas sin fallos con `--sequence.shuffle`, con y sin `--coverage`).

### (a) Frontend completo (166 archivos, 1 019 pruebas)

| Variante                                 | Comando (`apps/frontend`)                                     | Mediana  | Rango           | Resultado                          |
| ---------------------------------------- | ------------------------------------------------------------- | -------- | --------------- | ---------------------------------- |
| Base (`forks` + `isolate`)               | `pnpm exec vitest run`                                        | 113.37 s | 112.16–114.96 s | OK (1 019)                         |
| `--pool=threads`                         | `pnpm exec vitest run --pool=threads`                         | 115.27 s | 114.11–122.09 s | OK (1 019)                         |
| `--no-isolate`                           | `pnpm exec vitest run --no-isolate`                           | 19.21 s  | 19.14–19.36 s   | OK (1 019)                         |
| `--pool=threads --no-isolate`            | `pnpm exec vitest run --pool=threads --no-isolate`            | 18.55 s  | 18.50–18.69 s   | OK (1 019)                         |
| `happy-dom` (worktree desechable)        | `pnpm exec vitest run --environment=happy-dom`                | 82.93 s  | 78.81–83.48 s   | Falla                              |
| Base `--coverage`                        | `pnpm exec vitest run --coverage`                             | 126.42 s | 124.22–128.45 s | OK (1 019)                         |
| `--pool=threads --no-isolate --coverage` | `pnpm exec vitest run --pool=threads --no-isolate --coverage` | 22.25 s  | 21.49–22.81 s   | Falla (a diagnosticar en T-080-14) |

### (b) Subconjunto sin DOM (59 archivos)

| Variante                                         | Comando (`apps/frontend`)                                                           | Mediana | Rango         | Resultado                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- | ------- | ------------- | -------------------------- |
| Base (`jsdom`)                                   | `pnpm exec vitest run <59 archivos>`                                                | 35.25 s | 34.73–35.50 s | OK (380)                   |
| `--environment=node` (con `setup.ts`)            | `pnpm exec vitest run --environment=node <59 archivos>`                             | 14.32 s | 14.28–14.85 s | Falla por `setup.ts` (377) |
| `--environment=node --pool=threads --no-isolate` | `pnpm exec vitest run --environment=node --pool=threads --no-isolate <59 archivos>` | 4.64 s  | 4.47–4.82 s   | Falla por `setup.ts` (377) |

### (c) Unitarias del backend (`--project unit`, 2 068 pruebas)

| Variante                                 | Comando (`apps/backend`)                                                     | Mediana | Rango         | Resultado  |
| ---------------------------------------- | ---------------------------------------------------------------------------- | ------- | ------------- | ---------- |
| Base (`forks` + `isolate`)               | `pnpm exec vitest run --project unit`                                        | 22.60 s | 20.29–23.31 s | OK (2 068) |
| `--pool=threads`                         | `pnpm exec vitest run --project unit --pool=threads`                         | 21.09 s | 20.16–21.24 s | OK (2 068) |
| `--no-isolate`                           | `pnpm exec vitest run --project unit --no-isolate`                           | 6.24 s  | 5.72–6.60 s   | OK (2 068) |
| `--pool=threads --no-isolate`            | `pnpm exec vitest run --project unit --pool=threads --no-isolate`            | 5.35 s  | 5.29–5.38 s   | OK (2 068) |
| Base `--coverage`                        | `pnpm exec vitest run --project unit --coverage`                             | 22.14 s | 22.13–22.85 s | OK (2 068) |
| `--pool=threads --no-isolate --coverage` | `pnpm exec vitest run --project unit --pool=threads --no-isolate --coverage` | 7.11 s  | 6.93–7.37 s   | OK (2 068) |

**Decisiones adoptadas:**

- **Proyecto `node` del frontend (T-080-12 / T-080-13):** separar en `node` (con `setup-node.ts` sin `window`/Testing Library) y activar `pool: 'threads'` + `isolate: false` (−86.8 % sobre la base `jsdom` del subconjunto).
- **Proyecto `dom` del frontend (T-080-14):** descartar `happy-dom` (más lento, falla y agrega dependencia); evaluar `threads` + `isolate: false` con `--coverage` y `--sequence.shuffle` antes de adoptarlo.
- **Unitarias del backend (T-080-15):** adoptar `pool: 'threads'` + `isolate: false` (−76.3 % sin cobertura, −67.9 % con cobertura), sujeto a 3 corridas con `--sequence.shuffle` y verificación de `argon2`.

## Estructura del CI y pruebas rápidas (HU-080)

### Jobs, agregadores y shards (`.github/workflows/pr-checks.yml`)

- **Convenciones (`convenciones`):** valida rama, título de PR, `check:env-parity`, `check:windows-paths` y `check:test-patterns`.
- **Jobs paralelos tras `convenciones`:**
  - **Estáticas (`estaticas`):** Prettier, ESLint + `check-design-tokens`, TypeScript (`typecheck`), `depcruise` y `build`.
  - **Unitarias (`unitarias`):** cobertura >= 80 % en backend, frontend (`node` + `dom`) y shared; genera `unit-backend.json` y `unit-frontend.json`, publica el resumen de lentas y verifica presupuesto por prueba (`--tier unit`).
  - **Integración (`integracion`, 1 shard):** corre contra PostgreSQL 16 (sin `worker-isolation.integration.test.ts`) y genera un informe blob combinado luego por el agregador `calidad`.
  - **E2E en 2 shards (`e2e-shards`):** cada shard corre Playwright contra su PostgreSQL 16 (`--grep-invert "Worker isolation"`) y sube su informe blob para que el agregador `e2e` los combine.
  - **Aislamiento de workers (`aislamiento`):** ejecuta `worker-isolation.integration.test.ts` y `worker-isolation.spec.ts` completos fuera de los shards y de la ruta crítica.
  - **Seguridad (`seguridad`)** e **Imágenes (`imagenes`)**: auditoría `pnpm audit` y build/smoke de Docker Compose.
- **Nombres exactos de los checks requeridos (protección de ramas):**
  - `Rama y título del PR`
  - `Lint, tipos, pruebas y build` (agregador `calidad`: depende de `convenciones`, `estaticas`, `unitarias`, `integracion`, `aislamiento`; además combina blobs de integración, valida completitud con `check-shard-completeness.mjs` y verifica presupuesto `--tier integration`)
  - `Auditoría de dependencias`
  - `Pruebas end-to-end (Playwright)` (agregador `e2e`: depende de `e2e-shards`, `aislamiento`; además combina blobs E2E, valida completitud y verifica presupuesto `--tier e2e`)
  - Nunca renombres, elimines ni sustituyas estos checks por filtros `paths:` sin actualizar la protección de ramas.

### Cómo medir tiempos del CI y locales

```bash
pnpm ci:timing --runs 5
pnpm ci:timing --head-branch feature/HU-080-optimizacion-pruebas-ci --runs 5
pnpm perf:tests
```

- `ci:timing` lee ejecuciones reales de GitHub Actions con `gh` y reporta tiempo de espera (mediana/promedio) y minutos de máquina (exactos y facturados).
- `perf:tests` ejecuta y compara la suite local frente a la línea base.

### Presupuesto por prueba y excepciones (`scripts/ci/perf-budget.json`)

| Nivel         | Presupuesto por prueba | Comando de verificación                                  |
| ------------- | ---------------------- | -------------------------------------------------------- |
| `unit`        | 2 000 ms               | `pnpm check:perf-budget --tier unit --vitest ...`        |
| `integration` | 5 000 ms               | `pnpm check:perf-budget --tier integration --vitest ...` |
| `e2e`         | 20 000 ms              | `pnpm check:perf-budget --tier e2e --playwright ...`     |

**Qué hacer si una prueba supera su presupuesto:**

1. Baja la prueba en la pirámide si la regla no necesita navegador ni PostgreSQL real.
2. Usa siembra en proceso (`createE2ESeeder` / `seedAuthorizationFast`), sesión por API (`loginAsTestUser`) y esperas por señal (`waitForResponse` / aserciones web-first).
3. Solo si la prueba es inherentemente pesada (p. ej. aislamiento con múltiples workers o recorrido completo de contraste WCAG), agrégala en `exceptions` de `scripts/ci/perf-budget.json` con su tope `ms` y un `reason` explícito. Las excepciones obsoletas o superadas también fallan el CI.

### Plantillas copiables y reglas para HU nuevas (`pnpm check:test-patterns`)

| Tipo de prueba            | Plantilla copiable                                                        | Reglas obligatorias                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitaria sin DOM (`node`) | `apps/frontend/src/test/templates/example-node.test.ts`                   | Sin `@testing-library/*`, `react-dom`, `window`, `document` ni `localStorage` (`dom-in-node`).                                                                                               |
| Integración (PostgreSQL)  | `apps/backend/src/test/templates/example-integration.integration.test.ts` | Usar `useTestDatabase()` y `seedAuthorizationFast` (nunca `seedAuthorization` lenta, `slow-seed`), sin pausas fijas (`fixed-pause`).                                                         |
| E2E (Playwright)          | `apps/frontend/e2e/templates/example-session.spec.ts`                     | Usar `loginAsTestUser(page)` por API (no login por interfaz fuera de specs de auth, `ui-login`), sin `execSync`/`spawnSync` en specs (`e2e-subprocess`) ni `waitForTimeout` (`fixed-pause`). |

### Variantes de CI medidas (T-080-10, 15/11/2026)

- **Línea base oficial del CA11 (T-080-01):** flujo **948.9 s**, máquina **21.3 min** exactos.
- **Referencia comparativa en `develop` (5 runs previos a HU-080: `43642133673`, `43564650613`, `43556704247`, `43538427967`, `43523244612`):** flujo **984 s**, máquina **21.81 min** exactos / **24.8 min** facturados (redondeo al minuto por job).

| Variante                                                                               | Run ID (PR #45)              |   Corridas | Jobs | Tiempo de espera | Minutos exactos | Minutos facturados | Decisión                                                                                          |
| -------------------------------------------------------------------------------------- | ---------------------------- | ---------: | ---: | ---------------: | --------------: | -----------------: | ------------------------------------------------------------------------------------------------- |
| **V1** (`0c0b422`): 3 E2E shards + 2 int. shards + jobs de informe separados           | `43739419872`                |          1 |   14 |            308 s |       23.42 min |             31 min | Descartada (1 corrida; no cumplía CA11 en minutos de máquina)                                     |
| **V2** (`89af2fe`): 2 E2E shards + 2 int. shards + informes absorbidos + Chromium 30 s | `43740815771`                |          1 |   12 |            304 s |       22.23 min |             29 min | Descartada (1 corrida; no cumplía CA11 en minutos de máquina)                                     |
| **V3** (`368e750`): 2 E2E shards + 1 int. shard + informes absorbidos                  | `43741505391`                | 1 (piloto) |   11 |            291 s |       20.10 min |             25 min | **Adoptada** (pasa a medición final de 5 corridas en T-080-26)                                    |
| **V3 + `concurrency` + `TEST_DB_WORKERS=2`** (`0e9516c`)                               | `43746134457` (intentos 1–3) |          3 |   11 |    330.3 s prom. | 21.19 min prom. |    27.33 min prom. | **Conservada** (`Calidad · Integración` en `212 s`, `208 s`, `201 s`, todas `< 225 s` y 0 fallos) |

_Notas:_

- V1 y V2 se midieron con una sola corrida porque ya superaban la línea base en minutos exactos y facturados y no cumplían el CA11.
- La variante final de `T-080-10` (`0e9516c`) añade `concurrency` con `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` (nunca en `push` a `develop` ni `main`) y `TEST_DB_WORKERS=2` en `Calidad · Integración` manteniendo las 3 pasadas de `src/shared/pdf`.

### Medición final (T-080-26, 15/11/2026)

- **Archivo de registro:** `scripts/perf/final-2026-11-15.json`.
- **CI (5 corridas consecutivas de V3, `368e750` / `0032e9a`):** `43741505391` (#1: `291 s`, `20.10 min` exactos, `25 min` facturados, integración `239 s`) y `43743280561` (#1: `304 s`, `19.80 min`, `26 min`, integración `267 s`; #2: `312 s`, `21.33 min`, `29 min`, integración `265 s`; #3: `308 s`, `19.92 min`, `26 min`, integración `264 s`; #4: `322 s`, `19.77 min`, `26 min`, integración `214 s`). Todas corresponden a **reruns del mismo commit/workflow**, con **0 fallos y 0 intermitencias**.
  - **Promedio V3 (5 corridas):** espera **307.4 s** (`-67.6 %` vs `948.9 s`), máquina **20.18 min exactos** (`< 21.3 min`) y **26.4 min facturados**.
  - **Explicación del `+1.6 min` facturado (`26.4` vs `24.8 min` de `develop`):** aunque V3 consume menos minutos exactos que `develop` (`20.18` vs `21.81 min`), el redondeo al techo por minuto se aplica a **11 jobs frente a 5** y `Calidad · Integración` superó el umbral de **240 s** en 3 de las 5 corridas (`264–267 s`). Con `TEST_DB_WORKERS=2` (`0e9516c`), `Calidad · Integración` bajó a **212 s, 208 s y 201 s** (promedio **207.0 s**, por debajo de `225 s` y `240 s`) en 3 corridas consecutivas en verde.
- **Puerta local (`pnpm verify:pr:full --repeat 3`):** **395.5 s** frente a `531.8 s` de línea base (meta `≤ 425 s`).
- **Conteo y cobertura:** **4 698 pruebas** ejecutadas (`≥ 4 648`) y cobertura unitaria **97.09 %** en backend y **93.96 %** en frontend (`≥ 80 %`).
