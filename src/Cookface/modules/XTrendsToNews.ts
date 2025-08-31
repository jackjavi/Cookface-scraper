import sleep from '../utils/sleep';
import fetchTweetTrends from '../services/fetchTweetTrends';
import scrapeTrends24 from '../services/scrapeTrends24';
import GenerativeAIService from '../services/generativeAI';
import {postTrendNewsOnX} from '../services/postTrendNewsOnX';
import {postTrendNewsOnFB} from '../services/postTrendNewsOnFB';
import {sendArticleToTelegram} from '../services/postTrendNewsOnTelegram';
import {cleanupImage} from '../utils/imageUtils';
import config from '../config/index.js';
import {Page} from 'puppeteer';

interface TweetImage {
  src: string;
  alt: string | null;
  articleIndex: number;
}

/**
 * Processes X trends and posts news to X, Facebook, and Telegram
 * @param xPage Puppeteer page for X.com
 * @param fbPage Puppeteer page for Facebook
 */
export const XTrendsToNews = async (
  xPage: Page,
  fbPage: Page,
): Promise<void> => {
  let sharedImagePath: string | null = null;

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
    let selectedImage: TweetImage | null = null;
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
        selectedImage = {
          src: config.tnkDefaultIMG,
          alt: 'Default Image',
          articleIndex: -1,
        };
      }
    }

    await sleep(2000);

    // Post to X
    console.log('Posting to X...');
    sharedImagePath = await postTrendNewsOnX(
      'Home',
      xPage,
      newsBite,
      selectedImage?.src || '',
    );
    console.log('Successfully posted to X');

    await fbPage.bringToFront();
    await sleep(3000);

    // Post to Facebook
    console.log('Posting to Facebook...');
    await postTrendNewsOnFB(
      fbPage,
      newsBite,
      selectedImage?.src || '',
      sharedImagePath,
    );
    console.log('Successfully posted to Facebook');

    await sleep(3000);

    // Post to Telegram using the shared image path
    console.log('Posting to Telegram...');
    await sendArticleToTelegram(
      newsBite,
      selectedImage?.src || '',
      sharedImagePath,
    );
    console.log('Successfully posted to Telegram');

    console.log('All platforms posted successfully!');
  } catch (error) {
    console.error('XTrendsToNews error:', error);
  } finally {
    if (sharedImagePath) {
      console.log('Cleaning up shared image...');
      await cleanupImage(sharedImagePath);
    }
  }
};
