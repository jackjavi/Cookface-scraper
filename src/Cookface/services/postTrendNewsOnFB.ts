import sleep from '../utils/sleep';
import getRandomWaitTime from '../utils/randomWaitTime';
import GenerativeAIService from './generativeAI';
import {getFacebookPage} from '../utils/browserManager';
import {Page} from 'puppeteer';

const postTrendNewsOnFB = async (newsBite: string) => {
  const generativeAI = new GenerativeAIService();
  const navSelector = 'nav[aria-label="Primary"] a';
  const placeholderSelector = '.public-DraftEditorPlaceholder-inner';
  const postButtonSelector = 'div[dir="ltr"] span.css-1jxf684 > span';

  try {
    // Step 1: Get the Facebook page instance
    const page: Page = await getFacebookPage();
    if (!page) {
      throw new Error('Failed to get Facebook page instance.');
    }

    // Wait for the target span element to appear (up to 15 seconds)
    await page.waitForSelector('span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6', {
      timeout: 15000,
      visible: true,
    });

    // Scroll until the span with exact inner text is visible and clickable
    const clicked = await page.evaluate(() => {
      const spans = Array.from(
        document.querySelectorAll('span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6'),
      );

      const target = spans.find(span =>
        span.textContent?.includes("What's on your mind,"),
      );

      if (target) {
        target.scrollIntoView({behavior: 'smooth', block: 'center'});
        (target as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('Clicked on "What’s on your mind?" span successfully.');
    } else {
      console.warn('Target span not found.');
    }

    await sleep(3000);

    // Type the post
    await page.keyboard.type(newsBite, {delay: 200});
    console.log('Typed the message into the editor successfully.');

    await sleep(getRandomWaitTime(2000, 3000));
    // Wait for the "Post" span to appear
    await page.waitForFunction(
      () => {
        const spans = Array.from(document.querySelectorAll('span'));
        return spans.some(span => span.textContent?.trim() === 'Post');
      },
      {timeout: 10000},
    );

    const postClicked = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const postBtn = spans.find(span => span.textContent?.trim() === 'Post');

      if (postBtn) {
        postBtn.scrollIntoView({behavior: 'smooth', block: 'center'});
        (postBtn as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (postClicked) {
      console.log('Clicked on "Post" button successfully.');
    } else {
      console.warn('"Post" button not found.');
    }
  } catch (err: any) {
    console.error(`Error in post function: ${err.message}`);
  }
};

export {postTrendNewsOnFB};
