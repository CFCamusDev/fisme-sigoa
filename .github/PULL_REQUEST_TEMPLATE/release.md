<!--
PLANTILLA RELEASE · release/X.Y.Z → main
Abrir con: https://github.com/<owner>/<repo>/compare/main...release/X.Y.Z?template=release.md
Título: release: vX.Y.Z — nombre del release      ej. release: v0.3.0 — Encuestas y actas
Merge:  Merge commit (conserva la historia). Después: tag vX.Y.Z y merge de release → develop.
DoD completa: docs/DEFINITION_OF_DONE.md (sección 3)
-->

## 1. Identificación

| Campo | Valor |
|---|---|
| Versión | vX.Y.Z |
| Nombre | |
| Fase del Plan de Prácticas | Fase x |
| Fecha prevista de despliegue | dd/mm/aaaa |

## 2. Contenido del release

| HU | Título | RF | PR a develop |
|---|---|---|---|
| HU-xxx | | RF-xxx | #nn |

**HU planificadas que quedan fuera** (y motivo):

## 3. Calidad del código

- [ ] Todas las HU listadas tienen su PR a develop aprobado con la DoD de feature completa
- [ ] CI en verde sobre `release/X.Y.Z`: lint, typecheck, pruebas, cobertura ≥ 80 %, build, regla hexagonal
- [ ] `npm audit` sin vulnerabilidades altas ni críticas (RNF-011)
- [ ] Solo correcciones menores en la rama release; sin funcionalidades nuevas

## 4. Pruebas del release

- [ ] Pruebas end-to-end de los flujos completos tocados por el release (ej. sesión → encuesta → respuesta → acta → firma)
- [ ] Pruebas de acceso por rol con la matriz de permisos por defecto (Administrador, Presidente, Miembro, Director, Docente)
- [ ] Encuesta pública probada en celular de 360 px (RNF-034)
- [ ] Desempeño verificado: p95 API, 50 respuestas simultáneas, cálculos < 2 s, PDF < 10 s (RNF-018 a RNF-021)
- [ ] Inmutabilidad verificada: nada Cerrado, Firmado o Aprobado se puede editar (RNF-017)

## 5. Datos y base de datos

- [ ] Migraciones probadas sobre una **copia** de la base de producción
- [ ] Seed de permisos, parámetros y plantillas actualizado y probado
- [ ] Backup de producción tomado antes del despliegue (RNF-023) — archivo: ______
- [ ] Restauración del backup probada en staging (RNF-023)
- [ ] Verificación de integridad de la auditoría: "Cadena íntegra" antes y después de migrar (RNF-015)

## 6. Documentación

- [ ] `CHANGELOG.md` actualizado con la versión vX.Y.Z
- [ ] Versión actualizada en los `package.json`
- [ ] Manual de usuario actualizado para las funcionalidades nuevas
- [ ] Contrato OpenAPI actualizado (RNF-032)
- [ ] Variables de entorno nuevas documentadas en `.env.example`

## 7. Despliegue

- [ ] Despliegue probado en staging con el mismo `docker compose` que producción (RNF-039)
- [ ] Plan de rollback definido: versión anterior `vX.Y.Z-1` + backup indicado arriba
- [ ] Prueba de humo en producción: login, dashboard, un flujo principal del release
- [ ] HTTPS y cabeceras de seguridad activas (RNF-001, RNF-006)

## 8. Cierre

- [ ] Tag `vX.Y.Z` creado en main
- [ ] `release/X.Y.Z` mergeada de vuelta a develop
- [ ] Rama release eliminada
- [ ] (Opcional) Demo del release mostrada al asesor / Comité — fecha: ______

## 9. Notas
