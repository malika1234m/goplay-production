import { db } from "@/lib/db";
import { createNotification } from "@/lib/notify";
import { notifyAdmins } from "@/lib/lobby-payments";
import { sendPayoutAccountChangedEmail } from "@/lib/email";
import { isAllowed } from "@/lib/rateLimiter";

// Changing where players' money goes is the most valuable thing a stolen session can do, so every
// change is announced to the owner (in the app and by email) and to GoPlay, and changes are capped.

/** False once an owner has changed payout accounts too often today. */
export const payoutChangeAllowed = (userId: string) => isAllowed(`payout-account:${userId}`, 5, 24 * 60 * 60_000);

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export async function announcePayoutAccountChange(opts: { ownerUserId: string; where: string; before: string | null; after: string | null }) {
  if (digits(opts.before) === digits(opts.after)) return;
  const last4 = digits(opts.after) ? digits(opts.after).slice(-4) : null;
  const owner = await db.user.findUnique({ where: { id: opts.ownerUserId }, select: { name: true, email: true } });
  if (!owner) return;
  await createNotification({
    userId:  opts.ownerUserId,
    title:   "Payout bank account changed",
    message: `The account players pay for ${opts.where} was ${last4 ? `changed to one ending in ${last4}` : "removed"}. If this wasn't you, change your password and contact GoPlay support now.`,
    type:    "warning",
  });
  void sendPayoutAccountChangedEmail({ to: owner.email, name: owner.name, where: opts.where, accountLast4: last4 });
  await notifyAdmins("Ground payout account changed", `${owner.name} changed the bank account for ${opts.where}${last4 ? ` (now ending ${last4})` : " (removed)"}.`, "/admin/grounds");
}
