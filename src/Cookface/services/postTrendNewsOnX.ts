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
  videoFilePath?: string,
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
    await uploadImageToX(
      page,
      imagePath,
      videoFilePath ? videoFilePath : undefined,
    );
    await sleep(3000);

    // Step 6: Press Ctrl+Enter to post
    console.log('Pressing Ctrl+Enter to post...');
    await page.keyboard.down('Control');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Control');
    console.log('Posted successfully using Ctrl+Enter.');

    /**
     * Alternative method using button click
     *
     * const isPostClicked = await page.evaluate(postButtonSelector => {
     *   const postButton = Array.from(
     *     document.querySelectorAll(postButtonSelector),
     *   ).find(span => {
     *     const el = span as HTMLElement;
     *     return el.innerText === 'Post';
     *   });
     *
     *   if (postButton) {
     *     postButton.scrollIntoView({behavior: 'smooth', block: 'center'});
     *     (postButton as HTMLElement).click();
     *     return true;
     *   }
     *   return false;
     * }, postButtonSelector);
     *
     * if (!isPostClicked) {
     *   throw new Error('Failed to find or click the "Post" button.');
     * }
     *
     * console.log('Clicked on the "Post" button successfully.');
     */

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
 * @param videoFilePath Optional path to video file
 */
const uploadImageToX = async (
  page: Page,
  imagePath: string,
  videoFilePath: string | undefined,
): Promise<void> => {
  try {
    console.log('Starting file upload to X...');

    // Find the file input - it should already be there based on your HTML
    const fileInput = await page.waitForSelector('[data-testid="fileInput"]', {
      timeout: 5000,
    });

    if (!fileInput) {
      throw new Error('File input with data-testid="fileInput" not found');
    }

    console.log('Found file input, uploading file...');

    // Upload the file directly - this bypasses the file explorer
    let absolutePath: string;
    const isVideo = !!videoFilePath;

    if (videoFilePath) {
      absolutePath = path.resolve(videoFilePath);
      await (fileInput as ElementHandle<HTMLInputElement>).uploadFile(
        absolutePath,
      );
      console.log(`Video uploaded successfully: ${absolutePath}`);
    } else {
      absolutePath = path.resolve(imagePath);
      await (fileInput as ElementHandle<HTMLInputElement>).uploadFile(
        absolutePath,
      );
      console.log(`Image uploaded successfully: ${absolutePath}`);
    }

    // Different confirmation methods for video vs image
    if (isVideo) {
      // For videos: Wait for the upload confirmation span to appear
      console.log('Waiting for video upload confirmation via text...');

      await page.waitForFunction(
        () => {
          const attachmentsDiv = document.querySelector(
            'div[data-testid="attachments"].css-175oi2r.r-9aw3ui.r-15zivkp.r-14gqq1x.r-184en5c',
          );
          if (!attachmentsDiv) {
            return false;
          }

          const spans = Array.from(attachmentsDiv.querySelectorAll('span'));
          return spans.some(span => {
            const text = span.innerText || span.textContent || '';
            return text.includes(': Uploaded (100%)');
          });
        },
        {
          timeout: 120000, // 120 seconds timeout for video upload completion
          polling: 1000, // Check every 1 second
        },
      );

      console.log(
        '✅ Video upload confirmed - found span with ": Uploaded (100%)" text in attachments div',
      );

      // Optional: Log the exact span text for debugging
      const uploadedSpanText = await page.evaluate(() => {
        const attachmentsDiv = document.querySelector(
          'div[data-testid="attachments"].css-175oi2r.r-9aw3ui.r-15zivkp.r-14gqq1x.r-184en5c',
        );
        if (!attachmentsDiv) {
          return null;
        }

        const spans = Array.from(attachmentsDiv.querySelectorAll('span'));
        const uploadedSpan = spans.find(span => {
          const text = span.innerText || span.textContent || '';
          return text.includes(': Uploaded (100%)');
        });
        return uploadedSpan
          ? uploadedSpan.innerText || uploadedSpan.textContent
          : null;
      });

      if (uploadedSpanText) {
        console.log(`Video upload confirmation text: "${uploadedSpanText}"`);
      }
    } else {
      // For images: Wait for img tag with blob src to appear in attachments div
      console.log('Waiting for image upload confirmation via img element...');

      await page.waitForFunction(
        () => {
          const attachmentsDiv = document.querySelector(
            'div[data-testid="attachments"].css-175oi2r.r-9aw3ui.r-15zivkp.r-14gqq1x.r-184en5c',
          );
          if (!attachmentsDiv) {
            return false;
          }

          const images = Array.from(attachmentsDiv.querySelectorAll('img'));
          return images.some(img => {
            const src = img.getAttribute('src') || '';
            return (
              src.startsWith('blob:https://x.com/') || src.startsWith('blob:')
            );
          });
        },
        {
          timeout: 30000, // 30 seconds timeout for image upload completion
          polling: 1000, // Check every 1 second
        },
      );

      console.log(
        '✅ Image upload confirmed - found img element with blob src in attachments div',
      );

      // Optional: Log the image src for debugging
      const uploadedImageSrc = await page.evaluate(() => {
        const attachmentsDiv = document.querySelector(
          'div[data-testid="attachments"].css-175oi2r.r-9aw3ui.r-15zivkp.r-14gqq1x.r-184en5c',
        );
        if (!attachmentsDiv) {
          return null;
        }

        const images = Array.from(attachmentsDiv.querySelectorAll('img'));
        const uploadedImg = images.find(img => {
          const src = img.getAttribute('src') || '';
          return (
            src.startsWith('blob:https://x.com/') || src.startsWith('blob:')
          );
        });
        return uploadedImg ? uploadedImg.getAttribute('src') : null;
      });

      if (uploadedImageSrc) {
        console.log(`Image upload confirmation src: "${uploadedImageSrc}"`);
      }
    }

    console.log('File upload process completed successfully');
  } catch (error) {
    console.error('Error uploading file to X:', error);

    // Additional debugging: check what's currently in the attachments div
    try {
      const debugInfo = await page.evaluate(() => {
        const attachmentsDiv = document.querySelector(
          'div[data-testid="attachments"].css-175oi2r.r-9aw3ui.r-15zivkp.r-14gqq1x.r-184en5c',
        );
        if (!attachmentsDiv) {
          return {found: false, spans: [], images: []};
        }

        const spans = Array.from(attachmentsDiv.querySelectorAll('span'));
        const spanTexts = spans
          .map(span => span.innerText || span.textContent || '')
          .filter(text => text.trim().length > 0)
          .slice(0, 10);

        const images = Array.from(attachmentsDiv.querySelectorAll('img'));
        const imageSrcs = images
          .map(img => img.getAttribute('src') || '')
          .filter(src => src.length > 0)
          .slice(0, 5);

        return {found: true, spans: spanTexts, images: imageSrcs};
      });

      console.log('Debug info from attachments div:', debugInfo);
    } catch (debugError) {
      console.log('Could not retrieve debug info from attachments div');
    }

    throw error;
  }
};

export {postTrendNewsOnX, uploadImageToX};
