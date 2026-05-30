"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Crown, Zap, Shield, AlertTriangle, Loader2,
  Building2, Users, CalendarX, ArrowUpRight,
} from "lucide-react";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plan-constants";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UsageStat {
  used: number;
  max:  number | null;
}

interface PlanStatus {
  plan:          PlanKey;
  isActivated:   boolean;
  planExpiresAt: string | null;
  daysLeft:      number | null;
  expiringSoon:  boolean;
  usage: {
    facilities:   UsageStat;
    workers:      UsageStat;
    blockedDates: UsageStat;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PLAN_ICONS: Record<PlanKey, React.ElementType> = {
  STARTER: Shield,
  GROWTH:  Zap,
  PRO:     Crown,
};

const PLAN_STYLES: Record<PlanKey, { badge: string; bar: string; ring: string }> = {
  STARTER: { badge: "bg-slate-100 text-slate-700",    bar: "bg-slate-400",   ring: "ring-slate-200"  },
  GROWTH:  { badge: "bg-blue-100 text-blue-700",      bar: "bg-blue-500",    ring: "ring-blue-200"   },
  PRO:     { badge: "bg-purple-100 text-purple-700",  bar: "bg-purple-500",  ring: "ring-purple-200" },
};

function UsageBar({
  label, icon: Icon, used, max, barColor,
}: {
  label: string;
  icon:  React.ElementType;
  used:  number;
  max:   number | null;
  barColor: string;
}) {
  const pct = max !== null ? Math.min(100, Math.round((used / Math.max(max, 1)) * 100)) : 0;
  const isUnlimited = max === null;
  const isAtMax     = !isUnlimited && used >= max;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <Icon className="w-3.5 h-3.5 text-slate-400" />
          {label}
        </span>
        <span className={`text-xs font-semibold ${isAtMax ? "text-red-500" : "text-slate-700"}`}>
          {used} / {isUnlimited ? "∞" : max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        {isUnlimited ? (
          <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: "100%", opacity: 0.35 }} />
        ) : (
          <div
            className={`h-1.5 rounded-full transition-all ${isAtMax ? "bg-red-400" : barColor}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PlanStatusWidget() {
  const [status,  setStatus]  = useState<PlanStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    fetch("/api/ground-owner/plan-status")
      .then((r) => {
        if (!r.ok) throw new Error("failed");
        return r.json() as Promise<PlanStatus>;
      })
      .then((d) => setStatus(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center justify-center gap-2 text-slate-400 min-h-[140px]">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Loading plan…</span>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5 text-center text-xs text-slate-400 min-h-[100px] flex items-center justify-center">
        Could not load plan status.
      </div>
    );
  }

  const { plan, daysLeft, expiringSoon, usage } = status;
  const config  = PLAN_CONFIG[plan];
  const styles  = PLAN_STYLES[plan];
  const Icon    = PLAN_ICONS[plan];

  return (
    <div className={`bg-white rounded-2xl border border-slate-100 overflow-hidden ring-1 ${styles.ring}`}>

      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${styles.badge}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${styles.badge}`}>
              <Icon className="w-3 h-3" />
              {config.label} Plan
            </span>
            {plan === "STARTER" && (
              <p className="text-xs text-green-600 font-semibold mt-1">Free — no monthly fee</p>
            )}
          </div>
        </div>

        {/* Days left badge for paid plans */}
        {plan !== "STARTER" && daysLeft !== null && (
          <div className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
            expiringSoon
              ? "bg-amber-100 text-amber-700"
              : "bg-green-100 text-green-700"
          }`}>
            {daysLeft}d left
          </div>
        )}
      </div>

      {/* Expiring soon warning */}
      {expiringSoon && (
        <div className="mx-5 mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            Your {config.label} plan expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}. Renew to avoid service interruption.
          </p>
        </div>
      )}

      {/* Usage bars */}
      <div className="px-5 pb-5 flex flex-col gap-3.5">
        <UsageBar
          label="Facilities"
          icon={Building2}
          used={usage.facilities.used}
          max={usage.facilities.max}
          barColor={styles.bar}
        />
        <UsageBar
          label="Workers"
          icon={Users}
          used={usage.workers.used}
          max={usage.workers.max}
          barColor={styles.bar}
        />
        <UsageBar
          label="Blocked Dates (this month)"
          icon={CalendarX}
          used={usage.blockedDates.used}
          max={usage.blockedDates.max}
          barColor={styles.bar}
        />
      </div>

      {/* Footer */}
      {plan === "STARTER" ? (
        <div className="border-t border-slate-50 px-5 py-3.5">
          <Link
            href="/ground-owner/billing"
            className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 py-2.5 rounded-xl transition-all"
          >
            Upgrade Plan
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="border-t border-slate-50 px-5 py-3.5 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Rs. {config.monthlyFee.toLocaleString()}/mo
          </span>
          <Link
            href="/ground-owner/billing"
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Manage Plan <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
