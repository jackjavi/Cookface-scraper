import GenerativeAIAudioService from '../GenAI/genAIAudioService';
import AnimatedVideoService from '../GenAI/AnimatedVideoService';
import {
  downloadImage,
  cleanupImage,
  generateMultiPlatformImageFilename,
} from '../../utils/imageUtils';
import {cleanupVideo} from '../../utils/videoUtils';
import config from '../../config/index';
import * as fs from 'fs';
import * as path from 'path';
import sleep from '../../utils/sleep';

interface GainTrainVideoOptions {
  maxDuration: number; // seconds
  effects: {
    glitch: boolean;
    grid: boolean;
    zoom: boolean;
    shake: boolean;
    colorShift: boolean;
    particles: boolean;
    pulse: boolean;
    rotate: boolean;
  };
}

interface GainTrainResult {
  videoPath: string;
  audioPath?: string;
  description: string;
  hashtags: string[];
  transcript: string;
  duration: number;
}

class TikTokGainTrainService {
  private audioService: GenerativeAIAudioService;
  private videoService: AnimatedVideoService;
  private imageUrls: string[];
  private transcripts: string[];
  private hashtagGroups: string[][];

  constructor() {
    this.audioService = new GenerativeAIAudioService();
    this.videoService = new AnimatedVideoService(
      config.videoStore || './videos',
    );

    // Predefined Pexels image URLs
    this.imageUrls = [
      'https://images.pexels.com/photos/17319809/pexels-photo-17319809.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.pexels.com/photos/3490257/pexels-photo-3490257.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.pexels.com/photos/2379179/pexels-photo-2379179.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.pexels.com/photos/20889987/pexels-photo-20889987.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.pexels.com/photos/7481278/pexels-photo-7481278.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.pexels.com/photos/2379178/pexels-photo-2379178.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.pexels.com/photos/20026561/pexels-photo-20026561.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.pexels.com/photos/14251997/pexels-photo-14251997.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.pexels.com/photos/7481958/pexels-photo-7481958.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.pexels.com/photos/15658170/pexels-photo-15658170.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.pexels.com/photos/15694789/pexels-photo-15694789.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.pexels.com/photos/14251988/pexels-photo-14251988.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
      'https://images.pexels.com/photos/16948489/pexels-photo-16948489.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
    ];

    // Predefined gain train transcripts
    this.transcripts = [
      "Follow train activated! All aboard the growth express! Let's help each other reach new heights!",
      'Mass following time! Building our community one follow at a time! Join the movement!',
      "Follow for follow chain starts now! Supporting creators, growing together! Who's in?",
      'Gain train departing! Next stop: viral content! Follow back guaranteed!',
      'Community building mode activated! Follow, like, support! We rise together!',
      "Follow train 2025! New year, new followers! Let's grow our accounts together!",
      'Teamwork makes the dream work! Follow for follow, like for like! Building connections!',
      'Growth hack activated! Follow train in motion! Supporting fellow creators!',
      'Follow back express! Building genuine connections! Community over competition!',
      'Gain train conductor here! All aboard for mutual growth and support!',
    ];

    // Different hashtag combinations for variety
    this.hashtagGroups = [
      [
        '#followforfollow',
        '#followtrain2025',
        '#follow4follow',
        '#followtrain',
        '#followtrainchallenge',
        '#f4f',
        '#followback',
        '#follows',
        '#fyp',
        '#followingback',
        '#follow',
        '#gaintrain',
        '#viral',
      ],
      [
        '#massfollowing',
        '#teamworktrend',
        '#teamworkifb',
        '#teamworkmakesthedreamwork',
        '#teamworks',
        '#teamwork10k',
        '#teamworkuk',
        '#trending',
        '#viral_video',
        '#growmyaccount',
        '#growaccount',
        '#growfollowers',
        '#fyp',
        '#foryoupage',
      ],
      [
        '#growmyaccount',
        '#followmeguys',
        '#likemyvideos',
        '#fypviraltiktok',
        '#creatorsearchinsights',
        '#kenyatiktok',
        '#loveyou',
        '#backupaccount',
        '#supportsmallcreators',
        '#followback',
        '#viral',
        '#fyp',
      ],
      [
        '#gaintrain',
        '#followtrain',
        '#supporteachother',
        '#followforfollow',
        '#communitybuilding',
        '#creators',
        '#viral',
        '#trending',
        '#fyp',
        '#growtogether',
        '#mutualfollow',
        '#support',
        '#follow4follow',
      ],
      [
        '#tiktokgrowth',
        '#followchain',
        '#gaintrainexpress',
        '#creatorssupport',
        '#followme',
        '#followback',
        '#viral',
        '#trendingnow',
        '#fyp',
        '#tiktokfamily',
        '#supportcreators',
        '#growwithme',
        '#followtrain2025',
      ],
    ];
  }

  /**
   * Get random elements from array
   */
  private getRandomElements<T>(array: T[], count: number = 1): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Get random single element from array
   */
  private getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Generate TikTok description with hashtags
   */
  private generateDescription(transcript: string): {
    description: string;
    hashtags: string[];
  } {
    const hashtagSet = this.getRandomElement(this.hashtagGroups);

    // Create different description styles
    const descriptionTemplates = [
      `${transcript.split('!')[0]}! 🚂✨`,
      `Follow train activated! 🌟 ${transcript.split('.')[0].toLowerCase()}.`,
      `🚂 Choo choo! ${transcript} 💫`,
      `${transcript} 🙏💕`,
      `Building our community! ${transcript.split('!').slice(1).join('!') || "Let's grow together!"} 🚀`,
    ];

    const description = this.getRandomElement(descriptionTemplates);

    return {
      description,
      hashtags: hashtagSet,
    };
  }

  /**
   * Download random images for the video
   */
  private async downloadRandomImages(count: number = 3): Promise<string[]> {
    const selectedUrls = this.getRandomElements(this.imageUrls, count);
    const imagePaths: string[] = [];

    for (let i = 0; i < selectedUrls.length; i++) {
      try {
        const filename = generateMultiPlatformImageFilename(
          `gaintrain-${i}`,
          'tiktok',
        );
        let imagePath = `${config.imagesStore}${filename}`;

        await downloadImage(selectedUrls[i], imagePath);
        imagePaths.push(imagePath);
        console.log(`Downloaded image ${i + 1}: ${imagePath}`);
        await sleep(1000);
      } catch (error) {
        console.error(`Failed to download image ${i + 1}:`, error);
      }
    }

    return imagePaths;
  }

  /**
   * Generate gain train audio from transcript
   */
  private async generateGainTrainAudio(transcript: string): Promise<string> {
    try {
      // Use the existing audio service but with gain train specific prompt
      const audioPath = await this.audioService.generateAudioFromTranscript(
        transcript,
        'gaintrain',
      );
      return audioPath;
    } catch (error) {
      console.error('Error generating gain train audio:', error);
      throw error;
    }
  }

  /**
   * Create animated gain train video with multiple images
   */
  private async createGainTrainVideo(
    imagePaths: string[],
    audioPath: string,
    transcript: string,
    options: GainTrainVideoOptions,
  ): Promise<string> {
    try {
      // Use the first image as primary, others can be composited
      const primaryImage = imagePaths[0];

      const videoPath = await this.videoService.generateAnimatedVideo(
        audioPath,
        primaryImage,
        'FOLLOW TRAIN 🚂',
        options.maxDuration,
        options.effects,
      );

      return videoPath;
    } catch (error) {
      console.error('Error creating gain train video:', error);
      throw error;
    }
  }

  /**
   * Generate complete TikTok gain train content
   */
  async generateGainTrainContent(
    options: GainTrainVideoOptions = {
      maxDuration: 5,
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
    },
  ): Promise<GainTrainResult> {
    let imagePaths: string[] = [];
    let audioPath: string | null = null;
    let videoPath: string | null = null;

    try {
      console.log('Starting TikTok Gain Train content generation...');

      // Step 1: Select random transcript
      const transcript = this.getRandomElement(this.transcripts);
      console.log(`Selected transcript: ${transcript}`);

      // Step 2: Download random images
      console.log('Downloading random images...');
      imagePaths = await this.downloadRandomImages(3);

      if (imagePaths.length === 0) {
        throw new Error('No images could be downloaded');
      }

      // Step 3: Generate audio
      console.log('Generating audio...');
      audioPath = await this.generateGainTrainAudio(transcript);
      audioPath = path.resolve(audioPath);

      // Step 4: Create animated video
      console.log('Creating animated video...');
      videoPath = await this.createGainTrainVideo(
        imagePaths,
        audioPath,
        transcript,
        options,
      );

      // Step 5: Generate description and hashtags
      const {description, hashtags} = this.generateDescription(transcript);

      // Step 6: Get video duration
      const duration =
        (await this.videoService['getAudioDuration'](audioPath)) ||
        options.maxDuration;

      console.log('TikTok Gain Train content generated successfully!');

      return {
        videoPath,
        audioPath,
        description,
        hashtags,
        transcript,
        duration: Math.min(duration, options.maxDuration),
      };
    } catch (error: any) {
      console.error('Error generating gain train content:', error);
      throw new Error(
        `Failed to generate gain train content: ${error.message}`,
      );
    } finally {
      // Cleanup downloaded images
      for (const imagePath of imagePaths) {
        try {
          await cleanupImage(imagePath);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup image: ${imagePath}`, cleanupError);
        }
      }

      // Cleanup audio file (video contains embedded audio)
      if (audioPath) {
        try {
          await this.audioService.cleanupAudio(audioPath);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup audio: ${audioPath}`, cleanupError);
        }
      }
    }
  }

  /**
   * Generate multiple gain train videos for batch upload
   */
  async generateMultipleGainTrainVideos(
    count: number = 3,
  ): Promise<GainTrainResult[]> {
    const results: GainTrainResult[] = [];

    for (let i = 0; i < count; i++) {
      try {
        console.log(`Generating gain train video ${i + 1}/${count}...`);

        // Vary effects for each video
        const effects = {
          glitch: Math.random() > 0.3,
          grid: Math.random() > 0.4,
          zoom: Math.random() > 0.2,
          shake: Math.random() > 0.5,
          colorShift: Math.random() > 0.4,
          particles: Math.random() > 0.3,
          pulse: Math.random() > 0.2,
          rotate: Math.random() > 0.7,
        };

        const options: GainTrainVideoOptions = {
          maxDuration: 5 + Math.random() * 2, // 5-7 seconds
          effects,
        };

        const result = await this.generateGainTrainContent(options);
        results.push(result);

        // Short delay between generations
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to generate video ${i + 1}:`, error);
      }
    }

    return results;
  }

  /**
   * Cleanup gain train video files
   */
  async cleanupGainTrainVideo(result: GainTrainResult): Promise<void> {
    try {
      if (result.videoPath) {
        await cleanupVideo(result.videoPath);
      }
      if (result.audioPath) {
        await this.audioService.cleanupAudio(result.audioPath);
      }
    } catch (error) {
      console.error('Error cleaning up gain train video:', error);
    }
  }

  /**
   * Get formatted video info for logging/display
   */
  getVideoInfo(result: GainTrainResult): string {
    return `
TikTok Gain Train Video Generated:
- Duration: ${result.duration.toFixed(1)}s
- Description: ${result.description}
- Hashtags: ${result.hashtags.slice(0, 5).join(' ')}...
- Video: ${result.videoPath}
- Transcript: ${result.transcript}
    `.trim();
  }
}

export default TikTokGainTrainService;
