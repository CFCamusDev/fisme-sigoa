import { AsyncLocalStorage } from 'node:async_hooks';
import type { UnitOfWork } from '../unit-of-work/unit-of-work.js';
import type { PrismaClient, Prisma } from './generated/client.js';

export interface DbProvider {
  get(): PrismaClient | Prisma.TransactionClient;
}

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
}

export class PrismaUnitOfWork implements UnitOfWork, DbProvider {
  private readonly asyncLocalStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly options?: TransactionOptions,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    const activeTransaction = this.asyncLocalStorage.getStore();
    if (activeTransaction) {
      // Reutiliza la transacción existente en el contexto actual
      return await work();
    }

    return await this.prisma.$transaction(async (tx) => {
      return await this.asyncLocalStorage.run(tx as unknown as Prisma.TransactionClient, work);
    }, this.options);
  }

  get(): PrismaClient | Prisma.TransactionClient {
    const activeTransaction = this.asyncLocalStorage.getStore();
    return activeTransaction ?? this.prisma;
  }
}
