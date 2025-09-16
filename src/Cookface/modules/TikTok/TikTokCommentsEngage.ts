import sleep from '../../utils/sleep';
import getRandomWaitTime from '../../utils/randomWaitTime';
import {CommentArticle} from '../../services/TikTok/commentArticle';
import {navigateToNextArticle} from '../../services/TikTok/navigationControls';
import {selectActiveArticle} from '../../utils/TikTok/selectActiveArticle';
import {
  navigateToTikTokPage,
  TIKTOK_ROUTES,
  navigateToPreviousPage,
} from '../../utils/TikTok/Navigation';
import {Page} from 'puppeteer';
import config from '../../config/index';

const CONFIG = {
  TikTokUsername: config.TikTokUsername,
};

function getWeightedChoice(weights: number[]): number {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  const rand = Math.random() * sum;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (rand < cumulative) return i;
  }
  return weights.length - 1; // Fallback to last index
}

export const TikTokCommentsEngage = async (tiktokPage: Page): Promise<void> => {
  try {
    console.log('Starting TikTokCommentsEngage processing...');
    await tiktokPage.bringToFront();

    // Weights: [openSingleComments, openMultipleComments, justNavigate]
    // openSingle: 60%, openMultiple: 25%, justNavigate: 15%
    // const weights = [60, 25, 15];
    const weights = [100];
    const choice = getWeightedChoice(weights);

    switch (choice) {
      case 0:
        console.log('Executing openSingleComments (60% probability)');
        await executeSingleArticleComment(tiktokPage);
        break;
      default:
        console.log('Fallback: Executing openSingleComments');
        await executeSingleArticleComment(tiktokPage);
        break;
    }

    await sleep(2000);
  } catch (error: any) {
    console.error('TikTokCommentsEngage error:', error.message);
  }
};

/**
 * Execute single comment section opening with random settings
 */
async function executeSingleArticleComment(page: Page): Promise<void> {
  try {
    // Randomly choose a page to navigate to for variety
    /** const pages = [TIKTOK_ROUTES.HOME];
    const randomPage = pages[Math.floor(Math.random() * pages.length)];
    
    const navSuccess = await navigateToTikTokPage(page, randomPage, CONFIG);
    if (!navSuccess) {
      console.log('Failed to navigate to random page, using Home...');
      await navigateToTikTokPage(page, TIKTOK_ROUTES.HOME, CONFIG);
    } */

    await sleep(getRandomWaitTime(2000, 4000));

    // Random minimum comment count between 3 - 6
    const minCommentCount = Math.floor(Math.random() * 3) + 3;

    const result = await CommentArticle(page, {
      minCommentCount,
    });

    console.log(
      `Single comment result for article ${result.articleIndex}: ${result.action}`,
    );

    // 30% chance to navigate to next article after opening comments
    if (Math.random() < 0.3) {
      console.log('Navigating to next article after opening comments...');
      await navigateToNextArticle(page, getRandomWaitTime(1500, 3000));
    }

    await sleep(getRandomWaitTime(3000, 7000));

    // Navigate back to Home after operation
    await navigateToPreviousPage(page);
  } catch (error: any) {
    console.error('Error in executeOpenSingleComments:', error.message);
  }
}
