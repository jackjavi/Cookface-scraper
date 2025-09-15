import {
  getNewYTSPage,
  getMultipleYTSPages,
  navigateToYouTube,
  createProxyBrowser,
  closeProxyBrowser,
  closeAllProxyBrowsers,
  getProxyCount,
  testAllProxies,
  visitBrowserPageLink,
} from './utils/browserManager';
import sleep from './utils/sleep';
import getRandomWaitTime from './utils/randomWaitTime';

// Example 1: Single YTS page with proxy
async function singlePageExample() {
  try {
    console.log('=== Single Page Example ===');

    const {page, browser, proxy} = await getNewYTSPage();
    console.log(`Created page with proxy: ${proxy}`);

    // Navigate to YouTube
    // await navigateToYouTube(page);
    await sleep(300000);

    // Do your scraping work here
    // await page.waitForSelector('input#search', {timeout: 10000});
    // console.log('YouTube loaded successfully!');

    // Clean up
    // await closeProxyBrowser(browser, proxy);
  } catch (error: any) {
    console.error('Single page example failed:', error.message);
  } finally {
    await sleep(100000);
  }
}

// Example 2: Multiple pages with different proxies
async function multiplePageExample() {
  try {
    console.log('=== Multiple Pages Example ===');

    const proxyCount = await getProxyCount();
    console.log(`Available proxies: ${proxyCount}`);

    // Create 3 pages with different proxies
    const pages = await getMultipleYTSPages(3);

    // Navigate all pages to YouTube in parallel
    const navigationPromises = pages.map(async ({page, browser, proxy}) => {
      try {
        await navigateToYouTube(page);
        console.log(`✅ YouTube loaded on proxy: ${proxy}`);
        return {page, browser, proxy, success: true};
      } catch (error) {
        console.error(`❌ Failed to load YouTube on proxy: ${proxy}`, error);
        return {page, browser, proxy, success: false};
      }
    });

    const results = await Promise.allSettled(navigationPromises);

    // Process results
    const successfulPages = results
      .filter(result => result.status === 'fulfilled' && result.value.success)
      .map(result => (result.status === 'fulfilled' ? result.value : null))
      .filter(Boolean);

    console.log(
      `✅ Successfully loaded ${successfulPages.length}/${pages.length} pages`,
    );

    // Do parallel scraping work here
    for (const pageData of successfulPages) {
      if (pageData) {
        try {
          // Example: Search for a video
          await pageData.page.type('input#search', 'puppeteer tutorial');
          await pageData.page.click('button#search-icon-legacy');
          await pageData.page.waitForSelector('ytd-video-renderer', {
            timeout: 10000,
          });
          console.log(`Search completed on proxy: ${pageData.proxy}`);
        } catch (error) {
          console.error(`Search failed on proxy: ${pageData.proxy}`, error);
        }
      }
    }

    // Clean up all browsers
    await closeAllProxyBrowsers();
  } catch (error) {
    console.error('Multiple pages example failed:', error);
  }
}

// Example 3: Test all proxies before use
async function testProxiesExample() {
  try {
    console.log('=== Testing All Proxies ===');

    const workingProxies = await testAllProxies();
    console.log('Working proxies:', workingProxies);

    if (workingProxies.length === 0) {
      console.log('❌ No working proxies found!');
      return;
    }

    console.log(
      `✅ Found ${workingProxies.length} working proxies. Proceeding with scraping...`,
    );
  } catch (error) {
    console.error('Proxy testing failed:', error);
  }
}

// Example 4: Visit specific links with proxy browsers
async function visitLinksExample() {
  try {
    console.log('=== Visit Links Example ===');

    const {browser, proxy} = await createProxyBrowser();

    const links = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/channel/UCJ0-OtVpF0wOKEqT2Z1HEtA',
      'https://www.youtube.com/results?search_query=puppeteer',
    ];

    for (const link of links) {
      try {
        const page = await visitBrowserPageLink(browser, link);
        console.log(`✅ Visited: ${link}`);

        // Do something with the page
        const title = await page.title();
        console.log(`Page title: ${title}`);

        await page.close();
      } catch (error) {
        console.error(`❌ Failed to visit ${link}:`, error);
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    await browser.close();
  } catch (error) {
    console.error('Visit links example failed:', error);
  }
}

// Example 5: Error handling and recovery
async function errorHandlingExample() {
  try {
    console.log('=== Error Handling Example ===');

    let retries = 3;
    let pageData = null;

    while (retries > 0 && !pageData) {
      try {
        pageData = await getNewYTSPage();
        console.log(
          `✅ Page created successfully with proxy: ${pageData.proxy}`,
        );
        break;
      } catch (error) {
        retries--;
        console.log(`❌ Attempt failed. Retries left: ${retries}`);

        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    if (!pageData) {
      throw new Error('Failed to create page after all retries');
    }

    // Use the page
    await navigateToYouTube(pageData.page);

    // Clean up
    await closeProxyBrowser(pageData.browser, pageData.proxy);
  } catch (error) {
    console.error('Error handling example failed:', error);
  }
}

// Main execution function
export async function runExamples() {
  console.log('🚀 Starting Native Proxy Browser Examples\n');

  // Run examples one by one
  await singlePageExample();
  await new Promise(resolve => setTimeout(resolve, 2000));

  await testProxiesExample();
  await new Promise(resolve => setTimeout(resolve, 2000));

  await multiplePageExample();
  await new Promise(resolve => setTimeout(resolve, 2000));

  await errorHandlingExample();

  console.log('\n✅ All examples completed!');
}

// Run if this file is executed directly
if (require.main === module) {
  // runExamples().catch(console.error);
  singlePageExample();
}
