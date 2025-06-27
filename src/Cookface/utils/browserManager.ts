import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import config from '../config/index';

puppeteer.use(StealthPlugin());

let browser: Browser | null = null;
let fbPage: Page | null = null;
let xPage: Page | null = null;

const browserWSEndpoint = config.browserWSEndpointUrl;

export async function initializeBrowser() {
  if (!browser) {
    browser = await puppeteer.connect({ browserWSEndpoint });
  }
  return browser;
}

export async function getFacebookPage(): Promise<Page> {
  if (!fbPage) {
    const browser = await initializeBrowser();
    fbPage = await browser.newPage();
    await fbPage.goto('https://www.facebook.com/');
    console.log('Facebook page initialized.');
  }
  return fbPage;
}

export async function getNewXPage(): Promise<Page> {
  const browser = await initializeBrowser();
  const newPage = await browser.newPage();
  await newPage.goto('https://x.com');
  console.log('New X.com page opened.');
  return newPage;
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
