import sleep from '../../utils/sleep';
import getRandomWaitTime from '../../utils/randomWaitTime';
import {
  likeSingleArticle,
  likeMultipleArticles,
} from '../../services/TikTok/likeArticle';
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

export const TikTokLikesEngage = async (tiktokPage: Page): Promise<void> => {
  try {
    console.log('Starting TikTokEngage processing...');
    await tiktokPage.bringToFront();

    // Weights: [likeSingle, likeMultiple, justNavigate]
    // likeSingle: 50%, likeMultiple: 35%, justNavigate: 15%
    // const weights = [100, 0, 0];
    const weights = [50, 35, 15];
    const choice = getWeightedChoice(weights);

    switch (choice) {
      case 0:
        console.log('Executing likeSingleArticle (50% probability)');
        await executeLikeSingle(tiktokPage);
        break;
      case 1:
        console.log('Executing likeMultipleArticles (35% probability)');
        await executeLikeMultiple(tiktokPage);
        break;
      case 2:
        console.log('Executing justNavigate (15% probability)');
        await executeJustNavigate(tiktokPage);
        break;
      default:
        console.log('Fallback: Executing likeSingleArticle');
        await executeLikeSingle(tiktokPage);
        break;
    }

    await sleep(2000);
  } catch (error) {
    console.error('TikTokEngage error:', error);
  }
};

/**
 * Execute single article like with random settings
 */
async function executeLikeSingle(page: Page): Promise<void> {
  try {
    // Randomly choose a page to navigate to for variety
    const pages = [TIKTOK_ROUTES.FRIENDS, TIKTOK_ROUTES.FOLLOWING];
    const randomPage = pages[Math.floor(Math.random() * pages.length)];

    const navSuccess = await navigateToTikTokPage(page, randomPage, CONFIG);
    if (!navSuccess) {
      console.log('Failed to navigate to random page, using Home...');
      await navigateToTikTokPage(page, TIKTOK_ROUTES.HOME, CONFIG);
    }

    /// await navigateToNextArticle(page, 1500);
    // Random minimum like count between 1-10
    const minLikeCount = Math.floor(Math.random() * 10) + 1;

    const result = await likeSingleArticle(page, {
      minLikeCount,
      skipAlreadyLiked: true,
    });

    console.log(
      `Single like result for article ${result.articleIndex}: ${result.action}`,
    );

    // 30% chance to navigate to next article after liking
    if (Math.random() < 0.3) {
      console.log('Navigating to next article after single like...');
      await navigateToNextArticle(page, getRandomWaitTime(1500, 3000));
    }

    await sleep(getRandomWaitTime(3000, 7000));

    // Navigate back to Home after operation.
    await navigateToPreviousPage(page);
  } catch (error) {
    console.error('Error in executeLikeSingle:', error);
  }
}

/**
 * Execute multiple article likes with random settings
 */
async function executeLikeMultiple(page: Page): Promise<void> {
  try {
    // Randomly choose a page to navigate to for variety
    const pages = [TIKTOK_ROUTES.FRIENDS, TIKTOK_ROUTES.FOLLOWING];
    const randomPage = pages[Math.floor(Math.random() * pages.length)];

    const navSuccess = await navigateToTikTokPage(page, randomPage, CONFIG);
    if (!navSuccess) {
      console.log('Failed to navigate to random page, using Home...');
      await navigateToTikTokPage(page, TIKTOK_ROUTES.HOME, CONFIG);
    }

    await sleep(3000);
    // await navigateToNextArticle(page, 1500);
    // Random settings
    const maxArticles = Math.floor(Math.random() * 4) + 2; // 2-5 articles
    const minLikeCount = Math.floor(Math.random() * 8) + 1; // 1-8 likes minimum
    const delayBetweenLikes = Math.floor(Math.random() * 5000) + 5000; // 5-10 seconds
    const delayAfterNavigation = Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds

    console.log(
      `Liking up to ${maxArticles} articles with min ${minLikeCount} likes`,
    );

    const results = await likeMultipleArticles(page, {
      maxArticles,
      minLikeCount,
      delayBetweenLikes,
      delayAfterNavigation,
      skipAlreadyLiked: true,
    });

    console.log(
      `Multiple like completed: ${results.totalLiked} liked, ${results.totalSkipped} skipped`,
    );
    await sleep(getRandomWaitTime(3000, 7000));

    // Navigate back to Home after operation.
    await navigateToPreviousPage(page);
  } catch (error) {
    console.error('Error in executeLikeMultiple:', error);
  }
}

/**
 * Just navigate through articles without liking (for variety)
 */
async function executeJustNavigate(page: Page): Promise<void> {
  try {
    // Randomly choose a page to navigate to for variety
    const pages = [TIKTOK_ROUTES.FRIENDS, TIKTOK_ROUTES.FOLLOWING];
    const randomPage = pages[Math.floor(Math.random() * pages.length)];

    const navSuccess = await navigateToTikTokPage(page, randomPage, CONFIG);
    if (!navSuccess) {
      console.log('Failed to navigate to random page, using Home...');
      await navigateToTikTokPage(page, TIKTOK_ROUTES.HOME, CONFIG);
    }

    // Navigate through 2-4 articles just to mix up the activity
    const navigateCount = Math.floor(Math.random() * 3) + 2;
    console.log(`Just navigating through ${navigateCount} articles`);

    for (let i = 0; i < navigateCount; i++) {
      // Check current article
      const articleInfo = await selectActiveArticle(page);
      if (articleInfo) {
        console.log(`Viewing article ${articleInfo.index}`);
      }

      // Random viewing time between 2-6 seconds
      const viewTime = Math.floor(Math.random() * 4000) + 2000;
      await sleep(viewTime);

      // Navigate to next if not the last iteration
      if (i < navigateCount - 1) {
        const navSuccess = await navigateToNextArticle(page, 1500);
        if (!navSuccess) {
          console.log('Navigation failed, stopping browse session');
          break;
        }
      }
    }

    console.log('Navigation session completed');
    await sleep(getRandomWaitTime(3000, 7000));

    // Navigate back to Home after operation.
    await navigateToPreviousPage(page);
  } catch (error) {
    console.error('Error in executeJustNavigate:', error);
  }
}
