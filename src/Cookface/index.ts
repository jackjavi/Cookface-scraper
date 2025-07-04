import sleep from './utils/sleep';
import getRandomWaitTime from './utils/randomWaitTime';
import {XTrendsToNews} from './modules/XTrendsToNews';
import {initializeBrowser} from './utils/browserManager';

// Weighted choice helper
function getWeightedChoice(weights: number[]): number {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  const rand = Math.random() * sum;

  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (rand < cumulative) return i;
  }

  return 0;
}

(async () => {
  try {
    // const FIFTEEN_MINUTES = 15 * 60 * 1000;
    const THIRTY_MINUTES = 30 * 60 * 1000;
    const ONE_HOUR = 60 * 60 * 1000;
    const FORTY_FIVE_MINUTES = 45 * 60 * 1000;
    const browser = await initializeBrowser();
    const xPage = await browser.newPage();
    await xPage.goto('https://x.com');
    console.log('X.com page initialized.');

    const fbPage = await browser.newPage();
    await fbPage.goto('https://www.facebook.com/');
    console.log('Facebook page initialized.');

    await sleep(1500);

    const weights = [100];

    while (true) {
      const choice = getWeightedChoice(weights);

      switch (choice) {
        case 0:
          console.log('Starting XTrendsToNews processing...');
          await XTrendsToNews(xPage, fbPage);
          console.log('XTrendsToNews processing completed.');
          await sleep(getRandomWaitTime(FORTY_FIVE_MINUTES, ONE_HOUR));
          break;
        default:
          console.log(`No action taken for choice: ${choice}`);
          break;
      }

      await sleep(2000);
    }
  } catch (error) {
    console.error('Error in main execution:', error);
  }
})();
