import * as path from 'path';
import * as fs from 'fs';
import {execSync} from 'child_process';
import sharp from 'sharp';

interface VideoEffects {
  glitch: boolean;
  grid: boolean;
  zoom: boolean;
  shake: boolean;
  colorShift: boolean;
  particles: boolean;
  pulse: boolean;
  rotate: boolean;
}

class AnimatedVideoService {
  private outputDir: string;
  private tempDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    this.tempDir = path.join(outputDir, 'temp');
    this.ensureDirectoryExists(this.tempDir);
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {recursive: true});
    }
  }

  /**
   * Validate audio file format and fix if necessary
   */
  private async validateAndFixAudio(audioPath: string): Promise<string> {
    try {
      console.log('Validating audio file...');

      // Check if file exists and has content
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Audio file does not exist: ${audioPath}`);
      }

      const stats = fs.statSync(audioPath);
      if (stats.size === 0) {
        throw new Error(`Audio file is empty: ${audioPath}`);
      }

      console.log(`Audio file size: ${stats.size} bytes`);

      // Test audio with ffprobe
      try {
        const probeCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${audioPath}"`;
        const probeOutput = execSync(probeCmd, {encoding: 'utf8'});
        const probeData = JSON.parse(probeOutput);

        if (!probeData.streams || probeData.streams.length === 0) {
          throw new Error('No valid audio streams found');
        }

        console.log('Audio validation passed');
        return audioPath;
      } catch (probeError) {
        console.warn('Audio probe failed, attempting to fix...');

        // Create a fixed version of the audio file
        const fixedAudioPath = audioPath.replace('.wav', '_fixed.wav');
        const fixCmd = `ffmpeg -y -i "${audioPath}" -ar 44100 -ac 1 -c:a pcm_s16le "${fixedAudioPath}"`;

        try {
          execSync(fixCmd, {stdio: 'pipe'});
          console.log('Audio file fixed successfully');
          return fixedAudioPath;
        } catch (fixError) {
          throw new Error(`Cannot fix audio file: ${fixError}`);
        }
      }
    } catch (error: any) {
      console.error('Audio validation error:', error);
      throw new Error(`Audio validation failed: ${error.message}`);
    }
  }

  /**
   * Generate animated video with simplified, stable effects
   */
  async generateAnimatedVideo(
    audioPath: string,
    backgroundImage?: string,
    title?: string,
    duration?: number,
    effects: VideoEffects = {
      glitch: false,
      grid: false,
      zoom: true,
      shake: false,
      colorShift: true,
      particles: false,
      pulse: true,
      rotate: false,
    },
  ): Promise<string> {
    let fixedAudioPath: string | null = null;

    try {
      console.log('Starting animated video generation...');

      // Validate and potentially fix audio
      fixedAudioPath = await this.validateAndFixAudio(audioPath);

      // Get audio duration if not provided
      const videoDuration =
        duration || (await this.getAudioDuration(fixedAudioPath));
      console.log(`Video duration: ${videoDuration} seconds`);

      // Generate unique output filename
      const timestamp = Date.now();
      const outputPath = path.join(
        this.outputDir,
        `tnk-animated-${timestamp}.mp4`,
      );

      // Create background if none provided
      const bgPath =
        (backgroundImage && path.resolve(backgroundImage)) ||
        (await this.generateDynamicBackground());

      // Build simplified FFMPEG command
      const ffmpegCmd = this.buildSimplifiedFFMPEGCommand(
        fixedAudioPath,
        bgPath,
        outputPath,
        title,
        videoDuration,
        effects,
      );

      console.log('Executing FFMPEG command...');
      console.log('Command preview:', ffmpegCmd.substring(0, 200) + '...');

      execSync(ffmpegCmd, {stdio: 'inherit', timeout: 60000}); // 60 second timeout

      // Verify output file was created
      if (!fs.existsSync(outputPath)) {
        throw new Error('Output video file was not created');
      }

      const outputStats = fs.statSync(outputPath);
      if (outputStats.size === 0) {
        throw new Error('Output video file is empty');
      }

      console.log(`Animated video generated successfully: ${outputPath}`);
      console.log(
        `Output file size: ${(outputStats.size / 1024 / 1024).toFixed(2)}MB`,
      );

      return outputPath;
    } catch (error: any) {
      console.error('Error generating animated video:', error);
      throw new Error(`Failed to generate animated video: ${error.message}`);
    } finally {
      // Cleanup fixed audio file if it was created
      if (fixedAudioPath && fixedAudioPath !== audioPath) {
        try {
          if (fs.existsSync(fixedAudioPath)) {
            fs.unlinkSync(fixedAudioPath);
          }
        } catch (cleanupError) {
          console.warn('Failed to cleanup fixed audio file:', cleanupError);
        }
      }
    }
  }

  /**
   * Generate dynamic background with gradients and patterns
   */
  private async generateDynamicBackground(): Promise<string> {
    const bgPath = path.join(this.tempDir, `bg-${Date.now()}.png`);

    const width = 1080;
    const height = 1920;

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="grad1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:1" />
            <stop offset="50%" style="stop-color:#4ecdc4;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#45b7d1;stop-opacity:1" />
          </radialGradient>
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad1)"/>
        <rect width="100%" height="100%" fill="url(#grid)"/>
      </svg>
    `;

    await sharp(Buffer.from(svg)).png().toFile(bgPath);
    return bgPath;
  }

  /**
   * Build FFMPEG command without specifying fontfile (uses system default)
   */
  private buildSimplifiedFFMPEGCommand(
    audioPath: string,
    backgroundPath: string,
    outputPath: string,
    title?: string,
    duration: number = 30,
    effects: VideoEffects = {} as VideoEffects,
  ): string {
    const fps = 30;
    const width = 1080;
    const height = 1920;

    let filterComplex = `[0:v]scale=${width}:${height}[bg];`;
    let currentStream = '[bg]';
    let streamCounter = 1;

    // Apply zoom effect
    if (effects.zoom) {
      filterComplex += `${currentStream}zoompan=z='min(1.05,1.2)':d=25:s=${width}x${height}:fps=${fps}[zoom${streamCounter}];`;
      currentStream = `[zoom${streamCounter}]`;
      streamCounter++;
    }

    // Apply color adjustment
    if (effects.colorShift) {
      filterComplex += `${currentStream}hue=h=10:s=1.1[color${streamCounter}];`;
      currentStream = `[color${streamCounter}]`;
      streamCounter++;
    }

    // Add title text WITHOUT fontfile parameter - let FFmpeg use system default
    if (title) {
      const cleanTitle = title
        .replace(/['"🚂]/g, '') // Remove quotes and emojis
        .replace(/:/g, '\\:') // Escape colons
        .replace(/\\/g, '\\\\') // Escape backslashes
        .replace(/,/g, '\\,') // Escape commas
        .replace(/=/g, '\\=') // Escape equals
        .trim();

      // Build drawtext WITHOUT fontfile - this should work on Windows
      const textFilter = `${currentStream}drawtext=text=${cleanTitle}:fontsize=60:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.15:alpha=0.9[final]`;

      filterComplex += textFilter;
      currentStream = '[final]';
    } else {
      // Remove trailing semicolon if no text
      filterComplex = filterComplex.replace(/;$/, '');
    }

    const commandParts = [
      'ffmpeg',
      '-y',
      `-i "${backgroundPath}"`,
      `-i "${audioPath}"`,
      '-filter_complex',
      `"${filterComplex}"`,
      '-map',
      currentStream,
      '-map',
      '1:a',
      '-c:v libx264',
      '-c:a aac',
      '-preset veryfast',
      '-crf 28',
      '-pix_fmt yuv420p',
      '-r 30',
      `-t ${Math.min(duration, 60)}`,
      '-movflags +faststart',
      `"${outputPath}"`,
    ];

    return commandParts.join(' ');
  }

  /**
   * Alternative: Create video without any text overlay for testing
   */
  async generateVideoWithoutText(
    audioPath: string,
    backgroundImage?: string,
    duration?: number,
  ): Promise<string> {
    try {
      console.log('Generating video without text overlay...');

      const fixedAudioPath = await this.validateAndFixAudio(audioPath);
      const videoDuration =
        duration || (await this.getAudioDuration(fixedAudioPath));

      const timestamp = Date.now();
      const outputPath = path.join(this.outputDir, `no-text-${timestamp}.mp4`);

      const bgPath = backgroundImage
        ? path.resolve(backgroundImage)
        : await this.generateDynamicBackground();

      // Simple filter chain without text
      const filterComplex =
        '[0:v]scale=1080:1920[bg];[bg]zoompan=z=min(1.05,1.2):d=25:s=1080x1920:fps=30[zoom];[zoom]hue=h=10:s=1.1[final]';

      const ffmpegCmd = [
        'ffmpeg',
        '-y',
        `-i "${bgPath}"`,
        `-i "${fixedAudioPath}"`,
        '-filter_complex',
        `"${filterComplex}"`,
        '-map [final]',
        '-map 1:a',
        '-c:v libx264',
        '-c:a aac',
        '-preset veryfast',
        '-crf 28',
        '-pix_fmt yuv420p',
        '-r 30',
        `-t ${Math.min(videoDuration, 60)}`,
        '-movflags +faststart',
        `"${outputPath}"`,
      ].join(' ');

      console.log('Executing FFmpeg without text...');
      execSync(ffmpegCmd, {stdio: 'inherit', timeout: 60000});

      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
        throw new Error('Output video file was not created or is empty');
      }

      console.log(`Video created successfully: ${outputPath}`);
      return outputPath;
    } catch (error: any) {
      console.error('Error generating video without text:', error);
      throw new Error(`Failed to generate video: ${error.message}`);
    }
  }

  /**
   * Test method to isolate the text rendering issue
   */
  async testTextRendering(audioPath: string): Promise<void> {
    try {
      console.log('Testing basic FFmpeg functionality...');

      // Test 1: Create video without text
      console.log('Test 1: Video without text');
      await this.generateVideoWithoutText(audioPath);
      console.log('✅ Basic video generation works');

      // Test 2: Try with system default font
      console.log('Test 2: Video with text (system font)');
      await this.generateAnimatedVideo(audioPath, undefined, 'TEST', 5, {
        glitch: false,
        grid: false,
        zoom: true,
        shake: false,
        colorShift: true,
        particles: false,
        pulse: false,
        rotate: false,
      });
      console.log('✅ Text rendering works');
    } catch (error: any) {
      console.error('Test failed:', error.message);
      throw error;
    }
  }

  /**
   * Find available system font - simplified approach
   */
  private findSystemFont(): string {
    // List of potential font files to check
    const windowsFonts = [
      'C:\\Windows\\Fonts\\arial.ttf',
      'C:\\Windows\\Fonts\\Arial.ttf',
      'C:\\Windows\\Fonts\\arialbd.ttf', // Arial Bold
      'C:\\Windows\\Fonts\\calibri.ttf',
    ];

    // Check which font exists
    for (const font of windowsFonts) {
      if (fs.existsSync(font)) {
        console.log(`Found font: ${font}`);
        // Return with forward slashes for FFmpeg
        return font.replace(/\\/g, '/');
      }
    }

    // If no specific font found, try without fontfile parameter
    console.warn('No specific font found, using system default');
    return '';
  }

  /**
   * Alternative method: Generate video without text overlay to test basic functionality
   */
  async generateBasicVideo(
    audioPath: string,
    backgroundImage?: string,
  ): Promise<string> {
    try {
      console.log('Generating basic video without text overlay...');

      const fixedAudioPath = await this.validateAndFixAudio(audioPath);
      const videoDuration = await this.getAudioDuration(fixedAudioPath);

      const timestamp = Date.now();
      const outputPath = path.join(this.outputDir, `basic-${timestamp}.mp4`);

      const bgPath =
        (backgroundImage && path.resolve(backgroundImage)) ||
        (await this.generateDynamicBackground());

      // Simple filter without text
      const filterComplex =
        "[0:v]scale=1080:1920[bg];[bg]zoompan=z='min(1.05,1.2)':d=25:s=1080x1920:fps=30[final]";

      const ffmpegCmd = [
        'ffmpeg',
        '-y',
        `-i "${bgPath}"`,
        `-i "${fixedAudioPath}"`,
        '-filter_complex',
        `"${filterComplex}"`,
        '-map [final]',
        '-map 1:a',
        '-c:v libx264',
        '-c:a aac',
        '-preset veryfast',
        '-crf 28',
        '-pix_fmt yuv420p',
        '-r 30',
        `-t ${Math.min(videoDuration, 60)}`,
        '-movflags +faststart',
        `"${outputPath}"`,
      ].join(' ');

      console.log('Basic video command:', ffmpegCmd.substring(0, 200) + '...');
      execSync(ffmpegCmd, {stdio: 'inherit', timeout: 60000});

      return outputPath;
    } catch (error: any) {
      throw new Error(`Failed to generate basic video: ${error.message}`);
    }
  }

  /**
   * Generate TikTok-optimized video with stable effects
   */
  async generateTikTokVideo(
    audioPath: string,
    title: string,
    subtitle?: string,
  ): Promise<string> {
    const safeEffects: VideoEffects = {
      glitch: false,
      grid: false,
      zoom: true,
      shake: false,
      colorShift: true,
      particles: false,
      pulse: true,
      rotate: false,
    };

    return await this.generateAnimatedVideo(
      audioPath,
      undefined,
      title,
      undefined,
      safeEffects,
    );
  }

  /**
   * Get audio duration in seconds with better error handling
   */
  private async getAudioDuration(audioPath: string): Promise<number> {
    try {
      const output = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`,
        {encoding: 'utf8', timeout: 10000},
      );
      const duration = parseFloat(output.trim());

      if (isNaN(duration) || duration <= 0) {
        console.warn('Invalid audio duration detected, using default');
        return 5;
      }

      return Math.min(duration, 60); // Cap at 60 seconds
    } catch (error) {
      console.warn(
        'Could not determine audio duration, defaulting to 5 seconds',
      );
      return 5;
    }
  }

  /**
   * Cleanup temporary files
   */
  async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        for (const file of files) {
          const filePath = path.join(this.tempDir, file);
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.warn(`Failed to delete temp file: ${filePath}`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export default AnimatedVideoService;
