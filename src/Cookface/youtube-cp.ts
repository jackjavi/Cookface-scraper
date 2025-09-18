import {
  getNewYTSPage,
  getMultipleYTSPages,
  navigateToYouTube,
  navigateToYouTubeURL,
  createProxyBrowser,
  closeProxyBrowser,
  closeAllProxyBrowsers,
  getProxyCount,
  testAllProxies,
  visitBrowserPageLink,
  // New working proxy methods
  getNewWorkingYTSPage,
  getFastestYTSPage,
  getMultipleWorkingYTSPages,
  createWorkingProxyBrowser,
  createFastestProxyBrowser,
  getWorkingProxyCount,
  getWorkingProxies,
} from './utils/browserManager';
import sleep from './utils/sleep';
import getRandomWaitTime from './utils/randomWaitTime';

// Enhanced Example 1: Single page with working proxy
async function workingProxySinglePageExample() {
  try {
    console.log('=== Working Proxy Single Page Example ===');

    // Check if we have working proxies
    const workingProxyCount = await getWorkingProxyCount();
    console.log(`Available working proxies: ${workingProxyCount}`);

    if (workingProxyCount === 0) {
      console.log(
        '❌ No working proxies available! Please run proxy testing first.',
      );
      console.log('💡 Run: npm run proxy-fetch-test');
      return;
    }

    // Use working proxy
    const {page, browser, proxy} = await getNewWorkingYTSPage();
    console.log(`✅ Created page with working proxy: ${proxy}`);

    // Navigate to YouTube with enhanced method
    await navigateToYouTube(page);

    // Example: Search for content
    try {
      await page.waitForSelector('input#search', {timeout: 15000});
      await page.type('input#search', 'web scraping tutorial');
      await page.click('button#search-icon-legacy');

      // Wait for results to load
      await page.waitForSelector('ytd-video-renderer', {timeout: 20000});
      console.log('✅ Search completed successfully with working proxy');

      // Get some video titles as proof it's working
      const videoTitles = await page.$$eval('a#video-title', elements =>
        elements
          .slice(0, 3)
          .map(el => el.textContent?.trim())
          .filter(Boolean),
      );

      console.log('Found videos:', videoTitles);
    } catch (searchError) {
      console.log('Search failed, but page loaded successfully:', searchError);
    }

    // Keep browser open for demonstration
    await sleep(10000);

    // Clean up
    await closeProxyBrowser(browser, proxy);
  } catch (error: any) {
    console.error('Working proxy example failed:', error.message);
  }
}

// Enhanced Example 2: Fastest proxy for performance-critical operations
async function fastestProxyExample() {
  try {
    console.log('=== Fastest Proxy Example ===');

    const workingProxies = await getWorkingProxies();
    if (workingProxies.length === 0) {
      console.log('No working proxies available. Run proxy testing first.');
      return;
    }

    console.log(
      `Using fastest proxy from ${workingProxies.length} working options`,
    );

    const {page, browser, proxy} = await getFastestYTSPage();
    console.log(`Created page with fastest proxy: ${proxy}`);

    // Navigate to specific YouTube URL
    await navigateToYouTubeURL(
      page,
      'https://www.youtube.com/results?search_query=nodejs+tutorial',
    );

    // Measure performance
    const startTime = Date.now();
    await page.waitForSelector('ytd-video-renderer', {timeout: 30000});
    const loadTime = Date.now() - startTime;

    console.log(`Page loaded in ${loadTime}ms with fastest proxy`);

    // Clean up
    await closeProxyBrowser(browser, proxy);
  } catch (error: any) {
    console.error('Fastest proxy example failed:', error.message);
  }
}

// Enhanced Example 3: Multiple working proxies for parallel operations
async function multipleWorkingProxiesExample() {
  try {
    console.log('=== Multiple Working Proxies Example ===');

    const workingProxyCount = await getWorkingProxyCount();
    console.log(`Available working proxies: ${workingProxyCount}`);

    if (workingProxyCount < 2) {
      console.log(
        'Need at least 2 working proxies for this example. Run proxy testing first.',
      );
      return;
    }

    // Create multiple pages with working proxies
    const pageCount = Math.min(3, workingProxyCount);
    const pages = await getMultipleWorkingYTSPages(pageCount);

    console.log(`Created ${pages.length} pages with working proxies`);

    // Navigate all pages in parallel with different search terms
    const searchTerms = [
      'nodejs tutorial',
      'python programming',
      'web development',
    ];

    const navigationPromises = pages.map(
      async ({page, browser, proxy}, index) => {
        try {
          const searchTerm = searchTerms[index] || 'programming tutorial';
          const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;

          await navigateToYouTubeURL(page, searchUrl);
          console.log(`✅ Loaded "${searchTerm}" on proxy: ${proxy}`);

          // Get video count as success metric
          const videoCount = await page.evaluate(() => {
            return document.querySelectorAll('ytd-video-renderer').length;
          });
          console.log(`Found ${videoCount} videos for "${searchTerm}"`);

          return {proxy, searchTerm, videoCount, success: true};
        } catch (error) {
          console.error(`❌ Failed on proxy: ${proxy}`, error);
          return {proxy, success: false};
        }
      },
    );

    const results = await Promise.allSettled(navigationPromises);

    const successful = results
      .filter(result => result.status === 'fulfilled' && result.value.success)
      .map(result => (result.status === 'fulfilled' ? result.value : null))
      .filter(Boolean);

    console.log(
      `✅ Successfully loaded ${successful.length}/${pages.length} pages with working proxies`,
    );

    // Show results
    successful.forEach(result => {
      if (result) {
        console.log(
          `- "${result.searchTerm}": ${result.videoCount} videos (${result.proxy})`,
        );
      }
    });

    // Clean up all browsers
    await closeAllProxyBrowsers();
  } catch (error) {
    console.error('Multiple working proxies example failed:', error);
  }
}

// Enhanced Example 4: Proxy health check and fallback
async function proxyHealthCheckExample() {
  try {
    console.log('=== Proxy Health Check Example ===');

    // Check system health
    const workingCount = await getWorkingProxyCount();
    const totalCount = await getProxyCount();
    const workingProxies = await getWorkingProxies();

    console.log(`System Status:`);
    console.log(`- Working proxies: ${workingCount}`);
    console.log(`- Total proxies: ${totalCount}`);
    console.log(
      `- Success rate: ${totalCount > 0 ? ((workingCount / totalCount) * 100).toFixed(1) : 0}%`,
    );

    if (workingCount === 0) {
      console.log('🔴 CRITICAL: No working proxies available!');
      console.log('💡 Run: npm run proxy-fetch-test to get working proxies');
      return;
    }

    // Show proxy performance details
    console.log('\nWorking Proxy Performance:');
    const sortedProxies = workingProxies
      .sort((a, b) => (a.responseTime || 9999) - (b.responseTime || 9999))
      .slice(0, 5); // Top 5

    sortedProxies.forEach((proxy, index) => {
      const speed = proxy.responseTime ? `${proxy.responseTime}ms` : 'Unknown';
      const country = proxy.country || 'Unknown';
      console.log(`${index + 1}. ${proxy.proxyUrl} - ${speed} (${country})`);
    });

    // Test with best proxy
    if (sortedProxies.length > 0) {
      console.log(`\nTesting with fastest proxy...`);
      const {page, browser, proxy} = await getFastestYTSPage();

      try {
        await navigateToYouTube(page);
        console.log(`✅ Fastest proxy test successful: ${proxy}`);
      } catch (error) {
        console.log(`❌ Fastest proxy test failed: ${proxy}`);
      }

      await closeProxyBrowser(browser, proxy);
    }
  } catch (error) {
    console.error('Proxy health check failed:', error);
  }
}

// Original single page example (enhanced with fallback)
async function singlePageExample() {
  try {
    console.log('=== Enhanced Single Page Example ===');

    // Try working proxy first, fallback to any available proxy
    let pageData;

    try {
      pageData = await getNewWorkingYTSPage();
      console.log(`✅ Using working proxy: ${pageData.proxy}`);
    } catch (error) {
      console.log('⚠️ No working proxies, trying any available proxy...');
      pageData = await getNewYTSPage();
      console.log(`⚠️ Using untested proxy: ${pageData.proxy}`);
    }

    // Navigate to YouTube
    await navigateToYouTube(pageData.page);

    // Keep page open briefly
    await sleep(5000);

    // Clean up
    await closeProxyBrowser(pageData.browser, pageData.proxy);
  } catch (error: any) {
    console.error('Single page example failed:', error.message);
  }
}

// Example 5: Error handling and retry with working proxies
async function errorHandlingWithWorkingProxiesExample() {
  try {
    console.log('=== Error Handling with Working Proxies Example ===');

    const workingProxies = await getWorkingProxies();
    if (workingProxies.length === 0) {
      console.log('No working proxies available for retry example');
      return;
    }

    let retries = Math.min(3, workingProxies.length);
    let pageData = null;
    let attemptCount = 0;

    while (retries > 0 && !pageData) {
      attemptCount++;
      try {
        console.log(`Attempt ${attemptCount} with working proxy...`);
        pageData = await getNewWorkingYTSPage();

        // Test navigation
        await navigateToYouTube(pageData.page);
        console.log(
          `✅ Success on attempt ${attemptCount} with proxy: ${pageData.proxy}`,
        );
        break;
      } catch (error) {
        retries--;
        console.log(
          `❌ Attempt ${attemptCount} failed. Retries left: ${retries}`,
        );

        if (pageData && pageData.browser) {
          await closeProxyBrowser(pageData.browser, pageData.proxy);
        }
        pageData = null;

        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    if (!pageData) {
      throw new Error('Failed to create working page after all retries');
    }

    // Use the successful page
    console.log('Performing operations with successful proxy...');

    // Clean up
    await closeProxyBrowser(pageData.browser, pageData.proxy);
  } catch (error) {
    console.error('Error handling example failed:', error);
  }
}

// Main execution function with working proxy examples
export async function runWorkingProxyExamples() {
  console.log('🚀 Starting Enhanced Working Proxy Examples\n');

  // Check proxy system health first
  await proxyHealthCheckExample();
  await sleep(2000);

  // Run working proxy examples
  await workingProxySinglePageExample();
  await sleep(2000);

  await fastestProxyExample();
  await sleep(2000);

  await multipleWorkingProxiesExample();
  await sleep(2000);

  await errorHandlingWithWorkingProxiesExample();

  console.log('\n✅ All working proxy examples completed!');
}

// Original examples function (enhanced with fallbacks)
export async function runExamples() {
  console.log('🚀 Starting Enhanced Proxy Browser Examples\n');

  await singlePageExample();
  await sleep(2000);

  const workingProxies = await testAllProxies();
  console.log('Working proxies found:', workingProxies);
  await sleep(2000);

  await getMultipleYTSPages(3);
  await sleep(2000);

  await errorHandlingWithWorkingProxiesExample();

  console.log('\n✅ All examples completed!');
}

// Main execution - prioritize working proxy examples
if (require.main === module) {
  // Check if we have working proxies and run appropriate examples
  getWorkingProxyCount()
    .then(count => {
      if (count > 0) {
        console.log(
          `Found ${count} working proxies - running working proxy examples`,
        );
        runWorkingProxyExamples().catch(console.error);
      } else {
        console.log(
          'No working proxies found - running standard examples with fallbacks',
        );
        console.log('💡 Consider running: npm run proxy-fetch-test');
        runExamples().catch(console.error);
      }
    })
    .catch(error => {
      console.error('Failed to check proxy status:', error);
      runExamples().catch(console.error);
    });
}
