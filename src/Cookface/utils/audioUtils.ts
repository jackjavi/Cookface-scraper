import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import config from '../config/index.js';

/**
 * Generate audio filename for news content
 * @param title - The news bite or title to base filename on
 * @param platform - Optional platform identifier
 * @returns string - Generated filename with .wav extension
 */
export const generateAudioFilename = (
  title: string,
  platform?: string,
): string => {
  // Clean title for filename
  const cleanTitle = title
    .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .toLowerCase()
    .substring(0, 40); // Shorter limit for audio files

  // Add timestamp and platform for uniqueness
  const timestamp = Date.now();
  const platformPrefix = platform ? `${platform}-` : 'tnk-';

  return `${platformPrefix}${cleanTitle}-${timestamp}.wav`;
};

/**
 * Ensure audio storage directory exists
 * @param audioStorePath - Path to audio storage directory
 */
export const ensureAudioDirectory = async (
  audioStorePath: string,
): Promise<void> => {
  try {
    await fsPromises.mkdir(audioStorePath, {recursive: true});
  } catch (error) {
    console.error('Error creating audio directory:', error);
    throw error;
  }
};

/**
 * Get full audio file path
 * @param filename - Audio filename
 * @param customStorePath - Optional custom storage path, defaults to config.audioStore
 * @returns string - Full path to audio file
 */
export const getAudioFilePath = (
  filename: string,
  customStorePath?: string,
): string => {
  const storePath = customStorePath || config.audioStore;
  return path.join(storePath, filename);
};

/**
 * Clean up audio file after use
 * @param audioFilePath - Full path to the audio file to cleanup
 */
export const cleanupAudio = async (audioFilePath: string): Promise<void> => {
  try {
    if (fs.existsSync(audioFilePath)) {
      await fsPromises.unlink(audioFilePath);
      console.log(`Cleaned up audio file: ${audioFilePath}`);
    } else {
      console.log(`Audio file not found for cleanup: ${audioFilePath}`);
    }
  } catch (error) {
    console.error(`Error cleaning up audio file ${audioFilePath}:`, error);
    // Don't throw error - cleanup failure shouldn't stop the process
  }
};

/**
 * Check if audio file exists
 * @param audioFilePath - Full path to the audio file
 * @returns boolean - True if file exists
 */
export const audioFileExists = (audioFilePath: string): boolean => {
  try {
    return fs.existsSync(audioFilePath);
  } catch (error) {
    console.error(
      `Error checking audio file existence: ${audioFilePath}`,
      error,
    );
    return false;
  }
};

/**
 * Get audio file stats (size, creation time, etc.)
 * @param audioFilePath - Full path to the audio file
 * @returns Promise<fs.Stats | null> - File stats or null if error
 */
export const getAudioFileStats = async (
  audioFilePath: string,
): Promise<fs.Stats | null> => {
  try {
    if (audioFileExists(audioFilePath)) {
      return await fsPromises.stat(audioFilePath);
    }
    return null;
  } catch (error) {
    console.error(`Error getting audio file stats: ${audioFilePath}`, error);
    return null;
  }
};

/**
 * Get audio file size in bytes
 * @param audioFilePath - Full path to the audio file
 * @returns Promise<number> - File size in bytes, or 0 if error
 */
export const getAudioFileSize = async (
  audioFilePath: string,
): Promise<number> => {
  try {
    const stats = await getAudioFileStats(audioFilePath);
    return stats ? stats.size : 0;
  } catch (error) {
    console.error(`Error getting audio file size: ${audioFilePath}`, error);
    return 0;
  }
};

/**
 * Clean up old audio files (older than specified hours)
 * @param storePath - Path to audio storage directory
 * @param maxAgeHours - Maximum age in hours (default: 24)
 */
export const cleanupOldAudioFiles = async (
  storePath: string = config.audioStore,
  maxAgeHours: number = 24,
): Promise<void> => {
  try {
    if (!fs.existsSync(storePath)) {
      console.log('Audio storage directory does not exist');
      return;
    }

    const files = await fsPromises.readdir(storePath);
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();
    let cleanedCount = 0;

    for (const file of files) {
      if (file.endsWith('.wav')) {
        const filePath = path.join(storePath, file);
        const stats = await fsPromises.stat(filePath);

        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fsPromises.unlink(filePath);
          cleanedCount++;
          console.log(`Cleaned up old audio file: ${file}`);
        }
      }
    }

    console.log(`Cleaned up ${cleanedCount} old audio files`);
  } catch (error) {
    console.error('Error cleaning up old audio files:', error);
  }
};
