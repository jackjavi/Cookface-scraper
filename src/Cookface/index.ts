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

    const tiktokPage = await browser!.newPage();
    await tiktokPage.setViewport({width: 1366, height: 768});
    await tiktokPage.goto('https://www.tiktok.com/', {
      waitUntil: 'networkidle2',
    });
    console.log('TikTok page initialized.');
    await sleep(1500);

    const xPage = await browser!.newPage();
    await xPage.goto('https://x.com', {waitUntil: 'networkidle2'});
    console.log('X.com page initialized.');
    await sleep(1500);

    const fbPage = await browser!.newPage();
    await fbPage.goto('https://www.facebook.com/', {waitUntil: 'networkidle2'});
    console.log('Facebook page initialized.');
    await sleep(1500);

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

      // Run TikTokCommentsEngage every ~ 1-1.45 hrs
      if (
        now - lastTikTokComments >
        getRandomWaitTime(ONEHOUR, ONEHOURFORTYFIVE)
      ) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 🎵 Starting TikTokEngageComments...`,
        );
        try {
          await TikTokCommentsEngage(tiktokPage);
          console.log('✅ TikTokEngageComments completed successfully');
        } catch (tiktokError: any) {
          console.error('❌ TikTokEngageComments error:', tiktokError.message);
        }
        lastTikTokComments = Date.now();
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

      // Run XEngage every ~4-10 minutes
      if (now - lastEngage > getRandomWaitTime(THREE_MINUTES, FOUR_MINUTES)) {
        console.log(
          `[${new Date().toLocaleTimeString()}] ⏱️ Starting XEngage...`,
        );
        try {
          await XEngage(xPage);
          console.log('✅ XEngage completed successfully');
        } catch (xEngageError) {
          console.error('❌ XEngage error:', xEngageError);
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
        try {
          await XTrendsToNews(xPage, fbPage, tiktokPage);
          console.log('✅ XTrendsToNews completed successfully');
        } catch (trendsError) {
          console.error('❌ XTrendsToNews error:', trendsError);
        }
        lastTrends = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }

      // Run TikTokEngage every ~20-30 minutes
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
      }

      // Run fbEngage every ~ 1-2 hours
      if (now - lastFbEngage > getRandomWaitTime(ONEHOUR, TWOHOURS)) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 🎵 Starting fbEngage...`,
        );
        try {
          await fbEngage(fbPage);
          console.log('✅ fbEngage completed successfully');
        } catch (fbError) {
          console.error('❌ fbEngage error:', fbError);
        }
        lastFbEngage = Date.now();
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
