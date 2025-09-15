import puppeteer from 'puppeteer-extra';
import {Browser, Page} from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import config from '../config/index';
import * as fs from 'fs';
import sleep from './sleep';

puppeteer.use(StealthPlugin());

let browser: Browser | null | undefined = null;
let fbPage: Page | null | undefined = null;
let xPage: Page | null | undefined = null;

// Track active proxy browsers to manage them properly
const activeBrowsers = new Map<string, Browser>();

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

/**
 * Creates a new browser instance with a random proxy from the list
 * Each browser instance uses a dedicated proxy connection
 */
export async function createProxyBrowser(): Promise<{
  browser: Browser;
  proxy: string;
}> {
  // const randomProxy = await getRandomProxy(config.proxyList);
  const randomProxy = `socks4://104.200.135.46:4145`;
  console.log('Creating browser with proxy:', randomProxy);

  if (!randomProxy) {
    throw new Error('No proxy available from proxy list');
  }

  // Parse the SOCKS5 proxy URL
  // const proxyUrl = new URL(randomProxy);
  // const proxyUrl = new URL(`socks5://99.110.188.252:1080`);
  // const proxyServer = `${proxyUrl.hostname}:${proxyUrl.port}`;

  const browserArgs = [
    `--proxy-server=${randomProxy}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    // Additional proxy-related flags
    '--disable-features=VizDisplayCompositor',
    '--ignore-certificate-errors-spki-list',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
  ];

  try {
    const proxyBrowser = await puppeteer.launch({
      headless: false,
      // args: [`--proxy-server=${randomProxy}`],
      args: browserArgs,
      // defaultViewport: {width: 1920, height: 1280},
    });

    // Quick test
    const testPage = await proxyBrowser.newPage();
    await testPage.goto('https://facebook.com', {
      waitUntil: 'domcontentloaded',
      // timeout: 10000,
    });
    // await testPage.close();

    // Store the browser instance for cleanup
    activeBrowsers.set(randomProxy, proxyBrowser);

    console.log(`✅ Browser created successfully with proxy: ${randomProxy}`);
    return {browser: proxyBrowser, proxy: randomProxy};
  } catch (error: any) {
    console.error(
      `❌ Failed to create browser with proxy ${randomProxy}:`,
      error.message,
    );
    throw error;
  }
}

/**
 * Creates a new YTS page with a dedicated proxy browser
 */
export async function getNewYTSPage(): Promise<{
  page: Page;
  browser: Browser;
  proxy: string;
}> {
  const {browser: ytsBrowser, proxy} = await createProxyBrowser();

  const ytsPage = await ytsBrowser.newPage();

  // Set viewport
  // await ytsPage.setViewport({width: 1920, height: 1280});

  try {
    // Test the proxy by visiting IP checker
    console.log('Testing proxy connection...');
    await ytsPage.goto('https://www.whatismyip.com/', {
      waitUntil: 'networkidle2',
      // timeout: 300000,
    });
    await sleep(60000);

    // Optional: Get the actual IP to verify proxy is working
    /** try {
      const ipElement = await ytsPage.$('span#ip');
      if (ipElement) {
        const ip = await ytsPage.evaluate(el => el.textContent, ipElement);
        console.log(`✅ Proxy working! Current IP: ${ip}`);
      }
    } catch (ipError) {
      console.log('Could not extract IP, but page loaded successfully');
    } */

    console.log('New page opened with proxy:\t', proxy);
    return {page: ytsPage, browser: ytsBrowser, proxy};
  } catch (error: any) {
    console.error('❌ Failed to load test page:', error.message);
    // await ytsBrowser.close();
    // activeBrowsers.delete(proxy);
    throw error;
  }
}

/**
 * Creates multiple YTS pages with different proxies for parallel processing
 */
export async function getMultipleYTSPages(
  count: number,
): Promise<Array<{page: Page; browser: Browser; proxy: string}>> {
  const pages: Array<{page: Page; browser: Browser; proxy: string}> = [];

  console.log(`Creating ${count} YTS pages with different proxies...`);

  for (let i = 0; i < count; i++) {
    try {
      const pageData = await getNewYTSPage();
      pages.push(pageData);
      console.log(
        `✅ Page ${i + 1}/${count} created with proxy: ${pageData.proxy}`,
      );

      // Small delay between browser launches to avoid overwhelming the system
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Failed to create page ${i + 1}:`, error);
      // Continue with other pages even if one fails
    }
  }

  console.log(`✅ Created ${pages.length}/${count} pages successfully`);
  return pages;
}

/**
 * Navigates a proxy page to YouTube
 */
export async function navigateToYouTube(page: Page): Promise<void> {
  try {
    console.log('Navigating to YouTube...');
    await page.goto('https://www.youtube.com', {
      waitUntil: 'networkidle2',
      // timeout: 30000,
    });
    console.log('✅ Successfully navigated to YouTube');
  } catch (error: any) {
    console.error('❌ Failed to navigate to YouTube:', error.message);
    throw error;
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
    console.log('Error getting facebook page', error.message);
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
  const page = await browser.newPage();
  await page.setViewport({width: 1366, height: 768});
  await page.goto(link, {waitUntil: 'networkidle2'});
  console.log('Page initialized for link:', link);
  return page;
}

export async function visitBrowserPageLinkDefault(
  browser: Browser,
  link: string,
): Promise<Page> {
  try {
    const page = await browser.newPage();

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
      width: Math.min(dimensions.width, 1920),
      height: Math.min(dimensions.height, 1080),
    });

    console.log(
      `Page initialized with dynamic viewport: ${dimensions.width}x${dimensions.height}`,
    );
    return page;
  } catch (error: any) {
    console.log('Error Initializing page', error.message);
    throw error;
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

/**
 * Closes a proxy browser and removes it from tracking
 */
export async function closeProxyBrowser(
  browser: Browser,
  proxy: string,
): Promise<void> {
  try {
    if (!browser.isConnected()) {
      console.log('Browser already disconnected');
      return;
    }

    const pages = await browser.pages();
    for (const page of pages) {
      if (!page.isClosed()) {
        await page.close();
      }
    }

    await browser.close();
    activeBrowsers.delete(proxy);
    console.log(`✅ Closed browser with proxy: ${proxy}`);
  } catch (err) {
    console.error(`❌ Failed to close browser with proxy ${proxy}:`, err);
  }
}

/**
 * Cleanup function to close all active proxy browsers
 */
export async function closeAllProxyBrowsers(): Promise<void> {
  console.log('Closing all active proxy browsers...');

  const closePromises = Array.from(activeBrowsers.entries()).map(
    ([proxy, browser]) => closeProxyBrowser(browser, proxy),
  );

  await Promise.allSettled(closePromises);
  activeBrowsers.clear();
  console.log('✅ All proxy browsers closed');
}

export async function getRandomProxy(filePath: string): Promise<string> {
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.length);
        return data[randomIndex].proxyUrl;
      } else {
        console.error(`No proxies found in ${filePath}`);
        return '';
      }
    }
    console.error(`Proxy file not found: ${filePath}`);
    return '';
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return '';
  }
}

/**
 * Get available proxy count
 */
export async function getProxyCount(): Promise<number> {
  try {
    if (fs.existsSync(config.proxyList)) {
      const data = JSON.parse(fs.readFileSync(config.proxyList, 'utf-8'));
      return Array.isArray(data) ? data.length : 0;
    }
    return 0;
  } catch (error) {
    console.error('Failed to get proxy count:', error);
    return 0;
  }
}

/**
 * Test all proxies and return working ones
 */
export async function testAllProxies(): Promise<string[]> {
  const workingProxies: string[] = [];

  try {
    if (fs.existsSync(config.proxyList)) {
      const data = JSON.parse(fs.readFileSync(config.proxyList, 'utf-8'));

      console.log(`Testing ${data.length} proxies...`);

      for (const proxyData of data) {
        try {
          const {browser, proxy} = await createProxyBrowser();
          const page = await browser.newPage();

          await page.goto('https://www.google.com', {
            waitUntil: 'networkidle2',
            timeout: 15000,
          });

          workingProxies.push(proxy);
          console.log(`✅ Proxy working: ${proxy}`);

          await browser.close();
          activeBrowsers.delete(proxy);
        } catch (error) {
          console.log(`❌ Proxy failed: ${proxyData.proxyUrl}`);
        }

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error('Error testing proxies:', error);
  }

  console.log(`✅ Found ${workingProxies.length} working proxies`);
  return workingProxies;
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Cleaning up...');
  await closeAllProxyBrowsers();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Cleaning up...');
  await closeAllProxyBrowsers();
  process.exit(0);
});
