import sleep from '../utils/sleep';
import {Page} from 'puppeteer';
import { getNewXPage, closePage } from '../utils/browserManager';

interface Trend {
  title: string;
  url: string;
}

interface Comment {
  user: string | null;
  content: string | null;
  timestamp: string | null;
}

async function fetchTweetTrends(label: string, trends: Trend[]) {
  const page = await getNewXPage();
  const navSelector = 'nav[aria-label="Primary"] a';

  function getRandomWaitTime(min: any, max: any) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getRandomPhrase() {
    const firstFiveTrends = trends.slice(0, 5);
    const randomTrend =
      firstFiveTrends[Math.floor(Math.random() * firstFiveTrends.length)];
    console.log(`Random Trend: ${randomTrend.title}`);
    return randomTrend.title;
  }

  try {
    // Step 1: Click the navigation link
    await page.evaluate(
      (label, navSelector) => {
        const links = Array.from(document.querySelectorAll(navSelector));
        const targetLink = links.find(link =>
          link.getAttribute('aria-label')?.includes(label),
        );
        if (targetLink instanceof HTMLElement) {
          targetLink.click();
        } else {
          throw new Error(`Link with label "${label}" not found`);
        }
      },
      label,
      navSelector,
    );
    console.log(`Clicked on the "${label}" link successfully.`);

    // Step 2: Search for a random phrase
    const searchInputSelector = 'input[data-testid="SearchBox_Search_Input"]';
    await page.waitForSelector(searchInputSelector);
    const randomPhrase = getRandomPhrase();
    await page.type(searchInputSelector, randomPhrase, {delay: 100});
    await page.keyboard.press('Enter');
    console.log(`Search initiated for "${randomPhrase}".`);

    await sleep(2000);

    // Reload the page
    // await page.reload({ waitUntil: "networkidle2" });
    // console.log("Page reloaded successfully.");

    // Wait for the articles to load
    await page.waitForSelector('article[role="article"][data-testid="tweet"]');

    const comments: Comment[] = [];
    let previousHeight = 0;

    while (comments.length < 15) {
      const newComments = await page.evaluate(() => {
        const articles = document.querySelectorAll(
          'article[role="article"][data-testid="tweet"]',
        );

        return Array.from(articles).map(article => {
          const userSpan = article.querySelector(
            '[data-testid="User-Name"] span',
          );
          const contentEl = article.querySelector('[lang]');
          const user =
            userSpan instanceof HTMLElement ? userSpan.innerText : null;
          const content =
            contentEl instanceof HTMLElement ? contentEl.innerText : null;
          const timestamp =
            article.querySelector('time')?.getAttribute('datetime') || null;
          return {user, content, timestamp};
        });
      });

      newComments.forEach(comment => {
        if (
          comments.length < 15 &&
          !comments.some(c => c.content === comment.content)
        ) {
          comments.push(comment);
        }
      });

      console.log(`Fetched ${comments.length} comments so far.`);

      if (comments.length >= 15) break;

      previousHeight = (await page.evaluate(
        () => document.body.scrollHeight,
      )) as number;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(3000);
      const newHeight = (await page.evaluate(
        () => document.body.scrollHeight,
      )) as number;

      if (newHeight === previousHeight) {
        console.log('No more new comments to load.');
        break;
      }
    }

    // console.log("Final comments:", comments);
    await sleep(1000);
    return {randomPhrase, comments};
  } catch (err: any) {
    console.error(`Error in fetchTweetTrends function: ${err.message}`);
    return {randomPhrase: null, comments: []};
  } finally {
    await closePage(page);
  }
}

export default fetchTweetTrends;
