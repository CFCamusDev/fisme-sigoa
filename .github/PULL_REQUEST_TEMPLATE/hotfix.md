<!--
PLANTILLA HOTFIX · hotfix/X.Y.Z → main  (corrección urgente en producción)
Abrir con: https://github.com/<owner>/<repo>/compare/main...hotfix/X.Y.Z?template=hotfix.md
Rama:   hotfix/X.Y.Z desde main (sube solo el PARCHE: 1.0.0 → 1.0.1)
Título: fix(módulo): hotfix vX.Y.Z descripción      ej. fix(encuestas): hotfix v1.0.1 token expira antes de tiempo
Merge:  Merge commit. Después: tag vX.Y.Z y merge de hotfix → develop (OBLIGATORIO).
Urgencia: la sección 3 es obligatoria ANTES de desplegar; la sección 5 puede completarse dentro de las 24 h siguientes.
DoD completa: docs/DEFINITION_OF_DONE.md (sección 4)
-->

## 1. Incidente

| Campo | Valor |
|---|---|
| Versión afectada | vX.Y.Z |
| Versión del hotfix | vX.Y.Z+1 |
| Detectado | dd/mm/aaaa hh:mm — por: |
| Módulo | Mxx |
| Severidad | Crítica (bloquea un proceso) / Alta (error en datos o seguridad) |

**Qué falla y a quién afecta:**

**Cómo se reproduce:**

1.
2.

**Causa raíz:**

**Corrección aplicada:**

## 2. Alcance del cambio

- [ ] El cambio es mínimo y solo corrige el incidente; sin funcionalidades nuevas ni refactors
- [ ] No altera datos Cerrados, Firmados o Aprobados ni la tabla de auditoría (RNF-014, RNF-017)
- [ ] Si se requiere corregir datos, se hace con script versionado y auditado, no a mano

## 3. Obligatorio antes de desplegar

- [ ] Prueba automatizada que **reproduce el error** (falla sin el fix y pasa con él)
- [ ] CI en verde: lint, typecheck, pruebas, build, `npm audit`
- [ ] Backup de producción tomado — archivo: ______ (RNF-023)
- [ ] Verificación de integridad de la auditoría: "Cadena íntegra" (RNF-015)
- [ ] Plan de rollback: volver a vX.Y.Z con el backup indicado
- [ ] Desplegado y **verificado en producción** con el caso que fallaba

## 4. Cierre inmediato

- [ ] Tag `vX.Y.Z` creado en main
- [ ] `hotfix/X.Y.Z` mergeada a **develop** (o a la `release/*` abierta, si existe)
- [ ] Usuarios afectados informados (si corresponde)

## 5. Completar dentro de las 24 h

- [ ] `CHANGELOG.md` con la entrada del parche
- [ ] Versión actualizada en los `package.json`
- [ ] Manual de usuario actualizado (si cambia el uso)
- [ ] Nota de lección aprendida: por qué no lo detectaron las pruebas y qué se agregó para evitarlo

## 6. Notas
