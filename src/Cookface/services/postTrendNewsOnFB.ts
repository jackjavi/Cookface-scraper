import sleep from '../utils/sleep';
import getRandomWaitTime from '../utils/randomWaitTime';
import {Page} from 'puppeteer';
import fbLike from './fbLike';
import GenerativeAIService from '../services/generativeAI';

const YOUTUBE_LINK = 'https://youtu.be/XbmB6vvCaOQ?si=DpYmCd67nrlG3gxI';

/**
 * Posts trend news, YouTube video link, or engagement content on Facebook
 * @param page Puppeteer page instance
 * @param newsBite The news bite to post if not posting the YouTube link or engagement post
 */
const postTrendNewsOnFB = async (
  page: Page,
  newsBite: string,
): Promise<void> => {
  const postButtonSelector = 'div[dir="ltr"] span.css-1jxf684 > span';
  const genAI = new GenerativeAIService();

  try {
    // Reload the page
    await page.reload({waitUntil: 'networkidle2'});
    console.log('Page reloaded successfully.');

    // Step 1: Wait for the "What's on your mind?" span to appear
    await page.waitForSelector('span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6', {
      timeout: 15000,
      visible: true,
    });

    // Step 2: Click the "What's on your mind?" span
    const clicked = await page.evaluate(() => {
      const spans = Array.from(
        document.querySelectorAll('span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6'),
      );
      const target = spans.find(span =>
        span.textContent?.includes("What's on your mind,"),
      );
      if (target) {
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

    // Step 3: Randomly decide what to post
    const rand = Math.random();
    let toPost: string;
    if (rand > 0.9) {
      toPost = YOUTUBE_LINK;
    } else if (rand > 0.7) {
      toPost = await genAI.generateEngagementPost();
    } else {
      toPost = newsBite;
    }
   /* if (rand > 0.8) {
    toPost = YOUTUBE_LINK;
    } else {
      toPost = await genAI.generateEngagementPost();
    } */

    console.log(`Typing content: ${toPost}`);
    await page.keyboard.type(toPost, {delay: 200});
    console.log('Typed the message into the editor successfully.');

    // Step 4: Wait briefly then click "Post" button
    await sleep(3000);

    const postClicked = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const postBtn = spans.find(span => span.textContent?.trim() === 'Post');
      if (postBtn) {
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

    await sleep(getRandomWaitTime(2000, 5000));
    console.log('Page reloaded after posting.');
    // await fbLike(page);
    await sleep(getRandomWaitTime(3000, 6000));
    await page.reload({waitUntil: 'networkidle2'});
  } catch (err: any) {
    console.error(`Error in postTrendNewsOnFB: ${err.message}`);
  }
};

export {postTrendNewsOnFB};
