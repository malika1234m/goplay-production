import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/mobile-auth";
import { createNotification } from "@/lib/notify";
import {
  getCancellationPolicyFromTiers,
  loadPolicyTiers,
  CASH_CANCEL_BAN_THRESHOLD,
} from "@/lib/cancellation-policy";

// DELETE /api/open-matches/[id]/spot — player cancels their own reserved spot
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session?.user) return Response.json({ error: "Login required." }, { status: 401 });
  if (session.user.role !== "USER") {
    return Response.json({ error: "Only players can cancel open match spots." }, { status: 403 });
  }

  const { id } = await params;

  const [spot, user] = await Promise.all([
    db.openMatchSpot.findFirst({
      where: { matchId: id, userId: session.user.id, status: "RESERVED" },
    }),
    db.user.findUnique({
      where:  { id: session.user.id },
      select: { isBookingSuspended: true },
    }),
  ]);

  if (!spot) {
    return Response.json({ error: "No active spot found for you in this lobby." }, { status: 404 });
  }
  if (user?.isBookingSuspended) {
    return Response.json({ error: "Your account is suspended. Please contact support." }, { status: 403 });
  }

  const match = await db.openMatch.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      facility: { select: { name: true } },
      // other active spots so we can notify them
      spots: {
        where:  { status: "RESERVED", NOT: { userId: session.user.id } },
        select: { userId: true },
      },
    },
  });

  if (!match || match.status !== "COLLECTING") {
    return Response.json(
      { error: "You cannot cancel your spot once the lobby has been matched." },
      { status: 409 },
    );
  }

  // Determine cancellation policy tier based on time until the match
  const tiers  = await loadPolicyTiers();
  const policy = getCancellationPolicyFromTiers(
    new Date(match.preferredDate),
    match.preferredStartTime,
    tiers,
  );

  // Every write hangs off the spot still being RESERVED, so repeated taps of "Leave"
  // can't release its capacity, record the strike or notify players more than once.
  const outcome = await db.$transaction(async (tx) => {
    const released = await tx.openMatchSpot.updateMany({
      where: { id: spot.id, status: "RESERVED" },
      data:  { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (released.count === 0) return null;

    await tx.openMatch.update({
      where: { id },
      data:  { spotsReserved: { decrement: spot.groupSize } },
    });

    // Apply the same cancellation strike as cash bookings — every open match spot
    // is treated as a cash commitment since payment is taken at match time.
    // Incremented in the database: a count read earlier is stale when leaves overlap.
    const { cashCancelCount } = await tx.user.update({
      where:  { id: session.user.id },
      data:   { cashCancelCount: { increment: 1 } },
      select: { cashCancelCount: true },
    });
    const willSuspend = cashCancelCount >= CASH_CANCEL_BAN_THRESHOLD;
    if (willSuspend) {
      await tx.user.update({ where: { id: session.user.id }, data: { isBookingSuspended: true } });
    }
    return { newCount: cashCancelCount, willSuspend };
  });
  if (!outcome) {
    return Response.json({ error: "No active spot found for you in this lobby." }, { status: 404 });
  }
  const { newCount, willSuspend } = outcome;

  const dateStr    = new Date(match.preferredDate).toLocaleDateString("en-LK", { weekday: "short", month: "short", day: "numeric" });
  const spotsAfter = match.totalSpotsNeeded - match.spotsReserved + spot.groupSize;

  // Build fine label shown to the cancelling player
  let fineLabel: string;
  if (willSuspend) {
    fineLabel = "Your account has been suspended due to repeated cancellations. Contact GoPlay support to appeal.";
  } else if (policy.hoursUntil < 4) {
    fineLabel = `Late cancellation (< 4 hours before match) — strike ${newCount} of ${CASH_CANCEL_BAN_THRESHOLD - 1} recorded on your account.`;
  } else if (policy.hoursUntil < 24) {
    fineLabel = `Short-notice cancellation — strike ${newCount} of ${CASH_CANCEL_BAN_THRESHOLD - 1} recorded on your account.`;
  } else if (policy.hoursUntil < 48) {
    fineLabel = `Cancellation with under 48 hours to go — strike ${newCount} of ${CASH_CANCEL_BAN_THRESHOLD - 1} recorded.`;
  } else {
    fineLabel = `Cancelled well in advance — strike ${newCount} of ${CASH_CANCEL_BAN_THRESHOLD - 1} recorded. No payment penalty.`;
  }

  // Notify the cancelling player
  await createNotification({
    userId:  session.user.id,
    title:   willSuspend ? "Account Suspended" : "Spot Cancelled",
    message: `You left the ${match.category.name} lobby at ${match.facility.name} on ${dateStr}. ${fineLabel}`,
    type:    willSuspend ? "error" : "warning",
    link:    `/open-matches/${id}`,
  });

  // Notify remaining players that a spot reopened
  const otherIds = [...new Set(match.spots.map((s) => s.userId))];
  if (otherIds.length > 0) {
    await db.notification.createMany({
      data: otherIds.map((uid) => ({
        userId:  uid,
        title:   "A Spot Opened Up",
        message: `A player left the ${match.category.name} lobby at ${match.facility.name} on ${dateStr}. ${spotsAfter} spot${spotsAfter !== 1 ? "s" : ""} now available — share the link to fill it!`,
        type:    "info" as const,
        link:    `/open-matches/${id}`,
      })),
    });
  }

  return Response.json({
    message:     "Your spot has been cancelled.",
    fineLabel,
    isSuspended: willSuspend,
    cancelCount: newCount,
  });
}
