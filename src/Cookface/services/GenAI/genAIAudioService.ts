import config from '../../config';
import {Comment} from '../../types/Comment';
import {GoogleGenAI} from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';

class GenerativeAIAudioService {
  private genAITranscripts: GoogleGenAI;
  private audioTranscriptsKey: string;
  private genAIAudio: GoogleGenAI;
  private genAIKeyTTS: string;
  private audioStore: string;

  constructor() {
    this.audioStore = config.audioStore;
    this.genAIKeyTTS = config.generativeAIKeyTTS;
    this.audioTranscriptsKey = config.audioTranscriptsKey;
    this.genAITranscripts = new GoogleGenAI({apiKey: this.audioTranscriptsKey});
    this.genAIAudio = new GoogleGenAI({apiKey: this.genAIKeyTTS});
  }

  /**
   * Generate a podcast-style transcript from news bite and comments
   */
  async generatePodcastTranscript(
    newsBite: string,
    comments: Comment[],
  ): Promise<any> {
    if (!newsBite || !Array.isArray(comments) || comments.length === 0) {
      throw new Error(
        'Invalid input: newsBite must be a string and comments must be a non-empty array',
      );
    }

    const sampleComments = comments
      .slice(0, 8)
      .map(
        (comment, index) =>
          `Comment ${index + 1}: "${comment.content}" - @${comment.user}`,
      )
      .join('\n');

    const prompt = `
You are creating a professional news podcast script for "TRENDING NEWS KE" - a Kenyan news podcast that covers viral stories and trending topics.

Create a single-speaker, 20-30 second podcast transcript that:
- Starts with a brief, catchy intro mentioning "TRENDING NEWS KENYA"
- Presents the news story in an engaging, conversational tone
- Incorporates relevant context from the social media reactions
- Uses natural speech patterns with appropriate pauses
- Sounds professional yet accessible
- Ends with a brief closer that encourages engagement

NEWS STORY:
${newsBite}

SOCIAL MEDIA CONTEXT:
${sampleComments}

Guidelines:
- Write in natural spoken language (not written text)
- Include brief pauses indicated by "..." where appropriate
- Keep it informative but conversational
- Target 20-30 seconds of speaking time
- Use Kenyan context where relevant
- Don't read the comments verbatim, but reference the general sentiment

Format the output as a clean script ready for text-to-speech conversion.
    `;

    try {
      const response = await this.genAITranscripts.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });

      let result: string | undefined = undefined;
      if (
        response &&
        Array.isArray(response.candidates) &&
        response.candidates.length > 0 &&
        response.candidates[0].content &&
        Array.isArray(response.candidates[0].content.parts) &&
        response.candidates[0].content.parts.length > 0 &&
        typeof response.candidates[0].content.parts[0].text === 'string'
      ) {
        result = response.candidates[0].content.parts[0].text;
      } else {
        throw new Error('Invalid response structure from GenAI API');
      }

      return result;
    } catch (error: any) {
      console.error('Error generating podcast transcript:', error.message);
      throw new Error('Failed to generate podcast transcript');
    }
  }

  /**
   * Generate audio filename for storage
   */
  private generateAudioFilename(newsBite: string): string {
    const cleanTitle = newsBite
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 40);

    const timestamp = Date.now();
    return `tnk-news-${cleanTitle}-${timestamp}.wav`;
  }

  /**
   * Save audio data as properly formatted WAV file using FFmpeg
   */
  private async saveAudioWithFFmpeg(
    audioData: Buffer,
    outputPath: string,
  ): Promise<void> {
    const tempRawPath = outputPath.replace('.wav', '.raw');

    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
      }

      // Write raw audio data to temporary file
      fs.writeFileSync(tempRawPath, audioData);

      // Convert raw audio to proper WAV format using FFmpeg
      // Assuming the TTS returns 24kHz mono 16-bit PCM (common for Gemini TTS)
      const ffmpegCmd = [
        'ffmpeg',
        '-y', // Overwrite output
        '-f s16le', // Input format: 16-bit little-endian PCM
        '-ar 24000', // Sample rate: 24kHz (adjust if needed)
        '-ac 1', // Mono audio
        `-i "${tempRawPath}"`,
        '-c:a pcm_s16le', // Output codec
        '-ar 44100', // Convert to standard 44.1kHz
        '-ac 1', // Keep mono
        `"${outputPath}"`,
      ].join(' ');

      console.log('Converting audio with FFmpeg...');
      execSync(ffmpegCmd, {stdio: 'pipe', timeout: 30000});

      // Verify the output file
      if (!fs.existsSync(outputPath)) {
        throw new Error('FFmpeg failed to create output file');
      }

      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        throw new Error('FFmpeg created empty output file');
      }

      console.log(
        `Audio file saved successfully: ${outputPath} (${stats.size} bytes)`,
      );
    } finally {
      // Cleanup temporary raw file
      try {
        if (fs.existsSync(tempRawPath)) {
          fs.unlinkSync(tempRawPath);
        }
      } catch (cleanupError) {
        console.warn('Failed to cleanup temporary raw file:', cleanupError);
      }
    }
  }

  /**
   * Generate audio from transcript using Gemini TTS with improved error handling
   */
  async generateAudioFromTranscript(
    transcript: string,
    newsBite: string,
  ): Promise<string> {
    if (!transcript || typeof transcript !== 'string') {
      throw new Error('Invalid transcript: must be a non-empty string');
    }

    try {
      const filename = this.generateAudioFilename(newsBite);
      const audioFilePath = path.join(this.audioStore, filename);

      console.log('Generating audio with Gemini TTS...');
      console.log('Transcript length:', transcript.length);
      console.log('Output path:', audioFilePath);

      // Clean transcript for better TTS results
      const cleanTranscript = transcript
        .replace(/[^\w\s.,!?;:'"()-]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      console.log(
        'Cleaned transcript:',
        cleanTranscript.substring(0, 100) + '...',
      );

      const response = await this.genAIAudio.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [
          {
            parts: [
              {
                text: `Read this news podcast script in a clear, professional news presenter voice: ${cleanTranscript}`,
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore', // Professional voice
              },
            },
          },
        },
      });

      // Extract audio data
      const audioData =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!audioData) {
        throw new Error('No audio data received from TTS API');
      }

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      console.log('Audio buffer size:', audioBuffer.length, 'bytes');

      if (audioBuffer.length === 0) {
        throw new Error('Received empty audio data from TTS API');
      }

      // Save using FFmpeg for proper format
      await this.saveAudioWithFFmpeg(audioBuffer, audioFilePath);

      // Verify the final file works with FFmpeg
      try {
        const verifyCmd = `ffprobe -v quiet -print_format json -show_format "${audioFilePath}"`;
        const verifyOutput = execSync(verifyCmd, {
          encoding: 'utf8',
          timeout: 10000,
        });
        const formatData = JSON.parse(verifyOutput);

        if (!formatData.format || !formatData.format.duration) {
          throw new Error('Generated audio file has invalid format');
        }

        console.log(
          `Audio verification passed. Duration: ${formatData.format.duration}s`,
        );
      } catch (verifyError) {
        console.error('Audio verification failed:', verifyError);
        throw new Error(
          'Generated audio file is not valid for video processing',
        );
      }

      console.log('Audio generation completed successfully');
      return audioFilePath;
    } catch (error: any) {
      console.error('Error generating audio:', error);
      throw new Error(`Failed to generate audio: ${error.message}`);
    }
  }

  /**
   * Generate complete audio for news bite (transcript + audio generation)
   */
  async generateNewsAudio(
    newsBite: string,
    comments: Comment[],
  ): Promise<string> {
    try {
      console.log('Starting audio generation process...');

      // Step 1: Generate transcript
      console.log('Generating podcast transcript...');
      const transcript = await this.generatePodcastTranscript(
        newsBite,
        comments,
      );

      // Step 2: Generate audio from transcript
      console.log('Converting transcript to audio...');
      const audioFilePath = await this.generateAudioFromTranscript(
        transcript,
        newsBite,
      );

      console.log('Complete audio generation process finished');
      return audioFilePath;
    } catch (error: any) {
      console.error('Error in complete audio generation:', error);
      throw new Error(`Failed to generate news audio: ${error.message}`);
    }
  }

  /**
   * Cleanup audio file after use
   */
  async cleanupAudio(audioFilePath: string): Promise<void> {
    try {
      if (fs.existsSync(audioFilePath)) {
        await fs.promises.unlink(audioFilePath);
        console.log(`Cleaned up audio file: ${audioFilePath}`);
      }
    } catch (error) {
      console.error(`Error cleaning up audio file ${audioFilePath}:`, error);
    }
  }
}

export default GenerativeAIAudioService;
