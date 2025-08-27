import fsPromises from 'fs/promises';
import config from '../config/index.js';
import sleep from '../utils/sleep.js';
import getRandomWaitTime from '../utils/randomWaitTime.js';
import TelegramService from './telegram/telegramService.js';
import {
  downloadImage,
  generateImageFilename,
  cleanupImage,
} from '../utils/telegram/imageUtils.js';

const telegramService = new TelegramService();

// Send single article to Telegram
const sendArticleToTelegram = async (newsBite: string, img: string) => {
  try {
    // Generate image filename and download path
    const imageFilename = generateImageFilename('TNK');
    const imagePath = `${config.telegramPhotosStore}${imageFilename}`;

    // Download image
    console.log(`Downloading image from: ${img}`);
    await downloadImage(img, imagePath);

    // Prepare caption (URL encoded)
    const caption = `${newsBite}`;
    // Send to Telegram
    const response = await telegramService.sendPhotoWithCaption(
      imagePath,
      caption,
    );

    if (response.ok) {
      console.log(`Successfully sent to Telegram.`);

      // Cleanup downloaded image
      await cleanupImage(imagePath);

      return {success: true, article: newsBite};
    } else {
      console.error(`Failed to send to Telegram:`, response);

      // Cleanup image even on failure
      await cleanupImage(imagePath);

      return {success: false, article: newsBite, error: response};
    }
  } catch (error: any) {
    console.error(`Error processing article.`, error);
    return {success: false, article: newsBite, error: error.message};
  }
};

export {sendArticleToTelegram};
