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
    const path = './usedTrends.json';
    if (!fs.existsSync(path)) return [];
    return JSON.parse(fs.readFileSync(path, 'utf-8')).slice(0, 8);
  }

  async function getBestTitleFromTopTrends(): Promise<{
    title: string;
    index: number;
  }> {
    const top10Trends = trends.slice(0, 15);
    const recentTrends = getRecentTrends();

    const prompt = `
You are an expert at spotting the best trending topic to write about on social media in Kenya. 

Below are 15 trending topics:
${top10Trends.map((t, i) => `${i + 1}. ${t.title}`).join('\n')}

Avoid these recent trends: ${recentTrends.join(', ') || 'None'}.

Rules:
- Ignore titles that are promotional, branded, religious, or previously used (see list).
- Choose the most engaging, newsworthy, or viral-friendly title for mass audience content.
- Your job is to pick **only one** from the list.

Now reply ONLY with the number (1–15) of the trend you recommend. No explanation.`;

    const result = await genAIService['model'].generateContent(prompt);
    const response = await result.response;
    const answer = response.text().trim();
    const chosenIndex = parseInt(answer) - 1;

    if (
      isNaN(chosenIndex) ||
      chosenIndex < 0 ||
      chosenIndex >= top10Trends.length
    ) {
      throw new Error(`Invalid trend selection index: ${answer}`);
    }

    const selected = top10Trends[chosenIndex];
    genAIService['saveTrendToFile'](selected.title);
    console.log(`Selected Trend: ${selected.title}`);
    return {title: selected.title, index: chosenIndex};
  }

  try {
    const {title: selectedTitle} = await getBestTitleFromTopTrends();

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

    await sleep(2000);
    // Wait for the "live" filter link and click
    const linkSelector = 'a[href*="&f=live"]';
    await page.waitForSelector(linkSelector);
    await page.click(linkSelector);
    console.log("Selected 'Live' filter.");

    const searchInputSelector = 'input[data-testid="SearchBox_Search_Input"]';
    await page.waitForSelector(searchInputSelector);
    await page.type(searchInputSelector, selectedTitle, {delay: 100});
    await page.keyboard.press('Enter');
    console.log(`Search initiated for "${selectedTitle}".`);

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
