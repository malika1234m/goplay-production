export interface PolicyTier {
  minHours:      number;
  refundPercent: number;
}

export interface CancellationPolicy {
  hoursUntil:    number;
  refundPercent: number;
  refundLabel:   string;
  description:   string;
  tier:          "full" | "half" | "quarter" | "none" | "custom";
}

export const DEFAULT_POLICY_TIERS: PolicyTier[] = [
  { minHours: 48, refundPercent: 100 },
  { minHours: 24, refundPercent: 50  },
  { minHours: 4,  refundPercent: 25  },
  { minHours: 0,  refundPercent: 0   },
];

function tierLabel(pct: number): string {
  if (pct === 100) return "Full Refund (100%)";
  if (pct === 0)   return "No Refund";
  return `${pct}% Refund`;
}

export function getCancellationPolicyFromTiers(
  bookingDate: Date,
  startTime:   string,
  tiers:       PolicyTier[] = DEFAULT_POLICY_TIERS,
): CancellationPolicy {
  const [h, m] = startTime.split(":").map(Number);
  const start  = new Date(bookingDate);
  start.setHours(h, m, 0, 0);
  const hoursUntil = (start.getTime() - Date.now()) / 3_600_000;

  const sorted = [...tiers].sort((a, b) => b.minHours - a.minHours);

  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    if (hoursUntil >= tier.minHours) {
      const pct  = tier.refundPercent;
      const next = sorted[i - 1];
      const desc = next
        ? `Cancelled ${tier.minHours}–${next.minHours} hours before — ${pct > 0 ? `${pct}% refund` : "no refund"}.`
        : `Cancelled ${tier.minHours}+ hours before — ${pct > 0 ? `${pct}% refund` : "no refund"}.`;
      return {
        hoursUntil,
        refundPercent: pct,
        refundLabel:   tierLabel(pct),
        description:   desc,
        tier: pct === 100 ? "full" : pct === 50 ? "half" : pct === 25 ? "quarter" : pct === 0 ? "none" : "custom",
      };
    }
  }

  // Fallback — last tier
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  return {
    hoursUntil,
    refundPercent: last.refundPercent,
    refundLabel:   tierLabel(last.refundPercent),
    description:   `Cancelled less than ${prev?.minHours ?? last.minHours} hours before — ${last.refundPercent > 0 ? `${last.refundPercent}% refund` : "no refund"}.`,
    tier:          last.refundPercent === 0 ? "none" : "custom",
  };
}

export function getCancellationPolicy(bookingDate: Date, startTime: string): CancellationPolicy {
  return getCancellationPolicyFromTiers(bookingDate, startTime, DEFAULT_POLICY_TIERS);
}

export async function loadPolicyTiers(): Promise<PolicyTier[]> {
  try {
    const { db } = await import("@/lib/db");
    const row    = await db.platformSetting.findUnique({ where: { key: "refund_policy" } });
    if (!row) return DEFAULT_POLICY_TIERS;
    const parsed = JSON.parse(row.value) as PolicyTier[];
    return Array.isArray(parsed) && parsed.length >= 1 ? parsed : DEFAULT_POLICY_TIERS;
  } catch {
    return DEFAULT_POLICY_TIERS;
  }
}

export const CASH_CANCEL_WARN_THRESHOLD = 3;
export const CASH_CANCEL_BAN_THRESHOLD  = 5;
export const NO_SHOW_ONLINE_THRESHOLD   = 2;
export const NO_SHOW_SUSPEND_THRESHOLD  = 3;
export const STRIKE_SUSPEND_THRESHOLD   = 3;
export const STRIKE_RESET_DAYS          = 90;
