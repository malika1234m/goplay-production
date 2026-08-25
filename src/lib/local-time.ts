/**
 * Booking dates are stored as UTC midnight of the calendar day, and start/end
 * times are wall-clock Sri Lanka times ("08:00" means 8am in Colombo).
 *
 * Combining them with `Date.setHours()` uses the SERVER's timezone, which is
 * Asia/Colombo on a developer's machine but UTC on Vercel — a 5.5 hour error in
 * production that silently shifts refund tiers and no-show windows. Always build
 * the instant explicitly instead.
 *
 * Sri Lanka is UTC+05:30 year-round with no DST, so a fixed offset is exact.
 */
export const SL_UTC_OFFSET_MINUTES = 330;

/** The precise UTC instant of a wall-clock "HH:MM" on a stored booking date. */
export function slotInstant(bookingDate: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  return new Date(
    Date.UTC(
      bookingDate.getUTCFullYear(),
      bookingDate.getUTCMonth(),
      bookingDate.getUTCDate(),
      h || 0,
      m || 0,
      0,
      0,
    ) - SL_UTC_OFFSET_MINUTES * 60_000,
  );
}
