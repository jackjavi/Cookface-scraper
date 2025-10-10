import {Page, Browser} from 'puppeteer';
import sleep from './sleep';

// TikTok Page Management
export async function openTikTokPage(browser: Browser): Promise<Page> {
  const tiktokPage = await browser.newPage();
  await tiktokPage.setViewport({width: 1366, height: 768});
  await tiktokPage.goto('https://www.tiktok.com/', {
    waitUntil: 'networkidle2',
  });
  console.log('TikTok page initialized.');
  await sleep(1500);
  return tiktokPage;
}

export async function closeTikTokPage(page: Page): Promise<void> {
  if (page && !page.isClosed()) {
    await page.close();
    console.log('TikTok page closed.');
  }
}

// X (Twitter) Page Management
export async function openXPage(browser: Browser): Promise<Page> {
  const xPage = await browser.newPage();
  await xPage.setViewport({width: 1366, height: 768});
  await xPage.goto('https://x.com', {waitUntil: 'networkidle2'});
  console.log('X.com page initialized.');
  await sleep(1500);
  return xPage;
}

export async function closeXPage(page: Page): Promise<void> {
  if (page && !page.isClosed()) {
    await page.close();
    console.log('X.com page closed.');
  }
}

// Facebook Page Management
export async function openFbPage(browser: Browser): Promise<Page> {
  const fbPage = await browser.newPage();
  await fbPage.setViewport({width: 1366, height: 768});
  await fbPage.goto('https://www.facebook.com/', {waitUntil: 'networkidle2'});
  console.log('Facebook page initialized.');
  await sleep(1500);
  return fbPage;
}

export async function closeFbPage(page: Page): Promise<void> {
  if (page && !page.isClosed()) {
    await page.close();
    console.log('Facebook page closed.');
  }
}
