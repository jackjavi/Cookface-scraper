import sleep from '../utils/sleep';
import {Page} from 'puppeteer';
import GenerativeAIService from './generativeAI';
import * as fs from 'fs';

interface Trend {
  title: string;
  url: string;
}

interface Comment {
  user: string | null;
  content: string | null;
  timestamp: string | null;
}

async function fetchTweetTrends(
  label: string,
  trends: Trend[],
  page: Page,
): Promise<{
  randomPhrase: string | null;
  comments: Comment[];
}> {
  const navSelector = 'nav[aria-label="Primary"] a';
  const genAIService = new GenerativeAIService();

  function getRecentTrends(): string[] {
    const path = 'storage/usedTrends.json';
    if (!fs.existsSync(path)) return [];
    return JSON.parse(fs.readFileSync(path, 'utf-8')).slice(0, 7);
  }

  function getBestTitleFromTopTrends(): {
    title: string;
    index: number;
  } {
    const top10Trends = trends.slice(0, 10);
    const recentTrends = getRecentTrends();
    console.log(`Recent Trends:\t ${recentTrends}`);
    sleep(10000);

    // Loop through top10trends and find the first unused one
    for (let i = 0; i < top10Trends.length; i++) {
      const currentTrend = top10Trends[i];

      // Check if this trend is NOT in the recent trends list
      if (!recentTrends.includes(currentTrend.title)) {
        console.log(`Selected Trend: ${currentTrend.title}`);

        // Save the selected trend to file
        genAIService['saveTrendToFile'](currentTrend.title);

        return {
          title: currentTrend.title,
          index: i,
        };
      }
    }

    // If all top 10 trends have been used recently, return null or handle as needed
    console.log(
      'All top 10 trends have been used recently. Returning number 1 trend!',
    );
    return {
      title: top10Trends[0].title,
      index: 1,
    };
  }

  try {
    const selectedTrend = getBestTitleFromTopTrends();

    if (!selectedTrend) {
      console.log('No unused trend available. Skipping this execution.');
      return {randomPhrase: null, comments: []};
    }

    const selectedTitle = selectedTrend.title;

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

    const searchInputSelector = 'input[data-testid="SearchBox_Search_Input"]';
    await page.waitForSelector(searchInputSelector);
    await page.type(searchInputSelector, selectedTitle, {delay: 100});
    await page.keyboard.press('Enter');
    console.log(`Search initiated for "${selectedTitle}".`);

    await sleep(3000);

    // Wait for the "live" filter link and click
    const linkSelector = 'a[href*="&f=live"]';
    await page.waitForSelector(linkSelector);
    await page.click(linkSelector);
    console.log("Selected 'Live' filter.");
    await sleep(2000);

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

      previousHeight = await page.evaluate(() => document.body.scrollHeight);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(3000);
      const newHeight = await page.evaluate(() => document.body.scrollHeight);

      if (newHeight === previousHeight) {
        console.log('No more new comments to load.');
        break;
      }
    }

    await sleep(1000);
    return {randomPhrase: selectedTitle, comments};
  } catch (err: any) {
    console.error(`Error in fetchTweetTrends function: ${err.message}`);
    return {randomPhrase: null, comments: []};
  }
}

export default fetchTweetTrends;
