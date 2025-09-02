import {Page} from 'puppeteer';
import sleep from '../../utils/sleep';

export type NavigationDirection = 'up' | 'down';

export interface NavigationOptions {
  direction?: NavigationDirection;
  delay?: number;
}

/**
 * Navigate to the next or previous article using TikTok's navigation buttons
 * @param page - Puppeteer Page instance
 * @param options - Navigation options including direction and delay
 * @returns Promise<boolean> - Success status
 */
export async function navigateArticle(
  page: Page,
  options: NavigationOptions = {},
): Promise<boolean> {
  const {direction = 'down', delay = 1000} = options;

  try {
    console.log(`🧭 Navigating ${direction}`);

    // Find the main content container
    /** const mainElement = await page.$(
      '#main-content-homepage_hot.css-p8ufe6-5e6d46e3--DivMainContainer.e14hpjes0',
    );
    if (!mainElement) {
      console.log('❌ Main content element not found');
      return false;
    } */

    // Find the aside navigation container
    const asideElement = await page.$(
      'aside.css-1oaoh7-5e6d46e3--AsideOneColumnSidebar.e1xmvfos0',
    );
    if (!asideElement) {
      console.log('❌ Navigation aside element not found');
      return false;
    }

    // Find the navigation container
    const navContainer = await asideElement.$(
      '.css-6fqno5-5e6d46e3--DivFeedNavigationContainer.e87f1nv0',
    );
    if (!navContainer) {
      console.log('❌ Navigation container not found');
      return false;
    }

    // Get all navigation buttons
    const navButtons = await navContainer.$$('button.TUXButton');
    if (navButtons.length < 2) {
      console.log('❌ Navigation buttons not found or insufficient');
      return false;
    }

    // Select button based on direction
    // First button (index 0) = up/previous
    // Second button (index 1) = down/next
    const buttonIndex = direction === 'up' ? 0 : 1;
    const targetButton = navButtons[buttonIndex];

    // Check if button is disabled
    const isDisabled = await page.evaluate(button => {
      return (
        button.getAttribute('aria-disabled') === 'true' ||
        button.hasAttribute('disabled')
      );
    }, targetButton);

    if (isDisabled) {
      console.log(`⚠️ Navigation button (${direction}) is disabled`);
      return false;
    }

    // Click the navigation button
    await targetButton.click();
    console.log(`✅ Successfully clicked ${direction} navigation button`);

    // Wait for navigation to complete
    await sleep(delay);

    return true;
  } catch (error) {
    console.error(`❌ Error navigating ${direction}:`, error);
    return false;
  }
}

/**
 * Navigate to the next article (scroll down)
 * @param page - Puppeteer Page instance
 * @param delay - Optional delay after navigation
 * @returns Promise<boolean> - Success status
 */
export async function navigateToNextArticle(
  page: Page,
  delay: number = 1000,
): Promise<boolean> {
  return navigateArticle(page, {direction: 'down', delay});
}

/**
 * Navigate to the previous article (scroll up)
 * @param page - Puppeteer Page instance
 * @param delay - Optional delay after navigation
 * @returns Promise<boolean> - Success status
 */
export async function navigateToPreviousArticle(
  page: Page,
  delay: number = 1000,
): Promise<boolean> {
  return navigateArticle(page, {direction: 'up', delay});
}
