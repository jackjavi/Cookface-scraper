import sleep from '../utils/sleep';
import fetchTweetTrends from '../services/fetchTweetTrends';
import scrapeTrends24 from '../services/scrapeTrends24';
import GenerativeAIService from '../services/generativeAI';
import { postTrendNewsOnX } from '../services/postTrendNewsOnX';
import { postTrendNewsOnFB } from '../services/postTrendNewsOnFB';
import { Page } from 'puppeteer';

/**
 * Processes X trends and posts news to X and Facebook
 * @param xPage Puppeteer page for X.com
 * @param fbPage Puppeteer page for Facebook
 */
export const XTrendsToNews = async (
  xPage: Page,
  fbPage: Page,
): Promise<void> => {
  try {
    console.log('Starting XTrendsToNews processing...');
    await xPage.bringToFront();
    const genAIService = new GenerativeAIService();
    const trends = await scrapeTrends24();

    if (!trends || trends.length === 0) {
      console.warn('No trends returned from scrapeTrends24.');
      return;
    }

    const { randomPhrase, comments } = await fetchTweetTrends(
      'Search and explore',
      trends,
      xPage,
    );

    await sleep(2000);

    const newsBite = await genAIService.generateNewsBiteFromTrends(
      randomPhrase,
      comments,
    );

    console.log(`Generated News Bite: ${newsBite}`);
    await sleep(2000);

    await postTrendNewsOnX('Home', xPage, newsBite);

    fbPage.bringToFront();
    await sleep(225000);
    await postTrendNewsOnFB(fbPage, newsBite);

  } catch (error) {
    console.error('XTrendsToNews error:', error);
  }
};
