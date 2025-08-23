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

    // Step 2: Search for "others followed you" notification
    const foundFollowNotification = await page.evaluate(async () => {
      const sleep = (ms: any) => new Promise(res => setTimeout(res, ms));

      const timelineDiv = document.querySelector(
        'div[aria-label="Timeline: Notifications"].css-175oi2r',
      );

      if (!timelineDiv) {
        throw new Error(
          'Timeline with aria-label="Timeline: Notifications" not found.',
        );
      }

      const findOthersFollowedDiv = () => {
        const cellDivs = Array.from(
          timelineDiv.querySelectorAll(
            'div.css-175oi2r[data-testid="cellInnerDiv"]',
          ),
        );

        for (const cellDiv of cellDivs) {
          const spans = Array.from(cellDiv.querySelectorAll('span'));
          const targetSpan = spans.find(
            span =>
              span.innerText && span.innerText.includes(' others followed you'),
          );

          if (targetSpan) {
            return cellDiv; // Return the cellDiv that contains the target span
          }
        }
        return null;
      };

      let targetCellDiv = findOthersFollowedDiv();
      let scrollAttempts = 0;
      let previousHeight = document.body.scrollHeight;

      // Keep scrolling until we find the "others followed you" notification or reach max attempts
      while (!targetCellDiv && scrollAttempts < 10) {
        // Scroll down
        window.scrollTo(0, document.body.scrollHeight);
        await sleep(2000); // Wait for content to load

        // Check if new content loaded
        const newHeight = document.body.scrollHeight;
        if (newHeight === previousHeight) {
          console.log('No more content to load, breaking scroll loop.');
          break;
        }
        previousHeight = newHeight;

        // Search again in the new content
        targetCellDiv = findOthersFollowedDiv();
        scrollAttempts++;

        console.log(
          `Scroll attempt ${scrollAttempts}: ${targetCellDiv ? 'Found' : 'Not found'} "others followed you" notification`,
        );
      }

      if (targetCellDiv) {
        // Scroll the found element into view
        targetCellDiv.scrollIntoView({behavior: 'smooth', block: 'center'});
        await sleep(800);

        // Click on the span in the cellDiv to open the followers list
        const spans = Array.from(targetCellDiv.querySelectorAll('span'));
        const targetSpan = spans.find(
          span =>
            span.innerText && span.innerText.includes(' others followed you'),
        );

        targetSpan!.click();
        console.log('Clicked on "others followed you" notification');
        return true;
      } else {
        console.log(
          'Could not find "others followed you" notification after scrolling',
        );
        return false;
      }
    });

    if (!foundFollowNotification) {
      console.log(
        'No "others followed you" notification found. Exiting function.',
      );
      return;
    }

    await sleep(3000); // Wait for the followers list to load

    // Step 3: Locate and interact with the "Follow" or "Following" buttons
    const result = await page.evaluate(async () => {
      const sleep = (ms: any) => new Promise(res => setTimeout(res, ms));

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
      const maxCells = 10; // Process only the first 10 cells

      for (const cell of cellDivs.slice(0, maxCells)) {
        const span = cell.querySelector(
          'span.css-1jxf684.r-dnmrzs.r-1udh08x.r-3s2u2q.r-bcqeeo.r-1ttztb7.r-qvutc0.r-poiln3.r-1b43r93.r-1cwl3u0 > span.css-1jxf684.r-bcqeeo.r-1ttztb7.r-qvutc0.r-poiln3',
        );

        if (span && span instanceof HTMLElement) {
          if (span.innerText === 'Follow back') {
            span.click();
            actions.push("Clicked on a 'Follow back' button.");
          } else if (span.innerText === 'Follow') {
            span.click();
            actions.push("Clicked on a 'Follow' button.");
          } else if (span.innerText === 'Following') {
            actions.push("Skipped a 'Following' button.");
          } else {
            actions.push(`Found span with text: "${span.innerText}"`);
          }
        } else {
          actions.push('No matching span found inside the cell.');
        }

        await sleep(10000); // Sleep for 10 seconds between actions
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
