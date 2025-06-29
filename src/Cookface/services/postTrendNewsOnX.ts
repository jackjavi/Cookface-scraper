import sleep from '../utils/sleep';
import getRandomWaitTime from '../utils/randomWaitTime';
import { Page } from 'puppeteer';

/**
 * Posts trend news on X (formerly Twitter)
 * @param label The label to navigate to (e.g., 'Home')
 * @param page Puppeteer page instance
 * @param newsBite The news bite to post
 */
const postTrendNewsOnX = async (
  label: string,
  page: Page,
  newsBite: string,
) => {
  const navSelector = 'nav[aria-label="Primary"] a';
  const placeholderSelector = '.public-DraftEditorPlaceholder-inner';
  const postButtonSelector = 'div[dir="ltr"] span.css-1jxf684 > span';

  try {
    // Step 1: Navigate to the specified label
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

    // Reload the page
    await page.reload({ waitUntil: 'networkidle2' });
    console.log('Page reloaded successfully.');

    // Step 2: Click on the "What’s happening?" input
    const isPlaceholderClicked = await page.evaluate(placeholderSelector => {
      const placeholder = document.querySelector(
        placeholderSelector,
      ) as HTMLElement | null;

      if (placeholder && placeholder.innerText.trim() === 'What’s happening?') {
        placeholder.click();
        return true;
      }
      return false;
    }, placeholderSelector);

    if (!isPlaceholderClicked) {
      throw new Error(
        'Failed to find or click the placeholder with "What’s happening?" text.',
      );
    }

    console.log('Clicked on the "What’s happening?" placeholder successfully.');
    await sleep(2000);

    // Step 3: Type into the editor
    await page.keyboard.type(newsBite, { delay: 200 });
    console.log('Typed the message into the editor successfully.');
    await sleep(2000);

    // Step 4: Click the "Post" button
    const isPostClicked = await page.evaluate(postButtonSelector => {
      const postButton = Array.from(
        document.querySelectorAll(postButtonSelector),
      ).find(span => {
        const el = span as HTMLElement;
        return el.innerText === 'Post';
      });

      if (postButton) {
        postButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (postButton as HTMLElement).click();
        return true;
      }
      return false;
    }, postButtonSelector);

    if (!isPostClicked) {
      throw new Error('Failed to find or click the "Post" button.');
    }

    console.log('Clicked on the "Post" button successfully.');
    await sleep(getRandomWaitTime(3000, 5000));

  } catch (err: any) {
    console.error(`Error in postTrendNewsOnX: ${err.message}`);
  }
};

export { postTrendNewsOnX };
