import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCommissionRate } from "@/lib/settings";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "GROUND_OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rangeRaw = searchParams.get("range") ?? "all";
    const VALID_RANGES = ["30d", "90d", "month", "all"] as const;
    const range = (VALID_RANGES as readonly string[]).includes(rangeRaw)
      ? rangeRaw as typeof VALID_RANGES[number]
      : "all";

    const profile = await db.groundOwnerProfile.findUnique({
      where: { userId: session.user.id },
      include: { facilities: { select: { id: true } } },
    });
    if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });

    // Backfill: create GroundEarning for any COMPLETED bookings that slipped through
    const facilityIds = profile.facilities.map((f) => f.id);
    const unrecorded = await db.facilityBooking.findMany({
      where: {
        facilityId: { in: facilityIds },
        status:     "COMPLETED",
        earning:    { is: null },
      },
      select: { id: true, facilityId: true, totalAmount: true, paymentMethod: true, paymentStatus: true, specialRequests: true },
    });

    if (unrecorded.length > 0) {
      const FEE = await getCommissionRate();
      await db.groundEarning.createMany({
        data: unrecorded.map((b) => {
          const isWalkIn = b.specialRequests?.startsWith("[Walk-in]") ?? false;
          return {
            bookingId:      b.id,
            facilityId:     b.facilityId,
            ownerId:        profile.id,
            grossAmount:    b.totalAmount,
            platformFee:    isWalkIn ? 0 : Math.round(b.totalAmount * FEE * 100) / 100,
            netAmount:      isWalkIn ? b.totalAmount : Math.round(b.totalAmount * (1 - FEE) * 100) / 100,
            paymentMethod:  b.paymentMethod,
            cashConfirmed:  b.paymentMethod === "ONLINE" ? b.paymentStatus === "PAID" : false,
            ...(isWalkIn && { commissionNote: "Walk-in — no platform commission" }),
          };
        }),
        skipDuplicates: true,
      });
    }

    // Date filter
    let since: Date | undefined;
    const now = new Date();
    if (range === "30d") {
      since = new Date(now);
      since.setDate(now.getDate() - 29);
      since.setHours(0, 0, 0, 0);
    } else if (range === "90d") {
      since = new Date(now);
      since.setDate(now.getDate() - 89);
      since.setHours(0, 0, 0, 0);
    } else if (range === "month") {
      since = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    const earnings = await db.groundEarning.findMany({
      where: {
        ownerId:  profile.id,
        ...(since && { earnedAt: { gte: since } }),
      },
      include: {
        facility: { select: { id: true, name: true, city: true } },
        booking: {
          select: {
            bookingDate:     true,
            startTime:       true,
            endTime:         true,
            totalHours:      true,
            paymentStatus:   true,
            specialRequests: true,
            user:            { select: { name: true, email: true } },
            court:           { select: { name: true } },
          },
        },
      },
      orderBy: { earnedAt: "desc" },
    });

    // Overall summary
    const summary = earnings.reduce(
      (acc, e) => ({
        totalGross: acc.totalGross + e.grossAmount,
        totalFee:   acc.totalFee   + e.platformFee,
        totalNet:   acc.totalNet   + e.netAmount,
        totalCount: acc.totalCount + 1,
        cashPending: acc.cashPending + (e.paymentMethod === "ON_ARRIVAL" && !e.cashConfirmed ? 1 : 0),
      }),
      { totalGross: 0, totalFee: 0, totalNet: 0, totalCount: 0, cashPending: 0 }
    );

    // Group by facility
    const facilityMap = new Map<string, {
      facilityId:   string;
      facilityName: string;
      facilityCity: string;
      gross: number;
      fee:   number;
      net:   number;
      count: number;
      earnings: typeof earnings;
    }>();

    for (const e of earnings) {
      const fid = e.facility.id;
      if (!facilityMap.has(fid)) {
        facilityMap.set(fid, {
          facilityId:   fid,
          facilityName: e.facility.name,
          facilityCity: e.facility.city,
          gross: 0, fee: 0, net: 0, count: 0,
          earnings: [],
        });
      }
      const grp = facilityMap.get(fid)!;
      grp.gross += e.grossAmount;
      grp.fee   += e.platformFee;
      grp.net   += e.netAmount;
      grp.count += 1;
      grp.earnings.push(e);
    }

    const byFacility = Array.from(facilityMap.values()).sort((a, b) => b.gross - a.gross);

    return Response.json({ summary, byFacility });
  } catch (err) {
    console.error("[GET /api/ground-owner/earnings]", err);
    return Response.json({ error: "Failed to fetch earnings." }, { status: 500 });
  }
}
