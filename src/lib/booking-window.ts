/**
 * The window every ground-portal booking list works in: bookings from the last 30 days
 * onwards that haven't been archived. Older ones live in Booking history. The Needs action
 * inbox and the full booking list both use this, so their counts always agree.
 */
export const ACTIVE_WINDOW_DAYS = 30;

export function activeBookingWindow() {
  const since = new Date();
  since.setDate(since.getDate() - ACTIVE_WINDOW_DAYS);
  since.setHours(0, 0, 0, 0);
  return { archivedAt: null, bookingDate: { gte: since } };
}
