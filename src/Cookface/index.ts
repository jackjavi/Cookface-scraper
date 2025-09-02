import sleep from './utils/sleep';
import getRandomWaitTime from './utils/randomWaitTime';
import {XTrendsToNews} from './modules/XTrendsToNews';
import {XEngage} from './modules/XEngage';
import {TikTokEngage} from './modules/TikTokEngage';
import {fbEngage} from './modules/fbEngage';
// import { TelegramNews } from './modules/TelegramNews';
import {initializeBrowser, visitBrowserPageLink} from './utils/browserManager';
// import { isWithinSleepWindow } from './utils/sleepWindow';

(async () => {
  try {
    const THREE_MINUTES = 3 * 60 * 1000;
    // const SIX_MINUTES = 6 * 60 * 1000;
    const TWENTY_MINUTES = 20 * 60 * 1000;
    const THIRTY_MINUTES = 30 * 60 * 1000;
    // const ONEHOUR = 60 * 60 * 1000;
    // const TWOHOURS = 60 * 90 * 1000; // 1.5 HRS

    const browser = await initializeBrowser();

    const tiktokPage = await visitBrowserPageLink(
      browser!,
      'https://www.tiktok.com/',
    );
    await sleep(1500);

    const xPage = await browser!.newPage();
    await xPage.goto('https://x.com');
    console.log('X.com page initialized.');
    await sleep(1500);

    const fbPage = await browser!.newPage();
    // await fbPage.setViewport({width: 1366, height: 768}); // ELiteBook 8470p to work with on Lenovo when testing/coding
    await fbPage.goto('https://www.facebook.com/');
    console.log('Facebook page initialized.');

    await sleep(1500);

    // Initialize timers
    let lastEngage = 0;
    let lastTrends = 0;
    let lastTikTok = 0;
    let lastFbEngage = 0;
    // let lastTelegram = 0;

    while (true) {
      const now = Date.now();

      // 💡 Sleep window check
      /* if (isWithinSleepWindow()) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 💤 Sleep window active. Sleeping 15 minutes...`,
        );
        await sleep(15 * 60 * 1000);
        continue;
      } */

      // Run TikTokEngage every ~20 minutes
      if (now - lastTikTok > TWENTY_MINUTES) {
        console.log('🎵 Starting TikTokEngage...');
        await TikTokEngage(tiktokPage); // Updated function call
        lastTikTok = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }

      // Run XEngage every ~3 minutes
      if (now - lastEngage > THREE_MINUTES) {
        console.log('⏱ Starting XEngage...');
        await XEngage(xPage);
        lastEngage = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }

      // Run XTrendsToNews every ~30 minutes
      if (now - lastTrends > THIRTY_MINUTES) {
        console.log('📊 Starting XTrendsToNews...');
        await XTrendsToNews(xPage, fbPage);
        lastTrends = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }

      // Run fbEngage every ~30 minutes
      if (now - lastFbEngage > THIRTY_MINUTES) {
        console.log('🎵 Starting fbEngage...');
        await fbEngage(fbPage);
        lastFbEngage = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }

      // Run TelegramNews every ~1.5 hours
      /* if (now - lastTelegram > TWOHOURS) {
        console.log('📊 Starting TelegramNews...');
        await TelegramNews();
        lastTelegram = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }*/

      // If nothing is ready, sleep briefly
      await sleep(60 * 1000); // Sleep 1 minute before checking again
    }
  } catch (error) {
    console.error('❌ Error in main execution:', error);
  }
})();
