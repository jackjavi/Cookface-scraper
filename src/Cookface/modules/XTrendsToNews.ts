import {Page} from 'puppeteer';
import sleep from '../utils/sleep';
import fetchTweetTrends from '../services/fetchTweetTrends';
import scrapeTrends24 from '../services/scrapeTrends24';
import GenerativeAIService from '../services/generativeAI';
import {Comment} from '../types/Comment';
import { postTrendNewsOnX } from '../services/postTrendNewsOnX';

/**
 * Clicks on the Facebook "What's on your mind?" box to begin composing a post.
 * @param page Puppeteer page instance passed from index.ts
 */
export const XTrendsToNews = async (): Promise<void> => {
  try {
    console.log('Starting XTrendsToNews processing...');
    const genAIService = new GenerativeAIService();
    const trends = await scrapeTrends24();

    if (!trends || trends.length === 0) {
      console.warn('No trends returned from scrapeTrends24.');
      return;
    }

    const {randomPhrase, comments, page} = await fetchTweetTrends(
      'Search and explore',
      trends,
    );

    await sleep(2000);
    const newsBite = await genAIService.generateNewsBiteFromTrends(
      randomPhrase,
      comments,
    );
    console.log(`Generated News Bite: ${newsBite}`);
    await sleep(2000);
    await postTrendNewsOnX('Home', page, newsBite);

    await sleep(2000);
    console.log('Waiting for Facebook home to fully load...');

     /* await page.waitForSelector('span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6', {
      timeout: 15000,
      visible: true,
    });

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
    } */

    await sleep(2000);
  } catch (error) {
    console.error('XTrendsToNews error:', error);
  }
};
