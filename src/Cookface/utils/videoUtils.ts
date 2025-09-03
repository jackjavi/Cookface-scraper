import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import config from '../config/index.js';

/**
 * Generate video filename for news content
 * @param title - The news bite or title to base filename on
 * @param platform - Optional platform identifier
 * @returns string - Generated filename with .mp4 extension
 */
export const generateVideoFilename = (
  title: string,
  platform?: string,
): string => {
  // Clean title for filename
  const cleanTitle = title
    .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .toLowerCase()
    .substring(0, 40); // Shorter limit for video files

  // Add timestamp and platform for uniqueness
  const timestamp = Date.now();
  const platformPrefix = platform ? `${platform}-` : 'tnk-';

  return `${platformPrefix}${cleanTitle}-${timestamp}.mp4`;
};

/**
 * Ensure video storage directory exists
 * @param videoStorePath - Path to video storage directory
 */
export const ensureVideoDirectory = async (
  videoStorePath: string,
): Promise<void> => {
  try {
    await fsPromises.mkdir(videoStorePath, {recursive: true});
  } catch (error) {
    console.error('Error creating video directory:', error);
    throw error;
  }
};

/**
 * Get full video file path
 * @param filename - Video filename
 * @param customStorePath - Optional custom storage path, defaults to config.videoStore
 * @returns string - Full path to video file
 */
export const getVideoFilePath = (
  filename: string,
  customStorePath?: string,
): string => {
  const storePath = customStorePath || config.videoStore || 'storage/videos/';
  return path.join(storePath, filename);
};

/**
 * Clean up video file after use
 * @param videoFilePath - Full path to the video file to cleanup
 */
export const cleanupVideo = async (videoFilePath: string): Promise<void> => {
  try {
    if (fs.existsSync(videoFilePath)) {
      await fsPromises.unlink(videoFilePath);
      console.log(`Cleaned up video file: ${videoFilePath}`);
    } else {
      console.log(`Video file not found for cleanup: ${videoFilePath}`);
    }
  } catch (error) {
    console.error(`Error cleaning up video file ${videoFilePath}:`, error);
    // Don't throw error - cleanup failure shouldn't stop the process
  }
};

/**
 * Check if video file exists
 * @param videoFilePath - Full path to the video file
 * @returns boolean - True if file exists
 */
export const videoFileExists = (videoFilePath: string): boolean => {
  try {
    return fs.existsSync(videoFilePath);
  } catch (error) {
    console.error(
      `Error checking video file existence: ${videoFilePath}`,
      error,
    );
    return false;
  }
};

/**
 * Get video file stats (size, creation time, etc.)
 * @param videoFilePath - Full path to the video file
 * @returns Promise<fs.Stats | null> - File stats or null if error
 */
export const getVideoFileStats = async (
  videoFilePath: string,
): Promise<fs.Stats | null> => {
  try {
    if (videoFileExists(videoFilePath)) {
      return await fsPromises.stat(videoFilePath);
    }
    return null;
  } catch (error) {
    console.error(`Error getting video file stats: ${videoFilePath}`, error);
    return null;
  }
};

/**
 * Get video file size in bytes
 * @param videoFilePath - Full path to the video file
 * @returns Promise<number> - File size in bytes, or 0 if error
 */
export const getVideoFileSize = async (
  videoFilePath: string,
): Promise<number> => {
  try {
    const stats = await getVideoFileStats(videoFilePath);
    return stats ? stats.size : 0;
  } catch (error) {
    console.error(`Error getting video file size: ${videoFilePath}`, error);
    return 0;
  }
};

/**
 * Format file size in human readable format
 * @param bytes - File size in bytes
 * @returns string - Formatted file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Clean up old video files (older than specified hours)
 * @param storePath - Path to video storage directory
 * @param maxAgeHours - Maximum age in hours (default: 24)
 */
export const cleanupOldVideoFiles = async (
  storePath: string = config.videoStore || 'storage/videos/',
  maxAgeHours: number = 24,
): Promise<void> => {
  try {
    if (!fs.existsSync(storePath)) {
      console.log('Video storage directory does not exist');
      return;
    }

    const files = await fsPromises.readdir(storePath);
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();
    let cleanedCount = 0;

    for (const file of files) {
      if (file.endsWith('.mp4')) {
        const filePath = path.join(storePath, file);
        const stats = await fsPromises.stat(filePath);

        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fsPromises.unlink(filePath);
          cleanedCount++;
          console.log(`Cleaned up old video file: ${file}`);
        }
      }
    }

    console.log(`Cleaned up ${cleanedCount} old video files`);
  } catch (error) {
    console.error('Error cleaning up old video files:', error);
  }
};

/**
 * Copy video file to another location
 * @param sourcePath - Source video file path
 * @param destinationPath - Destination path
 * @returns Promise<void>
 */
export const copyVideoFile = async (
  sourcePath: string,
  destinationPath: string,
): Promise<void> => {
  try {
    // Ensure destination directory exists
    const destDir = path.dirname(destinationPath);
    await ensureVideoDirectory(destDir);

    // Copy the file
    await fsPromises.copyFile(sourcePath, destinationPath);
    console.log(`Video copied from ${sourcePath} to ${destinationPath}`);
  } catch (error) {
    console.error('Error copying video file:', error);
    throw error;
  }
};

/**
 * Move video file to another location
 * @param sourcePath - Source video file path
 * @param destinationPath - Destination path
 * @returns Promise<void>
 */
export const moveVideoFile = async (
  sourcePath: string,
  destinationPath: string,
): Promise<void> => {
  try {
    await copyVideoFile(sourcePath, destinationPath);
    await cleanupVideo(sourcePath);
    console.log(`Video moved from ${sourcePath} to ${destinationPath}`);
  } catch (error) {
    console.error('Error moving video file:', error);
    throw error;
  }
};
