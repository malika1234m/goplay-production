import type { BookingStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// What a ground (owner or worker) may do to a booking. A no-show leaves NO_SHOW only through
// GoPlay's review; COMPLETED and CANCELLED are final. Admin actions have their own routes.
const GROUND_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING:   ["CONFIRMED", "COMPLETED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  NO_SHOW:   [],
  COMPLETED: [],
  CANCELLED: [],
};

/** Why a ground can't move this booking to `to`, or null when it can. */
export function groundTransitionError(b: { status: BookingStatus; paymentMethod: string; paymentStatus: string; isOpenMatch?: boolean | null }, to: BookingStatus): string | null {
  if (b.status === "NO_SHOW")   return "This booking is marked as a no-show and is with GoPlay for review. Contact GoPlay support to change it.";
  if (b.status === "COMPLETED") return "This booking is already completed and cannot be changed.";
  if (b.status === "CANCELLED") return "This booking is cancelled and cannot be changed.";
  if (b.isOpenMatch && to === "CANCELLED") return "Open match bookings can't be cancelled by the ground. Contact GoPlay support to resolve this.";
  if (!GROUND_TRANSITIONS[b.status].includes(to)) return `A ${b.status.toLowerCase()} booking can't be marked ${to.toLowerCase().replace("_", "-")}.`;
  // "Pay online" money is confirmed by accepting the receipt, never by changing the status
  if ((to === "CONFIRMED" || to === "COMPLETED") && b.paymentMethod === "ONLINE" && b.paymentStatus !== "PAID") {
    return "This booking is paid by bank transfer. Review the player's receipt under Payments first.";
  }
  return null;
}

/**
 * Apply a status change only if the booking is still in the status it was read in — so an owner
 * and a worker (or two taps) acting at once can't both apply it. False means someone got there first.
 */
export async function moveBooking(id: string, from: BookingStatus, data: Prisma.FacilityBookingUpdateManyMutationInput, client: Pick<typeof db, "facilityBooking"> = db): Promise<boolean> {
  const { count } = await client.facilityBooking.updateMany({ where: { id, status: from }, data });
  return count === 1;
}
