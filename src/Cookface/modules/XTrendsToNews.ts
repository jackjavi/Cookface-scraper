import sleep from '../utils/sleep';
import fetchTweetTrends from '../services/fetchTweetTrends';
import scrapeTrends24 from '../services/scrapeTrends24';
import GenerativeAIService from '../services/generativeAI';
import {postTrendNewsOnX} from '../services/postTrendNewsOnX';
import {postTrendNewsOnFB} from '../services/postTrendNewsOnFB';

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
    await postTrendNewsOnFB(newsBite);

    await sleep(75000);
    await sleep(2000);
  } catch (error) {
    console.error('XTrendsToNews error:', error);
  }
};
