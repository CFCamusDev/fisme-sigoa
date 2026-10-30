import { describe, it, expect, vi } from 'vitest';
import {
  PuppeteerPdfGenerator,
  type BrowserLauncher,
  type BrowserInstance,
  type BrowserPage,
  type BrowserRequest,
} from './puppeteer-pdf-generator.js';
import { AppError } from '../errors/app-error.js';

function createMockPage(overrides: Partial<BrowserPage> = {}): {
  page: BrowserPage;
  requestHandlers: ((req: BrowserRequest) => void)[];
} {
  const requestHandlers: ((req: BrowserRequest) => void)[] = [];

  const page: BrowserPage = {
    setContent: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4\nTest')),
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    setJavaScriptEnabled: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: (req: BrowserRequest) => void) => {
      if (event === 'request') {
        requestHandlers.push(handler);
      }
    }),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  return { page, requestHandlers };
}

function createMockLauncher(): {
  launcher: BrowserLauncher;
  pagesCreated: BrowserPage[];
  browsersLaunched: BrowserInstance[];
} {
  const pagesCreated: BrowserPage[] = [];
  const browsersLaunched: BrowserInstance[] = [];

  const launcher: BrowserLauncher = {
    async launch() {
      let connected = true;

      const browser: BrowserInstance = {
        async newPage() {
          const { page } = createMockPage();
          pagesCreated.push(page);
          return page;
        },
        isConnected() {
          return connected;
        },
        async close() {
          connected = false;
        },
      };

      browsersLaunched.push(browser);
      return browser;
    },
  };

  return { launcher, pagesCreated, browsersLaunched };
}

describe('PuppeteerPdfGenerator (RS-063, RNF-021)', () => {
  it('reuses the same browser instance across multiple renders', async () => {
    const { launcher, browsersLaunched, pagesCreated } = createMockLauncher();
    const generator = new PuppeteerPdfGenerator({ launcher });

    const pdf1 = await generator.render({ html: '<h1>Doc 1</h1>' });
    const pdf2 = await generator.render({ html: '<h1>Doc 2</h1>' });

    expect(browsersLaunched).toHaveLength(1);
    expect(pagesCreated).toHaveLength(2);
    expect(pdf1.toString()).toContain('%PDF');
    expect(pdf2.toString()).toContain('%PDF');

    await generator.close();
  });

  it('respects concurrency limit and queues excess renders', async () => {
    let activePages = 0;
    let maxObservedPages = 0;

    const launcher: BrowserLauncher = {
      async launch() {
        return {
          async newPage() {
            activePages++;
            if (activePages > maxObservedPages) {
              maxObservedPages = activePages;
            }

            const { page } = createMockPage({
              async pdf() {
                await new Promise((r) => setTimeout(r, 20));
                return Buffer.from('%PDF-1.4\nConcurrent');
              },
              async close() {
                activePages--;
              },
            });

            return page;
          },
          isConnected: () => true,
          close: async () => {},
        };
      },
    };

    const generator = new PuppeteerPdfGenerator({ launcher, concurrency: 2 });

    const renders = Array.from({ length: 6 }, (_, i) =>
      generator.render({ html: `<p>Item ${i}</p>` }),
    );

    await Promise.all(renders);

    expect(maxObservedPages).toBeLessThanOrEqual(2);
    expect(maxObservedPages).toBeGreaterThanOrEqual(1);

    await generator.close();
  });

  it('always closes page even if rendering throws an error', async () => {
    let pageClosed = false;

    const launcher: BrowserLauncher = {
      async launch() {
        return {
          async newPage() {
            const { page } = createMockPage({
              async setContent() {
                throw new Error('Failed to set content');
              },
              async close() {
                pageClosed = true;
              },
            });
            return page;
          },
          isConnected: () => true,
          close: async () => {},
        };
      },
    };

    const generator = new PuppeteerPdfGenerator({ launcher });

    await expect(generator.render({ html: '<p>Bad HTML</p>' })).rejects.toThrow(AppError);
    expect(pageClosed).toBe(true);

    await generator.close();
  });

  it('relaunches browser if previous instance disconnected', async () => {
    const { launcher, browsersLaunched } = createMockLauncher();
    const generator = new PuppeteerPdfGenerator({ launcher });

    await generator.render({ html: '<p>1</p>' });
    expect(browsersLaunched).toHaveLength(1);

    // Simular desconexión
    await browsersLaunched[0]?.close();

    await generator.render({ html: '<p>2</p>' });
    expect(browsersLaunched).toHaveLength(2);

    await generator.close();
  });

  it('throws AppError when render times out', async () => {
    const launcher: BrowserLauncher = {
      async launch() {
        return {
          async newPage() {
            const { page } = createMockPage({
              async pdf() {
                // Tarda más que el timeout configurado
                await new Promise((r) => setTimeout(r, 100));
                return Buffer.from('%PDF');
              },
            });
            return page;
          },
          isConnected: () => true,
          close: async () => {},
        };
      },
    };

    const generator = new PuppeteerPdfGenerator({
      launcher,
      renderTimeoutMs: 25,
    });

    await expect(generator.render({ html: '<p>Slow</p>' })).rejects.toThrow(AppError);

    await generator.close();
  });

  it('disables JavaScript and blocks external network requests for security', async () => {
    let jsDisabled = false;
    let interceptionEnabled = false;
    let interceptedHandlers: ((req: BrowserRequest) => void)[] = [];

    const launcher: BrowserLauncher = {
      async launch() {
        return {
          async newPage() {
            const { page, requestHandlers } = createMockPage({
              async setJavaScriptEnabled(enabled) {
                jsDisabled = !enabled;
              },
              async setRequestInterception(val) {
                interceptionEnabled = val;
              },
            });
            interceptedHandlers = requestHandlers;
            return page;
          },
          isConnected: () => true,
          close: async () => {},
        };
      },
    };

    const generator = new PuppeteerPdfGenerator({ launcher });
    await generator.render({ html: '<p>Secure Doc</p>' });

    expect(jsDisabled).toBe(true);
    expect(interceptionEnabled).toBe(true);
    expect(interceptedHandlers.length).toBeGreaterThan(0);

    // Probar el handler de requests
    const handler = interceptedHandlers[0]!;

    let continued = false;
    let aborted = false;

    const dataRequest: BrowserRequest = {
      url: () =>
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      continue: async () => {
        continued = true;
      },
      abort: async () => {
        aborted = true;
      },
    };

    await handler(dataRequest);
    expect(continued).toBe(true);
    expect(aborted).toBe(false);

    continued = false;
    aborted = false;

    const externalRequest: BrowserRequest = {
      url: () => 'https://malicious-external-site.com/steal-data',
      continue: async () => {
        continued = true;
      },
      abort: async () => {
        aborted = true;
      },
    };

    await handler(externalRequest);
    expect(continued).toBe(false);
    expect(aborted).toBe(true);

    await generator.close();
  });

  it('close is idempotent and closes browser', async () => {
    const { launcher, browsersLaunched } = createMockLauncher();
    const generator = new PuppeteerPdfGenerator({ launcher });

    await generator.render({ html: '<p>Test</p>' });
    expect(browsersLaunched[0]?.isConnected()).toBe(true);

    await generator.close();
    expect(browsersLaunched[0]?.isConnected()).toBe(false);

    // Segundo close no debe fallar
    await expect(generator.close()).resolves.toBeUndefined();
  });

  it('launches with hardened args and without sandbox flags by default', async () => {
    let capturedArgs: string[] = [];

    const launcher: BrowserLauncher = {
      async launch(options) {
        capturedArgs = options.args;
        return {
          async newPage() {
            const { page } = createMockPage();
            return page;
          },
          isConnected: () => true,
          close: async () => {},
        };
      },
    };

    const generator = new PuppeteerPdfGenerator({ launcher, noSandbox: false });
    await generator.render({ html: '<p>Hardened</p>' });

    expect(capturedArgs).toContain('--disable-extensions');
    expect(capturedArgs).toContain('--disable-background-networking');
    expect(capturedArgs).toContain('--host-resolver-rules=MAP * ~NOTFOUND');
    expect(capturedArgs).not.toContain('--no-sandbox');
    expect(capturedArgs).not.toContain('--disable-setuid-sandbox');

    await generator.close();
  });

  it('includes --no-sandbox and logs warning when noSandbox is true', async () => {
    let capturedArgs: string[] = [];
    const mockLogger = {
      warn: vi.fn(),
    };

    const launcher: BrowserLauncher = {
      async launch(options) {
        capturedArgs = options.args;
        return {
          async newPage() {
            const { page } = createMockPage();
            return page;
          },
          isConnected: () => true,
          close: async () => {},
        };
      },
    };

    const generator = new PuppeteerPdfGenerator({
      launcher,
      noSandbox: true,
      logger: mockLogger,
    });
    await generator.render({ html: '<p>No Sandbox</p>' });

    expect(capturedArgs).toContain('--no-sandbox');
    expect(capturedArgs).toContain('--disable-setuid-sandbox');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Chromium is executing without sandbox'),
    );

    await generator.close();
  });

  it('aborts file:, http: and https: requests but continues data: and about:blank', async () => {
    let interceptedHandlers: ((req: BrowserRequest) => void)[] = [];

    const launcher: BrowserLauncher = {
      async launch() {
        return {
          async newPage() {
            const { page, requestHandlers } = createMockPage();
            interceptedHandlers = requestHandlers;
            return page;
          },
          isConnected: () => true,
          close: async () => {},
        };
      },
    };

    const generator = new PuppeteerPdfGenerator({ launcher });
    await generator.render({ html: '<p>Security</p>' });

    const handler = interceptedHandlers[0]!;

    const testUrl = async (url: string) => {
      let continued = false;
      let aborted = false;
      await handler({
        url: () => url,
        continue: async () => {
          continued = true;
        },
        abort: async () => {
          aborted = true;
        },
      });
      return { continued, aborted };
    };

    expect(await testUrl('data:text/plain,hello')).toEqual({ continued: true, aborted: false });
    expect(await testUrl('about:blank')).toEqual({ continued: true, aborted: false });
    expect(await testUrl('http://example.com/test')).toEqual({ continued: false, aborted: true });
    expect(await testUrl('https://example.com/test')).toEqual({ continued: false, aborted: true });
    expect(await testUrl('file:///etc/passwd')).toEqual({ continued: false, aborted: true });

    await generator.close();
  });
});
