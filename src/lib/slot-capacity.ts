import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Either the shared client or a transaction client — capacity reads work on both. */
type Db = typeof db | Prisma.TransactionClient;

export interface SlotUsage {
  /** Active courts at the facility. A facility with none defined is treated as one bookable unit. */
  capacity: number;
  /** Concurrent holds overlapping the requested window. */
  used: number;
  /** capacity - used, floored at 0. */
  free: number;
  /** An overlapping lobby, when one exists — lets callers point players at it. */
  lobby: { id: string; categoryName: string } | null;
  /** True when the specific court asked about is already held. */
  courtTaken: boolean;
}

/**
 * A facility can run one game per active court at a time, so a time window is
 * only truly full once every court is spoken for.
 *
 * Both confirmed/pending bookings and COLLECTING lobbies hold capacity: a lobby
 * turns into a court-less booking the moment it fills, so it must be counted
 * from the start. Bookings that name a court occupy that court; court-less ones
 * (open-match conversions, facilities with no courts) each occupy one unit.
 *
 * Times are zero-padded "HH:MM", which sort chronologically, so the standard
 * half-open overlap test `start < otherEnd && end > otherStart` holds as strings.
 */
export async function slotUsage(opts: {
  facilityId: string;
  date: Date;
  startTime: string;
  endTime: string;
  /** Exclude a lobby from the count — used when re-checking a lobby against itself. */
  ignoreLobbyId?: string;
  /** Ask whether this specific court is free, alongside the facility-wide count. */
  courtId?: string | null;
  /** Read inside a transaction so the count is consistent with the write that follows. */
  client?: Db;
}): Promise<SlotUsage> {
  const { facilityId, date, startTime, endTime, ignoreLobbyId } = opts;
  const client = opts.client ?? db;

  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const [courtCount, bookings, lobbies] = await Promise.all([
    client.facilityCourt.count({ where: { facilityId, isActive: true } }),

    client.facilityBooking.findMany({
      where: {
        facilityId,
        bookingDate: { gte: startOfDay, lte: endOfDay },
        status:      { in: ["PENDING", "CONFIRMED"] },
        AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
      },
      select: { courtId: true },
    }),

    client.openMatch.findMany({
      where: {
        facilityId,
        preferredDate: { gte: startOfDay, lte: endOfDay },
        status:        "COLLECTING",
        expiresAt:     { gt: new Date() },
        ...(ignoreLobbyId ? { id: { not: ignoreLobbyId } } : {}),
        AND: [
          { preferredStartTime: { lt: endTime } },
          { preferredEndTime:   { gt: startTime } },
        ],
      },
      select: { id: true, courtId: true, category: { select: { name: true } } },
    }),
  ]);

  // Distinct named courts count once; every court-less hold takes a unit of its own.
  // Bookings and lobbies are counted identically — a lobby becomes a booking on
  // the same court when it fills.
  const namedCourts = new Set<string>();
  let courtless = 0;
  for (const hold of [...bookings, ...lobbies]) {
    if (hold.courtId) namedCourts.add(hold.courtId);
    else courtless++;
  }

  const capacity = Math.max(courtCount, 1);
  const used     = namedCourts.size + courtless;

  return {
    capacity,
    used,
    free:  Math.max(capacity - used, 0),
    lobby: lobbies[0] ? { id: lobbies[0].id, categoryName: lobbies[0].category.name } : null,
    courtTaken: opts.courtId ? namedCourts.has(opts.courtId) : false,
  };
}


/**
 * Capacity is read-then-write, so two requests racing on the same slot could both
 * see a free court and both take it. Serialise every capacity decision for one
 * facility-day behind a Postgres advisory lock: it is held for the life of the
 * transaction and released on commit or rollback, so the check and the insert
 * are atomic. Different facilities — and different days at one facility — never
 * contend, so this costs nothing in the common case.
 *
 * Everything inside `fn` MUST use the supplied `tx`; work done on the shared
 * client runs outside the lock and outside the transaction.
 */
export async function withFacilityDayLock<T>(
  facilityId: string,
  date: Date,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const day = date.toISOString().slice(0, 10);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${facilityId}), hashtext(${day}))`;
    return fn(tx);
  });
}
