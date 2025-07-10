import sleep from './sleep';
import getRandomWaitTime from './randomWaitTime';
import {ElementHandle, Page} from 'puppeteer';

async function likeComments(article: ElementHandle, page: Page): Promise<void> {
  try {
    // Open comments functionality
    const commentDiv = await article.$(
      'div.css-146c3p1[data-testid="tweetText"]',
    );
    if (commentDiv) {
      await commentDiv.click();
      console.log('Opened comments for the article.');

      // Wait for the comment section to load articles
      await page.waitForSelector(
        'article[role="article"][data-testid="tweet"]',
      );
    } else {
      console.log('No comments section found for the article.');
      return;
    }

    await sleep(2000);

    // Find all article tags within the comments section
    const commentArticles = await page.$$(
      'article[role="article"][data-testid="tweet"]',
    );

    let likesClicked = 0;

    for (const commentArticle of commentArticles) {
      try {
        // Find the like button within each article
        const likeButton = await commentArticle.$('button[data-testid="like"]');
        if (likeButton) {
          const ariaLabel = await page.evaluate(
            button => button.getAttribute('aria-label') || '',
            likeButton,
          );

          // Click the like button if it's a "Like" button
          if (ariaLabel.includes('Like')) {
            await likeButton.click();
            likesClicked++;
            console.log(`Liked a comment. Total likes so far: ${likesClicked}`);
            if (likesClicked >= 15) {
              return;
            }
          }
          const rtime = await getRandomWaitTime(1000, 6000);
          await sleep(rtime);
        }
      } catch (error) {
        console.log('Error interacting with a comment article:', error);
        continue;
      }
    }

    console.log(`Liked ${likesClicked} comments successfully.`);

    // Close the comment section (optional)
    const backButton = await page.$('[aria-label="Back"]');
    if (backButton) {
      await backButton.click();
      console.log('Closed the comment section.');
    }
  } catch (error) {
    console.error('Error while liking comments:', error);
  }
}

export default likeComments;
