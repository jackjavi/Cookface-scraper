import sleep from '../utils/sleep.js';
import {Page} from 'puppeteer';

const notifications = async (label: string, page: Page) => {
  const navSelector = 'nav[aria-label="Primary"] a';
  const articleSelector = 'article[data-testid="notification"]';

  try {
    // Step 1: Click the navigation link
    await page.evaluate(
      (label: string, navSelector: string) => {
        const links = Array.from(document.querySelectorAll(navSelector));
        const targetLink = links.find(link =>
          link.getAttribute('aria-label')?.includes(label),
        );
        if (targetLink instanceof HTMLElement) targetLink.click();
        else throw new Error(`Link with label "${label}" not found`);
      },
      label,
      navSelector,
    );
    console.log(`Clicked on the "${label}" link successfully.`);
    await sleep(2000);

    // Step 2: Scroll until a "followed you" notification is found and click it
    const foundFollowNotification = await page.evaluate(async () => {
      const sleep = (ms: any) => new Promise(res => setTimeout(res, ms));
      const scrollContainer =
        document.querySelector('[data-testid="primaryColumn"]') ||
        document.body;

      const findFollowSpan = () => {
        const articles = Array.from(
          document.querySelectorAll('article[data-testid="notification"]'),
        );
        for (const article of articles) {
          const span = Array.from(article.querySelectorAll('span')).find(el =>
            el.innerText?.toLowerCase().includes('followed you'),
          );
          if (span) return span;
        }
        return null;
      };

      let span = findFollowSpan();
      let scrollAttempts = 0;

      while (!span && scrollAttempts < 8) {
        scrollContainer.scrollBy(0, 800);
        await sleep(1200);
        span = findFollowSpan();
        scrollAttempts++;
      }

      if (span) {
        span.scrollIntoView({behavior: 'smooth', block: 'center'});
        await sleep(800);
        span.click();
        return true;
      }

      return false;
    });

    await sleep(2000);

    // Step 3: Locate and interact with the "Follow" or "Following" buttons
    const result = await page.evaluate(async () => {
      const timelineDiv = document.querySelector(
        'div[aria-label="Timeline: Followers"].css-175oi2r',
      );

      if (!timelineDiv) {
        throw new Error(
          'Timeline with aria-label="Timeline: Followers" not found.',
        );
      }

      const cellDivs = Array.from(
        timelineDiv.querySelectorAll(
          'div.css-175oi2r[data-testid="cellInnerDiv"]',
        ),
      );

      const actions = []; // For debugging actions taken
      const maxCells = 10; // Process only the first 5 cells

      for (const cell of cellDivs.slice(0, maxCells)) {
        const span = cell.querySelector(
          'span.css-1jxf684.r-dnmrzs.r-1udh08x.r-3s2u2q.r-bcqeeo.r-1ttztb7.r-qvutc0.r-poiln3.r-1b43r93.r-1cwl3u0 > span.css-1jxf684.r-bcqeeo.r-1ttztb7.r-qvutc0.r-poiln3',
        );

        if (span && span instanceof HTMLElement) {
          if (span.innerText === 'Follow back') {
            span.click();
            actions.push("Clicked on a 'Follow' button.");
          } else if (span.innerText === 'Following') {
            actions.push("Skipped a 'Following' button.");
          }
        } else {
          actions.push('No matching span found inside the cell.');
        }

        await new Promise(resolve => setTimeout(resolve, 10000)); // Sleep for 10 seconds
      }

      return actions; // Return the actions for debugging
    });

    // Log the results of the actions taken
    result.forEach(action => console.log(action));

    await sleep(2000);
  } catch (err: any) {
    console.error(`Error in notifications function: ${err.message}`);
    return;
  }
};

export default notifications;
