import { db } from "@/lib/db";

const LK_MOBILE_RE = /^(?:\+94|0)7[0-9]{8}$/;

export function isValidLKMobile(raw: string): boolean {
  return LK_MOBILE_RE.test(raw.replace(/[\s\-().]/g, ""));
}

/**
 * Resolve the real mobile number for a paid action (PayHere needs one, and
 * co-players reach each other with it). Uses the number sent with the request,
 * falling back to the one saved on the profile. A number sent by a player who
 * has none saved is stored on their profile so they aren't asked again.
 */
export async function resolveContactPhone(
  userId: string,
  contactNumber: unknown,
): Promise<{ phone: string } | { error: string }> {
  const sent = typeof contactNumber === "string" ? contactNumber.trim() : "";

  if (sent && !isValidLKMobile(sent)) {
    return { error: "Enter a valid Sri Lankan mobile number (e.g. 077 123 4567 or +94 77 123 4567)." };
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { phone: true } });

  if (sent) {
    if (!user?.phone) await db.user.update({ where: { id: userId }, data: { phone: sent } });
    return { phone: sent };
  }
  if (user?.phone) return { phone: user.phone };

  return { error: "A contact mobile number is required. Add one to your profile and try again." };
}
