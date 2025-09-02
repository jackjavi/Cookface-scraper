import {Page} from 'puppeteer';
import sleep from '../../utils/sleep';
import getRandomWaitTime from '../../utils/randomWaitTime';
import getRandomCount from '../../utils/randomCount';

/**
 * Likes Facebook posts that are not already liked.
 * @param page Puppeteer page instance
 * @param randomCount Optional: specific count to like, otherwise uses getRandomCount(2, 9)
 */
const fbLike = async (page: Page, randomCount?: number): Promise<void> => {
  try {
    const targetLikeCount = randomCount || getRandomCount(2, 9);
    let likedCount = 0;
    let previousHeight = 0;

    console.log(`Starting to like up to ${targetLikeCount} Facebook posts...`);

    while (likedCount < targetLikeCount) {
      const likedThisRound = await page.evaluate(() => {
        // Find all like button icons that are not already liked
        const likeIcons = Array.from(
          document.querySelectorAll(
            'span.x3nfvp2:not(.xcena0t) i.x1b0d499.x1d69dk1',
          ),
        );

        console.log(`Found ${likeIcons.length} potential like buttons`);

        let clicks = 0;

        for (const icon of likeIcons) {
          if (clicks >= 5) break;

          // Find the post container using the structure you described
          const postContainer =
            icon.closest('[role="article"]') ||
            icon.closest('.x1lliihq') ||
            icon.closest(
              '.xabvvm4.xeyy32k.x1ia1hqs.x1a2w583.x6ikm8r.x10wlt62',
            ) ||
            icon.closest('.x1n2onr6');

          if (!postContainer) {
            console.log('❌ No post container found, skipping...');
            continue;
          }

          let reactionCount = 0;
          let countFound = false;

          // STRATEGY 1: Find the reaction toolbar and extract total count
          const reactionToolbar = postContainer.querySelector(
            'span.x1ja2u2z[aria-label="See who reacted to this"][role="toolbar"]',
          );

          if (reactionToolbar) {
            console.log('✅ Found reaction toolbar');

            // Look for the total reaction count in spans with specific classes
            const totalCountSpan = reactionToolbar.querySelector(
              'span.xt0b8zv.x135b78x, span.x135b78x',
            );

            if (totalCountSpan && totalCountSpan.textContent) {
              const countText = totalCountSpan.textContent.trim();
              const numberMatch = countText.match(/(\d+)/);

              if (numberMatch) {
                reactionCount = parseInt(numberMatch[1], 10);
                countFound = true;
                console.log(`✅ Found total reactions: ${reactionCount}`);
              }
            }
          }

          // STRATEGY 2: If total count not found, sum individual reactions
          if (!countFound) {
            const reactionElements = postContainer.querySelectorAll(
              '[aria-label*=":"][aria-label*="person"], [aria-label*=":"][aria-label*="people"]',
            );

            if (reactionElements.length > 0) {
              console.log(
                `🔍 Found ${reactionElements.length} individual reaction elements`,
              );

              let totalReactions = 0;

              // Convert NodeList to Array for iteration
              const reactionArray = Array.from(reactionElements);
              for (const element of reactionArray) {
                const ariaLabel = element.getAttribute('aria-label') || '';
                console.log(`   Reaction: "${ariaLabel}"`);

                const match = ariaLabel.match(/(\d+)\s*(?:person|people)/i);
                if (match && match[1]) {
                  totalReactions += parseInt(match[1], 10);
                }
              }

              if (totalReactions > 0) {
                reactionCount = totalReactions;
                countFound = true;
                console.log(`✅ Calculated total reactions: ${reactionCount}`);
              }
            }
          }

          // STRATEGY 3: Look for aria-label with "Like: X people"
          if (!countFound) {
            const likeButton = postContainer.querySelector(
              '[aria-label*="Like:"]',
            );
            if (likeButton) {
              const ariaLabel = likeButton.getAttribute('aria-label') || '';
              console.log(`🔍 Like button aria-label: "${ariaLabel}"`);

              const match = ariaLabel.match(/Like:\s*(\d+)\s*people/i);
              if (match && match[1]) {
                reactionCount = parseInt(match[1], 10);
                countFound = true;
                console.log(`✅ Found like count: ${reactionCount}`);
              }
            }
          }

          // STRATEGY 4: Look for any element with reaction count text
          if (!countFound) {
            const allTextElements = postContainer.querySelectorAll('*');
            // Convert NodeList to Array for iteration
            const allTextArray = Array.from(allTextElements);
            for (const element of allTextArray) {
              if (
                element.textContent &&
                /\d+\s*(reactions?|likes?)/i.test(element.textContent)
              ) {
                const text = element.textContent.trim();
                const match = text.match(/(\d+)\s*(?:reactions?|likes?)/i);
                if (match && match[1]) {
                  reactionCount = parseInt(match[1], 10);
                  countFound = true;
                  console.log(
                    `✅ Found reaction text: "${text}" -> ${reactionCount}`,
                  );
                  break;
                }
              }
            }
          }

          // Decision making
          console.log(
            `🎯 Post analysis: countFound=${countFound}, reactionCount=${reactionCount}`,
          );

          if (countFound) {
            if (reactionCount >= 5 && reactionCount <= 200) {
              console.log(
                `✅ LIKING: Post has ${reactionCount} reactions (within range 5-200)`,
              );
              (icon as HTMLElement).click();
              clicks++;
              // Add randomized delay between clicks (5000-10000 ms)
              const randomDelay = Math.floor(Math.random() * 5000) + 5000;
              console.log(`⏰ Waiting ${randomDelay}ms before next action...`);
              new Promise(resolve => setTimeout(resolve, randomDelay));
            } else {
              console.log(
                `❌ SKIPPING: Post has ${reactionCount} reactions (outside range 5-200)`,
              );
            }
          } else {
            console.log(`❌ SKIPPING: Could not determine reaction count`);
          }
        }

        return clicks;
      });

      likedCount += likedThisRound;
      console.log(
        `Liked ${likedThisRound} posts this round. Total: ${likedCount}/${targetLikeCount}`,
      );

      if (likedCount >= targetLikeCount) {
        console.log(`Target of ${targetLikeCount} likes reached!`);
        break;
      }

      // Scroll down to find more posts
      previousHeight = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() =>
        window.scrollBy({top: 1200, behavior: 'smooth'}),
      );

      // Wait for content to load
      await sleep(getRandomWaitTime(4000, 6000));

      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === previousHeight) {
        console.log('No more posts to scroll. Stopping.');
        break;
      }
    }

    console.log(
      `Finished liking process. Successfully liked ${likedCount} posts.`,
    );
    await sleep(getRandomWaitTime(3000, 5000));

    // Reload the page
    await page.reload({waitUntil: 'networkidle2'});
    console.log('Page reloaded successfully.');
    await sleep(getRandomWaitTime(4000, 7000));
  } catch (error: any) {
    console.error('Error in fbLike:', error.message);
    throw error;
  }
};

export default fbLike;
