import GenerativeAIService from '../services/generativeAI';
import sleep from './sleep';
import {ElementHandle, Page} from 'puppeteer';
import {Post} from '../types/Post';

const generativeAIService = new GenerativeAIService();

async function comments(article: ElementHandle, page: Page): Promise<void> {
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
          const userSpan = article.querySelector(
            '[data-testid="User-Name"] span',
          );
          const contentSpan = article.querySelector('[lang]');
          const timeTag = article.querySelector('time');

          const user = userSpan ? (userSpan as HTMLElement).innerText : null;
          const content = contentSpan
            ? (contentSpan as HTMLElement).innerText
            : null;
          const timestamp = timeTag ? timeTag.getAttribute('datetime') : null;

          return {user, content, timestamp};
        });
      });

      if (comments.length > 0) {
        console.log('Extracted comments successfully.');
        const reply = await generativeAIService.generateReply(
          comments as Post[],
        );
        console.log('Generated reply:', reply);

        // Type the reply
        const replyBox = await page.$(
          'div.public-DraftEditorPlaceholder-root .public-DraftEditorPlaceholder-inner',
        );
        if (replyBox) {
          const placeholderText = await page.evaluate(element => {
            return (element as HTMLElement).innerText.trim();
          }, replyBox);

          if (placeholderText === 'Post your reply') {
            console.log('Reply box located. Typing reply...');
            await replyBox.click(); // Focus the reply box
            await page.keyboard.type(reply, {delay: 200}); // Type the reply
            console.log('Reply typed successfully.');
            await sleep(1000);

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

export default comments;
