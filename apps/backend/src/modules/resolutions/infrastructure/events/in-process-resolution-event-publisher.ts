import type { ResolutionApproved } from '../../domain/entities/resolution-approved.js';
import type {
  ResolutionApprovedSubscriber,
  ResolutionEventPublisher,
} from '../../domain/ports/resolution-event-publisher.js';

/**
 * Publicador en proceso (D5): ejecuta los suscriptores en orden dentro del contexto transaccional
 * activo del llamador. Sin suscriptores no hace nada; si uno falla, el error se propaga.
 */
export class InProcessResolutionEventPublisher implements ResolutionEventPublisher {
  constructor(private readonly subscribers: readonly ResolutionApprovedSubscriber[] = []) {}

  async publish(event: ResolutionApproved): Promise<void> {
    for (const subscriber of this.subscribers) {
      await subscriber(event);
    }
  }
}
