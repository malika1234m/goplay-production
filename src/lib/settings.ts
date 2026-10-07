import { db } from "@/lib/db";

const DEFAULT_COMMISSION_PCT = Number(process.env.PLATFORM_COMMISSION_PCT ?? "10");

export async function getCommissionRate(): Promise<number> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key: "commissionRate" } });
    if (row) return Number(row.value) / 100;
  } catch { /* fall through */ }
  return DEFAULT_COMMISSION_PCT / 100;
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
