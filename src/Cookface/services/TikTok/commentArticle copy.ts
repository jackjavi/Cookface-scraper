import {Page} from 'puppeteer';
import {selectActiveArticle} from '../../utils/TikTok/selectActiveArticle';
import {parseCommentCount} from '../../utils/TikTok/parseCommentCount';
import sleep from '../../utils/sleep';

export interface CommentSectionOptions {
  minCommentCount?: number;
  maxCommentsToExtract?: number;
}

export interface CommentResult {
  success: boolean;
  articleIndex: string;
  commentCount: number;
  action: 'opened' | 'skipped' | 'error';
  error?: string;
}

/**
 * Open comments section if the article meets the criteria
 * @param page - Puppeteer Page instance
 * @param options - Comment options including minimum comment count
 * @returns Promise<CommentResult> - Result of the comment operation
 */
export async function openCommentsSection(
  page: Page,
  options: CommentSectionOptions = {},
): Promise<CommentResult> {
  const {minCommentCount = 5} = options;

  try {
    // Get the currently active article
    const activeArticleInfo = await selectActiveArticle(page);
    if (!activeArticleInfo) {
      return {
        success: false,
        articleIndex: 'unknown',
        commentCount: 0,
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
        commentCount: 0,
        action: 'error',
        error: 'Action bar not found',
      };
    }

    // Find the comment button with specific aria-label check
    const commentButton = await actionBarSection.evaluateHandle(() => {
      const buttons = Array.from(
        document.querySelectorAll('button[aria-label*="Read or add comments"]'),
      );
      return (
        buttons.find(button => {
          const ariaLabel = button.getAttribute('aria-label') || '';
          return ariaLabel.includes('Read or add comments');
        }) || null
      );
    });

    if (!commentButton || commentButton.asElement() === null) {
      return {
        success: false,
        articleIndex: index,
        commentCount: 0,
        action: 'error',
        error: 'Comment button not found',
      };
    }

    // Find the comment count element within the button
    const commentCountElement = await commentButton
      .asElement()!
      .$('strong[data-e2e="comment-count"]');

    let commentCount = 0;

    if (commentCountElement) {
      const commentCountText = await page.evaluate(
        el => el.innerText,
        commentCountElement,
      );
      commentCount = parseCommentCount(commentCountText);
      console.log(
        `💬 Article ${index} comment count: ${commentCountText} (${commentCount})`,
      );
    } else {
      console.log(`💬 Article ${index} comment count element not found`);
    }

    // Check if meets minimum comment count
    if (commentCount < minCommentCount) {
      console.log(
        `⏭️ Skipping article ${index} (comment count ${commentCount} < ${minCommentCount})`,
      );
      return {
        success: true,
        articleIndex: index,
        commentCount,
        action: 'skipped',
      };
    }

    // Click the comment button to open comments section
    await commentButton.asElement()!.click();
    console.log(
      `✅ Successfully opened comments for article ${index} with ${commentCount} comments`,
    );

    return {
      success: true,
      articleIndex: index,
      commentCount,
      action: 'opened',
    };
  } catch (error) {
    console.error('❌ Error opening comments section:', error);
    return {
      success: false,
      articleIndex: 'unknown',
      commentCount: 0,
      action: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Result type for extractComments function
 */
export interface ExtractCommentsResult {
  success: boolean;
  articleIndex: string;
  comments: string[];
  totalExtracted: number;
  error?: string;
}

/**
 * Extract comments from the opened comments section
 * @param page - Puppeteer Page instance
 * @param options - Options including maximum comments to extract
 * @returns Promise<ExtractCommentsResult> - Extracted comments and metadata
 */
export async function extractComments(
  page: Page,
  options: CommentSectionOptions = {},
): Promise<ExtractCommentsResult> {
  const {maxCommentsToExtract = 10} = options;

  try {
    // Get the currently active article for context
    const activeArticleInfo = await selectActiveArticle(page);
    const articleIndex = activeArticleInfo
      ? activeArticleInfo.index
      : 'unknown';

    console.log(
      `🔍 Starting comment extraction (target: ${maxCommentsToExtract} comments)...`,
    );

    let extractedComments: string[] = [];
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;

    while (
      extractedComments.length < maxCommentsToExtract &&
      scrollAttempts < maxScrollAttempts
    ) {
      // Find the comment list container
      const commentListContainer = await page.$(
        'div.css-10o05hi-5e6d46e3--DivCommentListContainer.egf6hx30',
      );

      if (!commentListContainer) {
        return {
          success: false,
          articleIndex,
          comments: [],
          totalExtracted: 0,
          error: 'Comment list container not found',
        };
      }

      // Extract comments from current view
      const currentComments = await page.evaluate(() => {
        const commentDivs = Array.from(
          document.querySelectorAll(
            'div.css-zjz0t7-5e6d46e3--DivCommentObjectWrapper.e16z10169',
          ),
        );

        const comments: string[] = [];

        commentDivs.forEach(commentDiv => {
          // Find the comment text within each div
          const commentLevelSpan = commentDiv.querySelector(
            'span[data-e2e="comment-level-1"]',
          );
          if (commentLevelSpan) {
            const commentTextSpan = commentLevelSpan.querySelector(
              'span.TUXText.TUXText--tiktok-sans.css-16xepmg-5e6d46e3--StyledTUXText.e1gw1eda0',
            );
            if (commentTextSpan && commentTextSpan.textContent) {
              const commentText = commentTextSpan.textContent.trim();
              if (commentText && !comments.includes(commentText)) {
                comments.push(commentText);
              }
            }
          }
        });

        return comments;
      });

      // Add new comments to our extracted list (avoid duplicates)
      currentComments.forEach(comment => {
        if (
          !extractedComments.includes(comment) &&
          extractedComments.length < maxCommentsToExtract
        ) {
          extractedComments.push(comment);
        }
      });

      console.log(
        `📝 Extracted ${currentComments.length} new comments (total: ${extractedComments.length}/${maxCommentsToExtract})`,
      );

      // If we have enough comments, break
      if (extractedComments.length >= maxCommentsToExtract) {
        break;
      }

      // Scroll down to load more comments
      scrollAttempts++;
      console.log(
        `📜 Scrolling down to load more comments (attempt ${scrollAttempts}/${maxScrollAttempts})...`,
      );

      const scrolled = await page.evaluate(() => {
        const commentContainer = document.querySelector(
          'div.css-10o05hi-5e6d46e3--DivCommentListContainer.egf6hx30',
        );
        if (commentContainer) {
          const before = commentContainer.scrollTop;
          commentContainer.scrollTop += 500;
          const after = commentContainer.scrollTop;
          return after > before; // Return true if we actually scrolled
        }
        return false;
      });

      if (!scrolled) {
        console.log(`📜 No more content to scroll, stopping extraction`);
        break;
      }

      // Wait for new comments to load
      await sleep(1500);
    }

    console.log(
      `✅ Comment extraction completed: ${extractedComments.length} comments extracted`,
    );

    // Log first few comments for debugging
    extractedComments.slice(0, 3).forEach((comment, index) => {
      console.log(
        `💬 Comment ${index + 1}: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"`,
      );
    });

    return {
      success: true,
      articleIndex,
      comments: extractedComments,
      totalExtracted: extractedComments.length,
    };
  } catch (error) {
    console.error('❌ Error extracting comments:', error);
    return {
      success: false,
      articleIndex: 'unknown',
      comments: [],
      totalExtracted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
