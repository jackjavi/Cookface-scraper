import sleep from '../utils/sleep';
import {Page} from 'puppeteer';
import GenerativeAIService from './generativeAI';
import * as fs from 'fs';

interface Trend {
  title: string;
  url: string;
}

interface Comment {
  user: string | null;
  content: string | null;
  timestamp: string | null;
}

interface TweetImage {
  src: string;
  alt: string | null;
  articleIndex: number;
}

async function fetchTweetTrends(
  label: string,
  trends: Trend[],
  page: Page,
): Promise<{
  randomPhrase: string | null;
  comments: Comment[];
  images: TweetImage[];
}> {
  const navSelector = 'nav[aria-label="Primary"] a';
  const genAIService = new GenerativeAIService();

  function getRecentTrends(): string[] {
    const path = 'storage/usedTrends.json';
    if (!fs.existsSync(path)) {
      return [];
    }
    return JSON.parse(fs.readFileSync(path, 'utf-8')).slice(0, 8);
  }

  async function getBestTitleFromTopTrends(): Promise<{
    title: string;
    index: number;
  }> {
    const top10Trends = trends.slice(0, 15);
    const recentTrends = getRecentTrends();

    const prompt = `
You are an expert at spotting the best trending topic to write about on social media in Kenya. 

Below are 15 trending topics:
${top10Trends.map((t, i) => `${i + 1}. ${t.title}`).join('\n')}

Avoid these recent trends: ${recentTrends.join(', ') || 'None'}.

Rules:
- Ignore titles that are promotional, branded, religious, or previously used (see list).
- Choose the most engaging, newsworthy, or viral-friendly title for mass audience content.
- Your job is to pick **only one** from the list.

Now reply ONLY with the number (1–15) of the trend you recommend. No explanation.`;

    const result = await genAIService['model'].generateContent(prompt);
    const response = result.response;
    const answer = response.text().trim();
    const chosenIndex = parseInt(answer) - 1;

    if (
      isNaN(chosenIndex) ||
      chosenIndex < 0 ||
      chosenIndex >= top10Trends.length
    ) {
      throw new Error(`Invalid trend selection index: ${answer}`);
    }

    const selected = top10Trends[chosenIndex];
    genAIService['saveTrendToFile'](selected.title);
    console.log(`Selected Trend: ${selected.title}`);
    return {title: selected.title, index: chosenIndex};
  }

  /**
   * Wait for page content to fully load and stabilize
   * @param timeout - Maximum time to wait (default: 10000ms)
   */
  async function waitForPageContentLoad(
    timeout: number = 10000,
  ): Promise<void> {
    console.log('⏳ Waiting for page content to fully load...');

    try {
      // Wait for network to be mostly idle
      await page.waitForNavigation({waitUntil: 'networkidle0', timeout});

      // Additional wait for any dynamic content
      await sleep(2000);

      // Wait specifically for tweet articles to be present and stable
      await page.waitForSelector(
        'article[role="article"][data-testid="tweet"]',
        {
          timeout: timeout,
        },
      );

      // Wait a bit more for images and content to load
      await sleep(1500);

      console.log('✅ Page content fully loaded');
    } catch (error) {
      console.warn('⚠️ Page load timeout, continuing with available content');
      // Continue execution even if full loading times out
    }
  }

  /**
   * Wait for new content to load after scrolling
   */
  async function waitForScrollContent(): Promise<void> {
    console.log('📜 Waiting for new content after scroll...');

    // Wait for potential new tweets to load
    await sleep(3000);

    // Wait for any images in the new content to load
    const maxWaitTime = 8000; // 8 seconds max
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      // Check if there are any loading images
      const loadingImages = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs.some(img => !img.complete || img.naturalWidth === 0);
      });

      if (!loadingImages) {
        console.log('✅ All images loaded after scroll');
        break;
      }

      console.log('⏳ Still waiting for images to load...');
      await sleep(1000);
    }

    // Final wait for any remaining dynamic content
    await sleep(1500);
  }

  /**
   * Enhanced function to extract comments and images with better error handling
   */
  async function extractContentFromPage(): Promise<{
    newComments: Comment[];
    newImages: TweetImage[];
  }> {
    return await page.evaluate(() => {
      const articles = document.querySelectorAll(
        'article[role="article"][data-testid="tweet"]',
      );

      const newComments: Comment[] = Array.from(articles)
        .map((article, index) => {
          try {
            const userSpan = article.querySelector(
              '[data-testid="User-Name"] span',
            );
            const contentEl = article.querySelector('[lang]');

            const user =
              userSpan instanceof HTMLElement
                ? userSpan.innerText?.trim()
                : null;
            const content =
              contentEl instanceof HTMLElement
                ? contentEl.innerText?.trim()
                : null;
            const timestamp =
              article.querySelector('time')?.getAttribute('datetime') || null;

            return {user, content, timestamp};
          } catch (error) {
            console.warn(
              `Error extracting comment from article ${index}:`,
              error,
            );
            return {user: null, content: null, timestamp: null};
          }
        })
        .filter(comment => comment.content && comment.content.length > 0); // Filter out empty comments

      // Enhanced image collection with better error handling
      const newImages: TweetImage[] = [];

      Array.from(articles).forEach((article, articleIndex) => {
        try {
          // Find all image containers in this article
          const imageContainers = article.querySelectorAll(
            'div[aria-label="Image"][data-testid="tweetPhoto"]',
          );

          imageContainers.forEach((container, containerIndex) => {
            try {
              // Look for img tags within the container
              const imgElements = container.querySelectorAll('img');

              imgElements.forEach((img, imgIndex) => {
                try {
                  const src = img.getAttribute('src');
                  const alt = img.getAttribute('alt');

                  // More strict validation for image src
                  if (
                    src &&
                    src.startsWith('http') &&
                    !src.includes('placeholder') &&
                    img.complete &&
                    img.naturalWidth > 0
                  ) {
                    newImages.push({
                      src: src,
                      alt: alt || `Image from article ${articleIndex}`,
                      articleIndex: articleIndex,
                    });
                  }
                } catch (imgError) {
                  console.warn(
                    `Error processing image ${imgIndex} in container ${containerIndex}:`,
                    imgError,
                  );
                }
              });
            } catch (containerError) {
              console.warn(
                `Error processing image container ${containerIndex}:`,
                containerError,
              );
            }
          });
        } catch (articleError) {
          console.warn(
            `Error processing article ${articleIndex} images:`,
            articleError,
          );
        }
      });

      return {newComments, newImages};
    });
  }

  try {
    const {title: selectedTitle} = await getBestTitleFromTopTrends();

    await page.evaluate(
      (label, navSelector) => {
        const links = Array.from(document.querySelectorAll(navSelector));
        const targetLink = links.find(link =>
          link.getAttribute('aria-label')?.includes(label),
        );
        if (targetLink instanceof HTMLElement) {
          targetLink.click();
        } else {
          throw new Error(`Link with label "${label}" not found`);
        }
      },
      label,
      navSelector,
    );
    console.log(`Clicked on the "${label}" link successfully.`);

    // Wait for navigation to complete
    await waitForPageContentLoad();

    const searchInputSelector = 'input[data-testid="SearchBox_Search_Input"]';
    await page.waitForSelector(searchInputSelector);
    await page.type(searchInputSelector, selectedTitle, {delay: 100});
    await page.keyboard.press('Enter');
    console.log(`Search initiated for "${selectedTitle}".`);

    // Wait for search results to load
    await waitForPageContentLoad();

    // Wait for the "live" filter link and click
    const linkSelector = 'a[href*="&f=live"]';
    await page.waitForSelector(linkSelector);
    await page.click(linkSelector);
    console.log("Selected 'Live' filter.");

    // Wait for filtered results to load completely
    await waitForPageContentLoad();

    await page.waitForSelector('article[role="article"][data-testid="tweet"]');

    const comments: Comment[] = [];
    const images: TweetImage[] = [];
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;

    console.log('🚀 Starting content extraction...');

    while (comments.length < 20 && scrollAttempts < maxScrollAttempts) {
      // Extract content with enhanced error handling
      const {newComments, newImages} = await extractContentFromPage();

      // Add unique comments (avoid duplicates)
      newComments.forEach(comment => {
        if (
          comments.length < 20 &&
          comment.content &&
          comment.content.length > 0 &&
          !comments.some(c => c.content === comment.content)
        ) {
          comments.push(comment);
        }
      });

      // Add unique images (avoid duplicates by src)
      newImages.forEach(image => {
        if (image.src && !images.some(img => img.src === image.src)) {
          images.push(image);
        }
      });

      console.log(
        `📊 Scroll ${scrollAttempts + 1}: ${comments.length} comments, ${images.length} images collected.`,
      );

      if (comments.length >= 20) {
        console.log('✅ Target comment count reached!');
        break;
      }

      // Prepare for scroll
      previousHeight = await page.evaluate(() => document.body.scrollHeight);

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      scrollAttempts++;

      // Wait for new content to load after scrolling
      await waitForScrollContent();

      const newHeight = await page.evaluate(() => document.body.scrollHeight);

      if (newHeight === previousHeight) {
        console.log('📄 No more new content to load - reached end of feed.');
        break;
      }
    }

    await sleep(2000);
    console.log(
      `🎉 Final results: ${comments.length} comments, ${images.length} images collected in ${scrollAttempts} scroll attempts.`,
    );

    // Log some stats about collected content
    const validComments = comments.filter(
      c => c.content && c.content.length > 10,
    );
    const validImages = images.filter(i => i.src && i.src.startsWith('http'));
    console.log(
      `📈 Quality check: ${validComments.length} substantial comments, ${validImages.length} valid images`,
    );

    return {randomPhrase: selectedTitle, comments, images};
  } catch (err: any) {
    console.error(`❌ Error in fetchTweetTrends function: ${err.message}`);
    console.error('Stack trace:', err.stack);
    return {randomPhrase: null, comments: [], images: []};
  }
}

export default fetchTweetTrends;
