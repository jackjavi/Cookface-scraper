import {Page} from 'puppeteer';
import sleep from '../sleep';
import getRandomWaitTime from '../randomWaitTime';

/**
 * Switches Facebook page to personal profile if currently on page profile
 * @param page Puppeteer page instance
 */
export const SwitchToProfile = async (page: Page): Promise<void> => {
  try {
    console.log('Starting page to profile switch process...');

    // Step 1: Search for the timeline link
    const timelineLink = await page.$('a[aria-label*="timeline"][role="link"]');

    if (!timelineLink) {
      console.log('No timeline link found - may already be on correct page');
      return;
    }

    // Get the aria-label value
    const ariaLabel = await timelineLink.evaluate(el =>
      el.getAttribute('aria-label'),
    );
    console.log(`Found timeline link: ${ariaLabel}`);

    // Step 2: Check if we're on Trending News KENYA's timeline
    if (ariaLabel === "Trending News KENYA's timeline") {
      console.log(
        'Currently on Trending News KENYA timeline, switching to personal profile...',
      );

      // Locate and click the profile SVG
      const profileSvg = await page.$(
        'svg[aria-label="Your profile"][class="x3ajldb"][data-visualcompletion="ignore-dynamic"][role="img"]',
      );

      if (!profileSvg) {
        throw new Error('Could not find profile SVG element');
      }

      console.log('Clicking profile SVG...');
      await profileSvg.click();
      await sleep(2000);

      // Step 3: Use Tab key to highlight switch option and press Enter
      console.log('Using Tab key to switch to Jack Javi...');
      await page.keyboard.press('Tab');
      await sleep(1000);
      await page.keyboard.press('Enter');
      await sleep(3000);

      // Step 4: Handle potential unsaved changes popup
      await handleUnsavedChangesPopup(page);

      console.log('Successfully switched to Jack Javi personal profile');
    } else if (ariaLabel === "Jack Javi's timeline") {
      console.log('Already on Jack Javi timeline - no switch needed');
    } else {
      console.log(`Unknown timeline detected: ${ariaLabel}`);
    }
  } catch (error: any) {
    console.error('Error in SwitchToProfile:', error.message);
    // Don't throw - continue with the process even if switch fails
  }
};

/**
 * Handles the "Changes you made may not be saved" popup
 * @param page Puppeteer page instance
 */
const handleUnsavedChangesPopup = async (page: Page): Promise<void> => {
  try {
    // Wait a bit for potential popup to appear
    await sleep(2000);

    // Check for unsaved changes text
    const hasUnsavedChanges = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.some(
        el =>
          el.textContent &&
          el.textContent.includes('Changes you made may not be saved.'),
      );
    });

    if (hasUnsavedChanges) {
      console.log('Detected unsaved changes popup, pressing Enter...');
      await page.keyboard.press('Enter');
      await sleep(2000);
      console.log('Handled unsaved changes popup');
    }
  } catch (error) {
    console.log('No unsaved changes popup detected or error handling it');
  }
};
