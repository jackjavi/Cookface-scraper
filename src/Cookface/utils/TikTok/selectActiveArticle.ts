import {Page} from 'puppeteer';

export interface ActiveArticleInfo {
  article: any; // Puppeteer ElementHandle
  index: string;
}

/**
 * Find and return the currently active/visible article on TikTok
 * @param page - Puppeteer Page instance
 * @returns Promise containing the active article element and its index
 */
export async function selectActiveArticle(
  page: Page,
): Promise<ActiveArticleInfo | null> {
  try {
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
      return null;
    }

    console.log(`✅ Active article index: ${activeArticleIndex}`);

    // Select the active article
    const article = await page.$(
      `article[data-scroll-index="${activeArticleIndex}"]`,
    );

    if (!article) {
      console.log('❌ Could not find active article element');
      return null;
    }

    console.log('✅ Active article element found');

    return {
      article,
      index: activeArticleIndex,
    };
  } catch (error) {
    console.error('❌ Error in selectActiveArticle:', error);
    return null;
  }
}
