import fsPromises from 'fs/promises';
import config from '../../config/index.js';
import sleep from '../../utils/sleep.js';
import {TelegramArticle} from '../../types/Article.js';
import TelegramService from '../../services/telegram/telegramService.js';
import {
  downloadImage,
  generateImageFilename,
  cleanupImage,
} from '../../utils/telegram/imageUtils.js';

const telegramService = new TelegramService();

// Send single article to Telegram
const sendArticleToTelegram = async (article: TelegramArticle) => {
  try {
    console.log(`Processing article: ${article.telegramTitle}`);

    // Generate image filename and download path
    const imageFilename = generateImageFilename(article.telegramTitle);
    const imagePath = `${config.telegramPhotosStore}${imageFilename}`;

    // Download image
    console.log(`Downloading image from: ${article.imageUrl}`);
    await downloadImage(article.imageUrl, imagePath);

    // Prepare caption (URL encoded)
    const caption = `${article.telegramTitle}\n\n${article.telegramContent}`;
    // Send to Telegram
    const response = await telegramService.sendPhotoWithCaption(
      imagePath,
      caption,
    );

    if (response.ok) {
      console.log(`Successfully sent to Telegram: ${article.telegramTitle}`);

      // Cleanup downloaded image
      await cleanupImage(imagePath);

      return {success: true, article: article};
    } else {
      console.error(`Failed to send to Telegram:`, response);

      // Cleanup image even on failure
      await cleanupImage(imagePath);

      return {success: false, article: article, error: response};
    }
  } catch (error: any) {
    console.error(`Error processing article ${article.telegramTitle}:`, error);
    return {success: false, article: article, error: error.message};
  }
};

// Main function to process and send all articles
const sendTelegramContent = async () => {
  try {
    // Read paraphrased articles
    const rawData = await fsPromises.readFile(
      config.paraphrasedForTelegramStore,
      'utf8',
    );
    const telegramData = JSON.parse(rawData);

    if (!telegramData.articles || telegramData.articles.length === 0) {
      return {success: false, article: [], error: 'No articles to send'};
    }

    const results = [];
    const successfulArticles = [];
    const failedArticles = [];

    // Process each article
    for (const article of telegramData.articles) {
      const result = await sendArticleToTelegram(article);
      results.push(result);

      if (result.success) {
        successfulArticles.push(result.article);
      } else {
        failedArticles.push(result.article);
      }

      // Wait between sends to avoid rate limiting
      await sleep(3000);
    }

    // Update JSON file - remove successfully sent articles
    if (successfulArticles.length > 0) {
      const updatedData = {
        ...telegramData,
        articles: failedArticles, // Keep only failed articles for retry
        lastUpdated: new Date().toISOString(),
        totalSent: successfulArticles.length,
        totalFailed: failedArticles.length,
      };

      await fsPromises.writeFile(
        config.paraphrasedForTelegramStore,
        JSON.stringify(updatedData, null, 2),
      );
    }

    console.log(
      `Telegram sending complete. Sent: ${successfulArticles.length}, Failed: ${failedArticles.length}`,
    );

    return {success: true, successfulArticles: successfulArticles.length};
  } catch (error: any) {
    console.error('Error sending telegram content:', error);
    return {success: false, error: error.message};
  }
};

export {sendArticleToTelegram, sendTelegramContent};
