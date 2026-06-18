import { db } from "../src/lib/db";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode() {
  let c = "";
  for (let i = 0; i < 6; i++) c += CHARS[Math.floor(Math.random() * CHARS.length)];
  return c;
}

async function main() {
  const lobbies = await db.openMatch.findMany({ where: { lobbyCode: null }, select: { id: true } });
  console.log(`Backfilling ${lobbies.length} lobbies…`);
  for (const lobby of lobbies) {
    let code: string;
    let exists: { id: string } | null;
    do {
      code = randomCode();
      exists = await db.openMatch.findUnique({ where: { lobbyCode: code }, select: { id: true } });
    } while (exists);
    await db.openMatch.update({ where: { id: lobby.id }, data: { lobbyCode: code } });
    console.log(`  ${lobby.id} → #${code}`);
  }
  console.log("Done.");
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
