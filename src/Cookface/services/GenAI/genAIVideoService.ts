import config from '../../config';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';

class GenerativeAIVideoService {
  private videoStore: string;

  constructor() {
    this.videoStore = config.videoStore;
  }

  /**
   * Generate video filename for storage
   * @param newsBite - The news bite content to base filename on
   * @returns string - Generated filename
   */
  private generateVideoFilename(newsBite: string): string {
    // Clean the news bite for filename
    const cleanTitle = newsBite
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase()
      .substring(0, 40); // Limit length

    const timestamp = Date.now();
    return `tnk-news-${cleanTitle}-${timestamp}.mp4`;
  }

  /**
   * Ensure video directory exists
   * @returns Promise<void>
   */
  private async ensureVideoDirectory(): Promise<void> {
    try {
      if (!fs.existsSync(this.videoStore)) {
        fs.mkdirSync(this.videoStore, {recursive: true});
        console.log(`Created video directory: ${this.videoStore}`);
      }
    } catch (error) {
      console.error('Error creating video directory:', error);
      throw error;
    }
  }

  /**
   * Get image dimensions using FFprobe
   * @param imagePath - Path to the image file
   * @returns Promise<{width: number, height: number}>
   */
  private async getImageDimensions(
    imagePath: string,
  ): Promise<{width: number; height: number}> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(imagePath, (err: any, metadata: any) => {
        if (err) {
          console.error('Error getting image dimensions:', err);
          // Return default dimensions if probe fails
          resolve({width: 1280, height: 720});
          return;
        }

        const videoStream = metadata.streams.find(
          (stream: any) => stream.codec_type === 'video',
        );
        if (videoStream) {
          resolve({
            width: videoStream.width || 1280,
            height: videoStream.height || 720,
          });
        } else {
          resolve({width: 1280, height: 720});
        }
      });
    });
  }

  /**
   * Generate video from image and audio using FFmpeg
   * @param imagePath - Path to the image file
   * @param audioPath - Path to the audio file
   * @param outputPath - Path where the video should be saved
   * @returns Promise<void>
   */
  private async createVideoWithFFmpeg(
    imagePath: string,
    audioPath: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      console.log('Starting video generation with FFmpeg...');
      console.log(`Image: ${imagePath}`);
      console.log(`Audio: ${audioPath}`);
      console.log(`Output: ${outputPath}`);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, {recursive: true});
      }

      try {
        // Get image dimensions first
        const dimensions = await this.getImageDimensions(imagePath);
        console.log(
          `Image dimensions: ${dimensions.width}x${dimensions.height}`,
        );

        // Ensure dimensions are even numbers (required by libx264)
        const width =
          dimensions.width % 2 === 0 ? dimensions.width : dimensions.width - 1;
        const height =
          dimensions.height % 2 === 0
            ? dimensions.height
            : dimensions.height - 1;

        console.log(`Adjusted dimensions: ${width}x${height}`);

        const command = ffmpeg()
          .input(imagePath)
          .inputOptions([
            '-loop 1', // Loop the image
            '-framerate 25', // Standard framerate
          ])
          .input(audioPath)
          .outputOptions([
            '-c:v libx264', // Video codec
            '-tune stillimage', // Optimize for still images
            '-c:a aac', // Audio codec
            '-b:a 128k', // Reduced audio bitrate
            '-pix_fmt yuv420p', // Pixel format for compatibility
            `-s ${width}x${height}`, // Explicitly set video size
            '-r 25', // Output framerate
            '-shortest', // End when shortest input ends (audio in this case)
            '-movflags +faststart', // Optimize for web streaming
            '-preset ultrafast', // Faster encoding
            '-crf 23', // Constant rate factor for good quality
          ])
          .output(outputPath)
          .on('start', commandLine => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('progress', progress => {
            console.log(
              `Video generation progress: ${Math.round(progress.percent || 0)}%`,
            );
          })
          .on('end', () => {
            console.log('Video generation completed successfully');
            resolve();
          })
          .on('error', err => {
            console.error('FFmpeg error:', err.message);
            reject(new Error(`Video generation failed: ${err.message}`));
          });

        command.run();
      } catch (error) {
        console.error('Error in video generation setup:', error);
        reject(error);
      }
    });
  }

  /**
   * Generate video from image path and audio file
   * @param imagePath - Local path to the image file
   * @param audioFilePath - Path to the audio file
   * @param newsBite - News bite content for filename generation (optional for future use like subtitles)
   * @returns Promise<string> - Path to the generated video file
   */
  async generateVideoFromImageAndAudio(
    imagePath: string,
    audioFilePath: string,
    newsBite?: string,
  ): Promise<string> {
    try {
      console.log('Starting video generation process...');

      // Validate inputs
      if (!imagePath || !audioFilePath) {
        throw new Error(
          'Missing required parameters: imagePath and audioFilePath are required',
        );
      }

      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }

      // Check if files are readable
      try {
        fs.accessSync(imagePath, fs.constants.R_OK);
        fs.accessSync(audioFilePath, fs.constants.R_OK);
      } catch (accessError) {
        throw new Error(`Cannot access input files: ${accessError}`);
      }

      // Ensure video directory exists
      await this.ensureVideoDirectory();

      // Generate video filename and path
      const videoFilename = this.generateVideoFilename(
        newsBite || 'news-video',
      );
      const videoFilePath = path.join(this.videoStore, videoFilename);

      // Generate video using FFmpeg
      console.log('Creating video with FFmpeg...');
      await this.createVideoWithFFmpeg(imagePath, audioFilePath, videoFilePath);

      // Verify video was created
      if (!fs.existsSync(videoFilePath)) {
        throw new Error('Video file was not created successfully');
      }

      const stats = fs.statSync(videoFilePath);
      console.log(`Video generated successfully: ${videoFilePath}`);
      console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      return videoFilePath;
    } catch (error: any) {
      console.error('Error generating video:', error);
      throw new Error(`Failed to generate video: ${error.message}`);
    }
  }

  /**
   * Get video file stats
   * @param videoFilePath - Path to video file
   * @returns Promise<fs.Stats | null>
   */
  async getVideoStats(videoFilePath: string): Promise<fs.Stats | null> {
    try {
      if (fs.existsSync(videoFilePath)) {
        return fs.statSync(videoFilePath);
      }
      return null;
    } catch (error) {
      console.error('Error getting video stats:', error);
      return null;
    }
  }

  /**
   * Get video duration using FFprobe (part of FFmpeg)
   * @param videoFilePath - Path to video file
   * @returns Promise<number> - Duration in seconds, or 0 if error
   */
  async getVideoDuration(videoFilePath: string): Promise<number> {
    return new Promise(resolve => {
      ffmpeg.ffprobe(videoFilePath, (err: any, metadata: any) => {
        if (err) {
          console.error('Error getting video duration:', err);
          resolve(0);
          return;
        }

        const duration = metadata.format.duration || 0;
        resolve(parseFloat(duration));
      });
    });
  }

  /**
   * Cleanup video file after use
   * @param videoFilePath - Path to the video file to cleanup
   */
  async cleanupVideo(videoFilePath: string): Promise<void> {
    try {
      if (fs.existsSync(videoFilePath)) {
        await fs.promises.unlink(videoFilePath);
        console.log(`Cleaned up video file: ${videoFilePath}`);
      } else {
        console.log(`Video file not found for cleanup: ${videoFilePath}`);
      }
    } catch (error) {
      console.error(`Error cleaning up video file ${videoFilePath}:`, error);
      // Don't throw error - cleanup failure shouldn't stop the process
    }
  }

  /**
   * Clean up old video files (older than specified hours)
   * @param maxAgeHours - Maximum age in hours (default: 24)
   */
  async cleanupOldVideoFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      if (!fs.existsSync(this.videoStore)) {
        console.log('Video storage directory does not exist');
        return;
      }

      const files = await fs.promises.readdir(this.videoStore);
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        if (file.endsWith('.mp4')) {
          const filePath = path.join(this.videoStore, file);
          const stats = await fs.promises.stat(filePath);

          if (now - stats.mtime.getTime() > maxAgeMs) {
            await fs.promises.unlink(filePath);
            cleanedCount++;
            console.log(`Cleaned up old video file: ${file}`);
          }
        }
      }

      console.log(`Cleaned up ${cleanedCount} old video files`);
    } catch (error) {
      console.error('Error cleaning up old video files:', error);
    }
  }

  /**
   * Check if video file exists
   * @param videoFilePath - Path to video file
   * @returns boolean
   */
  videoExists(videoFilePath: string): boolean {
    try {
      return fs.existsSync(videoFilePath);
    } catch (error) {
      console.error('Error checking video existence:', error);
      return false;
    }
  }

  /**
   * Get formatted file size
   * @param videoFilePath - Path to video file
   * @returns Promise<string> - Formatted file size or 'Unknown'
   */
  async getFormattedFileSize(videoFilePath: string): Promise<string> {
    try {
      const stats = await this.getVideoStats(videoFilePath);
      if (!stats) return 'Unknown';

      const bytes = stats.size;
      if (bytes === 0) return '0 Bytes';

      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch (error) {
      console.error('Error getting formatted file size:', error);
      return 'Unknown';
    }
  }
}

export default GenerativeAIVideoService;
