import type { PermissionCode } from './permission-catalog.js';

export interface DefaultRolePermissionGrant {
  readonly roleCode: string;
  readonly permissionCode: PermissionCode;
  readonly scope: 'GLOBAL' | 'OWN';
}

export type MatrixRoleCode =
  'ADMINISTRATOR' | 'COMMITTEE_PRESIDENT' | 'COMMITTEE_MEMBER' | 'PROGRAM_DIRECTOR' | 'TEACHER';

export type MatrixCellToken = 'NONE' | 'VIEW' | 'GLOBAL' | 'OWN' | 'OWN_VIEW';

export type MatrixCell = MatrixCellToken | readonly MatrixCellToken[];

export interface MatrixRowDefinition {
  readonly label: string;
  readonly permissions: readonly string[];
  readonly cells: {
    readonly ADMINISTRATOR: MatrixCell;
    readonly COMMITTEE_PRESIDENT: MatrixCell;
    readonly COMMITTEE_MEMBER: MatrixCell;
    readonly PROGRAM_DIRECTOR: MatrixCell;
    readonly TEACHER: MatrixCell;
  };
}

/**
 * Matriz de permisos por defecto transcrita fielmente de LS 3.3 (28 filas).
 * Leyenda:
 *   ✔ = 'GLOBAL' (global en todas las acciones de la fila)
 *   L = 'VIEW' (global solo en la acción .ver)
 *   — = 'NONE' (sin acceso)
 *   P = 'OWN' (propio en todas las acciones de la fila)
 *   P (L) = 'OWN_VIEW' (propio solo en la acción .ver)
 *   Arreglo de celdas: cuando la celda tiene barras en LS 3.3 (ej. L / — o ✔ / — / —).
 *   ✔ (borrador) = 'GLOBAL' (la limitación a borradores es regla de negocio de catálogo, HU-015, no del permiso).
 */
export const DEFAULT_ROLE_MATRIX: readonly MatrixRowDefinition[] = [
  // Fila 1: usuario.*, rol.*, permiso.*
  {
    label: 'usuario.*, rol.*, permiso.*',
    permissions: [
      'usuario.ver',
      'usuario.crear',
      'usuario.editar',
      'rol.ver',
      'rol.editar',
      'permiso.asignar',
    ],
    cells: {
      ADMINISTRATOR: 'GLOBAL',
      COMMITTEE_PRESIDENT: 'NONE',
      COMMITTEE_MEMBER: 'NONE',
      PROGRAM_DIRECTOR: 'NONE',
      TEACHER: 'NONE',
    },
  },

  // Fila 2: parametro.ver / parametro.editar
  {
    label: 'parametro.ver / parametro.editar',
    permissions: ['parametro.ver', 'parametro.editar'],
    cells: {
      ADMINISTRATOR: ['GLOBAL', 'GLOBAL'],
      COMMITTEE_PRESIDENT: ['GLOBAL', 'NONE'],
      COMMITTEE_MEMBER: ['GLOBAL', 'NONE'],
      PROGRAM_DIRECTOR: ['GLOBAL', 'NONE'],
      TEACHER: ['NONE', 'NONE'],
    },
  },

  // Fila 3: plantilla.ver / editar / publicar
  {
    label: 'plantilla.ver / editar / publicar',
    permissions: ['plantilla.ver', 'plantilla.editar', 'plantilla.publicar'],
    cells: {
      ADMINISTRATOR: 'GLOBAL',
      COMMITTEE_PRESIDENT: 'VIEW',
      COMMITTEE_MEMBER: 'VIEW',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'VIEW',
    },
  },

  // Fila 4: catalogo.ver / editar
  {
    label: 'catalogo.ver / editar',
    permissions: ['catalogo.ver', 'catalogo.editar'],
    cells: {
      ADMINISTRATOR: ['GLOBAL', 'NONE'],
      COMMITTEE_PRESIDENT: ['GLOBAL', 'GLOBAL'],
      COMMITTEE_MEMBER: ['GLOBAL', 'GLOBAL'], // L / ✔ (borrador) -> D9: GLOBAL en catalogo.editar
      PROGRAM_DIRECTOR: ['GLOBAL', 'NONE'],
      TEACHER: ['GLOBAL', 'NONE'],
    },
  },

  // Fila 5: constituyente.ver / editar / importar
  {
    label: 'constituyente.ver / editar / importar',
    permissions: ['constituyente.ver', 'constituyente.editar', 'constituyente.importar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'GLOBAL',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'NONE',
    },
  },

  // Fila 6: comite.ver / editar
  {
    label: 'comite.ver / editar',
    permissions: ['comite.ver', 'comite.editar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'VIEW',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'NONE',
    },
  },

  // Fila 7: ejecucion.ver / crear / avanzar
  {
    label: 'ejecucion.ver / crear / avanzar',
    permissions: ['ejecucion.ver', 'ejecucion.crear', 'ejecucion.avanzar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: ['GLOBAL', 'GLOBAL', 'GLOBAL'],
      COMMITTEE_MEMBER: ['GLOBAL', 'GLOBAL', 'NONE'], // L / ✔ / —
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'NONE',
    },
  },

  // Fila 8: ejecucion.cerrar / anular
  {
    label: 'ejecucion.cerrar / anular',
    permissions: ['ejecucion.cerrar', 'ejecucion.anular'],
    cells: {
      ADMINISTRATOR: 'NONE',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'NONE',
      PROGRAM_DIRECTOR: 'NONE',
      TEACHER: 'NONE',
    },
  },

  // Fila 9: cronograma.ver / editar
  {
    label: 'cronograma.ver / editar',
    permissions: ['cronograma.ver', 'cronograma.editar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'GLOBAL',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'NONE',
    },
  },

  // Fila 10: sesion.ver / editar
  {
    label: 'sesion.ver / editar',
    permissions: ['sesion.ver', 'sesion.editar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'GLOBAL',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'NONE',
    },
  },

  // Fila 11: encuesta.ver / editar / publicar / cerrar
  {
    label: 'encuesta.ver / editar / publicar / cerrar',
    permissions: ['encuesta.ver', 'encuesta.editar', 'encuesta.publicar', 'encuesta.cerrar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: ['GLOBAL', 'GLOBAL', 'GLOBAL', 'NONE'], // ✔ / ✔ / ✔ / —
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'NONE',
    },
  },

  // Fila 12: invitacion.enviar / reenviar / revocar
  {
    label: 'invitacion.enviar / reenviar / revocar',
    permissions: ['invitacion.enviar', 'invitacion.reenviar', 'invitacion.revocar'],
    cells: {
      ADMINISTRATOR: 'NONE',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'GLOBAL',
      PROGRAM_DIRECTOR: 'NONE',
      TEACHER: 'NONE',
    },
  },

  // Fila 13: acta.ver / editar / enviar_revision
  {
    label: 'acta.ver / editar / enviar_revision',
    permissions: ['acta.ver', 'acta.editar', 'acta.enviar_revision'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'GLOBAL',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'NONE',
    },
  },

  // Fila 14: acta.firmar / acta.anular
  {
    label: 'acta.firmar / acta.anular',
    permissions: ['acta.firmar', 'acta.anular'],
    cells: {
      ADMINISTRATOR: 'NONE',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'NONE',
      PROGRAM_DIRECTOR: 'NONE',
      TEACHER: 'NONE',
    },
  },

  // Fila 15: resolucion.ver / registrar / aprobar
  {
    label: 'resolucion.ver / registrar / aprobar',
    permissions: ['resolucion.ver', 'resolucion.registrar', 'resolucion.aprobar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'VIEW',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'NONE',
    },
  },

  // Fila 16: academico.ver / editar / importar
  {
    label: 'academico.ver / editar / importar',
    permissions: ['academico.ver', 'academico.editar', 'academico.importar'],
    cells: {
      ADMINISTRATOR: 'GLOBAL',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'GLOBAL',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'OWN_VIEW', // P (L) -> OWN en academico.ver
    },
  },

  // Fila 17: matriz.ver / editar
  {
    label: 'matriz.ver / editar',
    permissions: ['matriz.ver', 'matriz.editar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'GLOBAL',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'VIEW',
    },
  },

  // Fila 18: plan_assessment.ver / editar / aprobar
  {
    label: 'plan_assessment.ver / editar / aprobar',
    permissions: ['plan_assessment.ver', 'plan_assessment.editar', 'plan_assessment.aprobar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: ['GLOBAL', 'GLOBAL', 'NONE'], // ✔ / ✔ / —
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'VIEW',
    },
  },

  // Fila 19: instrumento.ver / editar / enviar
  {
    label: 'instrumento.ver / editar / enviar',
    permissions: ['instrumento.ver', 'instrumento.editar', 'instrumento.enviar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'VIEW',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'OWN', // P
    },
  },

  // Fila 20: instrumento.aprobar / observar
  {
    label: 'instrumento.aprobar / observar',
    permissions: ['instrumento.aprobar', 'instrumento.observar'],
    cells: {
      ADMINISTRATOR: 'NONE',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'NONE',
      PROGRAM_DIRECTOR: 'NONE',
      TEACHER: 'NONE',
    },
  },

  // Fila 21: medicion.ver / registrar / enviar
  {
    label: 'medicion.ver / registrar / enviar',
    permissions: ['medicion.ver', 'medicion.registrar', 'medicion.enviar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: ['GLOBAL', 'NONE', 'NONE'], // ✔ / — / —
      COMMITTEE_MEMBER: 'VIEW',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'OWN', // P
    },
  },

  // Fila 22: medicion.revisar / devolver
  {
    label: 'medicion.revisar / devolver',
    permissions: ['medicion.revisar', 'medicion.devolver'],
    cells: {
      ADMINISTRATOR: 'NONE',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'NONE',
      PROGRAM_DIRECTOR: 'NONE',
      TEACHER: 'NONE',
    },
  },

  // Fila 23: resultado.ver / recalcular
  {
    label: 'resultado.ver / recalcular',
    permissions: ['resultado.ver', 'resultado.recalcular'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'VIEW',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'OWN_VIEW', // P (L)
    },
  },

  // Fila 24: plan_mejora.ver / editar
  {
    label: 'plan_mejora.ver / editar',
    permissions: ['plan_mejora.ver', 'plan_mejora.editar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'GLOBAL',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'VIEW',
    },
  },

  // Fila 25: accion_mejora.ver / editar / avanzar
  {
    label: 'accion_mejora.ver / editar / avanzar',
    permissions: ['accion_mejora.ver', 'accion_mejora.editar', 'accion_mejora.avanzar'],
    cells: {
      ADMINISTRATOR: 'VIEW',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'GLOBAL',
      PROGRAM_DIRECTOR: 'VIEW',
      TEACHER: 'OWN', // P
    },
  },

  // Fila 26: reporte.ver / documento.descargar
  {
    label: 'reporte.ver / documento.descargar',
    permissions: ['reporte.ver', 'documento.descargar'],
    cells: {
      ADMINISTRATOR: 'GLOBAL',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'GLOBAL',
      PROGRAM_DIRECTOR: 'GLOBAL',
      TEACHER: 'OWN', // P
    },
  },

  // Fila 27: auditoria.ver
  {
    label: 'auditoria.ver',
    permissions: ['auditoria.ver'],
    cells: {
      ADMINISTRATOR: 'GLOBAL',
      COMMITTEE_PRESIDENT: 'GLOBAL',
      COMMITTEE_MEMBER: 'NONE',
      PROGRAM_DIRECTOR: 'NONE',
      TEACHER: 'NONE',
    },
  },

  // Fila 28: backup.ejecutar / descargar
  {
    label: 'backup.ejecutar / descargar',
    permissions: ['backup.ejecutar', 'backup.descargar'],
    cells: {
      ADMINISTRATOR: 'GLOBAL',
      COMMITTEE_PRESIDENT: 'NONE',
      COMMITTEE_MEMBER: 'NONE',
      PROGRAM_DIRECTOR: 'NONE',
      TEACHER: 'NONE',
    },
  },
] as const;

export function expandDefaultGrants(
  matrix: readonly MatrixRowDefinition[],
): DefaultRolePermissionGrant[] {
  const grants: DefaultRolePermissionGrant[] = [];
  const roles: readonly MatrixRoleCode[] = [
    'ADMINISTRATOR',
    'COMMITTEE_PRESIDENT',
    'COMMITTEE_MEMBER',
    'PROGRAM_DIRECTOR',
    'TEACHER',
  ];

  for (const row of matrix) {
    const hasViewAction = row.permissions.some((p) => p.endsWith('.ver'));

    for (const roleCode of roles) {
      const cell = row.cells[roleCode];

      if (Array.isArray(cell)) {
        if (cell.length !== row.permissions.length) {
          throw new Error(
            `Inconsistent cell length for row "${row.label}" and role "${roleCode}". Expected ${row.permissions.length}, received ${cell.length}`,
          );
        }

        cell.forEach((token, index) => {
          const perm = row.permissions[index];
          if (!perm) return;

          if (token === 'GLOBAL') {
            grants.push({ roleCode, permissionCode: perm, scope: 'GLOBAL' });
          } else if (token === 'OWN') {
            grants.push({ roleCode, permissionCode: perm, scope: 'OWN' });
          } else if (token === 'VIEW') {
            if (perm.endsWith('.ver')) {
              grants.push({ roleCode, permissionCode: perm, scope: 'GLOBAL' });
            }
          } else if (token === 'OWN_VIEW') {
            if (perm.endsWith('.ver')) {
              grants.push({ roleCode, permissionCode: perm, scope: 'OWN' });
            }
          }
        });
      } else {
        if ((cell === 'VIEW' || cell === 'OWN_VIEW') && !hasViewAction) {
          throw new Error(
            `Row "${row.label}" does not have a ".ver" action but role "${roleCode}" is configured with ${cell}`,
          );
        }

        for (const perm of row.permissions) {
          if (cell === 'GLOBAL') {
            grants.push({ roleCode, permissionCode: perm, scope: 'GLOBAL' });
          } else if (cell === 'OWN') {
            grants.push({ roleCode, permissionCode: perm, scope: 'OWN' });
          } else if (cell === 'VIEW') {
            if (perm.endsWith('.ver')) {
              grants.push({ roleCode, permissionCode: perm, scope: 'GLOBAL' });
            }
          } else if (cell === 'OWN_VIEW') {
            if (perm.endsWith('.ver')) {
              grants.push({ roleCode, permissionCode: perm, scope: 'OWN' });
            }
          }
        }
      }
    }
  }

  return grants;
}
