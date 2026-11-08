import type { Grant } from '../../domain/policies/effective-permissions.js';
import type { GrantReader } from '../../domain/ports/grant-reader.js';
import type { PermissionCacheInvalidator } from '../../domain/ports/permission-cache-invalidator.js';
import type { DbProvider } from '../../../../shared/prisma/prisma-unit-of-work.js';

export interface CachingGrantReaderOptions {
  readonly ttlMs?: number;
  readonly maxEntries?: number;
  readonly now?: () => number;
}

interface CacheEntry {
  readonly grants: Grant[];
  readonly expiresAt: number;
}

export class CachingGrantReader implements GrantReader, PermissionCacheInvalidator {
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlightReads = new Map<string, Promise<Grant[]>>();
  private readonly userGenerations = new Map<string, number>();
  private globalGeneration = 0;

  constructor(
    private readonly grantReader: GrantReader,
    private readonly dbProvider?: DbProvider,
    options?: CachingGrantReaderOptions,
  ) {
    this.ttlMs = options?.ttlMs ?? 30_000;
    this.maxEntries = options?.maxEntries ?? 1_000;
    this.now = options?.now ?? (() => Date.now());
  }

  async findGrantsByUserId(userId: string): Promise<Grant[]> {
    // Si la caché está desactivada (ttlMs === 0) o estamos dentro de una transacción, leer directamente
    if (this.ttlMs <= 0 || (this.dbProvider?.isInTransaction?.() ?? false)) {
      return this.grantReader.findGrantsByUserId(userId);
    }

    const currentTime = this.now();
    const cached = this.cache.get(userId);

    if (cached) {
      if (currentTime < cached.expiresAt) {
        // Marcamos como más recientemente usado (LRU)
        this.cache.delete(userId);
        this.cache.set(userId, cached);
        return cached.grants;
      }
      // Expirado
      this.cache.delete(userId);
    }

    // Comprobar si ya hay una lectura en vuelo para este usuario
    const inFlight = this.inFlightReads.get(userId);
    if (inFlight) {
      return inFlight;
    }

    // Registrar la generación al inicio de la lectura
    const startUserGen = this.userGenerations.get(userId) ?? 0;
    const startGlobalGen = this.globalGeneration;

    const readPromise = (async () => {
      try {
        const grants = await this.grantReader.findGrantsByUserId(userId);

        // Verificar si la generación cambió mientras la lectura estaba en curso
        const currentUserGen = this.userGenerations.get(userId) ?? 0;
        const currentGlobalGen = this.globalGeneration;

        if (
          currentUserGen === startUserGen &&
          currentGlobalGen === startGlobalGen &&
          this.ttlMs > 0
        ) {
          this.setInCache(userId, grants);
        }

        return grants;
      } finally {
        this.inFlightReads.delete(userId);
      }
    })();

    this.inFlightReads.set(userId, readPromise);
    return readPromise;
  }

  invalidateUser(userId: string): void {
    this.userGenerations.set(userId, (this.userGenerations.get(userId) ?? 0) + 1);
    this.cache.delete(userId);
  }

  invalidateAll(): void {
    this.globalGeneration++;
    this.userGenerations.clear();
    this.cache.clear();
  }

  private setInCache(userId: string, grants: Grant[]): void {
    if (this.cache.has(userId)) {
      this.cache.delete(userId);
    } else if (this.cache.size >= this.maxEntries) {
      // Desalojar el elemento más antiguo (primer elemento del Map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(userId, {
      grants,
      expiresAt: this.now() + this.ttlMs,
    });
  }
}
