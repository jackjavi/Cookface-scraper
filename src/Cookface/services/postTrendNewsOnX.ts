import sleep from '../utils/sleep';
import getRandomWaitTime from '../utils/randomWaitTime';
import retweetOwnPost from '../utils/retweetOwnPost';
import {Page, ElementHandle} from 'puppeteer';
import path from 'path';
import {
  downloadImage,
  cleanupImage,
  generateMultiPlatformImageFilename,
} from '../utils/imageUtils.js';
import config from '../config/index.js';

/**
 * Posts trend news on X (formerly Twitter) with image
 * @param label The label to navigate to (e.g., 'Home')
 * @param page Puppeteer page instance
 * @param newsBite The news bite to post
 * @param imgUrl The image URL to download and upload
 * @param sharedImagePath Optional: if image is already downloaded, use this path
 * @returns The path of the downloaded image (for reuse in other platforms)
 */
const postTrendNewsOnX = async (
  label: string,
  page: Page,
  newsBite: string,
  imgUrl: string,
  sharedImagePath?: string,
): Promise<string> => {
  const navSelector = 'nav[aria-label="Primary"] a';
  const placeholderSelector = '.public-DraftEditorPlaceholder-inner';
  const postButtonSelector = 'div[dir="ltr"] span.css-1jxf684 > span';

  let imagePath = sharedImagePath;

  try {
    // Step 1: Download image if not already provided
    if (!imagePath) {
      console.log(`Downloading image from: ${imgUrl}`);
      const imageFilename = generateMultiPlatformImageFilename(
        newsBite,
        'multiplatform',
      );
      imagePath = `${config.imagesStore}${imageFilename}`;

      await downloadImage(imgUrl, imagePath);
      console.log(`Image downloaded to: ${imagePath}`);
    } else {
      console.log(`Using shared image: ${imagePath}`);
    }

    // Step 2: Navigate to the specified label
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
    await sleep(2000);

    // Reload the page
    await page.reload({waitUntil: 'networkidle2'});
    console.log('Page reloaded successfully.');

    // Step 3: Click on the "What's happening?" input
    const isPlaceholderClicked = await page.evaluate(placeholderSelector => {
      const placeholder = document.querySelector(
        placeholderSelector,
      ) as HTMLElement | null;

      if (placeholder && placeholder.innerText.trim() === 'What’s happening?') {
        placeholder.click();
        return true;
      }
      return false;
    }, placeholderSelector);

    if (!isPlaceholderClicked) {
      throw new Error(
        'Failed to find or click the placeholder with "What’s happening?" text.',
      );
    }

    console.log('Clicked on the "What’s happening?" placeholder successfully.');
    await sleep(2000);

    // Step 4: Type the news bite (without image URL since we're uploading the actual image)
    await page.keyboard.type(newsBite, {delay: 200});
    console.log('Typed the message into the editor successfully.');
    await sleep(1000);

    // Step 5: Upload the image using the existing file input
    await uploadImageToX(page, imagePath);
    await sleep(3000);

    // Step 6: Click the "Post" button
    const isPostClicked = await page.evaluate(postButtonSelector => {
      const postButton = Array.from(
        document.querySelectorAll(postButtonSelector),
      ).find(span => {
        const el = span as HTMLElement;
        return el.innerText === 'Post';
      });

      if (postButton) {
        postButton.scrollIntoView({behavior: 'smooth', block: 'center'});
        (postButton as HTMLElement).click();
        return true;
      }
      return false;
    }, postButtonSelector);

    if (!isPostClicked) {
      throw new Error('Failed to find or click the "Post" button.');
    }

    console.log('Clicked on the "Post" button successfully.');
    await sleep(getRandomWaitTime(3000, 5000));

    // Retweet and Later Like
    await retweetOwnPost('Search and explore', page, newsBite);

    // Return the image path for reuse in other platforms
    return imagePath;
  } catch (err: any) {
    console.error(`Error in postTrendNewsOnX: ${err.message}`);
    throw err;
  }
};

/**
 * Upload image to X using the existing file input
 * @param page Puppeteer page instance
 * @param imagePath Local path to the image file
 */
const uploadImageToX = async (page: Page, imagePath: string): Promise<void> => {
  try {
    console.log('Starting image upload to X...');

    // Find the file input - it should already be there based on your HTML
    const fileInput = await page.waitForSelector('[data-testid="fileInput"]', {
      timeout: 5000,
    });

    if (!fileInput) {
      throw new Error('File input with data-testid="fileInput" not found');
    }

    console.log('Found file input, uploading image...');

    // Upload the file directly - this bypasses the file explorer
    const absolutePath = path.resolve(imagePath);
    await (fileInput as ElementHandle<HTMLInputElement>).uploadFile(
      absolutePath,
    );
    console.log(`Image uploaded successfully: ${absolutePath}`);

    // Wait for the image to be processed and appear in the tweet composer
    // Look for the remove media button which indicates successful upload
    try {
      await page.waitForSelector('[data-testid="removeMedia"]', {
        timeout: 15000,
      });
      console.log('Image upload confirmed - remove media button appeared');
    } catch (e) {
      // Alternative confirmation: look for media preview
      try {
        await page.waitForSelector('[data-testid="media-item"]', {
          timeout: 5000,
        });
        console.log('Image upload confirmed - media item detected');
      } catch (e2) {
        // Another alternative: look for any image with blob URL
        try {
          await page.waitForSelector('img[src*="blob:"]', {timeout: 5000});
          console.log('Image upload confirmed - blob image detected');
        } catch (e3) {
          console.log(
            'Warning: Could not confirm image upload, but it may have succeeded',
          );
          await sleep(3000); // Give it some time anyway
        }
      }
    }

    console.log('Image upload process completed');
  } catch (error) {
    console.error('Error uploading image to X:', error);
    throw error;
  }
};

export {postTrendNewsOnX, uploadImageToX};
