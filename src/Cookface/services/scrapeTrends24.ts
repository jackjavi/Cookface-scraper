import puppeteer, {Browser, Page} from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

interface Country {
  country: string;
  url: string;
}

interface Trend {
  title: string;
  url: string;
}

export const scrapeTrends24 = async (): Promise<Trend[] | null> => {
  let browser: Browser | null = null;

  try {
    // Read and parse country data
    const data = await fs.readFile(
      path.join(__dirname, '../countries.json'),
      'utf8',
    );
    const countriesData: Country[] = JSON.parse(data);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page: Page = await browser.newPage();

    let trends: Trend[] = [];
    let attempts = 0;
    const maxAttempts = 5;
    let selectedCountry: string = '';

    while (trends.length === 0 && attempts < maxAttempts) {
      const randomIndex = Math.floor(Math.random() * countriesData.length);
      const {country, url} = countriesData[randomIndex];
      selectedCountry = country;

      console.log(
        `Attempting to scrape trends for ${selectedCountry} (Attempt ${attempts + 1}/${maxAttempts})`,
      );

      await page.goto(url, {waitUntil: 'networkidle2', timeout: 60000});

      trends = await page.evaluate(() => {
        const trendContainer = document.querySelector(
          '.trend-data-container .tabs-container #timeline .list-container',
        );
        if (!trendContainer) return [];

        return Array.from(
          trendContainer.querySelectorAll('li .trend-name a'),
        ).map(anchor => ({
          title: anchor.textContent?.trim() || '',
          url: (anchor as HTMLAnchorElement).href,
        }));
      });

      attempts++;
    }

    if (trends.length > 0) {
      console.log(`✅ Found ${trends.length} trends for ${selectedCountry}`);
      return trends;
    } else {
      console.warn(`⚠️ No trends found after ${maxAttempts} attempts.`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error scraping Trends24:', error);
    return null;
  } finally {
    if (browser) await browser.close();
  }
};
