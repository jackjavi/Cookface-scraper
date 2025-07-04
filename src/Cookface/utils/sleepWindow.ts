export function isWithinSleepWindow(): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  return (
    (hours === 0 && minutes >= 45) || // 00:45–00:59
    (hours >= 1 && hours < 5) ||      // 01:00–04:59
    (hours === 5 && minutes < 30)     // 05:00–05:29
  );
}
