import sleep from '../utils/sleep';
import getRandomWaitTime from '../utils/randomWaitTime';
import fbLike from '../services/Facebook/fbLike';
import fbComment from '../services/Facebook/fbComment';
import getRandomCount from '../utils/randomCount';
import {Page} from 'puppeteer';
import {SwitchToProfile} from '../utils/facebook/switchToProfile';
import {SwitchToPage} from '../utils/facebook/switchToPage';
/**
 * Engages with Facebook posts by liking eligible posts
 * @param fbPage Puppeteer page instance for Facebook
 */
export const fbEngage = async (fbPage: Page): Promise<void> => {
  try {
    console.log('Starting Facebook engagement processing...');
    await fbPage.bringToFront();
    // Randomly switch to profile or page with 40/60 chance
    if (Math.random() < 0.4) {
      console.log('Switching to Facebook Profile...');
      await SwitchToProfile(fbPage);
    } else {
      console.log('Switching to Facebook Page...');
      await SwitchToPage(fbPage);
    }
    // await SwitchToPage(fbPage);
    // await SwitchToProfile(fbPage);
    await sleep(getRandomWaitTime(1500, 2500));

    // Comment on Facebook posts
    console.log(
      '🔍 Extracting post text from Facebook posts and generating comment to post...',
    );
    await fbComment(fbPage);
    console.log('✅ Comment posted successfully');

    // Generate random count for posts to like (1-7 posts)
    /** const randomCount = getRandomCount(1, 5);
    console.log(`Planning to like up to ${randomCount} eligible posts`);

    // Execute fbLike with the random count
    await fbLike(fbPage, randomCount); */

    console.log('Facebook engagement completed successfully');
    await sleep(2000);
  } catch (error: any) {
    console.error('fbEngage error:', error.message);
    throw error;
  }
};
