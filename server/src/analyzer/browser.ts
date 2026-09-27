import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { Logger } from '../utils/logger';

const logger = new Logger('PlaywrightBrowser');

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

export async function createBrowserSession(viewport = { width: 1440, height: 900 }): Promise<BrowserSession> {
  logger.info('Launching Chromium browser session...');
  
  let browser: Browser;
  const launchOptions = {
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  };

  try {
    browser = await chromium.launch(launchOptions);
  } catch (err: any) {
    logger.warn('Default Playwright Chromium not found, trying system Chrome channel...', { error: err.message });
    try {
      browser = await chromium.launch({ ...launchOptions, channel: 'chrome' });
    } catch {
      logger.warn('System Chrome failed, falling back to Microsoft Edge channel...');
      browser = await chromium.launch({ ...launchOptions, channel: 'msedge' });
    }
  }

  const context = await browser.newContext({
    viewport,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
    locale: 'en-US',
  });

  const page = await context.newPage();

  // Inject __name global shim to handle tsx / esbuild function wrapping
  await context.addInitScript('window.__name = (t) => t; (globalThis || window).__name = (t) => t;');
  await page.addInitScript('window.__name = (t) => t; (globalThis || window).__name = (t) => t;');

  // Set default timeout
  const timeoutMs = parseInt(process.env.PLAYWRIGHT_TIMEOUT_MS || '30000', 10);
  page.setDefaultTimeout(timeoutMs);
  page.setDefaultNavigationTimeout(timeoutMs);

  const close = async () => {
    try {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
      logger.info('Browser session closed successfully');
    } catch (err: any) {
      logger.warn('Error during browser cleanup', { error: err.message });
    }
  };

  return { browser, context, page, close };
}

export async function triggerLazyLoading(page: Page): Promise<void> {
  logger.info('Triggering lazy loading by scrolling page...');
  try {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight || totalHeight >= 8000) {
            clearInterval(timer);
            // Scroll back to top
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    });
    // Wait briefly for images and layout to settle
    await page.waitForTimeout(1000);
  } catch (err: any) {
    logger.warn('Lazy-load scroll encountered an error, continuing', { error: err.message });
  }
}
