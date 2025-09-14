import {Page, ElementHandle} from 'puppeteer';
import sleep from '../../utils/sleep';
import getRandomWaitTime from '../../utils/randomWaitTime';

/**
 * Likes a comment with a random probability
 * @param commentDiv - The comment div element handle
 * @param page - Puppeteer Page instance
 * @returns Promise<boolean> - True if comment was liked, false otherwise
 */
export async function LikeComment(
  commentDiv: ElementHandle<Element>,
  page: Page,
): Promise<boolean> {
  try {
    // Random determiner - like comment if random > 0.4 (60% chance)
    const shouldLike = Math.random() > 0.4;

    if (!shouldLike) {
      console.log('🎲 Skipping like for this comment (random chance)');
      return false;
    }

    // Find the like button within this comment div
    const likeButton = await commentDiv.$(
      'div[aria-label*="Like video"][role="button"]',
    );

    if (!likeButton) {
      console.warn('⚠️ Like button not found in comment div');
      return false;
    }

    // Check if the comment is already liked (aria-pressed="true")
    const isAlreadyLiked = await page.evaluate(
      button => button.getAttribute('aria-pressed') === 'true',
      likeButton,
    );

    if (isAlreadyLiked) {
      console.log('💙 Comment already liked, skipping');
      return false;
    }

    // Click the like button (could be the div itself or the svg inside)
    await likeButton.click();
    console.log('❤️ Successfully liked comment');

    // Random sleep between 1.5 and 3 seconds
    const waitTime = getRandomWaitTime(3000, 7000);
    console.log(`⏳ Waiting ${waitTime}ms after liking comment...`);
    await sleep(waitTime);

    return true;
  } catch (error) {
    console.error('❌ Error liking comment:', error);
    return false;
  }
}

export default LikeComment;
