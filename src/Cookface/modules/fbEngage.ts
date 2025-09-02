import sleep from '../utils/sleep';
import fbLike from '../services/Facebook/fbLike';
import getRandomCount from '../utils/randomCount';
import {Page} from 'puppeteer';

/**
 * Engages with Facebook posts by liking eligible posts
 * @param fbPage Puppeteer page instance for Facebook
 */
export const fbEngage = async (fbPage: Page): Promise<void> => {
  try {
    console.log('Starting Facebook engagement processing...');
    await fbPage.bringToFront();

    // Generate random count for posts to like (1-7 posts)
    const randomCount = getRandomCount(1, 7);
    console.log(`Planning to like up to ${randomCount} eligible posts`);

    // Execute fbLike with the random count
    await fbLike(fbPage, randomCount);

    console.log('Facebook engagement completed successfully');
    await sleep(2000);
  } catch (error: any) {
    console.error('fbEngage error:', error.message);
    throw error;
  }
};
