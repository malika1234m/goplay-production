/**
 * Fills the Bookings and Open matches lists with enough upcoming content that
 * neither screen reads as half-empty. Uses the existing facilities and demo
 * players only — no new venues, no new images. Idempotent.
 *
 *   npx tsx --env-file=.env prisma/fill-demo-screens.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const PLAYER = process.env.DEMO_PLAYER_EMAIL ?? "rashmi@gmail.com";

function at(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  // Booking dates are stored as UTC midnight of the calendar day —
  // setHours() would write the server's local midnight instead.
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const LOBBIES = [
  { facility: "Kandy Hills Tennis Club", sport: "Tennis",    code: "TNS4KD", day: 1, start: "17:00", end: "18:00", spots: 4,  taken: 3 },
  { facility: "Riverside Futsal Arena",  sport: "Futsal",    code: "FUT10R", day: 2, start: "18:00", end: "19:00", spots: 10, taken: 6 },
  { facility: "Ace Badminton Courts",    sport: "Badminton", code: "BDM2AC", day: 3, start: "19:00", end: "20:00", spots: 4,  taken: 1 },
  { facility: "GoPlay Sports Complex",   sport: "Football",  code: "FTB12G", day: 4, start: "07:00", end: "08:00", spots: 12, taken: 8 },
  { facility: "Kandy Hills Tennis Club", sport: "Tennis",    code: "TNS2KH", day: 6, start: "16:00", end: "17:00", spots: 2,  taken: 1 },
];

const BOOKINGS = [
  { facility: "Riverside Futsal Arena",  day: 4,  start: "18:00", end: "19:00" },
  { facility: "GoPlay Sports Complex",   day: 7,  start: "07:00", end: "08:00" },
  { facility: "Kandy Hills Tennis Club", day: 9,  start: "16:00", end: "17:00" },
  { facility: "Ace Badminton Courts",    day: 11, start: "20:00", end: "21:00" },
];

async function main() {
  const players = await db.user.findMany({
    where: { email: { in: ["ashan@demo.lk", "nimal@demo.lk", "priya@demo.lk", "demo.player@goplay.test"] } },
  });
  if (!players.length) throw new Error("No demo players found — run the seed first.");

  // ── Open matches ───────────────────────────────────────────────────
  for (const l of LOBBIES) {
    const existing = await db.openMatch.findUnique({ where: { lobbyCode: l.code } });
    if (existing) { console.log(`  lobby exists: ${l.code}`); continue; }

    const facility = await db.sportsFacility.findFirst({ where: { name: l.facility } });
    const category = await db.sportsCategory.findFirst({ where: { name: l.sport } });
    if (!facility || !category) { console.warn(`  skip ${l.code}`); continue; }

    const share = Math.round((facility.hourlyRate / l.spots) * 100) / 100;
    const expires = at(l.day);
    expires.setHours(Number(l.start.slice(0, 2)) - 2, 0, 0, 0);

    const match = await db.openMatch.create({
      data: {
        lobbyCode:          l.code,
        facilityId:         facility.id,
        categoryId:         category.id,
        preferredDate:      at(l.day),
        preferredStartTime: l.start,
        preferredEndTime:   l.end,
        totalSpotsNeeded:   l.spots,
        spotsReserved:      l.taken,
        status:             "COLLECTING",
        expiresAt:          expires,
      },
    });

    // Fill the reserved spots so the progress bar reflects `taken`
    let remaining = l.taken;
    let i = 0;
    while (remaining > 0) {
      const user = players[i % players.length];
      const groupSize = Math.min(remaining, i === 0 ? 1 : Math.min(2, remaining));
      await db.openMatchSpot.create({
        data: {
          matchId:       match.id,
          userId:        user.id,
          groupSize,
          status:        "RESERVED",
          paymentStatus: "PENDING",
          amountPaid:    share * groupSize,
        },
      });
      remaining -= groupSize;
      i++;
      if (i > 40) break;
    }
    console.log(`  lobby → ${l.code}  ${l.sport} ${l.taken}/${l.spots}`);
  }

  // ── More upcoming bookings for the demo player ─────────────────────
  const player = await db.user.findUnique({ where: { email: PLAYER } });
  if (!player) { console.warn(`  ${PLAYER} not found — skipping bookings`); }
  else {
    for (const b of BOOKINGS) {
      const facility = await db.sportsFacility.findFirst({
        where: { name: b.facility },
        include: { courts: { take: 1 } },
      });
      if (!facility) continue;

      const dupe = await db.facilityBooking.findFirst({
        where: { userId: player.id, facilityId: facility.id, bookingDate: at(b.day) },
      });
      if (dupe) continue;

      await db.facilityBooking.create({
        data: {
          userId:        player.id,
          facilityId:    facility.id,
          courtId:       facility.courts[0]?.id ?? null,
          bookingDate:   at(b.day),
          startTime:     b.start,
          endTime:       b.end,
          totalHours:    1,
          totalAmount:   facility.hourlyRate,
          status:        "CONFIRMED",
          paymentStatus: "PENDING",
          paymentMethod: "ON_ARRIVAL",
          contactNumber: "0775481108",
        },
      });
      console.log(`  booking → ${b.facility} in ${b.day}d`);
    }
  }

  const [lobbies, upcoming] = await Promise.all([
    db.openMatch.count({ where: { status: "COLLECTING", preferredDate: { gte: at(0) } } }),
    db.facilityBooking.count({ where: { user: { email: PLAYER }, status: "CONFIRMED", bookingDate: { gte: at(0) } } }),
  ]);
  console.log(`\ndone — ${lobbies} open lobbies, ${upcoming} upcoming bookings`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
