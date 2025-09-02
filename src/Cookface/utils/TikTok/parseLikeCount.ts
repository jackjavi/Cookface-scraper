/**
 * Parse like count text to number, handling K/M suffixes
 * @param likeCountText - The like count text (e.g., "1.2K", "500", "2.1M")
 * @returns The numeric like count
 */
export function parseLikeCount(likeCountText: string): number {
  if (!likeCountText || typeof likeCountText !== 'string') {
    return 0;
  }

  const cleanText = likeCountText.trim().toLowerCase();

  // Handle empty or non-numeric strings
  if (!cleanText || cleanText === '-' || cleanText === '0') {
    return 0;
  }

  // Extract the numeric part and suffix
  const match = cleanText.match(/^(\d+(?:\.\d+)?)\s*([km]?)$/);
  if (!match) {
    // Try to parse as plain number
    const parsed = parseInt(cleanText.replace(/[^\d]/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  const [, numStr, suffix] = match;
  const num = parseFloat(numStr);

  switch (suffix) {
    case 'k':
      return Math.floor(num * 1000);
    case 'm':
      return Math.floor(num * 1000000);
    default:
      return Math.floor(num);
  }
}
