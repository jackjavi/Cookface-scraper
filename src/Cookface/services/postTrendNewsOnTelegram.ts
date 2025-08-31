import fsPromises from 'fs/promises';
import config from '../config/index.js';
import sleep from '../utils/sleep.js';
import getRandomWaitTime from '../utils/randomWaitTime.js';
import TelegramService from './telegram/telegramService.js';
import {
  downloadImage,
  cleanupImage,
  generateMultiPlatformImageFilename,
} from '../utils/imageUtils.js';

const telegramService = new TelegramService();

// Send single article to Telegram
const sendArticleToTelegram = async (
  newsBite: string,
  imgUrl: string,
  sharedImagePath: string,
) => {
  let imagePath = sharedImagePath;

  try {
    // Download image if not already provided
    if (!imagePath && imgUrl) {
      console.log(`Downloading image from: ${imgUrl}`);
      const imageFilename = generateMultiPlatformImageFilename(
        newsBite,
        'telegram',
      );
      imagePath = `${config.imagesStore}${imageFilename}`;

      await downloadImage(imgUrl, imagePath);
      console.log(`Image downloaded to: ${imagePath}`);
    } else if (sharedImagePath) {
      console.log(`Using shared image: ${sharedImagePath}`);
      imagePath = sharedImagePath;
    }

    // Send to Telegram
    const response = await telegramService.sendPhotoWithCaption(
      imagePath,
      newsBite,
    );

    if (response.ok) {
      console.log(`Successfully sent to Telegram.`);

      return {success: true, article: newsBite};
    } else {
      console.error(`Failed to send to Telegram:`, response);

      return {success: false, article: newsBite, error: response};
    }
  } catch (error: any) {
    console.error(`Error processing article.`, error);
    return {success: false, article: newsBite, error: error.message};
  }
};

export {sendArticleToTelegram};
