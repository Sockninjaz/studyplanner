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
