import TikTokGainTrainService from '../../services/TikTok/GainTrainService';
import {TikTokUpload, validateVideoFile} from '../../services/TikTok/upload';
import config from '../../config';
import {Page} from 'puppeteer';
import * as path from 'path';
import sleep from '../../utils/sleep';

/**
 * TikTok Gain Train Module
 * Generates and uploads short animated videos for follower growth
 * @param tiktokPage - Puppeteer page for TikTok
 */
export const TikTokGainTrainModule = async (
  tiktokPage: Page,
): Promise<void> => {
  let gainTrainService: TikTokGainTrainService | null = null;
  let videoResult: any = null;

  try {
    console.log('🚂 Starting TikTok Gain Train Module...');

    // Initialize the gain train service
    gainTrainService = new TikTokGainTrainService();

    // Generate gain train content
    console.log('🎬 Generating gain train video content...');
    videoResult = await gainTrainService.generateGainTrainContent({
      maxDuration: 5, // 5 seconds for quick engagement
      effects: {
        glitch: true,
        grid: true,
        zoom: true,
        shake: true,
        colorShift: true,
        particles: true,
        pulse: true,
        rotate: false,
      },
    });

    console.log('✅ Gain train content generated successfully!');
    console.log(gainTrainService.getVideoInfo(videoResult));

    // Validate video file before upload
    const validation = validateVideoFile(path.resolve(videoResult.videoPath));
    if (!validation.isValid) {
      console.error('❌ Video validation failed:', validation.error);
      return;
    }

    console.log(
      `✅ Video validated: ${(validation.fileSize! / 1024 / 1024).toFixed(1)}MB ${validation.extension}`,
    );

    // Prepare full description with hashtags
    const fullDescription = `${videoResult.description}\n${videoResult.hashtags.join(' ')}`;

    console.log('📱 Uploading to TikTok...');
    console.log(`Description: ${videoResult.description}`);
    console.log(`Hashtags: ${videoResult.hashtags.slice(0, 8).join(' ')}...`);

    // Upload to TikTok
    const uploadSuccess = await TikTokUpload(
      tiktokPage,
      videoResult.videoPath,
      fullDescription,
      {
        TikTokUsername: config.TikTokUsername,
        isGainTrain: true,
      },
    );

    if (uploadSuccess) {
      console.log('🎉 Successfully uploaded gain train video to TikTok!');
      console.log(`📊 Video duration: ${videoResult.duration.toFixed(1)}s`);
      console.log(`📝 Used transcript: ${videoResult.transcript}`);
    } else {
      console.error('❌ TikTok gain train upload failed');
    }

    // Short delay before cleanup
    await sleep(2000);
  } catch (error) {
    console.error('❌ Error in TikTok Gain Train Module:', error);
  } finally {
    // Cleanup files
    if (gainTrainService && videoResult) {
      console.log('🧹 Cleaning up gain train files...');
      try {
        // await gainTrainService.cleanupGainTrainVideo(videoResult);
        // console.log('✅ Cleanup completed');
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup warning:', cleanupError);
      }
    }
  }
};

/**
 * Batch TikTok Gain Train Module
 * Generates multiple videos for scheduled uploads
 * @param tiktokPage - Puppeteer page for TikTok
 * @param count - Number of videos to generate (default: 3)
 */
export const TikTokGainTrainBatchModule = async (
  tiktokPage: Page,
  count: number = 3,
): Promise<void> => {
  let gainTrainService: TikTokGainTrainService | null = null;

  try {
    console.log(
      `🚂 Starting TikTok Gain Train Batch Module (${count} videos)...`,
    );

    gainTrainService = new TikTokGainTrainService();
    const results =
      await gainTrainService.generateMultipleGainTrainVideos(count);

    console.log(
      `✅ Generated ${results.length} gain train videos successfully!`,
    );

    // Upload each video with delays
    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      try {
        console.log(`📱 Uploading video ${i + 1}/${results.length}...`);

        const validation = validateVideoFile(path.resolve(result.videoPath));
        if (!validation.isValid) {
          console.error(
            `❌ Video ${i + 1} validation failed:`,
            validation.error,
          );
          continue;
        }

        const fullDescription = `${result.description}\n${result.hashtags.join(' ')}`;

        const uploadSuccess = await TikTokUpload(
          tiktokPage,
          result.videoPath,
          fullDescription,
          {
            TikTokUsername: config.TikTokUsername,
            isGainTrain: true,
          },
        );

        if (uploadSuccess) {
          console.log(`🎉 Video ${i + 1} uploaded successfully!`);
        } else {
          console.error(`❌ Video ${i + 1} upload failed`);
        }

        // Wait between uploads to avoid rate limits
        if (i < results.length - 1) {
          console.log('⏳ Waiting before next upload...');
          await sleep(30000); // 30 second delay between uploads
        }
      } catch (uploadError) {
        console.error(`❌ Error uploading video ${i + 1}:`, uploadError);
      }
    }

    // Cleanup all generated files
    console.log('🧹 Cleaning up batch files...');
    for (const result of results) {
      try {
        await gainTrainService!.cleanupGainTrainVideo(result);
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup warning for batch file:', cleanupError);
      }
    }

    console.log('✅ Batch upload completed!');
  } catch (error) {
    console.error('❌ Error in TikTok Gain Train Batch Module:', error);
  }
};

export default TikTokGainTrainModule;
