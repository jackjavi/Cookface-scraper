import config from '../../config';
import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';

class GenerativeAIVideoService {
  private videoStore: string;

  constructor() {
    this.videoStore = config.videoStore;

    // Configure FFmpeg paths based on operating system
    this.configureFfmpegPaths();
  }

  /**
   * Configure FFmpeg paths based on the current operating system
   */
  private configureFfmpegPaths(): void {
    const os = require('os');
    const platform = os.platform();

    console.log(`Detected operating system: ${platform}`);

    // Only configure explicit paths for Windows
    if (platform === 'win32') {
      const ffmpegPath = 'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe';
      const ffprobePath = 'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe';

      // Verify both executables exist
      if (fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath)) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        ffmpeg.setFfprobePath(ffprobePath);
        console.log(`FFmpeg configured for Windows at: ${ffmpegPath}`);
        console.log(`FFprobe configured for Windows at: ${ffprobePath}`);
      } else {
        console.error('FFmpeg or FFprobe not found at expected Windows paths:');
        console.error(
          `FFmpeg: ${ffmpegPath} - ${fs.existsSync(ffmpegPath) ? 'EXISTS' : 'NOT FOUND'}`,
        );
        console.error(
          `FFprobe: ${ffprobePath} - ${fs.existsSync(ffprobePath) ? 'EXISTS' : 'NOT FOUND'}`,
        );
        console.warn('Attempting to use system PATH for FFmpeg...');
      }
    } else {
      // Linux/macOS - use system PATH (no explicit configuration needed)
      console.log(`Using system PATH for FFmpeg on ${platform}`);
    }
  }

  /**
   * Generate video filename for storage
   */
  private generateVideoFilename(newsBite: string): string {
    const cleanTitle = newsBite
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 40);

    const timestamp = Date.now();
    return `tnk-news-${cleanTitle}-${timestamp}.mp4`;
  }

  /**
   * Ensure video directory exists
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
   * Get audio duration
   */
  private async getAudioDuration(audioPath: string): Promise<number> {
    return new Promise(resolve => {
      ffmpeg.ffprobe(audioPath, (err: any, metadata: any) => {
        if (err) {
          console.warn(
            'Could not get audio duration, using default:',
            err.message,
          );
          resolve(30);
          return;
        }
        const duration = metadata.format.duration || 30;
        const validDuration = Math.min(Math.max(parseFloat(duration), 5), 120);
        resolve(validDuration);
      });
    });
  }

  /**
   * Validate image paths
   */
  private validateImagePaths(imagePaths: string[]): string[] {
    const validPaths: string[] = [];

    for (const imagePath of imagePaths) {
      try {
        if (fs.existsSync(imagePath) && fs.statSync(imagePath).isFile()) {
          fs.accessSync(imagePath, fs.constants.R_OK);
          validPaths.push(imagePath);
        } else {
          console.warn(`Image file not found: ${imagePath}`);
        }
      } catch (error) {
        console.warn(`Cannot access image file: ${imagePath}`, error);
      }
    }

    return validPaths;
  }

  /**
   * Create simple video from single image - NO COMPLEX FILTERS
   */
  private async createSingleImageVideo(
    imagePath: string,
    audioPath: string,
    outputPath: string,
    title?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Creating simple single image video...');

      const command = ffmpeg()
        .input(imagePath)
        .inputOptions(['-loop', '1'])
        .input(audioPath)
        .outputOptions([
          '-c:v libx264',
          '-c:a aac',
          '-b:a 128k',
          '-pix_fmt yuv420p',
          '-vf',
          'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:-1:-1:color=black',
          '-r 30',
          '-shortest',
          '-movflags +faststart',
          '-preset ultrafast',
          '-crf 28',
        ])
        .output(outputPath)
        .on('start', commandLine => {
          console.log('Simple video command started');
        })
        .on('progress', progress => {
          console.log(`Video progress: ${Math.round(progress.percent || 0)}%`);
        })
        .on('end', () => {
          console.log('Simple video completed');
          resolve();
        })
        .on('error', err => {
          console.error('Simple video error:', err.message);
          reject(new Error(`Simple video failed: ${err.message}`));
        });

      command.run();
    });
  }

  /**
   * Create multi-image video by concatenation method - SIMPLE APPROACH
   */
  private async createMultiImageVideo(
    imagePaths: string[],
    audioPath: string,
    outputPath: string,
    duration: number,
    title?: string,
  ): Promise<void> {
    const tempDir = path.dirname(outputPath);
    const tempVideos: string[] = [];
    const concatFile = path.join(tempDir, `concat_${Date.now()}.txt`);

    try {
      console.log(
        `Creating multi-image video with ${imagePaths.length} images using concat method...`,
      );

      const timePerImage = Math.max(duration / imagePaths.length, 2); // Min 2 seconds per image

      // Create individual video for each image
      for (let i = 0; i < imagePaths.length; i++) {
        const tempVideoPath = path.join(tempDir, `temp_${Date.now()}_${i}.mp4`);
        await this.createTempVideoForImage(
          imagePaths[i],
          tempVideoPath,
          timePerImage,
        );
        tempVideos.push(tempVideoPath);
        console.log(`Created temp video ${i + 1}/${imagePaths.length}`);
      }

      // Create concat file
      const concatContent = tempVideos
        .map(video => `file '${path.basename(video)}'`)
        .join('\n');
      fs.writeFileSync(concatFile, concatContent);

      // Concatenate all videos and add audio
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(concatFile)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .input(audioPath)
          .outputOptions([
            '-c:v libx264',
            '-c:a aac',
            '-b:a 128k',
            '-pix_fmt yuv420p',
            '-r 30',
            `-t ${duration}`,
            '-movflags +faststart',
            '-preset ultrafast',
            '-crf 28',
          ])
          .output(outputPath)
          .on('start', () => {
            console.log('Concatenating videos with audio...');
          })
          .on('progress', progress => {
            console.log(
              `Concat progress: ${Math.round(progress.percent || 0)}%`,
            );
          })
          .on('end', () => {
            console.log('Multi-image video completed');
            resolve();
          })
          .on('error', err => {
            console.error('Concat error:', err.message);
            reject(new Error(`Concat failed: ${err.message}`));
          })
          .run();
      });
    } finally {
      // Clean up temp files
      tempVideos.forEach(tempVideo => {
        if (fs.existsSync(tempVideo)) {
          try {
            fs.unlinkSync(tempVideo);
          } catch (e) {
            console.warn(`Failed to delete temp video: ${tempVideo}`);
          }
        }
      });

      if (fs.existsSync(concatFile)) {
        try {
          fs.unlinkSync(concatFile);
        } catch (e) {
          console.warn(`Failed to delete concat file: ${concatFile}`);
        }
      }
    }
  }

  /**
   * Create temporary video for single image - ULTRA SIMPLE
   */
  private async createTempVideoForImage(
    imagePath: string,
    outputPath: string,
    duration: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(imagePath)
        .inputOptions(['-loop', '1', '-t', duration.toString()])
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-vf',
          'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:-1:-1:color=black',
          '-r 30',
          '-preset ultrafast',
          '-crf 30', // Higher CRF for temp videos (smaller file)
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', err =>
          reject(new Error(`Temp video creation failed: ${err.message}`)),
        )
        .run();
    });
  }

  /**
   * Generate video from image(s) and audio - SIMPLIFIED MAIN METHOD
   */
  async generateVideoFromImageAndAudio(
    imagePathOrPaths: string | string[],
    audioFilePath: string,
    newsBite?: string,
  ): Promise<string> {
    try {
      console.log('Starting simplified video generation...');

      // Normalize input to array
      const imagePaths = Array.isArray(imagePathOrPaths)
        ? imagePathOrPaths
        : [imagePathOrPaths];

      console.log(`Processing ${imagePaths.length} image(s)`);

      // Validate inputs
      if (!imagePaths.length || !audioFilePath) {
        throw new Error('Missing required parameters');
      }

      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }

      // Validate and filter image paths
      const validImagePaths = this.validateImagePaths(imagePaths);
      if (validImagePaths.length === 0) {
        throw new Error('No valid image files found');
      }

      console.log(`Using ${validImagePaths.length} valid images`);

      // Get audio duration
      const audioDuration = await this.getAudioDuration(audioFilePath);
      console.log(`Audio duration: ${audioDuration.toFixed(2)} seconds`);

      // Ensure video directory exists
      await this.ensureVideoDirectory();

      // Generate output path
      const videoFilename = this.generateVideoFilename(newsBite || 'video');
      const videoFilePath = path.join(this.videoStore, videoFilename);

      // Always try multi-image first if more than one image
      if (validImagePaths.length === 1) {
        console.log('Single image - creating simple video');
        await this.createSingleImageVideo(
          validImagePaths[0],
          audioFilePath,
          videoFilePath,
          newsBite,
        );
      } else {
        console.log(
          `Multiple images (${validImagePaths.length}) - trying multi-image video`,
        );

        try {
          await this.createMultiImageVideo(
            validImagePaths,
            audioFilePath,
            videoFilePath,
            audioDuration,
            newsBite,
          );
          console.log('Multi-image video created successfully');
        } catch (error) {
          console.warn('Multi-image failed, using first image only:', error);
          // Clean up any partial output
          if (fs.existsSync(videoFilePath)) {
            fs.unlinkSync(videoFilePath);
          }

          await this.createSingleImageVideo(
            validImagePaths[0],
            audioFilePath,
            videoFilePath,
            newsBite,
          );
        }
      }

      // Verify video was created
      if (!fs.existsSync(videoFilePath)) {
        throw new Error('Video file was not created');
      }

      const stats = fs.statSync(videoFilePath);
      console.log(
        `Video created: ${videoFilePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
      );

      return videoFilePath;
    } catch (error: any) {
      console.error('Video generation error:', error);
      throw new Error(`Failed to generate video: ${error.message}`);
    }
  }

  // Utility methods (unchanged)
  async getVideoStats(videoFilePath: string): Promise<fs.Stats | null> {
    try {
      return fs.existsSync(videoFilePath) ? fs.statSync(videoFilePath) : null;
    } catch (error) {
      console.error('Error getting video stats:', error);
      return null;
    }
  }

  async getVideoDuration(videoFilePath: string): Promise<number> {
    return new Promise(resolve => {
      ffmpeg.ffprobe(videoFilePath, (err: any, metadata: any) => {
        if (err) {
          console.error('Error getting video duration:', err);
          resolve(0);
          return;
        }
        resolve(parseFloat(metadata.format.duration || 0));
      });
    });
  }

  async cleanupVideo(videoFilePath: string): Promise<void> {
    try {
      if (fs.existsSync(videoFilePath)) {
        await fs.promises.unlink(videoFilePath);
        console.log(`Cleaned up: ${videoFilePath}`);
      }
    } catch (error) {
      console.error(`Cleanup error: ${videoFilePath}`, error);
    }
  }

  async cleanupOldVideoFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      if (!fs.existsSync(this.videoStore)) return;

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
          }
        }
      }

      console.log(`Cleaned up ${cleanedCount} old video files`);
    } catch (error) {
      console.error('Error cleaning up old files:', error);
    }
  }

  videoExists(videoFilePath: string): boolean {
    try {
      return fs.existsSync(videoFilePath);
    } catch {
      return false;
    }
  }

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
    } catch {
      return 'Unknown';
    }
  }
}

export default GenerativeAIVideoService;
