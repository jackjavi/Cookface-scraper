import sleep from '../utils/sleep';
import fetchTweetTrends from '../services/fetchTweetTrends';
import scrapeTrends24 from '../services/scrapeTrends24';
import GenerativeAIService from '../services/generativeAI';
import GenerativeAIAudioService from '../services/GenAI/genAIAudioService';
import GenerativeAIVideoService from '../services/GenAI/genAIVideoService';
import {postTrendNewsOnX} from '../services/postTrendNewsOnX';
import {postTrendNewsOnFB} from '../services/postTrendNewsOnFB';
import {sendArticleToTelegram} from '../services/postTrendNewsOnTelegram';
import {
  downloadImage,
  cleanupImage,
  generateMultiPlatformImageFilename,
} from '../utils/imageUtils';
import {cleanupVideo} from '../utils/videoUtils';
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
  let videoFilePath: string | null = null;

  try {
    console.log('Starting XTrendsToNews processing...');
    await xPage.bringToFront();

    // Initialize services
    const genAIService = new GenerativeAIService();
    const genAIAudioService = new GenerativeAIAudioService();
    const genAIVideoService = new GenerativeAIVideoService();

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
        console.log('No relevant image selected, using default');
        selectedImage = {
          src: config.tnkDefaultIMG,
          alt: 'Default Image',
          articleIndex: -1,
        };
      }
    } else {
      console.log('No images available, using default');
      selectedImage = {
        src: config.tnkDefaultIMG,
        alt: 'Default Image',
        articleIndex: -1,
      };
    }

    // Download image centrally for multi-platform use
    console.log('Downloading image for multi-platform use...');
    try {
      const imageFilename = generateMultiPlatformImageFilename(
        newsBite,
        'multiplatform',
      );
      sharedImagePath = `${config.imagesStore}${imageFilename}`;

      await downloadImage(selectedImage.src, sharedImagePath);
      console.log(`Image downloaded successfully: ${sharedImagePath}`);
    } catch (imageError) {
      console.error('Failed to download image:', imageError);
      // Continue without image if download fails
      sharedImagePath = null;
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

    // Generate video from image and audio
    console.log('Generating video from image and audio...');
    try {
      if (audioFilePath && sharedImagePath) {
        videoFilePath = await genAIVideoService.generateVideoFromImageAndAudio(
          sharedImagePath,
          audioFilePath,
          newsBite, // Pass newsBite for future use (subtitles, metadata, etc.)
        );
        console.log(`Generated video file: ${videoFilePath}`);

        // Clean up audio file since it's now embedded in video
        await genAIAudioService.cleanupAudio(audioFilePath);
        audioFilePath = null; // Mark as cleaned up
      } else {
        console.log('Skipping video generation - missing audio or image');
      }
    } catch (videoError) {
      console.error(
        'Video generation failed, continuing without video:',
        videoError,
      );
      // Continue with the process even if video generation fails
    }

    await sleep(2000);

    // Post to X
    console.log('Posting to X...');
    await postTrendNewsOnX(
      'Home',
      xPage,
      newsBite,
      selectedImage.src,
      sharedImagePath!, // Pass the shared image path as the last parameter
    );
    console.log('Successfully posted to X');

    await fbPage.bringToFront();
    await sleep(3000);

    // Post to Facebook
    console.log('Posting to Facebook...');
    await postTrendNewsOnFB(
      fbPage,
      newsBite,
      selectedImage.src,
      sharedImagePath!,
    );
    console.log('Successfully posted to Facebook');

    await sleep(3000);

    // Post to Telegram using the shared image path
    console.log('Posting to Telegram...');
    await sendArticleToTelegram(newsBite, selectedImage.src, sharedImagePath!);
    console.log('Successfully posted to Telegram');

    console.log('All platforms posted successfully!');

    // Log available media files for future use
    if (videoFilePath) {
      console.log('Video file available for future use:', videoFilePath);
      const videoService = new GenerativeAIVideoService();
      const duration = await videoService.getVideoDuration(videoFilePath);
      const fileSize = await videoService.getFormattedFileSize(videoFilePath);
      console.log(
        `Video stats: Duration: ${duration.toFixed(1)}s, Size: ${fileSize}`,
      );
      // TODO: Implement video sharing to platforms in future updates
      // Example: await sendVideoToTelegram(videoFilePath);
    } else if (audioFilePath) {
      console.log('Audio file available for future use:', audioFilePath);
      // TODO: Implement audio sharing to platforms in future updates
    }
  } catch (error) {
    console.error('XTrendsToNews error:', error);
  } finally {
    // Cleanup temporary files/Resources
    console.log('Starting cleanup process...');

    if (sharedImagePath) {
      console.log('Cleaning up shared image...');
      await cleanupImage(sharedImagePath);
    }

    /** if (audioFilePath) {
      console.log('Cleaning up audio file...');
      const genAIAudioService = new GenerativeAIAudioService();
      await genAIAudioService.cleanupAudio(audioFilePath);
    }

    if (videoFilePath) {
      console.log('Cleaning up video file...');
      await cleanupVideo(videoFilePath);
    } */

    console.log('Cleanup process completed');
  }
};
