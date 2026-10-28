import puppeteer from 'puppeteer-core';
import { AppError } from '../errors/app-error.js';
import type { PdfGenerator, PdfRenderInput } from './pdf-generator.js';

export interface BrowserRequest {
  url(): string;
  abort(): Promise<void>;
  continue(): Promise<void>;
}

export interface BrowserPage {
  setContent(html: string, options?: { waitUntil?: string }): Promise<void>;
  pdf(options?: Record<string, unknown>): Promise<Buffer | Uint8Array>;
  setRequestInterception(value: boolean): Promise<void>;
  setJavaScriptEnabled(enabled: boolean): Promise<void>;
  on(event: 'request', handler: (req: BrowserRequest) => void): void;
  close(): Promise<void>;
}

export interface BrowserInstance {
  newPage(): Promise<BrowserPage>;
  isConnected(): boolean;
  close(): Promise<void>;
}

export interface BrowserLauncher {
  launch(options: {
    executablePath?: string;
    args: string[];
    headless: boolean | 'shell';
  }): Promise<BrowserInstance>;
}

export const defaultBrowserLauncher: BrowserLauncher = {
  async launch(options) {
    const browser = await puppeteer.launch({
      executablePath: options.executablePath,
      args: options.args,
      headless: options.headless,
    });
    return {
      async newPage() {
        const page = await browser.newPage();
        return page as unknown as BrowserPage;
      },
      isConnected() {
        const anyBrowser = browser as unknown as {
          connected?: boolean;
          isConnected?: () => boolean;
        };
        if (typeof anyBrowser.connected === 'boolean') {
          return anyBrowser.connected;
        }
        if (typeof anyBrowser.isConnected === 'function') {
          return anyBrowser.isConnected();
        }
        return true;
      },
      async close() {
        await browser.close();
      },
    };
  },
};

export interface PuppeteerPdfGeneratorOptions {
  launcher?: BrowserLauncher;
  executablePath?: string;
  concurrency?: number;
  renderTimeoutMs?: number;
  noSandbox?: boolean;
}

/**
 * Adaptador de generación de PDF basado en Puppeteer y Chromium con pool de páginas (RS-063, RNF-021).
 */
export class PuppeteerPdfGenerator implements PdfGenerator {
  private readonly launcher: BrowserLauncher;
  private readonly executablePath?: string;
  private readonly concurrency: number;
  private readonly renderTimeoutMs: number;
  private readonly noSandbox: boolean;

  private browser?: BrowserInstance;
  private browserLaunchPromise?: Promise<BrowserInstance>;
  private activeRenders = 0;
  private readonly renderQueue: (() => void)[] = [];

  constructor(options: PuppeteerPdfGeneratorOptions = {}) {
    this.launcher = options.launcher ?? defaultBrowserLauncher;
    this.executablePath = options.executablePath ?? process.env.PUPPETEER_EXECUTABLE_PATH;
    this.concurrency = options.concurrency ?? 3;
    this.renderTimeoutMs = options.renderTimeoutMs ?? 30000;
    this.noSandbox = options.noSandbox ?? (process.env.PDF_CHROMIUM_NO_SANDBOX === 'true' || false);
  }

  async render(input: PdfRenderInput): Promise<Buffer> {
    await this.acquireSlot();

    try {
      return await this.renderWithTimeout(input);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Error al generar el documento PDF.', 'INTERNAL_ERROR', 500);
    } finally {
      this.releaseSlot();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      try {
        if (this.browser.isConnected()) {
          await this.browser.close();
        }
      } finally {
        this.browser = undefined;
        this.browserLaunchPromise = undefined;
      }
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeRenders < this.concurrency) {
      this.activeRenders++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.renderQueue.push(() => {
        this.activeRenders++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.activeRenders--;
    const next = this.renderQueue.shift();
    if (next) {
      next();
    }
  }

  private async ensureBrowser(): Promise<BrowserInstance> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.browserLaunchPromise) {
      return this.browserLaunchPromise;
    }

    const args: string[] = ['--disable-dev-shm-usage', '--disable-gpu'];
    if (this.noSandbox) {
      args.unshift('--no-sandbox', '--disable-setuid-sandbox');
    }

    this.browserLaunchPromise = this.launcher
      .launch({
        executablePath: this.executablePath,
        args,
        headless: true,
      })
      .then((instance) => {
        this.browser = instance;
        this.browserLaunchPromise = undefined;
        return instance;
      })
      .catch((err: unknown) => {
        this.browserLaunchPromise = undefined;
        throw err;
      });

    return this.browserLaunchPromise;
  }

  private async renderWithTimeout(input: PdfRenderInput): Promise<Buffer> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new AppError(
            `Tiempo de generación del PDF excedido (${this.renderTimeoutMs} ms).`,
            'INTERNAL_ERROR',
            500,
          ),
        );
      }, this.renderTimeoutMs);
    });

    const executionPromise = (async () => {
      const browser = await this.ensureBrowser();
      const page = await browser.newPage();

      try {
        await page.setJavaScriptEnabled(false);
        await page.setRequestInterception(true);

        page.on('request', (req) => {
          const url = req.url();
          if (url.startsWith('data:') || url.startsWith('about:blank')) {
            void req.continue();
          } else {
            void req.abort();
          }
        });

        await page.setContent(input.html, { waitUntil: 'load' });

        const pdfBytes = await page.pdf({
          format: input.options?.format ?? 'A4',
          printBackground: input.options?.printBackground ?? true,
          margin: input.options?.margin,
          headerTemplate: input.options?.headerTemplate,
          footerTemplate: input.options?.footerTemplate,
          displayHeaderFooter: input.options?.displayHeaderFooter ?? false,
        });

        return Buffer.from(pdfBytes);
      } finally {
        await page.close();
      }
    })();

    try {
      return await Promise.race([executionPromise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
