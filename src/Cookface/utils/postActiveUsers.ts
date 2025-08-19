import sleep from './sleep.js';
import retweetOwnPostAndComment from './retweetOwnPostAndComment.js';
import retweetOwnPostAndCommentSpecial from './retweetOwnPostAndCommentSpecial.js';
import getRandomWaitTime from './randomWaitTime.js';
import {Page} from 'puppeteer';

const postActiveUsers = async (
  label: string,
  page: Page,
  formattedString: string,
) => {
  const navSelector = 'nav[aria-label="Primary"] a';
  const placeholderSelector = '.public-DraftEditorPlaceholder-inner';
  const postButtonSelector = 'div[dir="ltr"] span.css-1jxf684 > span';

  try {
    // Step 3: Navigate to the specified label
    await page.evaluate(
      async (label, navSelector) => {
        const links = Array.from(document.querySelectorAll(navSelector));
        const targetLink = links.find(link =>
          link.getAttribute('aria-label')?.includes(label),
        );
        if (targetLink) (targetLink as HTMLElement).click();
        else throw new Error(`Link with label "${label}" not found`);
      },
      label,
      navSelector,
    );
    console.log(`Clicked on the "${label}" link successfully.`);
    await sleep(2000);

    // Step 4: Click on the placeholder with "What’s happening?" inner text
    const isPlaceholderClicked = await page.evaluate(
      async placeholderSelector => {
        const placeholder = document.querySelector(placeholderSelector);
        if (
          placeholder &&
          (placeholder as HTMLElement).innerText.trim() === 'What’s happening?'
        ) {
          (placeholder as HTMLElement).click();
          return true;
        }
        return false;
      },
      placeholderSelector,
    );

    if (!isPlaceholderClicked) {
      throw new Error(
        'Failed to find or click the placeholder with "What’s happening?" text.',
      );
    }

    console.log('Clicked on the "What’s happening?" placeholder successfully.');
    await sleep(2000);

    // Step 5: Type the randomly selected post into the editor
    await page.keyboard.type(formattedString, {delay: 200});
    console.log('Typed the message into the editor successfully.');
    await sleep(2000);

    // Step 6: Click the "Post" button
    const isPostClicked = await page.evaluate(async postButtonSelector => {
      const postButton = Array.from(
        document.querySelectorAll(postButtonSelector),
      ).find(span => (span as HTMLElement).innerText === 'Post');
      if (postButton) {
        (postButton as HTMLElement).click();
        return true;
      }
      return false;
    }, postButtonSelector);

    if (!isPostClicked) {
      throw new Error('Failed to find or click the "Post" button.');
    }

    console.log('Clicked on the "Post" button successfully.');
    const waitTime = getRandomWaitTime(2000, 6000);
    await sleep(waitTime);

    // Replace /n with a space
    formattedString = formattedString.replace(/\n/g, ' ');

    // Step 7: Randomly call one of the two functions
    const randomNumber = Math.random();
    console.log(`Random number generated: ${randomNumber}`);
    if (randomNumber < 0.05) {
      // Call the first function
      await retweetOwnPostAndComment(
        'Search and explore',
        page,
        formattedString,
      );
    } else {
      // Call the second function
      await retweetOwnPostAndCommentSpecial(
        'Search and explore',
        page,
        formattedString,
      );
    }
  } catch (err: any) {
    console.error(`Error in post function: ${err.message}`);
  }
};

export {postActiveUsers};
