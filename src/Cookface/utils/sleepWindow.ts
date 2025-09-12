export function isWithinSleepWindow(): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Convert current time to minutes since midnight for easier comparison
  const currentTimeInMinutes = hours * 60 + minutes;

  // Sleep window: 23:45 (11:45 PM) to 06:40 (6:40 AM)
  const sleepStart = 23 * 60 + 45; // 23:45 in minutes (1425)
  const sleepEnd = 6 * 60 + 40; // 06:40 in minutes (400)

  // Handle the case where sleep window crosses midnight
  if (sleepStart > sleepEnd) {
    // Sleep window spans across midnight (23:45 PM to 06:40 AM)
    return (
      currentTimeInMinutes >= sleepStart || currentTimeInMinutes < sleepEnd
    );
  } else {
    // Sleep window is within the same day (shouldn't happen in this case)
    return (
      currentTimeInMinutes >= sleepStart && currentTimeInMinutes < sleepEnd
    );
  }
}

// Alternative simpler approach (your original logic was almost correct):
export function isWithinSleepWindowSimple(): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  return (
    (hours === 23 && minutes >= 45) || // From 23:45 onwards
    (hours >= 0 && hours < 6) || // All hours from 0 to 5 (midnight to 5:59 AM)
    (hours === 6 && minutes < 40) // From 6:00 to 6:39 AM
  );
}
