import {ArticleHeadline} from '../../types/Article.js';

import {
  initializeBrowser,
  closePage,
  visitBrowserPageLink,
} from '../../utils/browserManager.js';
import sleep from '../../utils/sleep.js';
import fs from 'fs';
import fsPromises from 'fs/promises';
import config from '../../config/index.js';
import {Browser, Page} from 'puppeteer';

const fetchSkySportsArticles = async () => {
  try {
    const browser: Browser | undefined = await initializeBrowser();
    let page: Page | undefined = await visitBrowserPageLink(
      browser!,
      'https://www.skysports.com/football/news',
    );

    // Wait for main content to be ready
    await page!.waitForSelector('.sdc-site-tiles__group', {timeout: 30000});

    console.log('Collecting visible news items...');

    const articles: ArticleHeadline[] = [];
    let articlesStore = config.articlesStore;
    let seenLinks = new Set();

    // Function to collect all visible items on the page
    const collectAllVisibleItems = async () => {
      return await page!.evaluate(() => {
        const items: any[] = [];

        // First, find the main container
        const mainContainer = document.querySelector('.sdc-site-tiles__group');
        if (!mainContainer) return items;

        // Then select all individual news items within the container
        const newsItems = mainContainer.querySelectorAll(
          '.sdc-site-tiles__item',
        );

        newsItems.forEach((item, index) => {
          // Check if this item has a badge in its figure element - if so, skip it
          const figure = item.querySelector('figure.sdc-site-tile__figure');
          if (figure && figure.querySelector('.sdc-site-tile__badge')) {
            console.log(`Skipping item ${index + 1} - has badge`);
            return; // Skip this item
          }

          // Extract the required elements
          const headlineElement = item.querySelector(
            '.sdc-site-tile__headline-text',
          );
          const linkElement = item.querySelector(
            '.sdc-site-tile__headline-link',
          );
          const imageElement = item.querySelector('img');

          const headline = headlineElement?.textContent?.trim();
          const link = (linkElement as HTMLAnchorElement | null)?.href;
          const imageUrl = imageElement?.src;

          if (headline && link) {
            items.push({
              headline,
              link,
              imageUrl: imageUrl || null,
              index: index + 1,
            });
          }
        });

        return items;
      });
    };

    // Collect all visible items at once
    const allVisibleItems = await collectAllVisibleItems();

    // Add unique items to the articles array
    allVisibleItems.forEach(item => {
      if (!seenLinks.has(item.link)) {
        articles.push(item);
        seenLinks.add(item.link);
      }
    });

    console.log(`Successfully collected ${articles.length} visible news items`);

    await fsPromises.writeFile(
      articlesStore,
      JSON.stringify({title: 'Sky Sports Headlines', articles}, null, 2),
      'utf8',
    );

    await closePage(page!);

    return {success: true, data: articles};
  } catch (error: any) {
    console.error(
      'Error fetching football news headlines from Sky Sports:',
      error,
    );
    return {
      success: false,
      message: 'Failed to fetch football news headlines from Sky Sports',
      error: error.message,
    };
  }
};

const fetchSkySportsFullArticles = async () => {
  try {
    const rawData: any = fs.readFileSync(config.articlesStore);
    const articlesStructure = JSON.parse(rawData);
    const articles = articlesStructure.articles;

    // Handle edge case where fullArticles file doesn't exist or is empty
    let fullArticles = [];
    try {
      if (fs.existsSync(config.fullArticlesStore)) {
        const rawFullArticles: any = fs.readFileSync(config.fullArticlesStore);
        const fileContent = rawFullArticles.toString().trim();

        if (fileContent) {
          const fullArticlesStructure = JSON.parse(fileContent);
          fullArticles = fullArticlesStructure.articles || [];
        }
      }
    } catch (parseError: any) {
      console.warn(
        'Could not parse fullArticles file, starting with empty array:',
        parseError.message,
      );
      fullArticles = [];
    }

    const browser = await initializeBrowser();
    let extractedData = [];

    for (const article of articles) {
      if (article.link) {
        // Check if article already exists in fullArticles array
        const existingArticle = fullArticles.find(
          (fullArticle: any) => fullArticle.title === article.headline,
        );

        if (!existingArticle) {
          const page = await visitBrowserPageLink(browser!, article.link);
          await sleep(10000);

          // Function to parse timestamp and check if it's within allowed range
          const isWithinTimeRange = (timestampText: string) => {
            if (!timestampText) return false;

            // Check for minutes (0-59 m ago)
            const minuteMatch = timestampText.match(/(\d+)\s*m\s+ago/i);
            if (minuteMatch) {
              const minutes = parseInt(minuteMatch[1]);
              return minutes >= 0 && minutes <= 59;
            }

            // Check for hours (1-7 h ago)
            const hourMatch = timestampText.match(/(\d+)\s*h\s+ago/i);
            if (hourMatch) {
              const hours = parseInt(hourMatch[1]);
              return hours >= 1 && hours <= 7;
            }

            return false;
          };

          // Function to collect articles from divs with role="article"
          const collectCurrentContent = async () => {
            return await page!.evaluate(() => {
              const articles: any[] = [];

              // Target the main container
              const mainContainer = document.querySelector(
                '.section-wrap__article-column',
              );
              if (!mainContainer) {
                console.log('Main container not found');
                return articles;
              }

              // Find all divs with role="article"
              const articleDivs = mainContainer.querySelectorAll(
                'div[role="article"]',
              );

              articleDivs.forEach((div, divIndex) => {
                // Check timestamp for filtering
                const timestampSpan = div.querySelector(
                  '.ncpost-timestamp-ago',
                );
                if (!timestampSpan) return; // Skip if no timestamp

                const timestampText = timestampSpan?.textContent?.trim();

                // Check if within time range (this will be validated in Node.js)
                // For now, just collect the timestamp text for server-side validation

                // Get the datetime attribute from time element
                const timeElement = div.querySelector('time.ncpost-timestamp');
                const datetime = timeElement
                  ? timeElement.getAttribute('datetime')
                  : null;

                // Get h2 tag (subheading)
                const h2Element = div.querySelector('h2');
                const subheading = h2Element
                  ? h2Element?.textContent?.trim()
                  : null;

                // Get all p tags (content) and combine into one paragraph
                const pElements = div.querySelectorAll('p');
                let contentParagraphs: string[] = [];
                pElements.forEach(pElement => {
                  const text = pElement?.textContent?.trim();
                  if (text) {
                    contentParagraphs.push(text);
                  }
                });

                const content = contentParagraphs.join(' ');

                if (subheading && content) {
                  articles.push({
                    subheading: subheading,
                    timestamp: datetime,
                    timestampText: timestampText,
                    content: content,
                    divIndex: divIndex + 1,
                  });
                }
              });

              return articles;
            });
          };

          let allArticles: any[] = [];
          let seenArticles = new Set();
          let previousHeight: any = 0;
          let scrollAttempts = 0;
          const maxScrollAttempts = 20;

          console.log(
            `Starting content collection for article: ${article.headline}`,
          );

          // Controlled scrolling and collection loop
          while (scrollAttempts < maxScrollAttempts) {
            // Extract articles visible on the page
            const newArticles = await collectCurrentContent();

            // Filter articles by time range and add unique articles
            let newArticleCount = 0;
            newArticles.forEach(articleItem => {
              // Check if article is within time range
              if (isWithinTimeRange(articleItem.timestampText)) {
                const articleKey = `${articleItem.subheading}_${articleItem.timestamp}`;
                if (!seenArticles.has(articleKey)) {
                  // Remove timestampText as it's only needed for filtering
                  const {timestampText, ...cleanArticle} = articleItem;
                  allArticles.push(cleanArticle);
                  seenArticles.add(articleKey);
                  newArticleCount++;
                }
              }
            });

            console.log(
              `Scroll ${scrollAttempts + 1}: Collected ${newArticleCount} new articles within time range. Total: ${allArticles.length}`,
            );

            // Check if more article divs are still visible
            const hasVisibleContent = await page!.evaluate(() => {
              const mainContainer = document.querySelector(
                '.section-wrap__article-column',
              );
              if (!mainContainer) return false;

              const articleDivs = mainContainer.querySelectorAll(
                'div[role="article"]',
              );
              return articleDivs.length > 0;
            });

            if (!hasVisibleContent) {
              console.log('No more article divs visible.');
              break;
            }

            // Scroll to load more content
            previousHeight = await page!.evaluate('document.body.scrollHeight');
            await page!.evaluate(
              'window.scrollTo(0, document.body.scrollHeight)',
            );
            await sleep(3000); // Wait for new content to load

            const newHeight = await page!.evaluate(
              'document.body.scrollHeight',
            );

            // If page height hasn't changed, we've reached the end
            if (newHeight === previousHeight) {
              console.log('No more content to load - reached end of page.');
              break;
            }

            scrollAttempts++;
          }

          // Structure the collected data
          const articleData = {
            title: article.headline,
            link: article.link,
            imageUrl: article.imageUrl,
            totalArticles: allArticles.length,
            articles: allArticles,
            collectedAt: new Date().toISOString(),
          };

          if (allArticles.length > 0) {
            extractedData.push(articleData);
            console.log(
              `Successfully collected ${allArticles.length} articles within time range from: ${article.headline}`,
            );
          } else {
            console.log(
              `No articles within time range found for: ${article.headline}`,
            );
          }

          await closePage(page!);
          await sleep(3000);
        } else {
          console.log(
            `Article titled "${article.headline}" already exists in the database. Skipping...`,
          );
        }
      }
    }

    // Store all extracted data in config.fullArticlesStore
    await fsPromises.writeFile(
      config.fullArticlesStore,
      JSON.stringify(
        {
          title: 'Sky Sports Full Articles Content',
          totalArticles: extractedData.length,
          extractedAt: new Date().toISOString(),
          articles: extractedData,
        },
        null,
        2,
      ),
    );

    console.log(
      `Successfully extracted content from ${extractedData.length} articles`,
    );

    return {
      success: true,
      message: 'Articles content extracted successfully',
      totalArticles: extractedData.length,
      data: extractedData,
    };
  } catch (error: any) {
    console.error('Error scraping articles:', error);
    return {success: false, error: error.message};
  }
};

export {fetchSkySportsArticles, fetchSkySportsFullArticles};
