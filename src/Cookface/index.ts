import sleep from './utils/sleep';
import getRandomWaitTime from './utils/randomWaitTime';
import { XTrendsToNews } from './modules/XTrendsToNews';
import { XEngage } from './modules/XEngage';
import { initializeBrowser } from './utils/browserManager';
import { isWithinSleepWindow } from './utils/sleepWindow';

(async () => {
  try {
    const SIX_MINUTES = 6 * 60 * 1000;
    const TWENTY_MINUTES = 20 * 60 * 1000;

    const browser = await initializeBrowser();
    const xPage = await browser.newPage();
    await xPage.goto('https://x.com');
    console.log('X.com page initialized.');

    const fbPage = await browser.newPage();
    await fbPage.goto('https://www.facebook.com/');
    console.log('Facebook page initialized.');

    await sleep(1500);

    // Initialize timers
    let lastEngage = 0;
    let lastTrends = 0;

    while (true) {
      const now = Date.now();

      // 💡 Sleep window check
      if (isWithinSleepWindow()) {
        console.log(`[${new Date().toLocaleTimeString()}] 💤 Sleep window active. Sleeping 15 minutes...`);
        await sleep(15 * 60 * 1000);
        continue;
      }

      // Run XEngage every ~6 minutes
      if (now - lastEngage > SIX_MINUTES) {
        console.log('⏱ Starting XEngage...');
        await XEngage(xPage);
        lastEngage = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }

      // Run XTrendsToNews every ~20 minutes
      if (now - lastTrends > TWENTY_MINUTES) {
        console.log('📊 Starting XTrendsToNews...');
        await XTrendsToNews(xPage, fbPage);
        lastTrends = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }

      // If nothing is ready, sleep briefly
      await sleep(60 * 1000); // Sleep 1 minute before checking again
    }
  } catch (error) {
    console.error('❌ Error in main execution:', error);
  }
})();
