import sleep from '../utils/sleep.js';
import phrases from '../utils/gainPhrases.js';
import engagementPhrases from '../utils/engagementPhrases.js';
import {postActiveUsers} from '../utils/postActiveUsers.js';
import fs from 'fs/promises';
import config from '../config/index.js';
import {Page} from 'puppeteer';

async function tagActiveUsers(label: string, page: Page) {
  const navSelector = 'nav[aria-label="Primary"] a';

  function getRandomPhrase() {
    const randomIndex = Math.floor(Math.random() * phrases.length);
    return phrases[randomIndex];
  }

  function getRandomEngagementPhrase() {
    const randomIndex = Math.floor(Math.random() * engagementPhrases.length);
    return engagementPhrases[randomIndex];
  }

  try {
    // Step 1: Click the navigation link
    await page.evaluate(
      async (label, navSelector) => {
        const links = Array.from(document.querySelectorAll(navSelector));
        const targetLink = links.find(
          link => link.getAttribute('aria-label') === label,
        );
        if (targetLink) (targetLink as HTMLElement).click();
        else throw new Error(`Link with label "${label}" not found`);
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

    // Wait for the articles to load
    await page.waitForSelector('article[role="article"][data-testid="tweet"]');

    // Wait and click on the "Latest" tab with 'live' in href
    await page.evaluate(() => {
      const liveTab = Array.from(
        document.querySelectorAll('a[href*="live"]'),
      ).find(
        a =>
          a.getAttribute('href')?.includes('live') &&
          a.getAttribute('role') === 'tab',
      );
      if (liveTab) {
        (liveTab as HTMLElement).click();
      } else {
        throw new Error('Could not find the "Live" tab link.');
      }
    });
    console.log('Clicked on the "Live" tab after reload.');
    await sleep(2000); // Allow content to load

    // Reload the page
    await page.reload({waitUntil: 'networkidle2'});
    console.log('Page reloaded successfully.');

    const activeUsers: {user: string}[] = [];
    let previousHeight = 0;

    while (activeUsers.length < 20) {
      // Extract active users visible on the page
      const newActiveUsers = await page.evaluate(() => {
        const articles = document.querySelectorAll(
          'article[role="article"][data-testid="tweet"]',
        );
        return Array.from(articles).map(article => {
          const user = Array.from(
            article.querySelectorAll('[data-testid="User-Name"] span'),
          ).find(span => (span as HTMLElement).innerText.trim().startsWith('@'))
            ? (
                Array.from(
                  article.querySelectorAll('[data-testid="User-Name"] span'),
                ).find(span =>
                  (span as HTMLElement).innerText.trim().startsWith('@'),
                ) as HTMLElement
              ).innerText
            : null;
          return {user};
        });
      });

      // Add unique users to the activeUsers array
      newActiveUsers.forEach(user => {
        if (
          user.user !== null &&
          !activeUsers.some(existingUser => existingUser.user === user.user)
        ) {
          activeUsers.push({user: user.user});
        }
      });

      // Break if we've fetched enough users
      if (activeUsers.length >= 20) {
        break;
      }

      // Scroll to load more articles
      previousHeight = (await page.evaluate(
        'document.body.scrollHeight',
      )) as number;
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await sleep(3000); // Wait for new comments to load
      const newHeight = await page.evaluate('document.body.scrollHeight');

      if (newHeight === previousHeight) {
        console.log('No more new comments to load.');
        break;
      }
    }

    console.log(`Fetched ${activeUsers.length} active users so far.`);
    // Remove the last 5 users from the list
    // activeUsers.splice(-5);

    await sleep(1000);
    // Add @life_meth_money and @node_brogrammer to the list of active users

    // activeUsers.push({ user: '@life_meth_money' });
    const rawData = await fs.readFile(config.savedTweeps, 'utf8');
    const savedTweeps = JSON.parse(rawData);

    // Only get 6 users from savedTweeps and push to activeUsers
    const selectedTweeps = savedTweeps
      .sort(() => Math.random() - 0.5)
      .slice(0, 10);
    activeUsers.push(...selectedTweeps);

    // Randomize the order of active users and select the first 17 users if more than 17 users are found
    activeUsers.sort(() => Math.random() - 0.5);
    activeUsers.splice(13);
    // vary the number of users to tag btwn 5 and 10 so instead of
    // activeUsers.splice(15);
    // we can do something like this
    // const numberOfUsersToTag = Math.floor(Math.random() * 6) + 5; // Randomly choose between 5 and 10 users
    // if (activeUsers.length > numberOfUsersToTag) {
    //   activeUsers.splice(numberOfUsersToTag);
    // }

    // activeUsers.push({ user: '@KVistoh' }, { user: '@wrdonthestrit' }, { user: '@celebishere' }, { user: '@DavidPolycap' }, { user: '@mekky_ayo' }, { user: '@Eliaskaneke' },);
    activeUsers.push({user: '@TnkTrending'});
    activeUsers.sort(() => Math.random() - 0.5);
    const randomEngagementPhrase = getRandomEngagementPhrase();
    const formattedString =
      `${randomEngagementPhrase}\n\n` +
      '@life_meth_money\n\n' +
      activeUsers.map(({user}) => user).join('\n\n');

    await sleep(1000);
    await postActiveUsers('Home', page, formattedString);
    return;
  } catch (err: any) {
    console.error(`Error in fetchTweetTrends function: ${err.message}`);
    return null;
  }
}

export default tagActiveUsers;
