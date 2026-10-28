/**
 * Estado actual de la cabeza de la cadena de auditoría (RS-042, RNF-015).
 */
export interface AuditChainHeadState {
  sequence: bigint;
  hash: string;
}

/**
 * Puerto para anclar la cabeza de la cadena de auditoría y prevenir truncamientos silenciosos (RS-042).
 */
export interface AuditChainAnchor {
  read(): Promise<AuditChainHeadState | null>;
  advance(head: AuditChainHeadState): Promise<void>;
}
