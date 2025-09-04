import {Page} from 'puppeteer';
import {
  navigateToTikTokPage,
  navigateToHome,
  TIKTOK_ROUTES,
} from '../../utils/TikTok/Navigation';
import sleep from '../../utils/sleep';
import path from 'path';
import fs from 'fs';

/**
 * Upload video to TikTok with description
 * @param page - The Puppeteer page instance
 * @param videoFilePath - Path to the video file to upload
 * @param description - Description/caption for the video (newsBite)
 * @param config - Configuration object containing TikTok username
 * @returns Promise<boolean> - Success status of upload
 */
export async function TikTokUpload(
  page: Page,
  videoFilePath: string,
  description: string,
  config?: {TikTokUsername?: string},
): Promise<boolean> {
  try {
    console.log('🎬 Starting TikTok video upload...');
    console.log(`📁 Video file: ${videoFilePath}`);
    console.log(`📝 Description: ${description.substring(0, 100)}...`);

    // Verify video file exists
    if (!fs.existsSync(videoFilePath)) {
      console.error('❌ Video file does not exist:', videoFilePath);
      return false;
    }

    await page.bringToFront();
    await sleep(2000);

    // Navigate to TikTok upload page
    console.log('🔄 Navigating to TikTok upload page...');
    const navSuccess = await navigateToTikTokPage(
      page,
      TIKTOK_ROUTES.UPLOAD,
      config,
    );

    if (!navSuccess) {
      console.error('❌ Failed to navigate to upload page');
      return false;
    }

    console.log('✅ Successfully navigated to upload page');
    await sleep(3000);

    // Find and upload video file
    console.log('🔍 Looking for file input...');
    await page.waitForSelector(
      'input[type="file"][accept="video/*"].jsx-2995057667',
      {
        timeout: 10000,
      },
    );

    const fileInput = await page.$(
      'input[type="file"][accept="video/*"].jsx-2995057667',
    );
    if (!fileInput) {
      console.error('❌ File input not found');
      await navigateToHomeAfterUpload(page);
      return false;
    }

    console.log('📤 Uploading video file...');
    const absolutePath = path.resolve(videoFilePath);
    await fileInput.uploadFile(absolutePath);

    // Wait for upload success confirmation
    console.log('⏳ Waiting for upload confirmation...');
    try {
      await page.waitForSelector('.jsx-1979214919.info-status.success', {
        timeout: 60000, // 60 seconds timeout for upload
      });
      console.log('✅ Video upload confirmed!');
    } catch (uploadError) {
      console.error('❌ Upload confirmation timeout or failed');
      await navigateToHomeAfterUpload(page);
      return false;
    }

    await sleep(2000);

    // Scroll down to ensure description editor is visible
    console.log('📜 Scrolling to find description editor...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await sleep(1000);

    // Find and clear the description editor
    console.log('🔍 Looking for description editor...');
    await page.waitForSelector('.DraftEditor-editorContainer', {
      timeout: 10000,
    });

    const editorContainer = await page.$('.DraftEditor-editorContainer');
    if (!editorContainer) {
      console.error('❌ Description editor container not found');
      await navigateToHomeAfterUpload(page);
      return false;
    }

    // Find the span with data-text="true" within the editor
    const textSpan = await editorContainer.$('span[data-text="true"]');
    if (!textSpan) {
      console.error('❌ Text span not found in editor');
      await navigateToHomeAfterUpload(page);
      return false;
    }

    // Clear existing text and type new description
    console.log('✏️ Clearing existing text and typing new description...');

    // Focus on the text span
    await textSpan.click();
    await sleep(500);

    // Select all existing text and clear it
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await sleep(300);

    // Type the new description
    await page.keyboard.type(description, {delay: 50});
    console.log('✅ Description updated successfully');

    await sleep(20000); // Wait for checks to complete. Update later to check for specific indicators

    // Find the button group and post the video
    console.log('🔍 Looking for post button...');
    await page.waitForSelector('.jsx-3335848873.button-group', {
      timeout: 10000,
    });

    const buttonGroup = await page.$('.jsx-3335848873.button-group');
    if (!buttonGroup) {
      console.error('❌ Button group not found');
      await navigateToHomeAfterUpload(page);
      return false;
    }

    // Find all buttons in the group
    const buttons = await buttonGroup.$$('button');
    console.log(`📋 Found ${buttons.length} buttons in button group`);

    let postButtonFound = false;
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];

      // Look for the "Post" text within button content divs
      const contentDivs = await button.$$('div');

      for (const div of contentDivs) {
        const innerText = await page.evaluate(el => el.innerText?.trim(), div);

        if (innerText === 'Post') {
          console.log('🎯 Found Post button, clicking...');
          await button.click();
          postButtonFound = true;
          break;
        }
      }

      if (postButtonFound) break;
    }

    if (!postButtonFound) {
      console.error('❌ Post button not found');
      await navigateToHomeAfterUpload(page);
      return false;
    }

    console.log(
      '✅ Initial Post button clicked, checking for final confirmation...',
    );
    await sleep(3000);

    // Look for the final "Post now" button after clicking initial "Post"
    console.log('🔍 Looking for "Post now" confirmation button...');
    try {
      // Wait a bit for the "Post now" button to appear
      await sleep(2000);

      // Look for the "Post now" button with the specific structure
      const postNowButtons = await page.$$('div.TUXButton-label');
      let postNowFound = false;

      if (postNowButtons && postNowButtons.length > 0) {
        console.log(
          `📋 Found ${postNowButtons.length} TUXButton-label elements`,
        );

        for (const button of postNowButtons) {
          const innerText = await page.evaluate(
            el => el.innerText?.trim(),
            button,
          );

          if (innerText === 'Post now') {
            console.log(
              '🎯 Found "Post now" button, clicking to finalize upload...',
            );
            await button.click();
            postNowFound = true;
            break;
          }
        }
      } else {
        console.log('📋 No TUXButton-label elements found');
      }

      if (postNowFound) {
        console.log('✅ "Post now" button clicked successfully!');
        await sleep(3000);
      } else {
        console.log(
          'ℹ️ No "Post now" button found - upload may have completed automatically',
        );
      }
    } catch (postNowError) {
      console.log(
        'ℹ️ No "Post now" button appeared - upload likely completed automatically',
      );
      // This is not necessarily an error, continue with success
    }

    console.log('🚀 Video posted successfully to TikTok!');
    await sleep(2000);

    // Navigate back to home page after successful upload
    console.log('🏠 Navigating back to home page...');
    await navigateToHomeAfterUpload(page);

    return true;
  } catch (error) {
    console.error('❌ Error in TikTokUpload:', error);

    // Always try to navigate back to home on error
    await navigateToHomeAfterUpload(page);
    return false;
  }
}

/**
 * Navigate back to home page after upload (success or failure)
 * @param page - The Puppeteer page instance
 */
async function navigateToHomeAfterUpload(page: Page): Promise<void> {
  try {
    console.log('🔄 Attempting to navigate back to home page...');

    const homeNavSuccess = await navigateToHome(page);

    if (homeNavSuccess) {
      console.log('✅ Successfully navigated back to home page');
    } else {
      console.warn(
        '⚠️ Navigation to home failed, trying direct URL navigation...',
      );

      // Fallback: Direct navigation to TikTok home
      await page.goto('https://www.tiktok.com/', {
        waitUntil: 'networkidle2',
        timeout: 15000,
      });
      console.log('✅ Successfully navigated to home via direct URL');
    }

    await sleep(2000);
  } catch (error) {
    console.error('❌ Error navigating back to home:', error);
    // Continue execution even if navigation back to home fails
  }
}

/**
 * Utility function to validate video file before upload
 * @param filePath - Path to video file
 * @returns Object with validation result and file info
 */
export function validateVideoFile(filePath: string): {
  isValid: boolean;
  fileSize?: number;
  extension?: string;
  error?: string;
} {
  try {
    if (!fs.existsSync(filePath)) {
      return {isValid: false, error: 'File does not exist'};
    }

    const stats = fs.statSync(filePath);
    const extension = path.extname(filePath).toLowerCase();

    // Check file size (TikTok has limits, typically around 287MB)
    const maxSize = 287 * 1024 * 1024; // 287MB in bytes
    if (stats.size > maxSize) {
      return {
        isValid: false,
        fileSize: stats.size,
        extension,
        error: `File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB (max: 287MB)`,
      };
    }

    // Check file extension
    const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    if (!allowedExtensions.includes(extension)) {
      return {
        isValid: false,
        fileSize: stats.size,
        extension,
        error: `Unsupported file type: ${extension}`,
      };
    }

    return {
      isValid: true,
      fileSize: stats.size,
      extension,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `File validation error: ${error}`,
    };
  }
}
