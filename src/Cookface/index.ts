import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import sleep from './utils/sleep';
import config from './config/index';
import {XTrendsToNews} from './modules/XTrendsToNews';

puppeteer.use(StealthPlugin());
// const username = config.username;
// const password = config.password;
const browserWSEndpointUrl = config.browserWSEndpointUrl;

// Function to get weighted random choice
function getWeightedChoice(weights: number[]): any {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  const rand = Math.random() * sum;

  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (rand < cumulative) {
      return i;
    }
  }
}

(async () => {
  try {
    // const browser = await puppeteer.launch({ headless: false });
    // OPTION 1 - Launch new.
    // const browser = await puppeteer.launch({
    //   headless: false, // Puppeteer is 'headless' by default.
    // });

    // OPTION 2 - Connect to existing.
    // MAC: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir=$(mktemp -d -t 'chrome-remote_data_dir')
    // PC: start chrome.exe –remote-debugging-port=9222
    // Note: this url changes each time the command is run.
    // const wsChromeEndpointUrl = 'ws://127.0.0.1:9222/devtools/browser/b9b6ae94-ae62-4758-81dd-260af6f9b773';
    const browser = await puppeteer.connect({
      browserWSEndpoint: browserWSEndpointUrl,
    });
    const page = await browser.newPage();
    // await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
    await page.setViewport({
      width: 1920,
      height: 1080,
      hasTouch: false,
      isLandscape: false,
      isMobile: false,
      deviceScaleFactor: 1,
    });
    // await login(page, username, password);
    // Go to already logged in page
    await page.goto('https://www.facebook.com/');

    await sleep(1500);

    // const weights = [20, 0, 40, 0, 5, 5, 15, 15, 0, 0]; // Probabilities in percentages
    const weights = [100]; // Probabilities in percentages

    while (true) {
      const choice = getWeightedChoice(weights);

      switch (choice) {
        case 0:
          console.log('Starting XTrendsToNews processing...');
          await XTrendsToNews(page);
          console.log('XTrendsToNews processing completed.');
          await sleep(75000);
          break;
        default:
          console.log(`No action taken for choice: ${choice}`);
          break;
      }

      // Sleep before the next iteration
      await sleep(2000);
    }

    // Wait for 24 hours (86400000 ms)
    // await new Promise((resolve) => setTimeout(resolve, 86400000));

    // Termination notification
    // console.log("Process terminated successfully after 24 hours.");

    // Close the browser
    // await browser.close();
  } catch (error) {
    console.error('Error in main execution:', error);
  }
})();
