import {Page} from 'puppeteer';
import sleep from '../utils/sleep';

export const TikTokScraper = async (page: Page): Promise<void> => {
  try {
    await page.bringToFront();
    await sleep(3000);

    await page.waitForSelector(
      '.css-420tiu-5e6d46e3--BaseBodyContainer.e1pgfmdu0',
      {timeout: 10000},
    );

    console.log('✅ Base container found');

    // Find the currently active article
    const activeArticleIndex = await page.evaluate(() => {
      const articles = Array.from(
        document.querySelectorAll(
          'article[data-e2e="recommend-list-item-container"]',
        ),
      );

      // Filter articles that have actual content
      const articlesWithContent = articles.filter(article => {
        const hasActionBar = article.querySelector(
          'section.css-jbg155-5e6d46e3--SectionActionBarContainer',
        );
        const hasLikeButton = article.querySelector(
          'button[aria-label*="Like video"], button[aria-label*="like video"]',
        );
        const hasContent = article.querySelector(
          '[data-e2e="video-desc"], img[src*="tiktokcdn.com"], video',
        );

        return hasActionBar && hasLikeButton && hasContent;
      });

      if (articlesWithContent.length === 0) return null;

      // If only one article with content, return it
      if (articlesWithContent.length === 1) {
        return articlesWithContent[0].getAttribute('data-scroll-index');
      }

      // Find the most visible one
      let mostVisibleArticle = null;
      let maxVisibleArea = 0;
      const viewportHeight = window.innerHeight;

      articlesWithContent.forEach(article => {
        const rect = article.getBoundingClientRect();

        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(viewportHeight, rect.bottom);

        if (visibleBottom > visibleTop) {
          const visibleHeight = visibleBottom - visibleTop;
          const visibilityRatio = visibleHeight / rect.height;

          if (visibilityRatio > 0.5 && visibleHeight > maxVisibleArea) {
            maxVisibleArea = visibleHeight;
            mostVisibleArticle = article;
          }
        }
      });

      return (
        (mostVisibleArticle as Element | null)?.getAttribute(
          'data-scroll-index',
        ) ||
        (articlesWithContent[0] as Element).getAttribute('data-scroll-index')
      );
    });

    if (!activeArticleIndex) {
      console.log('❌ No active article found');
      return;
    }

    console.log(`✅ Active article index: ${activeArticleIndex}`);

    // Select the active article
    const article = await page.$(
      `article[data-scroll-index="${activeArticleIndex}"]`,
    );
    if (!article) {
      console.log('❌ Could not find active article element');
      return;
    }

    console.log('✅ Active article element found');

    // Rest of your existing logic remains the same
    const actionBarSection = await article.$(
      'section.css-jbg155-5e6d46e3--SectionActionBarContainer.e12arnib0',
    );

    if (!actionBarSection) {
      console.log('⚠️ Action bar not found in active article');
      return;
    }

    const likeButton = await actionBarSection.$(
      'button[aria-label*="Like video"], button[aria-label*="like video"]',
    );

    if (!likeButton) {
      console.log('⚠️ Like button not found in active article');
      return;
    }

    // Find the like count element within the button
    const likeCountElement = await likeButton.$(
      'strong[data-e2e="like-count"]',
    );
    if (!likeCountElement) {
      console.log('⚠️ Like count element not found in article');
      return;
    }

    // Extract the like count text
    const likeCountText = await page.evaluate(
      el => el.innerText,
      likeCountElement,
    );
    console.log(`📊 Article like count: ${likeCountText}`);

    // Parse the like count (handle K, M suffixes)
    const likeCount = parseLikeCount(likeCountText);

    if (likeCount > 2) {
      console.log(`👍 Liking article with ${likeCount} likes`);

      // Check if already liked (button might have different state)
      const isAlreadyLiked = await page.evaluate(button => {
        return button.getAttribute('aria-pressed') === 'true';
      }, likeButton);

      if (!isAlreadyLiked) {
        await likeButton.click();
        console.log(`✅ Successfully liked article`);

        // Small delay after action
        await sleep(1000 + Math.random() * 2000);
      } else {
        console.log(`ℹ️ Article already liked`);
      }
    } else {
      console.log(`⏭️ Skipping article (like count ${likeCount} <= 2)`);
    }

    console.log('🎵 TikTokScraper completed successfully');
    await sleep(100000);
  } catch (error) {
    console.error('❌ Error in TikTokScraper:', error);
    throw error;
  }
};

/**
 * Parse like count text to number, handling K/M suffixes
 * @param likeCountText - The like count text (e.g., "1.2K", "500", "2.1M")
 * @returns The numeric like count
 */
function parseLikeCount(likeCountText: string): number {
  if (!likeCountText || typeof likeCountText !== 'string') {
    return 0;
  }

  const cleanText = likeCountText.trim().toLowerCase();

  // Handle empty or non-numeric strings
  if (!cleanText || cleanText === '-' || cleanText === '0') {
    return 0;
  }

  // Extract the numeric part and suffix
  const match = cleanText.match(/^(\d+(?:\.\d+)?)\s*([km]?)$/);
  if (!match) {
    // Try to parse as plain number
    const parsed = parseInt(cleanText.replace(/[^\d]/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  const [, numStr, suffix] = match;
  const num = parseFloat(numStr);

  switch (suffix) {
    case 'k':
      return Math.floor(num * 1000);
    case 'm':
      return Math.floor(num * 1000000);
    default:
      return Math.floor(num);
  }
}
