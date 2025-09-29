import * as fs from 'fs';

export interface TransitionConfig {
  name: string;
  ffmpegFilter: string;
  duration: number;
  description: string;
}

export interface VideoEffectConfig {
  name: string;
  ffmpegFilter: string;
  intensity: 'light' | 'medium' | 'heavy';
  description: string;
}

export class VideoEffectsUtils {
  /**
   * Get available transition effects for multi-image videos
   */
  static getTransitionEffects(): TransitionConfig[] {
    return [
      {
        name: 'slideright',
        ffmpegFilter: 'slideright',
        duration: 0.8,
        description: 'Slide from right to left',
      },
      {
        name: 'slideleft',
        ffmpegFilter: 'slideleft',
        duration: 0.8,
        description: 'Slide from left to right',
      },
      {
        name: 'slideup',
        ffmpegFilter: 'slideup',
        duration: 0.7,
        description: 'Slide from bottom to top',
      },
      {
        name: 'slidedown',
        ffmpegFilter: 'slidedown',
        duration: 0.7,
        description: 'Slide from top to bottom',
      },
      {
        name: 'fade',
        ffmpegFilter: 'fade',
        duration: 1.0,
        description: 'Cross fade transition',
      },
      {
        name: 'wipeleft',
        ffmpegFilter: 'wipeleft',
        duration: 0.6,
        description: 'Wipe effect from left',
      },
      {
        name: 'wiperight',
        ffmpegFilter: 'wiperight',
        duration: 0.6,
        description: 'Wipe effect from right',
      },
      {
        name: 'pixelize',
        ffmpegFilter: 'pixelize',
        duration: 0.5,
        description: 'Pixelated transition',
      },
      {
        name: 'dissolve',
        ffmpegFilter: 'dissolve',
        duration: 1.2,
        description: 'Smooth dissolve effect',
      },
    ];
  }

  /**
   * Get single image animation effects
   */
  static getSingleImageEffects(): VideoEffectConfig[] {
    return [
      {
        name: 'ken_burns',
        ffmpegFilter:
          "zoompan=z='min(zoom+0.0015,1.5)':d={duration}:s={width}x{height}:fps=30",
        intensity: 'light',
        description: 'Classic Ken Burns pan and zoom effect',
      },
      {
        name: 'zoom_out',
        ffmpegFilter:
          "zoompan=z='if(lte(zoom,1.0),1.8,max(1.001,zoom-0.002))':d={duration}:s={width}x{height}:fps=30",
        intensity: 'medium',
        description: 'Zoom out effect from close-up',
      },
      {
        name: 'subtle_rotation',
        ffmpegFilter:
          'rotate=PI/180*sin(2*PI*t/8):c=black:ow={width}:oh={height}',
        intensity: 'light',
        description: 'Gentle rotation movement',
      },
      {
        name: 'color_pulse',
        ffmpegFilter:
          "eq=contrast='1+0.3*sin(2*PI*t/4)':brightness='0.1*sin(2*PI*t/6)':saturation='1+0.4*sin(2*PI*t/5)'",
        intensity: 'medium',
        description: 'Pulsing color enhancement',
      },
      {
        name: 'drift_left',
        ffmpegFilter:
          'crop=iw*1.2:ih*1.2:(iw*0.1)+(iw*0.1)*sin(2*PI*t/10):(ih*0.1)',
        intensity: 'light',
        description: 'Slow horizontal drift',
      },
      {
        name: 'drift_vertical',
        ffmpegFilter:
          'crop=iw*1.2:ih*1.2:(iw*0.1):(ih*0.1)+(ih*0.1)*sin(2*PI*t/12)',
        intensity: 'light',
        description: 'Slow vertical drift',
      },
    ];
  }

  /**
   * Get random transition effect configuration
   */
  static getRandomTransition(): TransitionConfig {
    const transitions = this.getTransitionEffects();
    const randomIndex = Math.floor(Math.random() * transitions.length);
    return transitions[randomIndex];
  }

  /**
   * Get random single image effect configuration
   */
  static getRandomSingleImageEffect(
    intensity: 'light' | 'medium' | 'heavy' = 'medium',
  ): VideoEffectConfig {
    const effects = this.getSingleImageEffects().filter(
      effect => effect.intensity === intensity,
    );
    const randomIndex = Math.floor(Math.random() * effects.length);
    return effects[randomIndex] || this.getSingleImageEffects()[0];
  }

  /**
   * Build optimized filter string for single image with multiple effects
   */
  static buildSingleImageFilter(
    width: number,
    height: number,
    duration: number,
    effects: VideoEffectConfig[] = [],
    title?: string,
  ): string {
    let filter = `[0:v]scale=${width}:${height}[scaled];`;
    let currentStream = '[scaled]';
    let streamCounter = 1;

    // Apply effects in sequence
    for (const effect of effects) {
      const effectFilter = effect.ffmpegFilter
        .replace(/{width}/g, width.toString())
        .replace(/{height}/g, height.toString())
        .replace(/{duration}/g, Math.round(duration * 30).toString());

      filter += `${currentStream}${effectFilter}[effect${streamCounter}];`;
      currentStream = `[effect${streamCounter}]`;
      streamCounter++;
    }

    // Add title if provided
    if (title) {
      const cleanTitle = this.sanitizeTitle(title);
      filter += `${currentStream}drawtext=text='${cleanTitle}':fontsize=54:fontcolor=white:borderw=4:bordercolor=black:x=(w-text_w)/2:y=h*0.08:alpha=0.9[final];`;
      return filter;
    } else {
      // Rename last stream to final
      filter = filter.replace(
        new RegExp(`\\[effect${streamCounter - 1}\\]$`),
        '[final]',
      );
      return filter;
    }
  }

  /**
   * Create dynamic background gradient
   */
  static generateGradientCommand(
    width: number,
    height: number,
    colors: string[] = [],
  ): string {
    if (colors.length === 0) {
      // Default gradient colors
      const gradientSets = [
        ['#667eea', '#764ba2'],
        ['#f093fb', '#f5576c'],
        ['#4facfe', '#00f2fe'],
        ['#43e97b', '#38f9d7'],
        ['#fa709a', '#fee140'],
      ];
      colors = gradientSets[Math.floor(Math.random() * gradientSets.length)];
    }

    return (
      `color=c=${colors[0]}:size=${width}x${height}:d=1[bg];` +
      `[bg]geq=r='r(X,Y)+20*sin(2*PI*X/100)':g='g(X,Y)+20*sin(2*PI*Y/100)':b='b(X,Y)+20*sin(2*PI*(X+Y)/150)'[gradient]`
    );
  }

  /**
   * Sanitize text for FFmpeg drawtext filter
   */
  static sanitizeTitle(title: string): string {
    return title
      .replace(/['"]/g, '') // Remove quotes
      .replace(/:/g, '\\:') // Escape colons
      .replace(/\\/g, '\\\\') // Escape backslashes
      .replace(/,/g, '\\,') // Escape commas
      .replace(/=/g, '\\=') // Escape equals
      .replace(/\[/g, '\\[') // Escape brackets
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(') // Escape parentheses
      .replace(/\)/g, '\\)')
      .trim()
      .substring(0, 80); // Limit length
  }

  /**
   * Calculate optimal timing for multi-image video
   */
  static calculateImageTimings(
    imageCount: number,
    totalDuration: number,
    transitionDuration: number = 0.8,
  ): {
    timePerImage: number;
    segments: Array<{start: number; duration: number; transition: number}>;
  } {
    if (imageCount <= 1) {
      return {
        timePerImage: totalDuration,
        segments: [{start: 0, duration: totalDuration, transition: 0}],
      };
    }

    const totalTransitionTime = (imageCount - 1) * transitionDuration;
    const availableDisplayTime = Math.max(
      totalDuration - totalTransitionTime,
      imageCount * 2,
    ); // Min 2 seconds per image
    const baseTimePerImage = availableDisplayTime / imageCount;

    const segments = [];
    let currentTime = 0;

    for (let i = 0; i < imageCount; i++) {
      const isLast = i === imageCount - 1;
      const displayDuration = isLast
        ? totalDuration - currentTime
        : baseTimePerImage;
      const transitionStart = isLast ? 0 : displayDuration - transitionDuration;

      segments.push({
        start: currentTime,
        duration: displayDuration,
        transition: isLast ? 0 : transitionDuration,
      });

      currentTime += baseTimePerImage;
    }

    return {
      timePerImage: baseTimePerImage,
      segments,
    };
  }

  /**
   * Validate video generation parameters
   */
  static validateVideoParams(
    imagePaths: string[],
    audioPath: string,
    outputPath: string,
  ): {isValid: boolean; errors: string[]} {
    const errors: string[] = [];

    // Check image paths
    if (!imagePaths || imagePaths.length === 0) {
      errors.push('No image paths provided');
    } else {
      for (let i = 0; i < imagePaths.length; i++) {
        if (!fs.existsSync(imagePaths[i])) {
          errors.push(`Image file not found: ${imagePaths[i]}`);
        }
      }
    }

    // Check audio path
    if (!audioPath) {
      errors.push('No audio path provided');
    } else if (!fs.existsSync(audioPath)) {
      errors.push(`Audio file not found: ${audioPath}`);
    }

    // Check output path directory
    if (!outputPath) {
      errors.push('No output path provided');
    } else {
      const outputDir = require('path').dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        errors.push(`Output directory does not exist: ${outputDir}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate creative video title effects
   */
  static generateTitleEffect(
    title: string,
    videoDuration: number,
    style: 'modern' | 'classic' | 'bold' | 'elegant' = 'modern',
  ): string {
    const cleanTitle = this.sanitizeTitle(title);
    const fadeInDuration = 0.8;
    const fadeOutStart = videoDuration - 1.5;
    const fadeOutDuration = 1.0;

    const styles = {
      modern: {
        fontsize: 58,
        fontcolor: 'white',
        borderw: 3,
        bordercolor: 'black',
        shadowcolor: 'black@0.8',
        shadowx: 2,
        shadowy: 2,
      },
      classic: {
        fontsize: 48,
        fontcolor: '#f8f8f8',
        borderw: 2,
        bordercolor: '#333333',
        shadowcolor: 'black@0.6',
        shadowx: 1,
        shadowy: 1,
      },
      bold: {
        fontsize: 64,
        fontcolor: '#ffffff',
        borderw: 4,
        bordercolor: '#ff6b35',
        shadowcolor: 'black@0.9',
        shadowx: 3,
        shadowy: 3,
      },
      elegant: {
        fontsize: 52,
        fontcolor: '#f5f5f5',
        borderw: 1,
        bordercolor: '#gold',
        shadowcolor: 'black@0.5',
        shadowx: 1,
        shadowy: 1,
      },
    };

    const styleConfig = styles[style];

    return (
      `drawtext=text='${cleanTitle}':` +
      `fontsize=${styleConfig.fontsize}:` +
      `fontcolor=${styleConfig.fontcolor}:` +
      `borderw=${styleConfig.borderw}:` +
      `bordercolor=${styleConfig.bordercolor}:` +
      `shadowcolor=${styleConfig.shadowcolor}:` +
      `shadowx=${styleConfig.shadowx}:` +
      `shadowy=${styleConfig.shadowy}:` +
      `x=(w-text_w)/2:` +
      `y=h*0.08:` +
      `alpha='if(lt(t,${fadeInDuration}),t/${fadeInDuration},if(gt(t,${fadeOutStart}),(${fadeOutStart}+${fadeOutDuration}-t)/${fadeOutDuration},1))'`
    );
  }
}
