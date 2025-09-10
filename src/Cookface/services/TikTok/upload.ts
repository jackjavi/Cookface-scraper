import {Page} from 'puppeteer';
import {
  navigateToTikTokPage,
  navigateToHome,
  navigateToPreviousPage,
  navigateToHomeDirectly,
  TIKTOK_ROUTES,
} from '../../utils/TikTok/Navigation';
import sleep from '../../utils/sleep';
import path from 'path';
import fs from 'fs';

/**
 * Upload video to TikTok with description and AI content settings
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

    // Navigate to TikTok upload page using the improved navigation
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
      await navigateBackAfterUpload(page);
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
      await navigateBackAfterUpload(page);
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
      await navigateBackAfterUpload(page);
      return false;
    }

    // Find the span with data-text="true" within the editor
    const textSpan = await editorContainer.$('span[data-text="true"]');
    if (!textSpan) {
      console.error('❌ Text span not found in editor');
      await navigateBackAfterUpload(page);
      return false;
    }

    // Scroll the text span into view before interacting with it
    console.log('📜 Scrolling text span into view...');
    await textSpan.scrollIntoView();
    await sleep(1000);

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

    // Handle advanced settings for AI content
    console.log('🔧 Configuring AI content settings...');
    const advancedSettingsSuccess = await handleAdvancedSettings(page);

    if (!advancedSettingsSuccess) {
      console.warn(
        '⚠️ Could not configure advanced settings, continuing with upload...',
      );
    }

    await sleep(20000); // Wait for checks to complete. Update later to check for specific indicators

    // Find the button group and post the video
    console.log('🔍 Looking for post button...');
    await page.waitForSelector('.jsx-3335848873.button-group', {
      timeout: 10000,
    });

    const buttonGroup = await page.$('.jsx-3335848873.button-group');
    if (!buttonGroup) {
      console.error('❌ Button group not found');
      await navigateBackAfterUpload(page);
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
          console.log('🎯 Found Post button, scrolling into view...');
          await button.scrollIntoView();
          await sleep(1000);

          console.log('🎯 Clicking Post button...');
          await button.click();
          postButtonFound = true;
          break;
        }
      }

      if (postButtonFound) break;
    }

    if (!postButtonFound) {
      console.error('❌ Post button not found');
      await navigateBackAfterUpload(page);
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

    // Navigate back after successful upload
    console.log('🔄 Navigating back after successful upload...');
    await navigateBackAfterUpload(page);

    return true;
  } catch (error) {
    console.error('❌ Error in TikTokUpload:', error);

    // Always try to navigate back on error
    await navigateBackAfterUpload(page);
    return false;
  }
}

/**
 * Handle advanced settings configuration for AI content
 * @param page - The Puppeteer page instance
 * @returns Promise<boolean> - Success status of advanced settings configuration
 */
async function handleAdvancedSettings(page: Page): Promise<boolean> {
  try {
    console.log('🔧 Starting advanced settings configuration...');

    // Step 1: Locate the advanced settings container
    console.log('🔍 Looking for advanced settings container...');
    await page.waitForSelector(
      'div[data-e2e="advanced_settings_container"].jsx-3335848873.more-collapse.collapsed',
      {
        timeout: 10000,
      },
    );

    const advancedSettingsContainer = await page.$(
      'div[data-e2e="advanced_settings_container"].jsx-3335848873.more-collapse.collapsed',
    );
    if (!advancedSettingsContainer) {
      console.error('❌ Advanced settings container not found');
      return false;
    }

    // Step 2: Find and click the "Show more" span
    console.log('🔍 Looking for "Show more" span...');
    const showMoreSpan = await advancedSettingsContainer.$(
      'span.jsx-3335848873',
    );
    if (!showMoreSpan) {
      console.error('❌ "Show more" span not found');
      return false;
    }

    // Verify the span contains "Show more" text
    const spanText = await page.evaluate(
      el => el.innerText?.trim(),
      showMoreSpan,
    );
    if (spanText !== 'Show more') {
      console.error(`❌ Expected "Show more" but found: "${spanText}"`);
      return false;
    }

    // Scroll the "Show more" span into view and click it
    console.log('📜 Scrolling "Show more" span into view...');
    await showMoreSpan.scrollIntoView();
    await sleep(1000);

    console.log('🎯 Clicking "Show more" span...');
    await showMoreSpan.click();
    console.log('✅ "Show more" clicked successfully');

    // Step 3: Wait for the options form to appear
    console.log('⏳ Waiting for options form to appear...');
    await sleep(3000); // Wait a few seconds for expansion

    await page.waitForSelector('div.jsx-3335848873.options-form', {
      timeout: 10000,
    });

    const optionsForm = await page.$('div.jsx-3335848873.options-form');
    if (!optionsForm) {
      console.error('❌ Options form not found');
      return false;
    }

    // Step 4: Find the AI content container within the options form
    console.log('🔍 Looking for AI content container...');
    const aiContentContainer = await optionsForm.$(
      'div[data-e2e="aigc_container"].jsx-1157814305.container',
    );
    if (!aiContentContainer) {
      console.error('❌ AI content container not found');
      return false;
    }

    // Step 5: Find the AI content switch input and click it (with multiple fallback strategies)
    console.log('🔍 Looking for AI content switch input...');
    let aiSwitchInput = null;

    // Option 1: Try the specific selector within AI content container
    aiSwitchInput = await page.$(
      'div[data-e2e="aigc_container"] input[type="checkbox"]',
    );

    // Option 2: If not found, try any switch input with dynamic ID pattern
    if (!aiSwitchInput) {
      console.log('🔍 Trying with dynamic ID pattern...');
      aiSwitchInput = await page.$(
        'input[role="switch"][type="checkbox"][id*=":r"]',
      );
    }

    // Option 3: Look for any checkbox within the AI content area using page selector
    if (!aiSwitchInput) {
      console.log('🔍 Looking for any switch input on page...');
      aiSwitchInput = await page.$('input[role="switch"][type="checkbox"]');
    }

    // Option 4: Use a more comprehensive search for switches near AI content
    if (!aiSwitchInput) {
      console.log('🔍 Looking for switch near AI-related content...');
      const switches = await page.$$('input[role="switch"][type="checkbox"]');
      for (const switchEl of switches) {
        // Check if this switch is in an AI-related context
        const isAIRelated = await page.evaluate(el => {
          const container = el.closest('div[data-e2e="aigc_container"]');
          const parentText =
            el.closest('div')?.textContent?.toLowerCase() || '';
          return (
            container !== null ||
            parentText.includes('ai') ||
            parentText.includes('generated') ||
            parentText.includes('aigc')
          );
        }, switchEl);

        if (isAIRelated) {
          aiSwitchInput = switchEl;
          console.log('✅ Found AI-related switch input');
          break;
        }
      }
    }

    // Option 5: Last resort - wait for any switch to appear and use the first/last one
    if (!aiSwitchInput) {
      console.log('🔍 Last resort: waiting for any switch inputs...');
      try {
        await page.waitForSelector('input[role="switch"][type="checkbox"]', {
          timeout: 5000,
        });
        const allSwitches = await page.$$(
          'input[role="switch"][type="checkbox"]',
        );
        console.log(`📋 Found ${allSwitches.length} switch inputs on page`);

        if (allSwitches.length === 1) {
          aiSwitchInput = allSwitches[0];
          console.log('✅ Using the only available switch input');
        } else if (allSwitches.length > 1) {
          // Use the last one (often the most recently added/AI-related)
          aiSwitchInput = allSwitches[allSwitches.length - 1];
          console.log(
            `✅ Using switch ${allSwitches.length} of ${allSwitches.length}`,
          );
        }
      } catch (waitError) {
        console.log('⚠️ No switch inputs found after waiting');
      }
    }

    if (!aiSwitchInput) {
      console.error('❌ AI content switch input not found with any method');
      return false;
    }

    // Check if the switch is already enabled
    const isChecked = await page.evaluate(el => el.checked, aiSwitchInput);
    console.log(
      `🔍 Switch current state: ${isChecked ? 'enabled' : 'disabled'}`,
    );

    if (isChecked) {
      console.log('ℹ️ AI content switch is already enabled, skipping click');
    } else {
      // Scroll the AI switch input into view
      console.log('📜 Scrolling AI content switch into view...');
      await aiSwitchInput.scrollIntoView();
      await sleep(1000);

      console.log('🎯 Clicking AI content switch...');
      await aiSwitchInput.click();
      console.log('✅ AI content switch clicked successfully');

      // Verify the switch was actually toggled
      await sleep(1000);
      const newState = await page.evaluate(el => el.checked, aiSwitchInput);
      console.log(`🔍 Switch new state: ${newState ? 'enabled' : 'disabled'}`);
    }

    // Step 6: Wait for initial 20 seconds before continuing
    console.log(
      '⏳ Waiting 20 seconds before continuing with post button logic...',
    );
    await sleep(20000);

    return true;
  } catch (error) {
    console.error('❌ Error in handleAdvancedSettings:', error);
    return false;
  }
}

/**
 * Navigate back after upload (success or failure) using multiple fallback strategies
 * @param page - The Puppeteer page instance
 */
async function navigateBackAfterUpload(page: Page): Promise<void> {
  try {
    console.log('🔄 Attempting to navigate back after upload...');

    // Strategy 1: Try browser back (most natural)
    console.log('📍 Strategy 1: Trying browser back...');
    let backSuccess = await navigateToPreviousPage(page);
    backSuccess = await navigateToPreviousPage(page);

    if (backSuccess) {
      console.log('✅ Successfully navigated back using browser history');
      return;
    }

    // Strategy 2: Try navigating to home using sidebar navigation
    console.log('📍 Strategy 2: Trying sidebar navigation to home...');
    const homeNavSuccess = await navigateToHome(page);

    if (homeNavSuccess) {
      console.log('✅ Successfully navigated to home using sidebar navigation');
      return;
    }

    // Strategy 3: Direct URL navigation to home (last resort)
    console.log('📍 Strategy 3: Trying direct URL navigation to home...');
    const directSuccess = await navigateToHomeDirectly(page);

    if (directSuccess) {
      console.log('✅ Successfully navigated to home via direct URL');
    } else {
      console.warn('⚠️ All navigation strategies failed');
    }

    await sleep(2000);
  } catch (error) {
    console.error('❌ Error in navigateBackAfterUpload:', error);
    // Continue execution even if navigation fails
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
