import sleep from './utils/sleep';
import getRandomWaitTime from './utils/randomWaitTime';
import {XTrendsToNews} from './modules/XTrendsToNews';
import {XEngage} from './modules/XEngage';
import {TikTokLikesEngage} from './modules/TikTok/TikTokLikesEngage';
import {TikTokCommentsEngage} from './modules/TikTok/TikTokCommentsEngage';
import {TikTokGainTrainModule} from './modules/TikTok/TikTokGainTrainModule';
import {fbEngage} from './modules/fbEngage';
import {initializeBrowser, visitBrowserPageLink} from './utils/browserManager';
import {isWithinSleepWindow} from './utils/sleepWindow';
import {
  openTikTokPage,
  closeTikTokPage,
  openXPage,
  closeXPage,
  openFbPage,
  closeFbPage,
} from './utils/pageManager';

(async () => {
  try {
    const THREE_MINUTES = 3 * 60 * 1000;
    const FOUR_MINUTES = 4 * 60 * 1000;
    const SIX_MINUTES = 6 * 60 * 1000;
    const TEN_MINUTES = 10 * 60 * 1000;
    const TWENTY_MINUTES = 20 * 60 * 1000;
    const THIRTY_MINUTES = 30 * 60 * 1000;
    const FORTY_FIVE_MINUTES = 45 * 60 * 1000;
    const ONEHOUR = 60 * 60 * 1000;
    const ONEHOURFORTYFIVE = 105 * 60 * 1000;
    const TWOHOURS = 2 * 60 * 60 * 1000;
    const THREEHOURS = 3 * 60 * 60 * 1000;
    const FOURHOURS = 4 * 60 * 60 * 1000;

    const browser = await initializeBrowser();

    // Initialize timers
    let lastEngage = 0;
    let lastTrends = 0;
    let lastTikTokLikes = 0;
    let lastTikTokComments = 0;
    let lastGainTrain = 0;
    let lastFbEngage = 0;

    console.log('🎯 Starting main execution loop...\n');

    while (true) {
      const now = Date.now();

      // 💤 Sleep window check
      /** if (isWithinSleepWindow()) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 💤 Sleep window active. Sleeping 15 minutes...`,
        );
        await sleep(15 * 60 * 1000);
        continue;
      } */

      // Run fbEngage every ~ 1-2 hours
      if (now - lastFbEngage > getRandomWaitTime(THIRTY_MINUTES, ONEHOUR)) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 🎵 Starting fbEngage...`,
        );
        const fbPage = await openFbPage(browser!);
        try {
          await fbEngage(fbPage);
          console.log('✅ fbEngage completed successfully');
        } catch (fbError) {
          console.error('❌ fbEngage error:', fbError);
        } finally {
          await closeFbPage(fbPage);
        }
        lastFbEngage = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }

      // Run TikTok Gain Train every ~3-4 hours
      /** if (now - lastGainTrain > getRandomWaitTime(THREEHOURS, FOURHOURS)) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 🚂 Starting TikTok Gain Train Module...`,
        );
        try {
          await TikTokGainTrainModule(tiktokPage);
          console.log('✅ TikTok Gain Train completed successfully');
        } catch (gainTrainError) {
          console.error('❌ TikTok Gain Train error:', gainTrainError);
        }
        lastGainTrain = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      } */

      // Run XEngage every ~3-4 minutes
      if (now - lastEngage > getRandomWaitTime(FOUR_MINUTES, SIX_MINUTES)) {
        console.log(
          `[${new Date().toLocaleTimeString()}] ⏱️ Starting XEngage...`,
        );
        const xPage = await openXPage(browser!);
        try {
          await XEngage(xPage);
          console.log('✅ XEngage completed successfully');
        } catch (xEngageError) {
          console.error('❌ XEngage error:', xEngageError);
        } finally {
          await closeXPage(xPage);
        }
        lastEngage = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }

      // Run XTrendsToNews every ~1 hr - 1 hr 45 minutes
      if (now - lastTrends > getRandomWaitTime(ONEHOUR, ONEHOURFORTYFIVE)) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 📊 Starting XTrendsToNews...`,
        );
        // Initialize pages using the new functions
        const tiktokPage = await openTikTokPage(browser!);
        const xPage = await openXPage(browser!);
        const fbPage = await openFbPage(browser!);
        try {
          await XTrendsToNews(xPage, fbPage, tiktokPage);
          console.log('✅ XTrendsToNews completed successfully');
        } catch (trendsError) {
          console.error('❌ XTrendsToNews error:', trendsError);
        } finally {
          // Ensure all pages are closed after use
          await closeXPage(xPage);
          await closeFbPage(fbPage);
          await closeTikTokPage(tiktokPage);
        }
        lastTrends = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }

      // Run TikTokCommentsEngage every ~ 1-1.45 hrs
      if (
        now - lastTikTokComments >
        getRandomWaitTime(ONEHOUR, ONEHOURFORTYFIVE)
      ) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 🎵 Starting TikTokEngageComments...`,
        );
        // Initialize pages using the new functions
        const tiktokPage = await openTikTokPage(browser!);
        try {
          await TikTokCommentsEngage(tiktokPage);
          console.log('✅ TikTokEngageComments completed successfully');
        } catch (tiktokError: any) {
          console.error('❌ TikTokEngageComments error:', tiktokError.message);
        } finally {
          // Ensure the TikTok page is closed after use
          await closeTikTokPage(tiktokPage);
        }
        lastTikTokComments = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }

      // Run TikTokEngage every ~1.45-3 hours
      /** if (
        now - lastTikTokLikes >
        getRandomWaitTime(ONEHOURFORTYFIVE, THREEHOURS)
      ) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 🎵 Starting TikTokEngage...`,
        );
        try {
          await TikTokLikesEngage(tiktokPage);
          console.log('✅ TikTokEngage completed successfully');
        } catch (tiktokError) {
          console.error('❌ TikTokEngage error:', tiktokError);
        }
        lastTikTokLikes = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      } */

      // If nothing is ready, sleep briefly
      await sleep(60 * 1000); // Sleep 1 minute before checking again
    }
  } catch (error) {
    console.error('❌ Error in main execution:', error);
  }
})();
