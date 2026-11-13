import type { ResolutionApproved } from '../entities/resolution-approved.js';

export interface ResolutionEventPublisher {
  /**
   * Entrega el evento a los suscriptores dentro del contexto transaccional activo: si uno falla,
   * el error se propaga y la aprobación completa se revierte (RNF-022).
   */
  publish(event: ResolutionApproved): Promise<void>;
}
