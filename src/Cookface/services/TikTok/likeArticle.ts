import {Page} from 'puppeteer';
import {selectActiveArticle} from '../../utils/TikTok/selectActiveArticle';
import {parseLikeCount} from '../../utils/TikTok/parseLikeCount';
import {navigateToNextArticle} from './navigationControls';
import sleep from '../../utils/sleep';

export interface LikeArticleOptions {
  minLikeCount?: number;
  maxArticles?: number;
  skipAlreadyLiked?: boolean;
  delayBetweenLikes?: number;
  delayAfterNavigation?: number;
}

export interface LikeResult {
  success: boolean;
  articleIndex: string;
  likeCount: number;
  wasAlreadyLiked: boolean;
  action: 'liked' | 'skipped' | 'already_liked' | 'error';
  error?: string;
}

export interface BulkLikeResult {
  totalProcessed: number;
  totalLiked: number;
  totalSkipped: number;
  totalAlreadyLiked: number;
  totalErrors: number;
  results: LikeResult[];
}

/**
 * Like a single article if it meets the criteria
 * @param page - Puppeteer Page instance
 * @param options - Like options including minimum like count
 * @returns Promise<LikeResult> - Result of the like operation
 */
export async function likeSingleArticle(
  page: Page,
  options: LikeArticleOptions = {},
): Promise<LikeResult> {
  const {minLikeCount = 2, skipAlreadyLiked = true} = options;

  try {
    // Get the currently active article
    const activeArticleInfo = await selectActiveArticle(page);
    if (!activeArticleInfo) {
      return {
        success: false,
        articleIndex: 'unknown',
        likeCount: 0,
        wasAlreadyLiked: false,
        action: 'error',
        error: 'No active article found',
      };
    }

    const {article, index} = activeArticleInfo;

    // Find the action bar section within this article
    const actionBarSection = await article.$(
      'section.css-jbg155-5e6d46e3--SectionActionBarContainer.e12arnib0',
    );

    if (!actionBarSection) {
      return {
        success: false,
        articleIndex: index,
        likeCount: 0,
        wasAlreadyLiked: false,
        action: 'error',
        error: 'Action bar not found',
      };
    }

    // Find the like button
    const likeButton = await actionBarSection.$(
      'button[aria-label*="Like video"], button[aria-label*="like video"]',
    );

    if (!likeButton) {
      return {
        success: false,
        articleIndex: index,
        likeCount: 0,
        wasAlreadyLiked: false,
        action: 'error',
        error: 'Like button not found',
      };
    }

    // Check if already liked
    const isAlreadyLiked = await page.evaluate(button => {
      return button.getAttribute('aria-pressed') === 'true';
    }, likeButton);

    // Find the like count element
    const likeCountElement = await likeButton.$(
      'strong[data-e2e="like-count"]',
    );
    let likeCount = 0;

    if (likeCountElement) {
      const likeCountText = await page.evaluate(
        el => el.innerText,
        likeCountElement,
      );
      likeCount = parseLikeCount(likeCountText);
      console.log(
        `📊 Article ${index} like count: ${likeCountText} (${likeCount})`,
      );
    }

    // Check if already liked and should skip
    if (isAlreadyLiked && skipAlreadyLiked) {
      console.log(`ℹ️ Article ${index} already liked - skipping`);
      return {
        success: true,
        articleIndex: index,
        likeCount,
        wasAlreadyLiked: true,
        action: 'already_liked',
      };
    }

    // Check if meets minimum like count
    if (likeCount <= minLikeCount) {
      console.log(
        `⏭️ Skipping article ${index} (like count ${likeCount} <= ${minLikeCount})`,
      );
      return {
        success: true,
        articleIndex: index,
        likeCount,
        wasAlreadyLiked: isAlreadyLiked,
        action: 'skipped',
      };
    }

    // Like the article if not already liked
    if (!isAlreadyLiked) {
      await likeButton.click();
      console.log(
        `✅ Successfully liked article ${index} with ${likeCount} likes`,
      );

      return {
        success: true,
        articleIndex: index,
        likeCount,
        wasAlreadyLiked: false,
        action: 'liked',
      };
    } else {
      return {
        success: true,
        articleIndex: index,
        likeCount,
        wasAlreadyLiked: true,
        action: 'already_liked',
      };
    }
  } catch (error) {
    console.error('❌ Error liking article:', error);
    return {
      success: false,
      articleIndex: 'unknown',
      likeCount: 0,
      wasAlreadyLiked: false,
      action: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Like multiple articles in sequence
 * @param page - Puppeteer Page instance
 * @param options - Like options including number of articles to like
 * @returns Promise<BulkLikeResult> - Results of all like operations
 */
export async function likeMultipleArticles(
  page: Page,
  options: LikeArticleOptions = {},
): Promise<BulkLikeResult> {
  const {
    maxArticles = 5,
    delayBetweenLikes = 2000,
    delayAfterNavigation = 1500,
  } = options;

  const results: LikeResult[] = [];
  let totalProcessed = 0;
  let totalLiked = 0;
  let totalSkipped = 0;
  let totalAlreadyLiked = 0;
  let totalErrors = 0;
  let articlesChecked = 0;

  console.log(`🚀 Starting to like up to ${maxArticles} articles`);

  while (totalLiked < maxArticles) {
    articlesChecked++;
    console.log(
      `\n📱 Checking article ${articlesChecked} (target: ${totalLiked + 1}/${maxArticles} likes)`,
    );

    // Like the current article
    const result = await likeSingleArticle(page, options);
    results.push(result);

    // Update counters based on action
    switch (result.action) {
      case 'liked':
        totalLiked++;
        totalProcessed++;
        break;
      case 'skipped':
        totalSkipped++;
        totalProcessed++;
        break;
      case 'already_liked':
        totalAlreadyLiked++;
        // Don't increment totalProcessed for already liked articles
        console.log(
          `⏭️ Article already liked, continuing to find next article to like...`,
        );
        break;
      case 'error':
        totalErrors++;
        totalProcessed++;
        break;
    }

    // Add delay after liking/processing
    if (result.action === 'liked') {
      const randomDelay = delayBetweenLikes + Math.random() * 1000;
      await sleep(randomDelay);
    }

    // Check if we've reached our target or hit too many errors
    if (totalLiked >= maxArticles) {
      console.log(`🎯 Target of ${maxArticles} likes reached!`);
      break;
    }

    if (totalErrors >= maxArticles) {
      console.log(`⚠️ Too many errors encountered, stopping operation`);
      break;
    }

    // Navigate to next article
    console.log(`🧭 Navigating to next article...`);
    const navigationSuccess = await navigateToNextArticle(
      page,
      delayAfterNavigation,
    );

    if (!navigationSuccess) {
      console.log(
        `⚠️ Failed to navigate to next article, stopping bulk like operation`,
      );
      break;
    }
  }

  const bulkResult: BulkLikeResult = {
    totalProcessed,
    totalLiked,
    totalSkipped,
    totalAlreadyLiked,
    totalErrors,
    results,
  };

  console.log(`\n📊 Bulk like operation completed:`);
  console.log(`   Articles checked: ${articlesChecked}`);
  console.log(`   Total processed (counted): ${totalProcessed}`);
  console.log(`   Total liked: ${totalLiked}`);
  console.log(`   Total skipped: ${totalSkipped}`);
  console.log(`   Total already liked (not counted): ${totalAlreadyLiked}`);
  console.log(`   Total errors: ${totalErrors}`);

  return bulkResult;
}
