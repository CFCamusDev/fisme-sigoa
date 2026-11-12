import { computeAuditHash } from './audit-hash.js';
import type { AuditChainAnchor } from './audit-chain-anchor.js';
import type { AuditChainReader } from './audit-chain-reader.js';

export { type AuditChainAnchor } from './audit-chain-anchor.js';

/**
 * Razones posibles por las cuales una cadena de auditoría falla su verificación de integridad (RS-042, RNF-015).
 */
export type AuditChainFailureReason =
  'SEQUENCE_GAP' | 'PREVIOUS_HASH_MISMATCH' | 'HASH_MISMATCH' | 'HEAD_MISMATCH';

/**
 * Resultado de la verificación de la cadena de auditoría (RS-042, RNF-015).
 */
export type AuditChainVerification =
  | { valid: true; checked: number }
  | {
      valid: false;
      checked: number;
      firstInvalid: { sequence: bigint; reason: AuditChainFailureReason };
    };

/**
 * Servicio de verificación de integridad de la cadena de auditoría (RS-042, RNF-015).
 * Recorre la secuencia de registros en lotes y comprueba correlatividad, hashes anteriores,
 * hashes propios y concordancia con el ancla de cabeza.
 */
export class AuditChainVerifier {
  constructor(
    private readonly reader: AuditChainReader,
    private readonly anchor?: AuditChainAnchor,
  ) {}

  async verify(batchSize = 500): Promise<AuditChainVerification> {
    let checked = 0;
    let afterSequence: bigint | null = null;
    let lastHash: string | null = null;
    let lastSequence: bigint | null = null;

    while (true) {
      const batch = await this.reader.readBatch(afterSequence, batchSize);
      if (batch.length === 0) {
        break;
      }

      for (const record of batch) {
        const expectedSequence = BigInt(checked + 1);

        // 1. Comprobación de salto en la secuencia correlativa sin huecos
        if (record.sequence !== expectedSequence) {
          return {
            valid: false,
            checked,
            firstInvalid: {
              sequence: record.sequence,
              reason: 'SEQUENCE_GAP',
            },
          };
        }

        // 2. Comprobación de hash previo encadenado
        if (expectedSequence === 1n) {
          if (record.previousHash !== null) {
            return {
              valid: false,
              checked,
              firstInvalid: {
                sequence: record.sequence,
                reason: 'PREVIOUS_HASH_MISMATCH',
              },
            };
          }
        } else {
          if (record.previousHash !== lastHash) {
            return {
              valid: false,
              checked,
              firstInvalid: {
                sequence: record.sequence,
                reason: 'PREVIOUS_HASH_MISMATCH',
              },
            };
          }
        }

        // 3. Comprobación de integridad del contenido y hash propio SHA-256
        const computedHash = computeAuditHash({
          action: record.action,
          actor: record.actor,
          after: record.after,
          before: record.before,
          entity: record.entity,
          entityId: record.entityId,
          ip: record.ip,
          occurredAt: record.occurredAt,
          previousHash: record.previousHash,
          requestId: record.requestId,
          sequence: record.sequence,
        });

        if (computedHash !== record.hash) {
          return {
            valid: false,
            checked,
            firstInvalid: {
              sequence: record.sequence,
              reason: 'HASH_MISMATCH',
            },
          };
        }

        lastSequence = record.sequence;
        lastHash = record.hash;
        afterSequence = record.sequence;
        checked++;
      }
    }

    // 4. Comprobación con el ancla de cabeza si está disponible
    if (this.anchor) {
      const head = await this.anchor.read();

      if (checked === 0) {
        if (head !== null) {
          return {
            valid: false,
            checked: 0,
            firstInvalid: {
              sequence: head.sequence,
              reason: 'HEAD_MISMATCH',
            },
          };
        }
      } else {
        if (!head || head.sequence !== lastSequence || head.hash !== lastHash) {
          return {
            valid: false,
            checked,
            firstInvalid: {
              sequence: head ? head.sequence : (lastSequence ?? 1n),
              reason: 'HEAD_MISMATCH',
            },
          };
        }
      }
    }

    return {
      valid: true,
      checked,
    };
  }
}
