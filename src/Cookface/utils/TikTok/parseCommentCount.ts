/**
 * Parse comment count from text (similar to parseLikeCount utility)
 * Handles formats like "85", "1.2K", "5.6M", etc.
 */
export function parseCommentCount(commentCountText: string): number {
  if (!commentCountText || commentCountText.trim() === '') return 0;

  const text = commentCountText.trim().toLowerCase();

  // Handle 'k' suffix (thousands)
  if (text.includes('k')) {
    const number = parseFloat(text.replace('k', ''));
    return Math.floor(number * 1000);
  }

  // Handle 'm' suffix (millions)
  if (text.includes('m')) {
    const number = parseFloat(text.replace('m', ''));
    return Math.floor(number * 1000000);
  }

  // Handle regular numbers
  const number = parseFloat(text);
  return isNaN(number) ? 0 : Math.floor(number);
}
