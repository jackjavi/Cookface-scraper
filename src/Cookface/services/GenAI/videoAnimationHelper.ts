import * as fs from 'fs';

export interface VideoTimings {
  timePerImage: number;
  totalDuration: number;
  transitionDuration: number;
}

export class VideoAnimationHelper {
  private width: number = 1280;
  private height: number = 720;

  constructor(width: number = 1280, height: number = 720) {
    this.width = width;
    this.height = height;
  }

  /**
   * Validate that image paths exist and are readable
   */
  validateImagePaths(imagePaths: string[]): string[] {
    const validPaths: string[] = [];

    for (const imagePath of imagePaths) {
      try {
        if (fs.existsSync(imagePath) && fs.statSync(imagePath).isFile()) {
          fs.accessSync(imagePath, fs.constants.R_OK);
          validPaths.push(imagePath);
        } else {
          console.warn(`Image file not found or not readable: ${imagePath}`);
        }
      } catch (error) {
        console.warn(`Cannot access image file: ${imagePath}`, error);
      }
    }

    return validPaths;
  }

  /**
   * Calculate optimal timing for multi-image videos
   */
  calculateVideoTimings(
    imageCount: number,
    totalDuration: number,
    transitionDuration: number = 0.8,
  ): VideoTimings {
    if (imageCount <= 1) {
      return {
        timePerImage: totalDuration,
        totalDuration,
        transitionDuration: 0,
      };
    }

    const totalTransitionTime = (imageCount - 1) * transitionDuration;
    const availableDisplayTime = Math.max(
      totalDuration - totalTransitionTime,
      imageCount * 2, // Minimum 2 seconds per image
    );

    const timePerImage = availableDisplayTime / imageCount;

    return {
      timePerImage: Math.max(timePerImage, 2), // Ensure minimum 2 seconds per image
      totalDuration,
      transitionDuration,
    };
  }

  /**
   * Generate Ken Burns effect filter for single image
   */
  generateKenBurnsFilter(
    duration: number,
    intensity: 'light' | 'medium' | 'heavy' = 'medium',
  ): string {
    const zoomFactors = {
      light: 0.001,
      medium: 0.0015,
      heavy: 0.002,
    };

    const maxZoom = {
      light: 1.2,
      medium: 1.3,
      heavy: 1.5,
    };

    const zoomFactor = zoomFactors[intensity];
    const maxZ = maxZoom[intensity];
    const frames = Math.round(duration * 30);

    return `zoompan=z='min(zoom+${zoomFactor},${maxZ})':d=${frames}:s=${this.width}x${this.height}:fps=30`;
  }

  /**
   * Generate basic scaling and padding filter
   */
  generateScaleFilter(): string {
    return `scale=${this.width}:${this.height}:force_original_aspect_ratio=decrease,pad=${this.width}:${this.height}:-1:-1:color=black`;
  }

  /**
   * Generate title overlay filter
   */
  generateTitleFilter(
    title: string,
    style: 'simple' | 'bold' = 'simple',
  ): string {
    // Sanitize title for FFmpeg
    const cleanTitle = title
      .replace(/['"]/g, '')
      .replace(/:/g, '\\:')
      .replace(/\\/g, '\\\\')
      .replace(/,/g, '\\,')
      .replace(/=/g, '\\=')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .trim()
      .substring(0, 60); // Limit length

    const styles = {
      simple: {
        fontsize: 48,
        fontcolor: 'white',
        borderw: 2,
        bordercolor: 'black',
        alpha: '0.9',
      },
      bold: {
        fontsize: 54,
        fontcolor: 'white',
        borderw: 3,
        bordercolor: 'black',
        alpha: '0.95',
      },
    };

    const styleConfig = styles[style];

    return `drawtext=text='${cleanTitle}':fontsize=${styleConfig.fontsize}:fontcolor=${styleConfig.fontcolor}:borderw=${styleConfig.borderw}:bordercolor=${styleConfig.bordercolor}:x=(w-text_w)/2:y=h*0.08:alpha=${styleConfig.alpha}`;
  }

  /**
   * Get available transition types
   */
  getTransitionTypes(): string[] {
    return [
      'fade',
      'slideright',
      'slideleft',
      'slideup',
      'slidedown',
      'wipeleft',
      'wiperight',
      'dissolve',
    ];
  }

  /**
   * Get random transition type
   */
  getRandomTransition(): string {
    const transitions = this.getTransitionTypes();
    return transitions[Math.floor(Math.random() * transitions.length)];
  }

  /**
   * Generate complete single image video filter chain
   */
  generateSingleImageFilterChain(
    duration: number,
    title?: string,
    kenBurnsIntensity: 'light' | 'medium' | 'heavy' = 'medium',
  ): string[] {
    const filters: string[] = [
      this.generateScaleFilter(),
      this.generateKenBurnsFilter(duration, kenBurnsIntensity),
    ];

    if (title) {
      filters.push(this.generateTitleFilter(title));
    }

    return filters;
  }

  /**
   * Build xfade filter chain for multiple images
   */
  buildXfadeChain(
    imageCount: number,
    timePerImage: number,
    transitionDuration: number,
    transitionType: string = 'fade',
  ): string {
    if (imageCount < 2) {
      return '[v0]copy[video]';
    }

    let filterChain = '';

    // Scale all images first
    for (let i = 0; i < imageCount; i++) {
      filterChain += `[${i}:v]${this.generateScaleFilter()},setpts=PTS-STARTPTS[v${i}];`;
    }

    if (imageCount === 2) {
      const offset = timePerImage - transitionDuration;
      filterChain += `[v0][v1]xfade=transition=${transitionType}:duration=${transitionDuration}:offset=${offset}[video];`;
    } else {
      // Chain multiple xfade operations
      let currentStream = '[v0]';

      for (let i = 1; i < imageCount; i++) {
        const offset = (timePerImage - transitionDuration) * i;
        const nextStream = i === imageCount - 1 ? '[video]' : `[temp${i}]`;
        const transition = i % 2 === 1 ? 'slideright' : 'slideleft'; // Alternate transitions

        filterChain += `${currentStream}[v${i}]xfade=transition=${transition}:duration=${transitionDuration}:offset=${offset}${nextStream};`;
        currentStream = `[temp${i}]`;
      }
    }

    return filterChain;
  }

  /**
   * Validate video generation parameters
   */
  validateVideoParams(
    imagePaths: string[],
    audioPath: string,
  ): {isValid: boolean; errors: string[]} {
    const errors: string[] = [];

    if (!imagePaths || imagePaths.length === 0) {
      errors.push('No image paths provided');
    } else {
      const validImages = this.validateImagePaths(imagePaths);
      if (validImages.length === 0) {
        errors.push('No valid image files found');
      }
    }

    if (!audioPath) {
      errors.push('No audio path provided');
    } else if (!fs.existsSync(audioPath)) {
      errors.push(`Audio file not found: ${audioPath}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export default VideoAnimationHelper;
