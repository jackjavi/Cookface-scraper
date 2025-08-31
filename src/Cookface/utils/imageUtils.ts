import fs from 'fs';
import fsPromises from 'fs/promises';
import axios from 'axios';
import path from 'path';
import config from '../config/index.js';

// Download image from URL
export const downloadImage = async (
  imageUrl: string,
  destinationPath: string,
) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(destinationPath);
    await fsPromises.mkdir(dir, {recursive: true});

    const response = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000, // 30 second timeout
    });

    const writer = fs.createWriteStream(destinationPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(undefined));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading image:', error);
    throw error;
  }
};

// Clean up downloaded image after sending
export const cleanupImage = async (imagePath: string) => {
  try {
    await fsPromises.unlink(imagePath);
    console.log(`Cleaned up image: ${imagePath}`);
  } catch (error) {
    console.error(`Error cleaning up image ${imagePath}:`, error);
    // Don't throw error - cleanup failure shouldn't stop the process
  }
};

// Reusable image filename generator for multi-platform use
export const generateMultiPlatformImageFilename = (
  title: string,
  platform?: string,
): string => {
  // Clean title for filename
  const cleanTitle = title
    .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .toLowerCase()
    .substring(0, 40); // Shorter limit for multi-platform use

  // Add timestamp and platform for uniqueness
  const timestamp = Date.now();
  const platformPrefix = platform ? `${platform}-` : '';

  return `${platformPrefix}${cleanTitle}-${timestamp}.jpg`;
};
