/**
 * Seeds the demo player's Alerts tab with the notifications the backend really
 * produces (createNotification also fires a push for each one). Uses only the
 * four tones the player app styles: success / info / warning / error.
 *
 *   npx tsx --env-file=.env prisma/add-demo-alerts.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const PLAYER = process.env.DEMO_PLAYER_EMAIL ?? "rashmi@gmail.com";
const ago = (mins: number) => new Date(Date.now() - mins * 60_000);

async function main() {
  const player = await db.user.findUnique({ where: { email: PLAYER } });
  if (!player) throw new Error(`${PLAYER} not found`);

  const tns = await db.openMatch.findUnique({ where: { lobbyCode: "TNS4KD" } });
  const fut = await db.openMatch.findUnique({ where: { lobbyCode: "FUT10R" } });

  const ALERTS = [
    { type: "success", title: "Booking confirmed",
      message: "Kandy Hills Tennis Club · Wed, 26 Aug at 8:00 AM. Pay Rs. 2,500 at the ground.",
      link: "/my-bookings", mins: 14, read: false },
    { type: "info", title: "1 spot left in your match",
      message: "Tennis at Kandy Hills Tennis Club is nearly full — Tue, 25 Aug at 5:00 PM.",
      link: tns ? `/open-matches/${tns.id}` : "/open-matches", mins: 95, read: false },
    { type: "success", title: "You're in the match",
      message: "Your spot in FUT10R is reserved. Your share of the court fee is Rs. 450.",
      link: fut ? `/open-matches/${fut.id}` : "/open-matches", mins: 320, read: false },
    { type: "info", title: "Match day tomorrow",
      message: "Riverside Futsal Arena · Fri, 28 Aug at 6:00 PM. Court 1, Nugegoda.",
      link: "/my-bookings", mins: 1500, read: true },
    { type: "warning", title: "Booking cancelled by the ground",
      message: "GoPlay Sports Complex cancelled Sun, 23 Aug at 7:00 AM. You were not charged.",
      link: "/my-bookings", mins: 2900, read: true },
    { type: "success", title: "Thanks for the review",
      message: "Your 5-star review of Riverside Futsal Arena is now live.",
      link: null, mins: 4300, read: true },
    { type: "info", title: "New ground near you",
      message: "Ace Badminton Courts just joined GoPlay in Colombo.",
      link: null, mins: 7200, read: true },
  ];

  let made = 0;
  for (const a of ALERTS) {
    const dupe = await db.notification.findFirst({
      where: { userId: player.id, title: a.title },
    });
    if (dupe) continue;

    await db.notification.create({
      data: {
        userId:    player.id,
        title:     a.title,
        message:   a.message,
        type:      a.type,
        link:      a.link,
        isRead:    a.read,
        createdAt: ago(a.mins),
      },
    });
    made++;
    console.log(`  ${a.read ? "read  " : "UNREAD"}  ${a.type.padEnd(7)}  ${a.title}`);
  }

  const [total, unread] = await Promise.all([
    db.notification.count({ where: { userId: player.id } }),
    db.notification.count({ where: { userId: player.id, isRead: false } }),
  ]);
  console.log(`\ndone — created ${made}; ${total} alerts, ${unread} unread`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
