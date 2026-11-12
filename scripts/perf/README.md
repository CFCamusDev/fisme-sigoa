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
