import puppeteer from 'puppeteer-extra';
import {Browser, Page} from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import config from '../config/index';

puppeteer.use(StealthPlugin());

let browser: Browser | null | undefined = null;
let fbPage: Page | null | undefined = null;
let xPage: Page | null | undefined = null;

const browserWSEndpoint = config.browserWSEndpointUrl;

export async function initializeBrowser() {
  try {
    if (!browser) {
      browser = await puppeteer.connect({browserWSEndpoint});
    }
    return browser;
  } catch (error: any) {
    console.log('Error initializing Browser', error.message);
  }
}

export async function getFacebookPage() {
  try {
    if (!fbPage) {
      browser = await initializeBrowser();
      fbPage = await browser!.newPage();
      await fbPage.goto('https://www.facebook.com/');
      console.log('Facebook page initialized.');
    }
    return fbPage;
  } catch (error: any) {
    console.log('Error pgetting facebook page', error.message);
  }
}

export async function getNewXPage(): Promise<Page> {
  const browser = await initializeBrowser();
  xPage = await browser!.newPage();
  await xPage.goto('https://x.com');
  console.log('New X.com page opened.');
  return xPage;
}

export async function visitBrowserPageLink(
  browser: Browser,
  link: string,
): Promise<Page> {
  let page = null;
  if (!page) {
    page = await browser.newPage();
    // await page.setViewport({width: 1920, height: 1080}); // Lenovo Legion 6
    await page.setViewport({width: 1366, height: 768}); // ELiteBook 8470p
    await page.goto(link);

    console.log('page initialized.');
  }
  return page;
}

// Half Page width
export async function visitBrowserPageLinkDefault(
  browser: Browser,
  link: string,
) {
  let page = null;
  try {
    if (!page) {
      page = await browser.newPage();

      // Load page with default viewport first
      await page.goto(link, {waitUntil: 'networkidle0'});

      // Get the full page dimensions
      const dimensions = await page.evaluate(() => {
        return {
          width: Math.max(
            document.body.scrollWidth,
            document.body.offsetWidth,
            document.documentElement.clientWidth,
            document.documentElement.scrollWidth,
            document.documentElement.offsetWidth,
          ),
          height: Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight,
          ),
        };
      });

      // Set viewport to match the page dimensions
      await page.setViewport({
        width: Math.min(dimensions.width, 1920), // Cap at reasonable max
        height: Math.min(dimensions.height, 1080),
      });

      console.log(
        `Page initialized with dynamic viewport: ${dimensions.width}x${dimensions.height}`,
      );
    }
    return page;
  } catch (error: any) {
    console.log('Error Initializing page', error.message);
  }
}

export async function closePage(page: Page): Promise<void> {
  try {
    if (!page.isClosed()) {
      await page.close();
    }
  } catch (err) {
    console.error('Failed to close page:', err);
  }
}
