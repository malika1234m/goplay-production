import { db } from "@/lib/db";

const DEFAULT_COMMISSION_PCT = Number(process.env.PLATFORM_COMMISSION_PCT ?? "10");

/** Platform default commission as a fraction (e.g. 0.1), set in admin Settings. */
export async function getDefaultCommissionRate(): Promise<number> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: "commissionRate" } });
    if (row) return Number(row.value) / 100;
  } catch { /* fall through */ }
  return DEFAULT_COMMISSION_PCT / 100;
}

/** Commission as a fraction for a ground: its own rate if an admin set one, else the platform default. */
export async function getCommissionRate(facilityId?: string | null): Promise<number> {
  if (facilityId) {
    const f = await db.sportsFacility.findUnique({ where: { id: facilityId }, select: { commissionRate: true } }).catch(() => null);
    if (f?.commissionRate != null) return f.commissionRate / 100;
  }
  return getDefaultCommissionRate();
}

export async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.platformSetting.upsert({
    where:  { key },
    create: { key, value },
    update: { value },
  });
}

const DEFAULT_RECEIPT_WINDOW_MINUTES = 120;

/** How long a "Pay online" booking or lobby spot waits for a receipt before its slot is released. */
export async function getReceiptWindowMinutes(): Promise<number> {
  const v = Number(await getSetting("receiptWindowMinutes"));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_RECEIPT_WINDOW_MINUTES;
}
