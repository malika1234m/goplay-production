import { db } from "@/lib/db";
import { getCommissionRate, getSetting, setSetting } from "@/lib/settings";
import { createNotification } from "@/lib/notify";
import type { PaymentDetails } from "@/lib/payment-details";

// GoPlay-collected lobby payments ("GoPlay Connect"). Players transfer to GoPlay's account;
// once the lobby fills GoPlay owes the ground its payout (court price minus commission).
// Refunds for lobbies that don't go ahead are GoPlay's to make. The split — commission and
// what GoPlay keeps — is admin-only: players see their price, owners see their payout.

export const PLATFORM_BANK_KEYS = {
  bankName:      "platformBankName",
  bankBranch:    "platformBankBranch",
  accountName:   "platformAccountName",
  accountNumber: "platformAccountNumber",
  instructions:  "platformPaymentInstructions",
} as const;

/** GoPlay's own bank account for lobby payments, set by an admin. Null until it's complete. */
export async function getPlatformPaymentDetails(): Promise<PaymentDetails | null> {
  const [bankName, bankBranch, accountName, accountNumber, instructions] = await Promise.all(
    Object.values(PLATFORM_BANK_KEYS).map((k) => getSetting(k)),
  );
  if (!bankName?.trim() || !accountName?.trim() || !accountNumber?.trim()) return null;
  return {
    bankName,
    bankBranch:   bankBranch?.trim() || null,
    accountName,
    accountNumber,
    instructions: instructions?.trim() || null,
  };
}

export async function setPlatformPaymentDetails(d: Partial<Record<keyof typeof PLATFORM_BANK_KEYS, string>>) {
  await Promise.all(
    (Object.keys(PLATFORM_BANK_KEYS) as (keyof typeof PLATFORM_BANK_KEYS)[])
      .filter((k) => d[k] !== undefined)
      .map((k) => setSetting(PLATFORM_BANK_KEYS[k], String(d[k] ?? "").trim().slice(0, 200))),
  );
}

/** In-app notification to every admin. */
export async function notifyAdmins(title: string, message: string, link = "/admin/lobby-payments") {
  const admins = await db.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  await Promise.all(admins.map((a) => createNotification({ userId: a.id, title, message, type: "info", link })));
}

/** The ground's share of a filled GoPlay-collected lobby. */
export async function calcLobbyPayout(courtAmount: number, facilityId: string) {
  const commissionRate   = await getCommissionRate(facilityId);
  const commissionAmount = Math.round(courtAmount * commissionRate * 100) / 100;
  return { commissionRate, commissionAmount, amount: Math.round((courtAmount - commissionAmount) * 100) / 100 };
}

/** Sri Lankan bank account details a player gives for a refund. */
export function validateRefundDetails(body: Record<string, unknown>):
  | { ok: true; data: { refundBankName: string; refundBankBranch: string | null; refundAccountName: string; refundAccountNumber: string } }
  | { ok: false; error: string } {
  const bank    = String(body.bankName ?? "").trim();
  const branch  = String(body.bankBranch ?? "").trim();
  const name    = String(body.accountName ?? "").trim();
  const number  = String(body.accountNumber ?? "").replace(/[\s-]/g, "");
  if (bank.length < 2 || bank.length > 80)   return { ok: false, error: "Enter your bank's name." };
  if (name.length < 2 || name.length > 100)  return { ok: false, error: "Enter the account holder's name." };
  if (!/^\d{6,20}$/.test(number))            return { ok: false, error: "Enter a valid account number (digits only)." };
  if (branch.length > 80)                    return { ok: false, error: "Branch name is too long." };
  return { ok: true, data: { refundBankName: bank, refundBankBranch: branch || null, refundAccountName: name, refundAccountNumber: number } };
}

/**
 * Earnings figures for a completed booking. A GoPlay-collected lobby shows the ground only its
 * payout — GoPlay already kept the commission, so there's nothing to bill the owner afterwards.
 */
export async function earningFigures(b: { totalAmount: number; facilityId: string; specialRequests?: string | null; isOpenMatch?: boolean | null; openMatchId?: string | null }) {
  if (b.isOpenMatch && b.openMatchId) {
    const payout = await db.lobbyPayout.findUnique({ where: { matchId: b.openMatchId }, select: { amount: true } });
    if (payout) {
      return {
        grossAmount: payout.amount, platformFee: 0, netAmount: payout.amount,
        commissionPaid: true, commissionSettledAt: new Date(),
        commissionNote: "GoPlay Connect — paid out by GoPlay",
      };
    }
  }
  const isWalkIn = b.specialRequests?.startsWith("[Walk-in]") ?? false;
  const rate     = await getCommissionRate(b.facilityId);
  const fee      = isWalkIn ? 0 : Math.round(b.totalAmount * rate * 100) / 100;
  return {
    grossAmount: b.totalAmount, platformFee: fee, netAmount: Math.round((b.totalAmount - fee) * 100) / 100,
    commissionPaid: false, commissionSettledAt: null as Date | null,
    commissionNote: isWalkIn ? "Walk-in — no platform commission" : b.isOpenMatch ? "GoPlay Connect — open match" : null,
  };
}
