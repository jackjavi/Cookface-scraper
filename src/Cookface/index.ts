import sleep from './utils/sleep';
import {XTrendsToNews} from './modules/XTrendsToNews';
import {getFacebookPage} from './utils/browserManager';

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
    // const fbPage = await getFacebookPage();
    await sleep(1500);

    const weights = [100];

    while (true) {
      const choice = getWeightedChoice(weights);

      switch (choice) {
        case 0:
          console.log('Starting XTrendsToNews processing...');
          // await XTrendsToNews(fbPage);
          await XTrendsToNews();
          console.log('XTrendsToNews processing completed.');
          await sleep(75000);
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
