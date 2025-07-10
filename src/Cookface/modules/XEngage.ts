import sleep from '../utils/sleep';
import explore from '../services/explore';
import {Page} from 'puppeteer';

export const XEngage = async (xPage: Page): Promise<void> => {
  const label = 'Search and explore';
  try {
    console.log('Starting XEngage processing...');
    await xPage.bringToFront();

    await explore(label, xPage);

    await sleep(2000);

    await sleep(225000);
    // await sleep(2000); // Reduced sleep time for testing
  } catch (error) {
    console.error('XTrendsToNews error:', error);
  }
};
