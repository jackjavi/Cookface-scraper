import {Page} from 'puppeteer';
import sleep from '../sleep';

// TikTok navigation routes configuration
export const TIKTOK_ROUTES = {
  HOME: '/',
  EXPLORE: '/explore',
  FOLLOWING: '/following',
  FRIENDS: '/friends',
  MESSAGES: '/messages',
  LIVE: '/live',
  UPLOAD: '/tiktokstudio/upload?from=webapp',
  PROFILE: (username: string) => `/@${username}`,
} as const;

// Route labels for documentation and logging
export const ROUTE_LABELS = {
  '/': 'Home',
  '/explore': 'Explore',
  '/following': 'Following',
  '/friends': 'Friends',
  '/messages': 'Messages',
  '/live': 'Live',
  '/tiktokstudio/upload?from=webapp': 'Upload',
} as const;

/**
 * Navigate to a specific TikTok page using the sidebar navigation
 * @param page - The Puppeteer page instance
 * @param targetHref - The href value to navigate to
 * @param config - Configuration object containing TikTok username if needed
 * @returns Promise<boolean> - Success status of navigation
 */
export async function navigateToTikTokPage(
  page: Page,
  targetHref: string,
  config?: {TikTokUsername?: string},
): Promise<boolean> {
  try {
    console.log(`🔍 Navigating to TikTok page: ${targetHref}`);

    // Handle profile route dynamically
    let actualHref = targetHref;
    if (targetHref.startsWith('/@') && config?.TikTokUsername) {
      actualHref = `/@${config.TikTokUsername}`;
    }

    // Wait for the main navigation container
    await page.waitForSelector(
      '.css-1ymoeiy-5e6d46e3--DivMainNavContainer.e1s4651v4',
      {
        timeout: 10000,
      },
    );

    console.log('✅ Main navigation container found');

    // Find the navigation container
    const navContainer = await page.$(
      '.css-1ymoeiy-5e6d46e3--DivMainNavContainer.e1s4651v4',
    );
    if (!navContainer) {
      console.log('❌ Navigation container not found');
      return false;
    }

    // First, look for upload button in TUXTooltip-reference divs
    if (actualHref === TIKTOK_ROUTES.UPLOAD) {
      const uploadSuccess = await handleUploadNavigation(
        page,
        navContainer,
        actualHref,
      );
      if (uploadSuccess) {
        return true;
      }
    }

    // Find all h2 elements within the navigation container for regular navigation
    const h2Elements = await navContainer.$$('h2');
    console.log(`📝 Found ${h2Elements.length} h2 navigation items`);

    // Look for the matching href in h2 > a elements
    for (let i = 0; i < h2Elements.length; i++) {
      const h2Element = h2Elements[i];

      // Find the anchor tag within this h2
      const anchorElement = await h2Element.$('a');
      if (!anchorElement) {
        continue;
      }

      // Get the href attribute
      const href = await page.evaluate(
        el => el.getAttribute('href'),
        anchorElement,
      );

      if (href === actualHref) {
        // Get the route label for logging
        const routeLabel = getRouteLabel(actualHref);
        console.log(
          `🎯 Found matching navigation link: ${routeLabel} (${actualHref})`,
        );

        // Click the anchor element
        await anchorElement.click();
        console.log(`✅ Successfully clicked ${routeLabel} navigation link`);

        // Wait a moment for navigation to start
        await sleep(2000);

        return true;
      }
    }

    // If no matching h2 > a found, try direct navigation buttons (for items not in h2)
    const directButtons = await navContainer.$$('button[aria-label]');
    for (const button of directButtons) {
      const ariaLabel = await page.evaluate(
        el => el.getAttribute('aria-label'),
        button,
      );

      // Handle special cases like notifications, profile buttons, etc.
      if (shouldClickDirectButton(ariaLabel, actualHref)) {
        console.log(`🎯 Found matching direct button: ${ariaLabel}`);
        await button.click();
        console.log(`✅ Successfully clicked ${ariaLabel} button`);
        await sleep(2000);
        return true;
      }
    }

    console.log(`❌ No navigation link found for href: ${actualHref}`);
    return false;
  } catch (error) {
    console.error('❌ Error in navigateToTikTokPage:', error);
    return false;
  }
}

/**
 * Handle navigation to upload page using TUXTooltip-reference structure
 * @param page - The Puppeteer page instance
 * @param navContainer - The navigation container element
 * @param targetHref - The target href for upload
 * @returns Promise<boolean> - Success status
 */
async function handleUploadNavigation(
  page: Page,
  navContainer: any,
  targetHref: string,
): Promise<boolean> {
  try {
    console.log('🔍 Looking for upload button in TUXTooltip-reference divs...');

    // Find all TUXTooltip-reference divs within the navigation container
    const tooltipDivs = await navContainer.$$('.TUXTooltip-reference');
    console.log(`📝 Found ${tooltipDivs.length} TUXTooltip-reference elements`);

    for (const tooltipDiv of tooltipDivs) {
      // Look for anchor tag with data-e2e="nav-upload" or matching href
      const anchorElement = await tooltipDiv.$('a[data-e2e="nav-upload"]');
      if (!anchorElement) {
        // Fallback: check any anchor with matching href
        const anyAnchor = await tooltipDiv.$('a');
        if (anyAnchor) {
          const href = await page.evaluate(
            el => el.getAttribute('href'),
            anyAnchor,
          );
          if (href === targetHref) {
            console.log(
              `🎯 Found matching upload link via href: ${targetHref}`,
            );
            await anyAnchor.click();
            console.log('✅ Successfully clicked upload navigation link');
            await sleep(2000);
            return true;
          }
        }
        continue;
      }

      // Verify this is the upload button by checking href
      const href = await page.evaluate(
        el => el.getAttribute('href'),
        anchorElement,
      );

      if (href === targetHref) {
        console.log(
          `🎯 Found upload button with data-e2e="nav-upload": ${targetHref}`,
        );
        await anchorElement.click();
        console.log('✅ Successfully clicked upload navigation link');
        await sleep(2000);
        return true;
      }
    }

    console.log('❌ Upload button not found in TUXTooltip-reference divs');
    return false;
  } catch (error) {
    console.error('❌ Error in handleUploadNavigation:', error);
    return false;
  }
}

/**
 * Navigate back to previous page using browser history
 * @param page - The Puppeteer page instance
 * @returns Promise<boolean> - Success status of navigation
 */
export async function navigateToPreviousPage(page: Page): Promise<boolean> {
  try {
    console.log('🔙 Navigating back to previous page using browser history...');

    // Use browser's back functionality
    await page.goBack({waitUntil: 'networkidle2', timeout: 15000});

    console.log('✅ Successfully navigated back to previous page');
    await sleep(2000);

    return true;
  } catch (error) {
    console.error('❌ Error navigating back:', error);
    return false;
  }
}

/**
 * Navigate back to home page (fallback method)
 * @param page - The Puppeteer page instance
 * @returns Promise<boolean> - Success status of navigation
 */
export async function navigateToHomeDirectly(page: Page): Promise<boolean> {
  try {
    console.log('🏠 Navigating directly to home page...');

    await page.goto('https://www.tiktok.com/', {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    console.log('✅ Successfully navigated to home page directly');
    await sleep(2000);

    return true;
  } catch (error) {
    console.error('❌ Error navigating to home directly:', error);
    return false;
  }
}

/**
 * Get a human-readable label for a route
 * @param href - The href value
 * @returns The route label
 */
function getRouteLabel(href: string): string {
  // Handle profile routes
  if (href.startsWith('/@')) {
    return `Profile (${href})`;
  }

  // Return predefined label or the href itself
  return (ROUTE_LABELS as any)[href] || href;
}

/**
 * Determine if a direct button should be clicked based on aria-label and target href
 * @param ariaLabel - The button's aria-label
 * @param targetHref - The target href we're looking for
 * @returns Whether this button matches our target
 */
function shouldClickDirectButton(
  ariaLabel: string | null,
  targetHref: string,
): boolean {
  if (!ariaLabel) return false;

  const lowerLabel = ariaLabel.toLowerCase();

  // Handle special navigation cases that might not be in h2 > a structure
  if (targetHref === '/notifications' && lowerLabel.includes('notifications')) {
    return true;
  }

  // Add more special cases as needed
  return false;
}

/**
 * Utility function to navigate to Home page
 * @param page - The Puppeteer page instance
 * @returns Promise<boolean>
 */
export async function navigateToHome(page: Page): Promise<boolean> {
  return navigateToTikTokPage(page, TIKTOK_ROUTES.HOME);
}

/**
 * Utility function to navigate to Explore page
 * @param page - The Puppeteer page instance
 * @returns Promise<boolean>
 */
export async function navigateToExplore(page: Page): Promise<boolean> {
  return navigateToTikTokPage(page, TIKTOK_ROUTES.EXPLORE);
}

/**
 * Utility function to navigate to Following page
 * @param page - The Puppeteer page instance
 * @returns Promise<boolean>
 */
export async function navigateToFollowing(page: Page): Promise<boolean> {
  return navigateToTikTokPage(page, TIKTOK_ROUTES.FOLLOWING);
}

/**
 * Utility function to navigate to Profile page
 * @param page - The Puppeteer page instance
 * @param username - TikTok username
 * @returns Promise<boolean>
 */
export async function navigateToProfile(
  page: Page,
  username: string,
): Promise<boolean> {
  return navigateToTikTokPage(page, TIKTOK_ROUTES.PROFILE(username));
}
