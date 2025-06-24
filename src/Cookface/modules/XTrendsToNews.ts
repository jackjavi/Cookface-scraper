import {Page} from 'puppeteer';
import sleep from '../utils/sleep';

/**
 * Clicks on the Facebook "What's on your mind?" box to begin composing a post.
 * @param page Puppeteer page instance passed from index.ts
 */
export const XTrendsToNews = async (page: Page): Promise<void> => {
  try {
    console.log('Waiting for Facebook home to fully load...');

    await page.waitForSelector('span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6', {
      timeout: 15000,
      visible: true,
    });

    const clicked = await page.evaluate(() => {
      const spans = Array.from(
        document.querySelectorAll('span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6'),
      );
      const target = spans.find(
        span => span.textContent?.trim() === "What's on your mind, Jack?",
      );

      if (target) {
        target.scrollIntoView({behavior: 'smooth', block: 'center'});
        (target as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('Clicked on "What’s on your mind?" successfully.');
    } else {
      console.warn('Target span not found.');
    }

    await sleep(2000);
  } catch (error) {
    console.error('XTrendsToNews error:', error);
  }
};
