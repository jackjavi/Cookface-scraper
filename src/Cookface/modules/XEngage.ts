import sleep from '../utils/sleep';
import explore from '../services/explore';
import tagActiveUsers from '../services/tagActiveUsers';
import notifications from '../services/notifications';
import {Page} from 'puppeteer';

function getWeightedChoice(weights: number[]): number {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  const rand = Math.random() * sum;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (rand < cumulative) return i;
  }
  return weights.length - 1; // Fallback to last index
}

export const XEngage = async (xPage: Page): Promise<void> => {
  const label = 'Search and explore';
  try {
    console.log('Starting XEngage processing...');
    await xPage.bringToFront();

    // Weights: [explore, notifications, tagActiveUsers]
    // explore: 60%, notifications: 20%, tagActiveUsers: 20%
    const weights = [60, 20, 20];
    const choice = getWeightedChoice(weights);

    switch (choice) {
      case 0:
        console.log('Executing explore function (60% probability)');
        await explore(label, xPage);
        break;
      case 1:
        console.log('Executing notifications function (20% probability)');
        await notifications(label, xPage);
        break;
      case 2:
        console.log('Executing tagActiveUsers function (20% probability)');
        await tagActiveUsers(label, xPage);
        break;
      default:
        console.log('Fallback: Executing explore function');
        await explore(label, xPage);
        break;
    }

    await sleep(2000);

    // await sleep(225000);
    // await sleep(2000); // Reduced sleep time for testing
  } catch (error) {
    console.error('XEngage error:', error);
  }
};
