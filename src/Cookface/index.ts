import sleep from './utils/sleep';
import getRandomWaitTime from './utils/randomWaitTime';
import {XTrendsToNews} from './modules/XTrendsToNews';
import {XEngage} from './modules/XEngage';
import {TikTokEngage} from './modules/TikTokEngage';
import {TikTokGainTrainModule} from './modules/TikTokGainTrainModule';
import {fbEngage} from './modules/fbEngage';
import {initializeBrowser, visitBrowserPageLink} from './utils/browserManager';
import {isWithinSleepWindow} from './utils/sleepWindow';
import {proxyManager} from './services/proxies/proxyManager';

(async () => {
  try {
    console.log(
      '🚀 Starting Cookface Scraper with Automated Proxy Management...\n',
    );

    // Start the proxy manager first
    console.log('🔧 Initializing Proxy Manager...');
    await proxyManager.start();

    // Show initial proxy stats
    const initialStats = await proxyManager.getProxyStats();
    if (initialStats) {
      console.log('📊 Initial Proxy Statistics:');
      console.log(`   📈 Total: ${initialStats.total}`);
      console.log(`   ✅ Working: ${initialStats.working}`);
      console.log(`   ❌ Failed: ${initialStats.failed}`);
      console.log(`   ❓ Untested: ${initialStats.untested}`);
      console.log(
        `   ⏱️  Avg Response: ${Math.round(initialStats.averageResponseTime)}ms\n`,
      );
    }

    const THREE_MINUTES = 3 * 60 * 1000;
    const FOUR_MINUTES = 4 * 60 * 1000;
    const SIX_MINUTES = 6 * 60 * 1000;
    const TWENTY_MINUTES = 20 * 60 * 1000;
    const THIRTY_MINUTES = 30 * 60 * 1000;
    const FORTY_FIVE_MINUTES = 45 * 60 * 1000;
    const ONEHOUR = 60 * 60 * 1000;
    const ONEHOURFORTYFIVE = 105 * 60 * 1000;
    const TWOHOURS = 2 * 60 * 60 * 1000;

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
    let lastTikTok = 0;
    let lastGainTrain = 0;
    let lastFbEngage = 0;
    let lastProxyStatsLog = 0;

    console.log('🎯 Starting main execution loop...\n');

    while (true) {
      const now = Date.now();

      // Log proxy stats every 30 minutes
      if (now - lastProxyStatsLog > THIRTY_MINUTES) {
        const stats = await proxyManager.getProxyStats();
        if (stats) {
          console.log(
            `\n📊 [${new Date().toLocaleTimeString()}] Proxy Status:`,
          );
          console.log(
            `   🔗 Total: ${stats.total} | ✅ Working: ${stats.working} | ❌ Failed: ${stats.failed}`,
          );
          console.log(
            `   ⏱️  Avg Response: ${Math.round(stats.averageResponseTime)}ms\n`,
          );

          // Alert if working proxies are critically low
          if (stats.working < 3) {
            console.warn(
              '⚠️  CRITICAL: Very few working proxies! Consider checking proxy sources.',
            );
          }
        }
        lastProxyStatsLog = now;
      }

      // 💤 Sleep window check
      if (isWithinSleepWindow()) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 💤 Sleep window active. Sleeping 15 minutes...`,
        );
        await sleep(15 * 60 * 1000);
        continue;
      }

      // Run TikTok Gain Train every ~1-2 hours (high frequency for growth)
      if (now - lastGainTrain > getRandomWaitTime(ONEHOUR, TWOHOURS)) {
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
      }

      // Run TikTokEngage every ~20-30 minutes
      if (
        now - lastTikTok >
        getRandomWaitTime(TWENTY_MINUTES, THIRTY_MINUTES)
      ) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 🎵 Starting TikTokEngage...`,
        );
        try {
          await TikTokEngage(tiktokPage);
          console.log('✅ TikTokEngage completed successfully');
        } catch (tiktokError) {
          console.error('❌ TikTokEngage error:', tiktokError);
        }
        lastTikTok = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }

      // Run XEngage every ~4-6 minutes
      if (now - lastEngage > getRandomWaitTime(FOUR_MINUTES, SIX_MINUTES)) {
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

      // Run XTrendsToNews every ~30-60 minutes
      if (now - lastTrends > getRandomWaitTime(THIRTY_MINUTES, ONEHOUR)) {
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

      // Run fbEngage every ~30 minutes (uncomment when ready)
      /** 
      if (now - lastFbEngage > THIRTY_MINUTES) {
        console.log(`[${new Date().toLocaleTimeString()}] 🎵 Starting fbEngage...`);
        try {
          await fbEngage(fbPage);
          console.log('✅ fbEngage completed successfully');
        } catch (fbError) {
          console.error('❌ fbEngage error:', fbError);
        }
        lastFbEngage = Date.now();
        await sleep(getRandomWaitTime(10000, 30000)); // Short cooldown
        continue;
      }
      */

      // If nothing is ready, sleep briefly
      await sleep(60 * 1000); // Sleep 1 minute before checking again
    }
  } catch (error) {
    console.error('❌ Error in main execution:', error);

    // Stop proxy manager on main error
    console.log('🛑 Stopping Proxy Manager due to main error...');
    proxyManager.stop();
  }
})();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
  proxyManager.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
  proxyManager.stop();
  process.exit(0);
});

process.on('uncaughtException', error => {
  console.error('❌ Uncaught Exception:', error);
  proxyManager.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  proxyManager.stop();
  process.exit(1);
});
