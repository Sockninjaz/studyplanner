/**
 * Validates if a date string in YYYY-MM-DD format is a valid calendar date.
 * Prevents issues like February 29th being entered for non-leap years.
 */
export function isValidCalendarDate(dateStr: string): boolean {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

    const [year, month, day] = dateStr.split('-').map(Number);

    // Note: month is 0-indexed in JS Date constructor (0 = Jan, 1 = Feb, etc.)
    const date = new Date(year, month - 1, day);

    // If the date is invalid (e.g. Feb 29 in a non-leap year), 
    // JS Date will automatically roll it over (e.g. to March 1).
    // We check if the components still match the input.
    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}

/**
 * Calculates finish time based on remaining study minutes (or seconds),
 * rounded UP to the nearest half hour (:00 or :30).
 * e.g., 17:02 + 45 min = 17:47 -> 18:00; 17:00 + 30 min = 17:30
 */
export function calculateFinishTimeRounded(
  remainingMinutesOrSeconds: number,
  fromDateMs: number = Date.now(),
  isSeconds: boolean = false
): string {
  const remainingMs = isSeconds
    ? remainingMinutesOrSeconds * 1000
    : remainingMinutesOrSeconds * 60 * 1000;

  if (remainingMs <= 0) return '';

  const HALF_HOUR_MS = 30 * 60 * 1000;
  const targetMs = fromDateMs + remainingMs;
  const roundedMs = Math.ceil(targetMs / HALF_HOUR_MS) * HALF_HOUR_MS;
  const roundedDate = new Date(roundedMs);
  const hours = String(roundedDate.getHours()).padStart(2, '0');
  const minutes = String(roundedDate.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
