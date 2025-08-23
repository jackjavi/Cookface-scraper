import sleep from '../utils/sleep';
import {
  fetchSkySportsArticles,
  fetchSkySportsFullArticles,
} from '../controllers/scrapeData/scrapedDataController.js';
import {generateTelegramContent} from '../controllers/generativeAI/generativeAIController.js';
import {sendTelegramContent} from '../controllers/telegram/telegramController.js';

export const TelegramNews = async () => {
  try {
    await fetchSkySportsArticles();
    await sleep(10000);
    await fetchSkySportsFullArticles();
    await sleep(10000);
    await generateTelegramContent();
    await sleep(10000);
    await sendTelegramContent();
    await sleep(5000);
  } catch (error) {
    console.error('TelegramNews error:', error);
  }
};
