import config from '../../config';
import {Comment} from '../../types/Comment';
import {GoogleGenAI} from '@google/genai';
import wav from 'wav';
import * as fs from 'fs';
import * as path from 'path';
import sleep from '../../utils/sleep';

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
   * @param newsBite - The generated news bite content
   * @param comments - Array of comments related to the trend
   * @returns Promise<string> - Generated transcript
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

    // Get sample comments for context
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
- Starts with a brief, catchy intro mentioning "TRENDING NEWS KE"
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

Format the output as a clean script ready for text-to-speech conversion without any additional like "Here is your podcast script".
Only the script text is needed.
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
   * @param newsBite - The news bite content to base filename on
   * @returns string - Generated filename
   */
  private generateAudioFilename(newsBite: string): string {
    // Clean the news bite for filename
    const cleanTitle = newsBite
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase()
      .substring(0, 40); // Limit length

    const timestamp = Date.now();
    return `tnk-news-${cleanTitle}-${timestamp}.wav`;
  }

  /**
   * Save wave file from PCM data
   * @param filename - Full path to save the file
   * @param pcmData - PCM audio data buffer
   * @param channels - Number of audio channels (default: 1)
   * @param rate - Sample rate (default: 24000)
   * @param sampleWidth - Sample width in bytes (default: 2)
   * @returns Promise<void>
   */
  private async saveWaveFile(
    filename: string,
    pcmData: Buffer,
    channels: number = 1,
    rate: number = 24000,
    sampleWidth: number = 2,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Ensure directory exists
        const dir = path.dirname(filename);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, {recursive: true});
        }

        const writer = new wav.FileWriter(filename, {
          channels,
          sampleRate: rate,
          bitDepth: sampleWidth * 8,
        });

        writer.on('finish', () => {
          console.log(`Audio file saved successfully: ${filename}`);
          resolve();
        });

        writer.on('error', error => {
          console.error('Error writing wave file:', error);
          reject(error);
        });

        writer.write(pcmData);
        writer.end();
      } catch (error) {
        console.error('Error in saveWaveFile:', error);
        reject(error);
      }
    });
  }

  /**
   * Generate audio from transcript using Gemini TTS
   * @param transcript - The text transcript to convert to speech
   * @param newsBite - The news bite for filename generation
   * @returns Promise<string> - Path to the generated audio file
   */
  async generateAudioFromTranscript(
    transcript: string,
    newsBite: string,
  ): Promise<string> {
    if (!transcript || typeof transcript !== 'string') {
      throw new Error('Invalid transcript: must be a non-empty string');
    }

    try {
      // Generate filename and full path
      const filename = this.generateAudioFilename(newsBite);
      const audioFilePath = path.join(this.audioStore, filename);

      console.log('Generating audio with Gemini TTS...');
      console.log('Transcript length:', transcript.length);
      console.log('Output path:', audioFilePath);

      // Configure TTS request with a professional news voice
      // Using 'Kore' (Firm) voice which is good for news content
      const response = await this.genAIAudio.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [
          {
            parts: [
              {
                text: `Read this news podcast script in a clear, professional news presenter voice with appropriate pacing for broadcast: ${transcript}`,
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore', // Firm voice, good for news
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

      // Save the audio file
      await this.saveWaveFile(audioFilePath, audioBuffer);

      console.log('Audio generation completed successfully');
      return audioFilePath;
    } catch (error: any) {
      console.error('Error generating audio:', error);
      throw new Error(`Failed to generate audio: ${error.message}`);
    }
  }

  /**
   * Generate complete audio for news bite (transcript + audio generation)
   * @param newsBite - The news bite content
   * @param comments - Related comments for context
   * @returns Promise<string> - Path to the generated audio file
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
   * @param audioFilePath - Path to the audio file to cleanup
   */
  async cleanupAudio(audioFilePath: string): Promise<void> {
    try {
      if (fs.existsSync(audioFilePath)) {
        await fs.promises.unlink(audioFilePath);
        console.log(`Cleaned up audio file: ${audioFilePath}`);
      }
    } catch (error) {
      console.error(`Error cleaning up audio file ${audioFilePath}:`, error);
      // Don't throw error - cleanup failure shouldn't stop the process
    }
  }
}

export default GenerativeAIAudioService;
