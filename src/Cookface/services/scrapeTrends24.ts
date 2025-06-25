import puppeteer from "puppeteer";
import * as fs from "fs";

interface Trend {
  title: string;
  url: string;
}

interface CountryData {
  country: string;
  url: string;
}

const scrapeTrends24 = async () => {
 const countriesData: CountryData[] = JSON.parse(fs.readFileSync("./countries.json", "utf8"));


 let browser;
 try {
   browser = await puppeteer.launch({ headless: true });
   const page = await browser.newPage();


   let trends: Trend[] = [];
   let attempts = 0;
   const maxAttempts = 5;
   let selectedCountry;


   while (trends.length === 0 && attempts < maxAttempts) {
     const randomCountry =
       countriesData[Math.floor(Math.random() * countriesData.length)];
     selectedCountry = randomCountry.country;
     const url = randomCountry.url;


     console.log(
       `Attempting to scrape trends for ${selectedCountry} (Attempt ${
         attempts + 1
       }/${maxAttempts})`
     );


     await page.goto(url, {
       waitUntil: "networkidle2",
       timeout: 60000,
     });


     trends = await page.evaluate(() => {
       const trendContainer = document.querySelector(
         ".trend-data-container .tabs-container #timeline .list-container"
       );
       if (!trendContainer) return [];


       return Array.from(
         trendContainer.querySelectorAll("li .trend-name a")
       ).map((anchor: any) => ({
         title: anchor.innerText.trim(),
         url: anchor.href,
       }));
     });


     attempts++;
   }


   if (trends.length > 0) {
     console.log(`Saving trends for ${selectedCountry}:`, trends);

     return trends;
   } else {
     console.log(`No valid trends found after ${maxAttempts} attempts`);
     return;
   }
 } catch (error) {
   console.error("Error scraping Trends24:", error);
   return;
 } finally {
   if (browser) {
     await browser.close();
   }
 }
};

export default scrapeTrends24;