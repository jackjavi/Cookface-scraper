import sleep from '../utils/sleep';
import fetchTweetTrends from '../services/fetchTweetTrends';
import scrapeTrends24 from '../services/scrapeTrends24';
import GenerativeAIService from '../services/generativeAI';
import GenerativeAIAudioService from '../services/GenAI/genAIAudioService';
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
  let audioFilePath: string | null = null;

  try {
    console.log('Starting XTrendsToNews processing...');
    await xPage.bringToFront();
    const genAIService = new GenerativeAIService();
    const genAIAudioService = new GenerativeAIAudioService();
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

    // Generate audio for the news bite
    console.log('Generating audio for news bite...');
    try {
      audioFilePath = await genAIAudioService.generateNewsAudio(
        newsBite,
        comments,
      );
      console.log(`Generated audio file: ${audioFilePath}`);
    } catch (audioError) {
      console.error(
        'Audio generation failed, continuing without audio:',
        audioError,
      );
      // Continue with the process even if audio generation fails
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

    // Can also send the audio file to Telegram #Implement Later
    if (audioFilePath) {
      console.log('Audio file available for future use:', audioFilePath);
      // TODO: Implement audio sharing to platforms in future updates
    }
  } catch (error) {
    console.error('XTrendsToNews error:', error);
  } finally {
    // Cleanup temporary files/Resources
    if (sharedImagePath) {
      console.log('Cleaning up shared image...');
      await cleanupImage(sharedImagePath);
    }

    /** if (audioFilePath) {
      console.log('Cleaning up audio file...');
      const genAIAudioService = new GenerativeAIAudioService();
      await genAIAudioService.cleanupAudio(audioFilePath);
    } */
  }
};
