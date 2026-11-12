import type { Logger } from 'pino';
import type { EmailSender, EmailMessage } from './email-sender.js';

export interface EmailQueueOptions {
  sender: EmailSender;
  concurrency?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  logger?: Logger;
  onFailure?: (message: EmailMessage, error: unknown) => void | Promise<void>;
}

interface QueueItem {
  message: EmailMessage;
  attempts: number;
}

function extractRecipientDomain(to: string): string {
  const at = to.lastIndexOf('@');
  return at !== -1 ? to.slice(at + 1) : 'unknown';
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class EmailQueue {
  private readonly sender: EmailSender;
  private readonly concurrency: number;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly logger?: Logger;
  private readonly onFailure?: (message: EmailMessage, error: unknown) => void | Promise<void>;

  private readonly items: QueueItem[] = [];
  private activeWorkers = 0;
  private drainResolvers: (() => void)[] = [];

  constructor(options: EmailQueueOptions) {
    this.sender = options.sender;
    this.concurrency = options.concurrency ?? 5;
    this.maxAttempts = options.maxAttempts ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.sleep = options.sleep ?? defaultSleep;
    this.logger = options.logger;
    this.onFailure = options.onFailure;
  }

  enqueue(messages: EmailMessage[]): { accepted: number } {
    for (const message of messages) {
      this.items.push({ message, attempts: 0 });
    }

    this.scheduleWorkers();

    return { accepted: messages.length };
  }

  async drain(): Promise<void> {
    if (this.activeWorkers === 0 && this.items.length === 0) {
      return;
    }

    return new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  private scheduleWorkers(): void {
    while (this.activeWorkers < this.concurrency && this.items.length > 0) {
      this.activeWorkers++;
      void this.runWorker();
    }
  }

  private async runWorker(): Promise<void> {
    try {
      while (this.items.length > 0) {
        const item = this.items.shift();
        if (!item) {
          break;
        }

        const domain = extractRecipientDomain(item.message.to);

        try {
          await this.sender.send(item.message);
          this.logger?.info({
            recipientDomain: domain,
            template: item.message.template,
            attempts: item.attempts + 1,
            status: 'delivered',
          });
        } catch (error) {
          item.attempts++;
          if (item.attempts < this.maxAttempts) {
            this.logger?.warn({
              recipientDomain: domain,
              template: item.message.template,
              attempt: item.attempts,
              maxAttempts: this.maxAttempts,
              status: 'retrying',
            });
            await this.sleep(this.retryDelayMs);
            this.items.push(item);
          } else {
            this.logger?.error({
              recipientDomain: domain,
              template: item.message.template,
              attempts: item.attempts,
              status: 'failed',
            });
            if (this.onFailure) {
              try {
                await this.onFailure(item.message, error);
              } catch {
                // Previene que una falla en el callback interrumpa la cola
              }
            }
          }
        }
      }
    } finally {
      this.activeWorkers--;
      this.checkDrain();
      // Si aún quedan items y hay capacidad, lanzar workers
      if (this.items.length > 0) {
        this.scheduleWorkers();
      }
    }
  }

  private checkDrain(): void {
    if (this.activeWorkers === 0 && this.items.length === 0) {
      const resolvers = [...this.drainResolvers];
      this.drainResolvers = [];
      for (const resolve of resolvers) {
        resolve();
      }
    }
  }
}
