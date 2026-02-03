/**
 * Calculates a heatmap color based on timestamp age.
 *
 * Color formula:
 * - Blue (240deg) = oldest
 * - Red (0deg) = newest
 * - Low opacity (0.15) for subtle background highlighting
 *
 * @param timestamp - Timestamp in milliseconds
 * @param minTimestamp - Oldest timestamp in range
 * @param maxTimestamp - Newest timestamp in range
 * @returns HSL color string with low opacity
 */
export function calculateAgeColor(
  timestamp: number,
  minTimestamp: number,
  maxTimestamp: number
): string {
  // Handle edge case where all timestamps are the same
  if (minTimestamp === maxTimestamp) {
    return 'hsla(200, 60%, 70%, 0.15)'; // Neutral gray-blue
  }

  // Calculate normalized age (0 = oldest, 1 = newest)
  const age = (timestamp - minTimestamp) / (maxTimestamp - minTimestamp);

  // Map age to hue: 240deg (blue) for old, 0deg (red) for new
  const hue = 240 - age * 240;

  return `hsla(${hue}, 60%, 70%, 0.15)`;
}

/**
 * Converts a date string to a human-readable relative time description.
 *
 * @param date - Date string in YYYY/MM/DD format from Perforce
 * @returns Human-readable description like "Today", "2 days ago", "3 months ago"
 */
export function getAgeDescription(date: string): string {
  // Parse YYYY/MM/DD format
  const [year, month, day] = date.split('/').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const now = new Date();

  // Calculate difference in days
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }
}
