"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Crown, Zap, Shield, TrendingUp, DollarSign, Users,
  Clock, AlertTriangle, CheckCircle, XCircle, RefreshCcw,
  CreditCard, Loader2, ChevronRight,
} from "lucide-react";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plan-constants";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PendingActivation {
  id: string; ownerId: string; name: string; email: string;
  joinedAt: string; businessName: string | null;
}

interface ExpiringSoon {
  id: string; name: string; email: string; plan: string;
  planExpiresAt: string; daysLeft: number;
}

interface ExpiredPlan {
  id: string; name: string; email: string; plan: string; planExpiresAt: string;
}

interface RecentPayment {
  id: string; ownerName: string; ownerEmail: string; plan: string;
  type: string; amount: number; status: string; paidAt: string | null; createdAt: string;
}

interface AnalyticsData {
  revenue: {
    mrr: number;
    totalRegistrationFees: number;
    totalSubscriptionRevenue: number;
    totalRevenue: number;
  };
  planDistribution: {
    STARTER: { count: number; percentage: number };
    GROWTH:  { count: number; percentage: number; mrr: number };
    PRO:     { count: number; percentage: number; mrr: number };
  };
  pendingActivations: PendingActivation[];
  expiringSoon:       ExpiringSoon[];
  expiredPlans:       ExpiredPlan[];
  recentPayments:     RecentPayment[];
  totals: { owners: number; activated: number; unactivated: number };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PLAN_ICONS: Record<PlanKey, React.ElementType> = { STARTER: Shield, GROWTH: Zap, PRO: Crown };

const PLAN_COLORS: Record<PlanKey, { badge: string; card: string; bar: string; icon: string }> = {
  STARTER: {
    badge: "bg-slate-100 text-slate-700",
    card:  "from-slate-50 to-slate-100 border-slate-200",
    bar:   "bg-slate-400",
    icon:  "bg-slate-100 text-slate-600",
  },
  GROWTH: {
    badge: "bg-blue-100 text-blue-700",
    card:  "from-blue-50 to-blue-100 border-blue-200",
    bar:   "bg-blue-500",
    icon:  "bg-blue-100 text-blue-600",
  },
  PRO: {
    badge: "bg-purple-100 text-purple-700",
    card:  "from-purple-50 to-purple-100 border-purple-200",
    bar:   "bg-purple-500",
    icon:  "bg-purple-100 text-purple-600",
  },
};

function PlanBadge({ plan }: { plan: string }) {
  const key = (["STARTER", "GROWTH", "PRO"].includes(plan) ? plan : "STARTER") as PlanKey;
  const Icon = PLAN_ICONS[key];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_COLORS[key].badge}`}>
      <Icon className="w-3 h-3" />{PLAN_CONFIG[key].label}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  PAID:    "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-700",
  FAILED:  "bg-red-100 text-red-600",
};

const TYPE_LABELS: Record<string, string> = {
  REGISTRATION_FEE: "Activation Fee",
  SUBSCRIPTION:     "Subscription",
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Main component ─────────────────────────────────────────────────────────────

type AttentionTab = "pending" | "expiring" | "expired";

export default function AdminSubscriptionsPage() {
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<AttentionTab>("pending");
  const [busy,    setBusy]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/subscriptions");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function forceActivate(ownerId: string) {
    setBusy(ownerId);
    await fetch(`/api/admin/owners/${ownerId}/plan`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ forceActivate: true }),
    });
    setBusy(null);
    load();
  }

  async function extendPlan(owner: ExpiringSoon) {
    setBusy(owner.id);
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0];
    await fetch(`/api/admin/owners/${owner.id}/plan`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ plan: owner.plan, expiresAt }),
    });
    setBusy(null);
    load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 gap-3 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading subscription analytics…</span>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-20 text-slate-400 text-sm">Failed to load data.</div>;
  }

  const { revenue, planDistribution, pendingActivations, expiringSoon, expiredPlans, recentPayments, totals } = data;

  const attentionCount = pendingActivations.length + expiringSoon.length + expiredPlans.length;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Dark gradient header ─────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-7 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.15),transparent_60%)]" />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Subscription Analytics</h1>
            <p className="text-slate-400 text-sm mt-1">
              {totals.owners} owner{totals.owners !== 1 ? "s" : ""} registered — {totals.activated} activated, {totals.unactivated} pending
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl transition-all"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Key numbers */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4 mt-7">
          {[
            { label: "Monthly Recurring",  value: `Rs. ${revenue.mrr.toLocaleString()}`,                    icon: TrendingUp,  highlight: true  },
            { label: "Activation Fees",    value: `Rs. ${revenue.totalRegistrationFees.toLocaleString()}`,   icon: DollarSign,  highlight: false },
            { label: "Subscription Rev",   value: `Rs. ${revenue.totalSubscriptionRevenue.toLocaleString()}`,icon: CreditCard,  highlight: false },
            { label: "Total Platform Rev", value: `Rs. ${revenue.totalRevenue.toLocaleString()}`,            icon: Users,       highlight: false },
          ].map(({ label, value, icon: Icon, highlight }) => (
            <div
              key={label}
              className={`rounded-xl p-4 border transition-all ${
                highlight
                  ? "bg-white/15 border-white/30 ring-1 ring-white/20"
                  : "bg-white/8 border-white/10"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${highlight ? "bg-indigo-500/30" : "bg-white/10"}`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <p className={`text-xl font-bold ${highlight ? "text-white" : "text-slate-100"}`}>{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Plan Distribution ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-3">Plan Distribution</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["STARTER", "GROWTH", "PRO"] as const).map((plan) => {
            const Icon     = PLAN_ICONS[plan];
            const colors   = PLAN_COLORS[plan];
            const dist     = planDistribution[plan];
            const planMrr  = "mrr" in dist ? dist.mrr : 0;

            return (
              <div
                key={plan}
                className={`rounded-2xl border bg-gradient-to-br p-5 ${colors.card}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.icon}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{PLAN_CONFIG[plan].label}</p>
                    <p className="text-xs text-slate-500">
                      {plan === "STARTER" ? "Free plan" : `Rs. ${PLAN_CONFIG[plan].monthlyFee.toLocaleString()}/mo`}
                    </p>
                  </div>
                </div>

                <p className="text-3xl font-bold text-slate-900">{dist.count}</p>
                <p className="text-xs text-slate-500 mt-0.5">owners · {dist.percentage}% of active</p>

                {/* distribution bar */}
                <div className="mt-4 h-1.5 rounded-full bg-white/60">
                  <div
                    className={`h-1.5 rounded-full transition-all ${colors.bar}`}
                    style={{ width: `${dist.percentage}%` }}
                  />
                </div>

                {plan !== "STARTER" && (
                  <p className="text-xs font-semibold text-slate-700 mt-3">
                    MRR: Rs. {planMrr.toLocaleString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Attention Required ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 pt-5 pb-0 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-slate-900">Attention Required</h2>
            {attentionCount > 0 && (
              <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{attentionCount}</span>
            )}
          </div>
          {/* Tabs */}
          <div className="flex gap-1">
            {([
              { key: "pending",  label: "Pending Activation", count: pendingActivations.length },
              { key: "expiring", label: "Expiring Soon",      count: expiringSoon.length },
              { key: "expired",  label: "Expired",            count: expiredPlans.length },
            ] as { key: AttentionTab; label: string; count: number }[]).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-xl border-b-2 transition-all ${
                  tab === key
                    ? "border-green-600 text-green-700 bg-green-50"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    tab === key ? "bg-green-600 text-white" : "bg-slate-200 text-slate-600"
                  }`}>{count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">

          {/* Pending Activations */}
          {tab === "pending" && (
            pendingActivations.length === 0
              ? <EmptyState message="No pending activations." />
              : (
                <div className="flex flex-col gap-3">
                  {pendingActivations.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-100 rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-sm font-bold shrink-0">
                          {o.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{o.name}</p>
                          <p className="text-xs text-slate-500 truncate">{o.email}</p>
                          {o.businessName && <p className="text-xs text-slate-400 truncate">{o.businessName}</p>}
                          <p className="text-xs text-slate-400 mt-0.5">Joined {fmt(o.joinedAt)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => forceActivate(o.id)}
                        disabled={busy === o.id}
                        className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                      >
                        {busy === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Force Activate
                      </button>
                    </div>
                  ))}
                </div>
              )
          )}

          {/* Expiring Soon */}
          {tab === "expiring" && (
            expiringSoon.length === 0
              ? <EmptyState message="No plans expiring in the next 7 days." />
              : (
                <div className="flex flex-col gap-3">
                  {expiringSoon.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-4 p-4 bg-orange-50 border border-orange-100 rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-orange-200 flex items-center justify-center text-orange-700 text-sm font-bold shrink-0">
                          {o.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900 truncate">{o.name}</p>
                            <PlanBadge plan={o.plan} />
                          </div>
                          <p className="text-xs text-slate-500 truncate">{o.email}</p>
                          <p className="text-xs text-orange-600 font-medium mt-0.5">
                            Expires {fmt(o.planExpiresAt)} · {o.daysLeft} day{o.daysLeft !== 1 ? "s" : ""} left
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => extendPlan(o)}
                        disabled={busy === o.id}
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                      >
                        {busy === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        Extend 30 Days
                      </button>
                    </div>
                  ))}
                </div>
              )
          )}

          {/* Expired Plans */}
          {tab === "expired" && (
            expiredPlans.length === 0
              ? <EmptyState message="No expired paid plans." />
              : (
                <div className="flex flex-col gap-3">
                  {expiredPlans.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-4 p-4 bg-red-50 border border-red-100 rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm font-bold shrink-0">
                          {o.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900 truncate">{o.name}</p>
                            <PlanBadge plan={o.plan} />
                          </div>
                          <p className="text-xs text-slate-500 truncate">{o.email}</p>
                          <p className="text-xs text-red-500 font-medium mt-0.5">Expired {fmt(o.planExpiresAt)}</p>
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-medium text-red-500 shrink-0">
                        <XCircle className="w-3.5 h-3.5" /> Expired
                      </span>
                    </div>
                  ))}
                </div>
              )
          )}
        </div>
      </div>

      {/* ── Recent Payments ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">Recent Payments</h2>
          <span className="text-xs text-slate-400 ml-auto">Last 20</span>
        </div>

        {recentPayments.length === 0 ? (
          <EmptyState message="No payment records yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Plan</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Type</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-900 text-sm">{p.ownerName}</p>
                      <p className="text-xs text-slate-400 truncate max-w-[140px]">{p.ownerEmail}</p>
                    </td>
                    <td className="px-3 py-3.5"><PlanBadge plan={p.plan} /></td>
                    <td className="px-3 py-3.5 hidden sm:table-cell">
                      <span className="text-xs text-slate-600">{TYPE_LABELS[p.type] ?? p.type}</span>
                    </td>
                    <td className="px-3 py-3.5 font-semibold text-slate-900 text-sm whitespace-nowrap">
                      Rs. {p.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLES[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {p.status === "PAID"    && <CheckCircle className="w-3 h-3" />}
                        {p.status === "FAILED"  && <XCircle className="w-3 h-3" />}
                        {p.status === "PENDING" && <Clock className="w-3 h-3" />}
                        {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-slate-400 whitespace-nowrap hidden md:table-cell">
                      {fmt(p.paidAt ?? p.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm text-slate-400">{message}</div>
  );
}
