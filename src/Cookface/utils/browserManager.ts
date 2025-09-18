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

// Interface for proxy data
interface ProxyData {
  proxyUrl: string;
  lastTested?: string;
  isWorking?: boolean;
  responseTime?: number;
  protocol?: string;
  anonymity?: string;
  country?: string;
  score?: number;
  source?: string;
  successDetails?: {
    canLoadGoogle?: boolean;
    canLoadHttps?: boolean;
    realIP?: string;
    captchaDetected?: boolean;
    htmlSnippet?: string;
  };
}

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
 * Get a random working proxy from the success file
 */
export async function getRandomWorkingProxy(): Promise<string> {
  try {
    if (fs.existsSync(config.proxyListSuccess)) {
      const data = JSON.parse(
        fs.readFileSync(config.proxyListSuccess, 'utf-8'),
      );
      if (Array.isArray(data) && data.length > 0) {
        const workingProxies = data.filter(
          (proxy: ProxyData) => proxy.isWorking === true,
        );

        if (workingProxies.length === 0) {
          console.warn('No working proxies found in success file');
          return await getRandomProxy(config.proxyList); // Fallback to main list
        }

        // Sort by response time (fastest first) and pick from top performers
        const sortedProxies = workingProxies.sort(
          (a, b) => (a.responseTime || 9999) - (b.responseTime || 9999),
        );

        // Pick from top 30% for better performance
        const topProxies = sortedProxies.slice(
          0,
          Math.max(1, Math.floor(workingProxies.length * 0.3)),
        );
        const randomIndex = Math.floor(Math.random() * topProxies.length);

        console.log(
          `Selected working proxy: ${topProxies[randomIndex].proxyUrl} (${topProxies[randomIndex].responseTime}ms)`,
        );
        return topProxies[randomIndex].proxyUrl;
      }
    }

    console.warn(
      'Success proxy file not found or empty, using main proxy list',
    );
    return await getRandomProxy(config.proxyList);
  } catch (error) {
    console.error(`Failed to read success proxy file:`, error);
    return await getRandomProxy(config.proxyList);
  }
}

/**
 * Get fastest working proxy from success file
 */
export async function getFastestWorkingProxy(): Promise<string> {
  try {
    if (fs.existsSync(config.proxyListSuccess)) {
      const data = JSON.parse(
        fs.readFileSync(config.proxyListSuccess, 'utf-8'),
      );
      if (Array.isArray(data) && data.length > 0) {
        const workingProxies = data.filter(
          (proxy: ProxyData) => proxy.isWorking === true,
        );

        if (workingProxies.length === 0) {
          throw new Error('No working proxies found in success file');
        }

        // Sort by response time and get the fastest
        const sortedProxies = workingProxies.sort(
          (a, b) => (a.responseTime || 9999) - (b.responseTime || 9999),
        );

        console.log(
          `Selected fastest proxy: ${sortedProxies[0].proxyUrl} (${sortedProxies[0].responseTime}ms)`,
        );
        return sortedProxies[0].proxyUrl;
      }
    }

    throw new Error('No working proxies available');
  } catch (error) {
    console.error(`Failed to get fastest proxy:`, error);
    throw error;
  }
}

/**
 * Creates a new browser instance with a working proxy from success file
 */
export async function createWorkingProxyBrowser(): Promise<{
  browser: Browser;
  proxy: string;
}> {
  const workingProxy = await getRandomWorkingProxy();

  if (!workingProxy) {
    throw new Error('No working proxy available');
  }

  console.log('Creating browser with working proxy:', workingProxy);

  const browserArgs = [
    `--proxy-server=${workingProxy}`,
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
    '--disable-features=VizDisplayCompositor',
    '--ignore-certificate-errors-spki-list',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--disable-web-security',
    '--allow-running-insecure-content',
  ];

  try {
    const proxyBrowser = await puppeteer.launch({
      headless: false,
      args: browserArgs,
      timeout: 30000,
    });

    activeBrowsers.set(workingProxy, proxyBrowser);
    console.log(
      `✅ Working proxy browser created successfully: ${workingProxy}`,
    );
    return {browser: proxyBrowser, proxy: workingProxy};
  } catch (error: any) {
    console.error(
      `❌ Failed to create browser with working proxy ${workingProxy}:`,
      error.message,
    );
    throw error;
  }
}

/**
 * Creates a browser with the fastest working proxy
 */
export async function createFastestProxyBrowser(): Promise<{
  browser: Browser;
  proxy: string;
}> {
  const fastestProxy = await getFastestWorkingProxy();

  console.log('Creating browser with fastest proxy:', fastestProxy);

  const browserArgs = [
    `--proxy-server=${fastestProxy}`,
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
    '--disable-features=VizDisplayCompositor',
    '--ignore-certificate-errors-spki-list',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--disable-web-security',
    '--allow-running-insecure-content',
  ];

  try {
    const proxyBrowser = await puppeteer.launch({
      headless: false,
      args: browserArgs,
      timeout: 30000,
    });

    activeBrowsers.set(fastestProxy, proxyBrowser);
    console.log(
      `✅ Fastest proxy browser created successfully: ${fastestProxy}`,
    );
    return {browser: proxyBrowser, proxy: fastestProxy};
  } catch (error: any) {
    console.error(
      `❌ Failed to create browser with fastest proxy ${fastestProxy}:`,
      error.message,
    );
    throw error;
  }
}

/**
 * Original method - now uses random working proxy by default
 */
export async function createProxyBrowser(): Promise<{
  browser: Browser;
  proxy: string;
}> {
  // Try working proxy first, fallback to original method
  try {
    return await createWorkingProxyBrowser();
  } catch (error) {
    console.warn(
      'Failed to create working proxy browser, falling back to original method',
    );
    return await createOriginalProxyBrowser();
  }
}

/**
 * Original proxy browser creation method (fallback)
 */
export async function createOriginalProxyBrowser(): Promise<{
  browser: Browser;
  proxy: string;
}> {
  const randomProxy = await getRandomProxy(config.proxyList);

  if (!randomProxy) {
    throw new Error('No proxy available from proxy list');
  }

  console.log('Creating browser with random proxy (fallback):', randomProxy);

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
    '--disable-features=VizDisplayCompositor',
    '--ignore-certificate-errors-spki-list',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--disable-web-security',
    '--allow-running-insecure-content',
  ];

  try {
    const proxyBrowser = await puppeteer.launch({
      headless: false,
      args: browserArgs,
      timeout: 30000,
    });

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
 * Creates a new YTS page with a working proxy
 */
export async function getNewWorkingYTSPage(): Promise<{
  page: Page;
  browser: Browser;
  proxy: string;
}> {
  const {browser: ytsBrowser, proxy} = await createWorkingProxyBrowser();
  const ytsPage = await ytsBrowser.newPage();

  console.log('New working proxy page opened:', proxy);
  return {page: ytsPage, browser: ytsBrowser, proxy};
}

/**
 * Creates a new YTS page with the fastest working proxy
 */
export async function getFastestYTSPage(): Promise<{
  page: Page;
  browser: Browser;
  proxy: string;
}> {
  const {browser: ytsBrowser, proxy} = await createFastestProxyBrowser();
  const ytsPage = await ytsBrowser.newPage();

  console.log('New fastest proxy page opened:', proxy);
  return {page: ytsPage, browser: ytsBrowser, proxy};
}

/**
 * Creates multiple YTS pages with working proxies
 */
export async function getMultipleWorkingYTSPages(count: number): Promise<
  Array<{
    page: Page;
    browser: Browser;
    proxy: string;
  }>
> {
  const pages: Array<{page: Page; browser: Browser; proxy: string}> = [];

  console.log(`Creating ${count} YTS pages with working proxies...`);

  for (let i = 0; i < count; i++) {
    try {
      const pageData = await getNewWorkingYTSPage();
      pages.push(pageData);
      console.log(
        `✅ Working page ${i + 1}/${count} created with proxy: ${pageData.proxy}`,
      );

      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Failed to create working page ${i + 1}:`, error);
      // Try fallback
      try {
        const fallbackData = await getNewYTSPage();
        pages.push(fallbackData);
        console.log(
          `✅ Fallback page ${i + 1}/${count} created with proxy: ${fallbackData.proxy}`,
        );
      } catch (fallbackError) {
        console.error(
          `❌ Fallback also failed for page ${i + 1}:`,
          fallbackError,
        );
      }
    }
  }

  console.log(`✅ Created ${pages.length}/${count} pages successfully`);
  return pages;
}

/**
 * Original getNewYTSPage method (now enhanced to try working proxies first)
 */
export async function getNewYTSPage(): Promise<{
  page: Page;
  browser: Browser;
  proxy: string;
}> {
  try {
    // Try working proxy first
    return await getNewWorkingYTSPage();
  } catch (error) {
    console.warn('Failed to create working proxy page, using original method');
    return await getOriginalYTSPage();
  }
}

/**
 * Original YTS page creation method (fallback)
 */
export async function getOriginalYTSPage(): Promise<{
  page: Page;
  browser: Browser;
  proxy: string;
}> {
  const {browser: ytsBrowser, proxy} = await createOriginalProxyBrowser();
  const ytsPage = await ytsBrowser.newPage();

  return {page: ytsPage, browser: ytsBrowser, proxy};
}

/**
 * Enhanced navigation with better error handling
 */
export async function navigateToYouTube(page: Page): Promise<void> {
  try {
    console.log('Navigating to YouTube...');
    await page.goto('https://www.facebook.com', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait for key elements to ensure page loaded properly
    // await page.waitForSelector('ytd-app', {timeout: 30000});
    console.log('✅ Successfully navigated to YouTube');
  } catch (error: any) {
    console.error('❌ Failed to navigate to YouTube:', error.message);
    throw error;
  }
}

/**
 * Navigate to specific YouTube URL with enhanced error handling
 */
export async function navigateToYouTubeURL(
  page: Page,
  url: string,
): Promise<void> {
  try {
    console.log(`Navigating to YouTube URL: ${url}`);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Wait for YouTube app to load
    await page.waitForSelector('ytd-app', {timeout: 30000});
    console.log(`✅ Successfully navigated to: ${url}`);
  } catch (error: any) {
    console.error(`❌ Failed to navigate to ${url}:`, error.message);
    throw error;
  }
}

/**
 * Get working proxy count from success file
 */
export async function getWorkingProxyCount(): Promise<number> {
  try {
    if (fs.existsSync(config.proxyListSuccess)) {
      const data = JSON.parse(
        fs.readFileSync(config.proxyListSuccess, 'utf-8'),
      );
      if (Array.isArray(data)) {
        const workingProxies = data.filter(
          (proxy: ProxyData) => proxy.isWorking === true,
        );
        return workingProxies.length;
      }
    }
    return 0;
  } catch (error) {
    console.error('Failed to get working proxy count:', error);
    return 0;
  }
}

/**
 * Get all working proxies with details
 */
export async function getWorkingProxies(): Promise<ProxyData[]> {
  try {
    if (fs.existsSync(config.proxyListSuccess)) {
      const data = JSON.parse(
        fs.readFileSync(config.proxyListSuccess, 'utf-8'),
      );
      if (Array.isArray(data)) {
        return data.filter((proxy: ProxyData) => proxy.isWorking === true);
      }
    }
    return [];
  } catch (error) {
    console.error('Failed to get working proxies:', error);
    return [];
  }
}

// Keep original methods for backwards compatibility
export async function getMultipleYTSPages(count: number): Promise<
  Array<{
    page: Page;
    browser: Browser;
    proxy: string;
  }>
> {
  // Enhanced to try working proxies first
  return await getMultipleWorkingYTSPages(count);
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
    await page.goto(link, {waitUntil: 'networkidle0'});

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
        const proxyItem = data[randomIndex];

        // Handle both old format (string) and new format (object)
        if (typeof proxyItem === 'string') {
          return proxyItem;
        } else if (proxyItem.proxyUrl) {
          return proxyItem.proxyUrl;
        }
      }
      console.error(`No valid proxies found in ${filePath}`);
      return '';
    }
    console.error(`Proxy file not found: ${filePath}`);
    return '';
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return '';
  }
}

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

export async function testAllProxies(): Promise<string[]> {
  const workingProxies: string[] = [];

  try {
    if (fs.existsSync(config.proxyList)) {
      const data = JSON.parse(fs.readFileSync(config.proxyList, 'utf-8'));
      console.log(`Testing ${data.length} proxies...`);

      for (const proxyData of data) {
        try {
          const {browser, proxy} = await createOriginalProxyBrowser();
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
          const proxyUrl =
            typeof proxyData === 'string' ? proxyData : proxyData.proxyUrl;
          console.log(`❌ Proxy failed: ${proxyUrl}`);
        }

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
