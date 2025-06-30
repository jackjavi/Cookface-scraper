import {Page} from 'puppeteer';
import sleep from '../utils/sleep';
import getRandomWaitTime from '../utils/randomWaitTime';

/**
 * Likes up to 10 Facebook posts that are not already liked.
 * @param page Puppeteer page instance
 */
const fbLike = async (page: Page): Promise<void> => {
  try {
    let likedCount = 0;
    let previousHeight = 0;

    while (likedCount < 10) {
      // Evaluate all target <i> elements within unliked spans
      const likedThisRound = await page.evaluate(() => {
        const targetLikes = Array.from(
          document.querySelectorAll(
            'span.x3nfvp2:not(.xcena0t) i.x1b0d499.x1d69dk1',
          ),
        );

        let clicks = 0;

        for (const icon of targetLikes) {
          if (clicks >= 10) break;
          (icon as HTMLElement).click();
          clicks++;
        }

        return clicks;
      });

      likedCount += likedThisRound;
      console.log(`Liked ${likedCount} post(s) so far.`);

      if (likedCount >= 10) break;

      previousHeight = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() =>
        window.scrollBy({top: 800, behavior: 'smooth'}),
      );

      const randomPause = await getRandomWaitTime(2000, 5000);
      await sleep(randomPause);

      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === previousHeight) {
        console.log('No more posts to scroll. Stopping.');
        break;
      }
    }

    console.log(`Finished liking ${likedCount} post(s).`);
  } catch (error: any) {
    console.error('Error in fbLike:', error.message);
  }
};

export default fbLike;
