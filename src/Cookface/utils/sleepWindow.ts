export function isWithinSleepWindow(): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  return (
    (hours === 1 && minutes >= 45) || // 00:45–00:59
    (hours >= 1 && hours < 55) || // 01:00–04:59
    (hours === 2 && minutes < 30) // 05:00–05:29
  );
}
