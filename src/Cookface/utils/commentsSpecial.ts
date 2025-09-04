import GenerativeAIService from '../services/generativeAI.js';
import sleep from './sleep.js';
import {ElementHandle, Page} from 'puppeteer';
import {getRandomEngagementPhrase} from '../utils/x/engagementPhrasesReply.js';

const generativeAIService = new GenerativeAIService();

async function commentsSpecial(
  article: ElementHandle<HTMLElement>,
  page: Page,
) {
  try {
    // Open comments functionality
    const commentDiv = await article.$(
      'div.css-146c3p1[data-testid="tweetText"]',
    );
    if (commentDiv) {
      await commentDiv.click();
      console.log('Opened comments for an article.');
      await sleep(3000); // Wait for comments to load

      // Wait for the articles to load
      await page.waitForSelector(
        'article[role="article"][data-testid="tweet"]',
      );

      // Extract data from each comment
      const comments = await page.evaluate(() => {
        const articles = document.querySelectorAll(
          'article[role="article"][data-testid="tweet"]',
        );
        return Array.from(articles).map(article => {
          const user =
            (
              article.querySelector(
                '[data-testid="User-Name"] span',
              ) as HTMLElement
            )?.innerText || null;
          const content =
            (article.querySelector('[lang]') as HTMLElement)?.innerText || null;
          const timestamp =
            article.querySelector('time')?.getAttribute('datetime') || null;
          return {user, content, timestamp};
        });
      });

      if (comments.length > 0) {
        console.log('Extracted comments successfully.');
        const reply1 =
          'For social media automation and software development services, do not hesitate to contact us.🚂 https://youtu.be/dnY2p2whjk8?si=5yIJetxJtY0P1-jf';
        const reply2 =
          '🚂 Join our Telegram channel for uninterrupted news content https://t.me/tnk254';
        const reply3 =
          '🚂 Click the link to join our Telegram Football Channel - https://t.me/ebcsports';
        const reply4 = '🚂 https://youtu.be/EUWf0opisUg';

        // Get random engagement phrase instead of fixed reply5
        const reply5 = getRandomEngagementPhrase();

        const randomNumber = Math.random();

        let reply;
        if (randomNumber > 0.9) {
          reply = reply1;
        } else if (randomNumber > 0.8) {
          reply = reply2;
        } /* else if (randomNumber > 0.7) {
          reply = reply3;
        }*/ else {
          reply = reply5;
        }

        console.log('Generated reply:', reply);

        // Type the reply
        const replyBox = await page.$(
          'div.public-DraftEditorPlaceholder-root .public-DraftEditorPlaceholder-inner',
        );
        if (replyBox) {
          const placeholderText = await page.evaluate(
            element => (element as HTMLElement).innerText,
            replyBox,
          );

          if (placeholderText === 'Post your reply') {
            console.log('Reply box located. Typing reply...');
            await replyBox.click(); // Focus the reply box
            await page.keyboard.type(reply, {delay: 200}); // Type the reply
            console.log('Reply typed successfully.');
            await sleep(2400);

            // Click on the "Reply" button
            const replyButton = await page.$(
              'button[role="button"][data-testid="tweetButtonInline"]',
            );
            if (replyButton) {
              const buttonText = await page.evaluate(
                element => element.innerText,
                replyButton,
              );

              if (buttonText === 'Reply') {
                await replyButton.click(); // Click the Reply button
                console.log('Reply button clicked successfully.');
                await sleep(3000);

                // Locate and click the "Back" button
                const backButton = await page.$(
                  'button[aria-label="Back"][data-testid="app-bar-back"]',
                );
                if (backButton) {
                  await backButton.click(); // Go back to the previous screen
                  console.log('Back button clicked successfully.');
                } else {
                  console.log('Back button not found.');
                  return;
                }
              } else {
                console.log('Reply button not found with correct text.');
                return;
              }
            } else {
              console.log('Reply button not found.');
              return;
            }
          }
        } else {
          console.log('Reply box not found.');
          return;
        }
      }
    }
  } catch (error) {
    console.log('Error extracting comments or posting reply:', error);
    return;
  }
}

export default commentsSpecial;
