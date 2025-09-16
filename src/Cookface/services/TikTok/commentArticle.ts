import {Page} from 'puppeteer';
import {selectActiveArticle} from '../../utils/TikTok/selectActiveArticle';
import {parseCommentCount} from '../../utils/TikTok/parseCommentCount';
import LikeComment from './likeComment';
import sleep from '../../utils/sleep';
import getRandomWaitTime from '../../utils/randomWaitTime';
import GenerativeAIService from '../generativeAI';
import config from '../../config/index';
import {navigateToNextArticle} from './navigationControls';

export interface CommentOptions {
  minCommentCount?: number;
  maxCommentsToExtract?: number;
  maxArticlesToCheck?: number; // New option to limit navigation attempts
}

export interface CommentResult {
  success: boolean;
  articleIndex: string;
  commentCount: number;
  action: 'opened_and_extracted' | 'skipped' | 'error' | 'no_suitable_article';
  comments: string[];
  totalExtracted: number;
  generatedReply?: string;
  error?: string;
  articlesChecked?: number; // Track how many articles were checked
}

/**
 * Open comments section and extract comments if the article meets the criteria
 * Will navigate to next articles until one with sufficient comments is found
 * @param page - Puppeteer Page instance
 * @param options - Comment options including minimum comment count and max comments to extract
 * @returns Promise<CommentResult> - Result of the comment operation and extraction
 */
export async function CommentArticle(
  page: Page,
  options: CommentOptions = {},
): Promise<CommentResult> {
  await sleep(getRandomWaitTime(1000, 4000));
  await page.reload({waitUntil: 'domcontentloaded'});
  console.log('Page reloaded successfully.');
  await sleep(getRandomWaitTime(1000, 5000));

  // Navigate to next article once initially
  await navigateToNextArticle(page, 1500);

  // Navigate through random number of articles (2-6) with random pauses
  const articlesToNavigate = Math.floor(Math.random() * 5) + 2; // Random between 2-6
  console.log(
    `🎯 Navigating through ${articlesToNavigate} articles before starting comment section...`,
  );

  for (let i = 0; i < articlesToNavigate; i++) {
    console.log(`📱 Navigating to article ${i + 1}/${articlesToNavigate}...`);

    // Navigate to next article
    await navigateToNextArticle(page, 1500);

    // Random pause between 4-7 seconds between navigations
    const pauseTime = getRandomWaitTime(4000, 7000);
    console.log(`⏳ Pausing for ${pauseTime}ms before next navigation...`);
    await sleep(pauseTime);
  }

  console.log(
    `✅ Completed navigation through ${articlesToNavigate} articles, starting comment section...`,
  );

  const {
    minCommentCount = 5,
    maxCommentsToExtract = 10,
    maxArticlesToCheck = 10, // Limit to prevent infinite loop
  } = options;

  let articlesChecked = 0;

  try {
    // Loop through articles until we find one with sufficient comments
    while (articlesChecked < maxArticlesToCheck) {
      articlesChecked++;

      console.log(
        `🔍 Checking article ${articlesChecked}/${maxArticlesToCheck} for comment threshold...`,
      );

      // Get the currently active article
      const activeArticleInfo = await selectActiveArticle(page);
      if (!activeArticleInfo) {
        console.warn(
          `⚠️ No active article found on attempt ${articlesChecked}`,
        );

        // Navigate to next article and continue
        if (articlesChecked < maxArticlesToCheck) {
          console.log('📱 Navigating to next article...');
          await navigateToNextArticle(page, getRandomWaitTime(1500, 3000));
          await sleep(getRandomWaitTime(1000, 2000));
          continue;
        } else {
          return {
            success: false,
            articleIndex: 'unknown',
            commentCount: 0,
            action: 'no_suitable_article',
            comments: [],
            totalExtracted: 0,
            error: 'No active article found after checking multiple articles',
            articlesChecked,
          };
        }
      }

      const {article, index} = activeArticleInfo;

      // Find the action bar section within this article
      const actionBarSection = await article.$(
        'section.css-jbg155-5e6d46e3--SectionActionBarContainer.e12arnib0',
      );

      if (!actionBarSection) {
        console.warn(`⚠️ Action bar not found for article ${index}`);

        // Navigate to next article and continue
        if (articlesChecked < maxArticlesToCheck) {
          console.log('📱 Navigating to next article...');
          await navigateToNextArticle(page, getRandomWaitTime(1500, 3000));
          await sleep(getRandomWaitTime(1000, 2000));
          continue;
        } else {
          return {
            success: false,
            articleIndex: index,
            commentCount: 0,
            action: 'no_suitable_article',
            comments: [],
            totalExtracted: 0,
            error: 'Action bar not found after checking multiple articles',
            articlesChecked,
          };
        }
      }

      // Find the comment button with specific aria-label check
      const commentButton = await actionBarSection.evaluateHandle(() => {
        const buttons = Array.from(
          document.querySelectorAll(
            'button[aria-label*="Read or add comments"]',
          ),
        );
        return (
          buttons.find(button => {
            const ariaLabel = button.getAttribute('aria-label') || '';
            return ariaLabel.includes('Read or add comments');
          }) || null
        );
      });

      if (!commentButton || commentButton.asElement() === null) {
        console.warn(`⚠️ Comment button not found for article ${index}`);

        // Navigate to next article and continue
        if (articlesChecked < maxArticlesToCheck) {
          console.log('📱 Navigating to next article...');
          await navigateToNextArticle(page, getRandomWaitTime(1500, 3000));
          await sleep(getRandomWaitTime(1000, 2000));
          continue;
        } else {
          return {
            success: false,
            articleIndex: index,
            commentCount: 0,
            action: 'no_suitable_article',
            comments: [],
            totalExtracted: 0,
            error: 'Comment button not found after checking multiple articles',
            articlesChecked,
          };
        }
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
          `⏭️ Article ${index} doesn't meet threshold (${commentCount} < ${minCommentCount}). Navigating to next article...`,
        );

        // Navigate to next article and continue the loop
        if (articlesChecked < maxArticlesToCheck) {
          await navigateToNextArticle(page, getRandomWaitTime(1500, 3000));
          await sleep(getRandomWaitTime(1000, 2000));
          continue;
        } else {
          return {
            success: true,
            articleIndex: index,
            commentCount,
            action: 'no_suitable_article',
            comments: [],
            totalExtracted: 0,
            articlesChecked,
          };
        }
      }

      // Article meets the threshold! Proceed with comment extraction
      console.log(
        `🎯 Found suitable article ${index} with ${commentCount} comments. Proceeding with extraction...`,
      );

      // Click the comment button to open comments section
      await commentButton.asElement()!.click();
      console.log(
        `✅ Successfully opened comments for article ${index} with ${commentCount} comments`,
      );

      // Wait for comments section to load
      await sleep(2000);

      // Now extract comments from the opened section
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
          console.warn(
            '⚠️ Comment list container not found, but comments section was opened',
          );
          break;
        }

        // Extract comments from current view and get their indexes
        const {comments: currentComments, commentIndexes} = await page.evaluate(
          () => {
            const commentDivs = Array.from(
              document.querySelectorAll(
                'div.css-zjz0t7-5e6d46e3--DivCommentObjectWrapper.e16z10169',
              ),
            );

            const comments: string[] = [];
            const commentIndexes: number[] = [];

            commentDivs.forEach((commentDiv, idx) => {
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
                    commentIndexes.push(idx);
                  }
                }
              }
            });

            return {comments, commentIndexes};
          },
        );

        // Like each comment using LikeComment (outside of page.evaluate)
        const commentDivHandles = await page.$$(
          'div.css-zjz0t7-5e6d46e3--DivCommentObjectWrapper.e16z10169',
        );
        for (const idx of commentIndexes) {
          if (commentDivHandles[idx]) {
            try {
              await LikeComment(commentDivHandles[idx], page);
            } catch (e) {
              console.warn('LikeComment failed for comment', idx, e);
            }
          }
        }

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

        // Scroll down to load more comments using arrow key method
        scrollAttempts++;
        console.log(
          `📜 Scrolling down to load more comments (attempt ${scrollAttempts}/${maxScrollAttempts})...`,
        );

        const scrolled = await page.evaluate(async () => {
          // Find a comment span to click on
          const commentLevelSpan = document.querySelector(
            'span[data-e2e="comment-level-1"]',
          );

          if (commentLevelSpan) {
            // Click on the comment span to focus it
            (commentLevelSpan as HTMLElement).click();

            // Small delay to ensure focus
            await new Promise(resolve => setTimeout(resolve, 100));

            return true; // Successfully found and clicked a comment span
          }

          return false; // No comment span found
        });

        if (scrolled) {
          // Press and hold arrow down key for 1 second
          await page.keyboard.down('ArrowDown');
          await sleep(1000); // Hold for 1 second
          await page.keyboard.up('ArrowDown');

          console.log('📜 Successfully scrolled using arrow down key');
        } else {
          console.log('📜 No comment span found to click, stopping extraction');
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

      // Generate a TikTok reply based on extracted comments
      let generatedReply: string | undefined;
      if (extractedComments.length > 0) {
        try {
          const genAI = new GenerativeAIService();
          generatedReply = await genAI.generateTikTokReply(
            extractedComments,
            `@${config.TikTokUsername}`,
          );
          console.log(`🤖 Generated reply: \t${generatedReply}`);

          // Post the generated comment
          if (generatedReply) {
            try {
              console.log('📝 Attempting to post generated comment...');

              // Find the comment input container
              const commentInputContainer = await page.$(
                'div.css-17kdrdu-5e6d46e3--DivCommentInputContainer.efkjbru0',
              );

              if (!commentInputContainer) {
                console.warn('⚠️ Comment input container not found');
              } else {
                // Find the comment text input div within the container
                const commentTextDiv = await commentInputContainer.$(
                  'div[data-e2e="comment-text"]',
                );

                if (!commentTextDiv) {
                  console.warn('⚠️ Comment text input div not found');
                } else {
                  // Click on the comment input div to focus it
                  await commentTextDiv.click();
                  console.log('✅ Clicked on comment input div');

                  // Wait a moment for the input to be ready
                  await sleep(500);

                  // Find the contenteditable div and type the comment
                  const editableDiv = await commentTextDiv.$(
                    'div.notranslate.public-DraftEditor-content[contenteditable="true"]',
                  );

                  if (editableDiv) {
                    // Clear any existing content and type the new comment
                    await editableDiv.click();
                    await page.keyboard.type(generatedReply, {delay: 200});
                    console.log(
                      `✅ Successfully typed comment: "${generatedReply}"`,
                    );

                    // Wait before posting (random delay)
                    const waitTime = getRandomWaitTime(1000, 2500);
                    console.log(`⏳ Waiting ${waitTime}ms before posting...`);
                    await sleep(waitTime);

                    // Find and click the Post button
                    const postButton = await commentInputContainer.$(
                      'div[data-e2e="comment-post"][role="button"]',
                    );

                    if (postButton) {
                      // Check if the post button is enabled (aria-disabled should be "false" or not present when enabled)
                      const isDisabled = await page.evaluate(
                        button =>
                          button.getAttribute('aria-disabled') === 'true',
                        postButton,
                      );

                      if (!isDisabled) {
                        await postButton.click();
                        console.log('✅ Successfully clicked Post button');

                        // Wait to ensure the comment is posted
                        await sleep(2000);
                        console.log('🎉 Comment posted successfully!');
                      } else {
                        console.warn('⚠️ Post button is disabled');
                      }
                    } else {
                      console.warn('⚠️ Post button not found');
                    }
                  } else {
                    console.warn('⚠️ Contenteditable div not found');
                  }
                }
              }
            } catch (postError) {
              console.error('❌ Error posting comment:', postError);
            }
          }
        } catch (error) {
          console.error('❌ Error generating TikTok reply:', error);
        }
      }

      return {
        success: true,
        articleIndex: index,
        commentCount,
        action: 'opened_and_extracted',
        comments: extractedComments,
        totalExtracted: extractedComments.length,
        generatedReply,
        articlesChecked,
      };
    }

    // If we've checked the maximum number of articles without finding a suitable one
    return {
      success: false,
      articleIndex: 'multiple',
      commentCount: 0,
      action: 'no_suitable_article',
      comments: [],
      totalExtracted: 0,
      error: `No articles with sufficient comments found after checking ${maxArticlesToCheck} articles`,
      articlesChecked,
    };
  } catch (error) {
    console.error('❌ Error in Comment function:', error);
    return {
      success: false,
      articleIndex: 'unknown',
      commentCount: 0,
      action: 'error',
      comments: [],
      totalExtracted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      articlesChecked,
    };
  }
}
