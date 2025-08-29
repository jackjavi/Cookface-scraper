import sleep from '../utils/sleep';
import fetchTweetTrends from '../services/fetchTweetTrends';
import scrapeTrends24 from '../services/scrapeTrends24';
import GenerativeAIService from '../services/generativeAI';
import {postTrendNewsOnX} from '../services/postTrendNewsOnX';
import {postTrendNewsOnFB} from '../services/postTrendNewsOnFB';
import {sendArticleToTelegram} from '../services/postTrendNewsOnTelegram';
import {Page} from 'puppeteer';

// Interface for TweetImage (should match the one in fetchTweetTrends)
interface TweetImage {
  src: string;
  alt: string | null;
  articleIndex: number;
}

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

    const {randomPhrase, comments, images} = await fetchTweetTrends(
      'Search and explore',
      trends,
      xPage,
    );

    console.log(`Collected ${images.length} images from trending posts`);

    await sleep(2000);

    const newsBite = await genAIService.generateNewsBiteFromTrends(
      randomPhrase,
      comments,
    );

    console.log(`Generated News Bite: ${newsBite}`);

    // Analyze and select the most relevant image
    /** let selectedImage: TweetImage | null = null;
    if (images && images.length > 0) {
      console.log('Analyzing images for relevance to news bite...');
      selectedImage = await genAIService.selectMostRelevantImage(
        newsBite,
        comments,
        images,
      );

      if (selectedImage) {
        console.log(`Selected most relevant image: ${selectedImage.src}`);
      } else {
        console.log('No relevant image selected');
      }
    } */

    await sleep(2000);

    // Post to X
    await postTrendNewsOnX('Home', xPage, newsBite);

    fbPage.bringToFront();
    await sleep(100000);

    // Post to Facebook
    // await postTrendNewsOnFB(fbPage, newsBite, selectedImage?.src!);
    await postTrendNewsOnFB(fbPage, newsBite);

    await sleep(100000);
    // Post to Telegram
    // await sendArticleToTelegram(newsBite, selectedImage?.src!);
  } catch (error) {
    console.error('XTrendsToNews error:', error);
  }
};
