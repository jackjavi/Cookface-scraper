import sleep from '../utils/sleep';
import getRandomWaitTime from '../utils/randomWaitTime';
import {Page, ElementHandle} from 'puppeteer';
import path from 'path';
import {
  downloadImage,
  cleanupImage,
  generateMultiPlatformImageFilename,
} from '../utils/imageUtils.js';
import config from '../config/index.js';
import GenerativeAIService from '../services/generativeAI';

const YOUTUBE_LINK =
  'For social media automation and software development services, do not hesitate to contact us. https://youtu.be/dnY2p2whjk8?si=3eBCaHP9GKlwUEUI';
const CHANNEL_LINK =
  '🚂 Join our Telegram channel for uninterrupted news content https://t.me/tnk254';

/**
 * Posts trend news on Facebook with image
 * @param page Puppeteer page instance
 * @param newsBite The news bite to post
 * @param imgUrl The image URL to download and upload
 * @param sharedImagePath Optional: if image is already downloaded, use this path
 * @returns The path of the downloaded image (for reuse in other platforms)
 */
const postTrendNewsOnFB = async (
  page: Page,
  newsBite: string,
  imgUrl: string,
  sharedImagePath?: string,
): Promise<string> => {
  const genAI = new GenerativeAIService();
  let imagePath = sharedImagePath;

  try {
    // Step 1: Download image if not already provided
    if (!imagePath && imgUrl) {
      console.log(`Downloading image from: ${imgUrl}`);
      const imageFilename = generateMultiPlatformImageFilename(
        newsBite,
        'facebook',
      );
      imagePath = `${config.imagesStore}${imageFilename}`;

      await downloadImage(imgUrl, imagePath);
      console.log(`Image downloaded to: ${imagePath}`);
    } else if (sharedImagePath) {
      console.log(`Using shared image: ${sharedImagePath}`);
      imagePath = sharedImagePath;
    }

    // Step 2: Upload image if available
    const rand = Math.random();
    if (imagePath && rand <= 0.9) {
      await uploadImageToFacebook(page, imagePath);
      await sleep(3000);
    }

    // Step 2: Wait for the "What's on your mind?" span to appear
    /** await page.waitForSelector('span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6', {
      timeout: 15000,
      visible: true,
    });

    // Step 3: Click the "What's on your mind?" span
    const clicked = await page.evaluate(() => {
      const spans = Array.from(
        document.querySelectorAll('span.x1lliihq.x6ikm8r.x10wlt62.x1n2onr6'),
      );
      const target = spans.find(span =>
        span.textContent?.includes("What's on your mind,"),
      );
      if (target) {
        (target as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (clicked) {
      console.log('Clicked on "What’s on your mind?" span successfully.');
    } else {
      console.warn('Target span not found.');
    } 

    await sleep(3000); */

    // Step 3: Determine what to post

    let toPost: string;

    /** if (rand > 0.95) {
      toPost = `${YOUTUBE_LINK} `;
    } else if (rand > 0.9) {
      toPost = `${CHANNEL_LINK} `;
    } else {
      toPost = newsBite;
    } */
    toPost = newsBite;

    console.log(`Typing content: ${toPost}`);

    // Step 4: Type the content
    await page.keyboard.type(toPost, {delay: 200});
    console.log('Typed the message into the editor successfully.');

    await sleep(2000);

    // Step 5: Click "Post" button
    const postClicked = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const postBtn = spans.find(span => span.textContent?.trim() === 'Post');
      if (postBtn) {
        (postBtn as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (postClicked) {
      console.log('Clicked on "Post" button successfully.');
    } else {
      console.warn('"Post" button not found.');
    }

    await sleep(getRandomWaitTime(2000, 5000));

    return imagePath || '';
  } catch (err: any) {
    console.error(`Error in postTrendNewsOnFB: ${err.message}`);
    throw err;
  }
};

/**
 * Upload image to Facebook using the file input
 * @param page Puppeteer page instance
 * @param imagePath Local path to the image file
 */
const uploadImageToFacebook = async (
  page: Page,
  imagePath: string,
): Promise<void> => {
  try {
    console.log('Starting image upload to Facebook...');

    // Multiple selectors to find the file input for Facebook
    const fileInputSelectors = [
      'input[accept="image/*,image/heif,image/heic,video/*,video/mp4,video/x-m4v,video/x-matroska,.mkv"]',
      'input[type="file"][accept*="image"]',
      'input.x1s85apg[type="file"]',
      'input[type="file"][multiple]',
    ];

    let fileInput: ElementHandle<HTMLInputElement> | null = null;

    // Try to find existing file input
    for (const selector of fileInputSelectors) {
      try {
        const input = await page.$(selector);
        if (input) {
          fileInput = input as ElementHandle<HTMLInputElement>;
          console.log(`Found file input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // If no file input found, try clicking the Photo/video button first
    if (!fileInput) {
      console.log('File input not found, looking for Photo/video button...');

      const mediaButtonSelectors = [
        '[aria-label="Photo/video"]',
        'div[aria-label="Photo/video"]',
        '[role="button"]:has-text("Photo/video")',
      ];

      let buttonClicked = false;
      for (const selector of mediaButtonSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            console.log(`Clicked Photo/video button: ${selector}`);
            buttonClicked = true;
            await sleep(2000);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Alternative approach: click by aria-label using evaluate
      if (!buttonClicked) {
        const clicked = await page.evaluate(() => {
          const buttons = Array.from(
            document.querySelectorAll('[aria-label="Photo/video"]'),
          );
          if (buttons.length > 0) {
            (buttons[0] as HTMLElement).click();
            return true;
          }
          return false;
        });

        if (clicked) {
          console.log('Clicked Photo/video button using evaluate');
          await sleep(2000);
        }
      }

      // Try to find file input again after clicking button
      for (const selector of fileInputSelectors) {
        try {
          const input = await page.waitForSelector(selector, {
            timeout: 3000,
            visible: false,
          });
          if (input) {
            fileInput = input as ElementHandle<HTMLInputElement>;
            console.log(`Found file input after clicking button: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    if (!fileInput) {
      throw new Error(
        'Could not find file input element for Facebook image upload',
      );
    }

    // Upload the file
    const absolutePath = path.resolve(imagePath);
    await fileInput.uploadFile(absolutePath);
    console.log(`Image uploaded successfully: ${absolutePath}`);

    // Wait for image upload confirmation
    const confirmationSelectors = [
      'img[src*="blob:"]',
      '[data-testid="media-preview"]',
      '.x1i10hfl img',
      '[role="img"]',
      'img[alt*="preview"]',
    ];

    let uploadConfirmed = false;
    for (const selector of confirmationSelectors) {
      try {
        await page.waitForSelector(selector, {timeout: 10000});
        console.log(`Image upload confirmed with selector: ${selector}`);
        uploadConfirmed = true;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!uploadConfirmed) {
      console.log(
        'Warning: Could not confirm image upload, but it may have succeeded',
      );
      await sleep(3000);
    }

    console.log('Facebook image upload process completed');
  } catch (error) {
    console.error('Error uploading image to Facebook:', error);
    throw error;
  }
};

export {postTrendNewsOnFB, uploadImageToFacebook};
