import fs from 'fs';
import fsPromises from 'fs/promises';
import axios from 'axios';
import path from 'path';
import config from '../../config/index.js';

// Generate unique filename for image
export const generateImageFilename = (telegramTitle: string) => {
  // Clean title for filename
  const cleanTitle = telegramTitle
    .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .toLowerCase()
    .substring(0, 50); // Limit length

  // Add timestamp for uniqueness
  const timestamp = Date.now();

  return `${cleanTitle}-${timestamp}.jpg`;
};

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
