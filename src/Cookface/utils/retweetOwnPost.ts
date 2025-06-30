import likeComments from './likes';
import {Page} from 'puppeteer';

async function retweetOwnPost(
  label: string,
  page: Page,
  randomPhrase: string,
): Promise<void> {
  const navSelector = 'nav[aria-label="Primary"] a';

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* function getRandomPhrase() {
    const randomIndex = Math.floor(Math.random() * phrases.length);
    return phrases[randomIndex];
  } */

  try {
    // Step 1: Click the navigation link
    await page.evaluate(
      async (label, navSelector) => {
        const links = Array.from(document.querySelectorAll(navSelector));
        const targetLink = links.find(
          link => link.getAttribute('aria-label') === label,
        );
        if (targetLink instanceof HTMLElement) targetLink.click();
        else throw new Error(`Link with label "${label}" not found`);
      },
      label,
      navSelector,
    );
    console.log(`Clicked on the "${label}" link successfully.`);

    // Step 2: Search for a random phrase
    const searchInputSelector = 'input[data-testid="SearchBox_Search_Input"]';
    await page.waitForSelector(searchInputSelector);
    // const randomPhrase = getRandomPhrase();
    await page.type(searchInputSelector, randomPhrase, {delay: 50});
    await page.keyboard.press('Enter');
    console.log(`Search initiated for "${randomPhrase}".`);

    // Step 3: Wait for the "live" filter link and click
    const linkSelector = 'a[href*="&f=live"]';
    await page.waitForSelector(linkSelector);
    await page.click(linkSelector);
    console.log("Selected 'Live' filter.");

    await sleep(2000);

    // Reload the page
    // await page.reload({ waitUntil: "networkidle2" });
    // console.log("Page reloaded successfully.");

    // await sleep(2000);

    let articlesProcessed = 0;
    let previousHeight;

    while (articlesProcessed < 2) {
      // Limit to process 50 articles for example
      // Get visible articles

      const articles = await page.$$('article');

      for (const article of articles) {
        try {
          // Locate the retweet button within the article
          const retweetButton = await article.$('[data-testid="retweet"]');
          if (retweetButton) {
            // Extract the aria-label attribute
            const ariaLabel = await page.evaluate(
              button => button.getAttribute('aria-label'),
              retweetButton,
            );

            if (ariaLabel) {
              // Extract the repost count from the aria-label string
              const repostCountMatch = ariaLabel.match(/^(\d+)\sreposts/);
              const repostCount = repostCountMatch
                ? parseInt(repostCountMatch[1], 10)
                : 0;

              console.log(`Repost count: ${repostCount}`);

              // Retweet the article
              console.log(`Retweeting article. Repost count: ${repostCount}`);
              await retweetButton.click();
              await sleep(2000); // Wait for retweet modal to appear

              // Confirm the retweet action
              const confirmButton = await page.$(
                '[data-testid="retweetConfirm"]',
              );
              if (confirmButton) {
                await confirmButton.click();
                console.log('Retweet confirmed.');
              } else {
                console.log('Retweet confirmation button not found.');
              }

              await likeComments(article, page);

              // Generate a random wait time between 30 and 45 seconds
              // const waitTime = getRandomWaitTime(60000, 90000);
              // await sleep(waitTime);
            } else {
              console.log('Aria-label not found. Skipping article.');
              continue;
            }
          }
          articlesProcessed++;
          console.log(`Processed ${articlesProcessed} articles.`);
          if (articlesProcessed >= 1) return;
        } catch (error) {
          console.log('Error interacting with article:', error);
          return;
        }
      }

      // Scroll to load more articles
      previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await sleep(3000); // Wait for new articles to load
      const newHeight = await page.evaluate('document.body.scrollHeight');

      if (newHeight === previousHeight) {
        console.log('No more new articles.');
        break;
      }
    }
  } catch (err: any) {
    console.error(`Error in explore function: ${err.message}`);
    return;
  }
}

export default retweetOwnPost;
