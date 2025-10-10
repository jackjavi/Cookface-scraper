import {Page} from 'puppeteer';
import sleep from '../../utils/sleep';
import getRandomWaitTime from '../../utils/randomWaitTime';
import GenerativeAIService from '../../services/generativeAI';

/**
 * Converts comment count strings to numbers
 * Examples: "3.5k" -> 3500, "1.2k" -> 1200, "50" -> 50
 */
const parseCommentCount = (text: string): number => {
  const match = text.match(/([\d.]+)k?/i);

  if (!match) return 0;

  const number = parseFloat(match[1]);

  // If the text contains 'k', multiply by 1000
  if (text.toLowerCase().includes('k')) {
    return Math.floor(number * 1000);
  }

  return Math.floor(number);
};

/**
 * Extracts text from Facebook posts and opens comment sections
 * @param page Puppeteer page instance
 */
const fbComment = async (page: Page): Promise<void> => {
  const MAX_RELOAD_ATTEMPTS = 10; // Maximum number of page reloads to attempt
  let reloadAttempt = 0;
  let postFound = false;

  try {
    console.log('Starting to extract post text from Facebook posts...');

    while (!postFound && reloadAttempt < MAX_RELOAD_ATTEMPTS) {
      if (reloadAttempt > 0) {
        console.log(
          `\n🔄 Reload attempt ${reloadAttempt}/${MAX_RELOAD_ATTEMPTS}`,
        );
        console.log('Reloading page to find new posts...');
        await page.reload({waitUntil: 'networkidle2'});
        await sleep(getRandomWaitTime(2000, 3000));
        console.log('Page reloaded successfully');
      }

      // Extract post texts using page.evaluate
      const postData = await page.evaluate(async () => {
        // Define parseCommentCount inside evaluate context
        const parseCommentCount = (text: string): number => {
          const match = text.match(/([\d.]+)k?/i);

          if (!match) return 0;

          const number = parseFloat(match[1]);

          // If the text contains 'k', multiply by 1000
          if (text.toLowerCase().includes('k')) {
            return Math.floor(number * 1000);
          }

          return Math.floor(number);
        };

        const results: Array<{
          postText: string;
          commentCount: number;
          clicked: boolean;
          comments?: string[];
        }> = [];

        // Find the main container with all posts
        const mainContainer = document.querySelector(
          'div.x1hc1fzr.x1unhpq9.x6o7n8i',
        );

        if (!mainContainer) {
          console.log('❌ Main container not found');
          return results;
        }

        console.log('✅ Main container found');

        // Find all individual post divs - but filter out nested x1lliihq divs
        // We only want the parent x1lliihq divs that contain story_message
        const allDivs = mainContainer.querySelectorAll('div.x1lliihq');
        const postDivs = Array.from(allDivs).filter(div => {
          // Check if this div has a story_message section (actual post)
          const hasStoryMessage =
            div.querySelector('div[data-ad-rendering-role="story_message"]') !==
            null;

          // Check if this div is nested inside another x1lliihq div
          let parent = div.parentElement;
          let isNested = false;
          while (parent && parent !== mainContainer) {
            if (parent.classList.contains('x1lliihq')) {
              isNested = true;
              break;
            }
            parent = parent.parentElement;
          }

          // Only keep divs that have story_message and are NOT nested
          return hasStoryMessage && !isNested;
        });

        console.log(
          `Found ${postDivs.length} top-level posts (filtered ${allDivs.length - postDivs.length} nested divs)`,
        );

        for (let i = 0; i < postDivs.length; i++) {
          const postDiv = postDivs[i];
          console.log(`\n--- Processing Post ${i + 1} ---`);

          // Find the post section with the story_message
          const postSection = postDiv.querySelector(
            'div[data-ad-rendering-role="story_message"].html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl',
          );

          if (!postSection) {
            console.log(`❌ Post ${i + 1}: No story_message section found`);

            // Scroll to next post if no story_message found
            console.log(`⬇️ Post ${i + 1}: Scrolling to next post...`);

            postDiv.scrollIntoView({
              behavior: 'smooth',
              block: 'end',
            });

            await new Promise(resolve => setTimeout(resolve, 1500));

            for (let k = 0; k < 3; k++) {
              window.dispatchEvent(
                new KeyboardEvent('keydown', {
                  key: 'ArrowDown',
                  code: 'ArrowDown',
                  keyCode: 40,
                  bubbles: true,
                  cancelable: true,
                }),
              );
              await new Promise(resolve => setTimeout(resolve, 200));
            }

            continue;
          }

          console.log(`✅ Post ${i + 1}: Found story_message section`);

          // Check for "See more" button
          const seeMoreButton = postSection.querySelector(
            'div[role="button"]',
          ) as HTMLElement;

          let hasSeeMore = false;
          if (seeMoreButton) {
            const buttonText = seeMoreButton.innerText || '';
            if (buttonText.includes('See more')) {
              console.log(
                `🔍 Post ${i + 1}: Found "See more" button, clicking...`,
              );
              hasSeeMore = true;
              seeMoreButton.click();

              // Wait for content to expand
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          let postText = '';

          if (hasSeeMore) {
            // After clicking "See more", select text from expanded content
            const expandedElements = postSection.querySelectorAll(
              'div.x14z9mp.xat24cr.x1lziwak.x1vvkbs.xtlvy1s.x126k92a',
            );

            if (expandedElements.length > 0) {
              console.log(
                `✅ Post ${i + 1}: Found ${expandedElements.length} expanded elements`,
              );
              const textParts: string[] = [];

              expandedElements.forEach(element => {
                // Get all inner text directly from the element
                const text = (element as HTMLElement).innerText?.trim();
                if (text) {
                  textParts.push(text);
                }
              });

              postText = textParts.join(' ');
            } else {
              // Fallback: if expanded elements not found, get text from postSection
              console.log(
                `⚠️ Post ${i + 1}: Expanded elements not found after clicking "See more", extracting available text`,
              );
              postText = (postSection as HTMLElement).innerText?.trim() || '';
            }
          } else {
            // No "See more" button, extract text from span with specific class
            const textSpan = postSection.querySelector(
              'span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x10flsy6.x1lliihq.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x4zkp8e.x41vudc.x6prxxf.xvq8zen.xo1l8bm.xzsf02u.x1yc453h',
            );

            if (textSpan) {
              console.log(`✅ Post ${i + 1}: Found text span`);
              // Get all inner text directly from the span element
              postText = (textSpan as HTMLElement).innerText?.trim() || '';
            } else {
              // If specific span not found, extract any available text from postSection
              console.log(
                `⚠️ Post ${i + 1}: Specific text span not found, extracting available text`,
              );
              postText = (postSection as HTMLElement).innerText?.trim() || '';
            }
          }

          if (postText) {
            console.log(
              `✅ Post ${i + 1} Text: "${postText.substring(0, 100)}${postText.length > 100 ? '...' : ''}"`,
            );

            // Now find and click on the comments button if it has more than 3 comments
            const commentSpan = postDiv.querySelector(
              'span.html-span.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x1hl2dhg.x16tdsg8.x1vvkbs.xkrqix3.x1sur9pj',
            ) as HTMLElement;

            let commentCount = 0;
            let clicked = false;

            if (commentSpan) {
              const commentText = commentSpan.innerText?.trim() || '';

              // Check if the text includes "comment"
              if (commentText.toLowerCase().includes('comment')) {
                // Parse comment count using the new function
                commentCount = parseCommentCount(commentText);
                console.log(
                  `📊 Post ${i + 1}: Found ${commentCount} comments (raw: "${commentText}")`,
                );

                if (commentCount > 3) {
                  console.log(
                    `🖱️ Post ${i + 1}: Scrolling comments section into view...`,
                  );

                  // Scroll the comment button into view
                  commentSpan.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });

                  // Wait for scroll to complete
                  await new Promise(resolve => setTimeout(resolve, 1000));

                  console.log(
                    `🖱️ Post ${i + 1}: Clicking on comments button (${commentCount} > 3)`,
                  );
                  commentSpan.click();
                  clicked = true;

                  // Wait for comments section to load
                  await new Promise(resolve => setTimeout(resolve, 3000));

                  console.log(`✅ Post ${i + 1}: Comments section opened`);

                  // Extract comments from the opened section
                  console.log(`📖 Post ${i + 1}: Extracting comments...`);

                  // Find the comments container
                  const commentsContainer = document.querySelector(
                    'div.html-div.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x1gslohp',
                  );

                  const postComments: string[] = [];

                  if (commentsContainer) {
                    console.log(`✅ Post ${i + 1}: Found comments container`);

                    // Find individual comment divs (up to 10)
                    const commentDivs = commentsContainer.querySelectorAll(
                      'div.x78zum5.xdt5ytf[data-virtualized="false"]',
                    );

                    const maxComments = Math.min(commentDivs.length, 10);
                    console.log(
                      `📊 Post ${i + 1}: Found ${commentDivs.length} comments, processing ${maxComments}`,
                    );

                    for (let j = 0; j < maxComments; j++) {
                      const commentDiv = commentDivs[j] as HTMLElement;
                      const commentText = commentDiv.innerText?.trim();

                      if (commentText) {
                        postComments.push(commentText);
                        console.log(
                          `💬 Comment ${j + 1}: "${commentText.substring(0, 80)}${commentText.length > 80 ? '...' : ''}"`,
                        );
                      }
                    }
                  } else {
                    console.log(
                      `❌ Post ${i + 1}: Comments container not found`,
                    );
                  }

                  // Check if we actually extracted enough comments
                  if (postComments.length > 3) {
                    console.log(
                      `🛑 Stopping - post with >3 actual comments found`,
                    );
                    console.log(
                      `📋 Total comments extracted: ${postComments.length}`,
                    );

                    results.push({
                      postText,
                      commentCount,
                      clicked,
                      comments: postComments,
                    });

                    // Return early to stop processing more posts
                    return results;
                  } else {
                    console.log(
                      `⚠️ Post ${i + 1}: Only extracted ${postComments.length} comments (need >3), will reload page`,
                    );
                    // Don't add to results, continue to trigger reload
                  }
                } else {
                  console.log(
                    `⏭️ Post ${i + 1}: Skipping comments (${commentCount} <= 3)`,
                  );
                }
              }
            } else {
              console.log(`❌ Post ${i + 1}: Comment button not found`);

              // If no comment button found, scroll to next post
              console.log(
                `⬇️ Post ${i + 1}: No comments found, scrolling to next post...`,
              );

              postDiv.scrollIntoView({
                behavior: 'smooth',
                block: 'end',
              });

              await new Promise(resolve => setTimeout(resolve, 1500));

              for (let k = 0; k < 3; k++) {
                window.dispatchEvent(
                  new KeyboardEvent('keydown', {
                    key: 'ArrowDown',
                    code: 'ArrowDown',
                    keyCode: 40,
                    bubbles: true,
                    cancelable: true,
                  }),
                );
                await new Promise(resolve => setTimeout(resolve, 200));
              }

              console.log(`✅ Post ${i + 1}: Scrolled to next post`);

              // Continue to next post without adding to results
              continue;
            }

            results.push({
              postText,
              commentCount,
              clicked,
            });
          } else {
            console.log(`❌ Post ${i + 1}: No text extracted`);
          }
        }

        return results;
      });

      // Log all extracted post data
      console.log('\n========== EXTRACTED POST DATA ==========');
      postData.forEach((data, index) => {
        console.log(`\nPost ${index + 1}:`);
        console.log(`Text: ${data.postText}`);
        console.log(`Comments: ${data.commentCount}`);
        console.log(`Comment Section Opened: ${data.clicked ? 'Yes' : 'No'}`);
        if (data.comments && data.comments.length > 0) {
          console.log(`Extracted Comments (${data.comments.length}):`);
          data.comments.forEach((comment, i) => {
            console.log(
              `  ${i + 1}. ${comment.substring(0, 100)}${comment.length > 100 ? '...' : ''}`,
            );
          });
        }
        console.log('---');
      });
      console.log(`\nTotal posts processed: ${postData.length}`);
      console.log(
        `Posts with comments opened: ${postData.filter(d => d.clicked).length}`,
      );

      // Check if we found a post with enough comments
      if (
        postData.length > 0 &&
        postData[0].comments &&
        postData[0].comments.length > 3
      ) {
        postFound = true;
        console.log('\n✅ Found post with sufficient comments!');

        console.log('\n========== GENERATING AI COMMENT ==========');
        console.log('Post Text:', postData[0].postText);
        console.log('Number of Comments:', postData[0].comments.length);

        try {
          const generativeAIService = new GenerativeAIService();
          const generatedComment =
            await generativeAIService.generateFacebookComment(
              postData[0].postText,
              postData[0].comments,
            );

          console.log('\n✨ Generated AI Comment:');
          console.log(`"${generatedComment}"`);
          console.log('==========================================\n');

          // Locate and click on the form element to activate the typing section
          console.log('Locating comment form to activate typing section...');
          const formSelector =
            'form.x1ed109x.x1n2onr6.xmjcpbm.x1xn7y0n.x1uxb8k9.x1vmbcc8.x16xm01d.x972fbf.x10w94by.x1qhh985.x14e42zd.x78zum5.x1iyjqo2.x13a6bvl[role="presentation"]';

          await page.waitForSelector(formSelector, {timeout: 5000});
          await page.click(formSelector);
          console.log('Clicked on comment form to activate typing.');

          await sleep(getRandomWaitTime(1000, 2000));

          //  Type the content
          await page.keyboard.type(`${generatedComment} `, {delay: 200});
          console.log('Typed the message into the editor successfully.');

          await sleep(getRandomWaitTime(3900, 6800));

          // Press Enter to post the comment
          await page.keyboard.press('Enter');
          console.log('Pressed Enter to post the comment.');
          console.log('Using keyboard shortcuts to click Post button...');

          await sleep(getRandomWaitTime(2000, 3000));
        } catch (error: any) {
          console.error('Failed to generate AI comment:', error.message);
        }
      } else {
        reloadAttempt++;
        if (reloadAttempt < MAX_RELOAD_ATTEMPTS) {
          console.log(
            `\n⚠️ No post with >3 comments found. Reloading page... (Attempt ${reloadAttempt}/${MAX_RELOAD_ATTEMPTS})`,
          );
        } else {
          console.log(
            `\n❌ Max reload attempts (${MAX_RELOAD_ATTEMPTS}) reached. No suitable post found.`,
          );
        }
      }
    }

    await sleep(getRandomWaitTime(2000, 3000));
  } catch (error: any) {
    console.error('Error in fbComment:', error.message);
    throw error;
  }
};

export default fbComment;
