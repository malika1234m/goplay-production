"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  CreditCard, CheckCircle, Loader2, TrendingUp, Star,
  Building2, Users, CalendarOff, BarChart2, Download,
  Clock, RefreshCw, Crown, Zap, Shield,
  AlertCircle, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plan-constants";

interface BillingInfo {
  plan:          PlanKey;
  storedPlan:    PlanKey;
  planExpiresAt: string | null;
  isActivated:   boolean;
  subscriptions: {
    id:        string;
    plan:      PlanKey;
    type:      string;
    amount:    number;
    status:    string;
    paidAt:    string | null;
    expiresAt: string | null;
    createdAt: string;
  }[];
}

const PLAN_FEATURES: Record<PlanKey, { icon: React.ElementType; text: string; available: boolean }[]> = {
  STARTER: [
    { icon: Building2,   text: "1 facility",              available: true  },
    { icon: CreditCard,  text: "2 courts per facility",   available: true  },
    { icon: Users,       text: "1 worker",                available: true  },
    { icon: TrendingUp,  text: "Basic earnings view",     available: true  },
    { icon: CalendarOff, text: "5 blocked dates/month",   available: true  },
    { icon: BarChart2,   text: "Monthly analytics",       available: false },
    { icon: Download,    text: "CSV export",              available: false },
    { icon: Star,        text: "Featured listing",        available: false },
  ],
  GROWTH: [
    { icon: Building2,   text: "3 facilities",            available: true },
    { icon: CreditCard,  text: "5 courts per facility",   available: true },
    { icon: Users,       text: "5 workers",               available: true },
    { icon: TrendingUp,  text: "Full earnings view",      available: true },
    { icon: CalendarOff, text: "20 blocked dates/month",  available: true },
    { icon: BarChart2,   text: "Monthly analytics",       available: true },
    { icon: Download,    text: "CSV export",              available: false },
    { icon: Star,        text: "Featured listing",        available: false },
  ],
  PRO: [
    { icon: Building2,   text: "Unlimited facilities",    available: true },
    { icon: CreditCard,  text: "Unlimited courts",        available: true },
    { icon: Users,       text: "Unlimited workers",       available: true },
    { icon: TrendingUp,  text: "Full earnings view",      available: true },
    { icon: CalendarOff, text: "Unlimited blocked dates", available: true },
    { icon: BarChart2,   text: "Full analytics + export", available: true },
    { icon: Download,    text: "CSV export",              available: true },
    { icon: Star,        text: "Featured listing",        available: true },
  ],
};

const PLAN_ICONS: Record<PlanKey, React.ElementType> = {
  STARTER: Shield,
  GROWTH:  Zap,
  PRO:     Crown,
};

const PLAN_COLORS: Record<PlanKey, { bg: string; text: string; border: string; badge: string; ring: string }> = {
  STARTER: { bg: "bg-slate-50",    text: "text-slate-700", border: "border-slate-200",  badge: "bg-slate-100 text-slate-600",    ring: "ring-slate-300"   },
  GROWTH:  { bg: "bg-blue-50",     text: "text-blue-700",  border: "border-blue-200",   badge: "bg-blue-100 text-blue-700",      ring: "ring-blue-400"    },
  PRO:     { bg: "bg-purple-50",   text: "text-purple-700",border: "border-purple-200", badge: "bg-purple-100 text-purple-700",  ring: "ring-purple-400"  },
};

function submitToPayHere(params: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = params.checkout_url;
  Object.entries(params).forEach(([k, v]) => {
    if (k === "checkout_url") return;
    const input = document.createElement("input");
    input.type  = "hidden";
    input.name  = k;
    input.value = v;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtAmt(n: number) {
  return `Rs. ${n.toLocaleString()}`;
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const urlStatus    = searchParams.get("status");

  const [info,         setInfo]         = useState<BillingInfo | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [upgrading,    setUpgrading]    = useState<PlanKey | null>(null);
  const [error,        setError]        = useState("");
  const [polling,      setPolling]      = useState(urlStatus === "success");
  const [cancelModal,  setCancelModal]  = useState(false);
  const [cancelling,   setCancelling]   = useState(false);
  const [cancelDone,   setCancelDone]   = useState("");

  useEffect(() => {
    fetch("/api/ground-owner/billing")
      .then((r) => r.json())
      .then(setInfo)
      .finally(() => setLoading(false));
  }, []);

  // Auto-refresh after successful PayHere redirect
  useEffect(() => {
    if (!polling) return;
    const t = setTimeout(() => window.location.reload(), 4000);
    return () => clearTimeout(t);
  }, [polling]);

  async function handleCancel(immediate: boolean) {
    setCancelling(true);
    try {
      const res  = await fetch("/api/ground-owner/billing/cancel", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ immediate }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to cancel."); return; }
      setCancelDone(data.message);
      setCancelModal(false);
      // Reload billing info
      const billing = await fetch("/api/ground-owner/billing").then((r) => r.json());
      setInfo(billing);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleUpgrade(plan: PlanKey) {
    setUpgrading(plan);
    setError("");
    try {
      const res  = await fetch("/api/ground-owner/billing/upgrade", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to initiate upgrade."); return; }
      submitToPayHere(data.payHereParams);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setUpgrading(null);
    }
  }

  if (polling) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <RefreshCw className="w-7 h-7 text-green-600 animate-spin" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-900">Confirming your payment…</p>
          <p className="text-sm text-slate-500 mt-1">Your plan will update momentarily. Refreshing automatically.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading billing info…</span>
      </div>
    );
  }

  if (!info) return null;

  const currentPlan = info.plan;
  const PlanIcon    = PLAN_ICONS[currentPlan];
  const colors      = PLAN_COLORS[currentPlan];

  const expiresAt   = info.planExpiresAt ? new Date(info.planExpiresAt) : null;
  const daysLeft    = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000) : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 7;
  const expired      = info.storedPlan !== "STARTER" && info.plan === "STARTER" && info.planExpiresAt;

  return (
    <div className="flex flex-col gap-7">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing &amp; Plan</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your subscription and view payment history</p>
      </div>

      {/* Status alerts */}
      {urlStatus === "cancelled" && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Payment was cancelled. Your plan has not changed.
        </div>
      )}
      {expired && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Your paid plan expired. You&apos;ve been moved to the Starter plan. Renew to restore your features.
        </div>
      )}
      {expiringSoon && !expired && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm">
          <Clock className="w-4 h-4 shrink-0" />
          Your {PLAN_CONFIG[info.storedPlan].label} plan expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}. Renew now to keep your features.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Current plan banner */}
      <div className={`${colors.bg} border ${colors.border} rounded-2xl p-6`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${colors.badge} flex items-center justify-center`}>
              <PlanIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-xl font-bold ${colors.text}`}>{PLAN_CONFIG[currentPlan].label} Plan</h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>Current</span>
              </div>
              <p className="text-slate-500 text-sm mt-0.5">
                {currentPlan === "STARTER"
                  ? "Free forever"
                  : expiresAt
                  ? `Renews ${fmt(info.planExpiresAt)}`
                  : "Active"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-extrabold ${colors.text}`}>
              {PLAN_CONFIG[currentPlan].monthlyFee === 0 ? "Free" : fmtAmt(PLAN_CONFIG[currentPlan].monthlyFee)}
            </p>
            {PLAN_CONFIG[currentPlan].monthlyFee > 0 && <p className="text-slate-500 text-xs">/month</p>}
            <p className="text-slate-500 text-xs mt-1">{PLAN_CONFIG[currentPlan].commissionPct}% platform commission</p>
          </div>
        </div>
      </div>

      {/* Plan comparison */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 mb-4">Available Plans</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {(["STARTER", "GROWTH", "PRO"] as const).map((key) => {
            const cfg      = PLAN_CONFIG[key];
            const features = PLAN_FEATURES[key];
            const isActive = currentPlan === key;
            const c        = PLAN_COLORS[key];
            const Icon     = PLAN_ICONS[key];
            const isUpgrading = upgrading === key;

            return (
              <div
                key={key}
                className={`bg-white rounded-2xl border-2 p-6 flex flex-col relative ${
                  isActive ? `${c.border} ring-2 ${c.ring}` : "border-slate-100"
                }`}
              >
                {isActive && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full ${c.badge}`}>
                    Current Plan
                  </span>
                )}
                {key === "PRO" && !isActive && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-purple-600 text-white">
                    Best Value
                  </span>
                )}

                <div className={`w-11 h-11 rounded-xl ${c.badge} flex items-center justify-center mb-4`}>
                  <Icon className="w-5 h-5" />
                </div>

                <h3 className="text-lg font-bold text-slate-900">{cfg.label}</h3>
                <div className="flex items-baseline gap-1 mt-1 mb-1">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {cfg.monthlyFee === 0 ? "Free" : `Rs. ${cfg.monthlyFee.toLocaleString()}`}
                  </span>
                  {cfg.monthlyFee > 0 && <span className="text-slate-400 text-sm">/mo</span>}
                </div>
                <p className="text-xs text-slate-500 mb-5">{cfg.commissionPct}% platform commission</p>

                <div className="flex flex-col gap-2.5 mb-6 flex-1">
                  {features.map(({ icon: FIcon, text, available }) => (
                    <div key={text} className={`flex items-center gap-2.5 text-sm ${available ? "text-slate-700" : "text-slate-300"}`}>
                      {available
                        ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                        : <div className="w-4 h-4 rounded-full border-2 border-slate-200 shrink-0" />
                      }
                      <FIcon className={`w-3.5 h-3.5 shrink-0 ${available ? "text-slate-400" : "text-slate-200"}`} />
                      {text}
                    </div>
                  ))}
                </div>

                {isActive ? (
                  <div className={`w-full py-2.5 rounded-xl text-sm font-semibold text-center ${c.badge}`}>
                    Active Plan
                  </div>
                ) : key === "STARTER" ? (
                  <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center bg-slate-50 text-slate-400 border border-slate-100">
                    Downgrade via Support
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(key)}
                    disabled={!!upgrading}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                      key === "PRO"
                        ? "bg-purple-600 hover:bg-purple-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    } disabled:bg-slate-100 disabled:text-slate-400`}
                  >
                    {isUpgrading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</>
                    ) : (
                      `Upgrade to ${cfg.label}`
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing history */}
      {info.subscriptions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50">
            <h2 className="text-base font-semibold text-slate-900">Payment History</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {info.subscriptions.map((s) => (
              <div key={s.id} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    s.status === "PAID"    ? "bg-green-50"  :
                    s.status === "FAILED"  ? "bg-red-50"    :
                    "bg-amber-50"
                  }`}>
                    <CreditCard className={`w-4 h-4 ${
                      s.status === "PAID"    ? "text-green-600"  :
                      s.status === "FAILED"  ? "text-red-500"    :
                      "text-amber-500"
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {s.type === "REGISTRATION_FEE" ? "Account Activation" : `${PLAN_CONFIG[s.plan].label} Plan — Monthly`}
                    </p>
                    <p className="text-xs text-slate-400">{fmt(s.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    s.status === "PAID"    ? "bg-green-100 text-green-700" :
                    s.status === "FAILED"  ? "bg-red-100 text-red-600"    :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {s.status === "PAID" ? "Paid" : s.status === "FAILED" ? "Failed" : "Pending"}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{fmtAmt(s.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancellation success */}
      {cancelDone && (
        <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Cancellation Confirmed</p>
            <p className="text-sm text-slate-500 mt-0.5">{cancelDone}</p>
          </div>
        </div>
      )}

      {/* Cancel Subscription — only shown for active paid plans */}
      {info.plan !== "STARTER" && !cancelDone && (
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Cancel Subscription</h2>
              <p className="text-sm text-slate-500 mt-1">
                {info.planExpiresAt
                  ? `Your ${PLAN_CONFIG[info.plan].label} plan is active until ${fmt(info.planExpiresAt)}. You can cancel now or let it expire naturally — no auto-renewal charges.`
                  : `You can cancel your ${PLAN_CONFIG[info.plan].label} plan at any time.`}
              </p>
            </div>
            <button
              onClick={() => setCancelModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-xl transition-colors shrink-0"
            >
              <XCircle className="w-4 h-4" />
              Cancel Plan
            </button>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Cancel {PLAN_CONFIG[info.plan].label} Plan</h2>
                <p className="text-sm text-slate-500 mt-0.5">Choose how you want to cancel</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 mb-6">
              {/* Option A — let it expire */}
              {info.planExpiresAt && (
                <button
                  onClick={() => handleCancel(false)}
                  disabled={cancelling}
                  className="text-left border-2 border-slate-200 hover:border-blue-400 rounded-xl p-4 transition-all disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Cancel at end of billing period</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Stay on {PLAN_CONFIG[info.plan].label} until <strong>{fmt(info.planExpiresAt)}</strong>, then automatically move to Starter. No further charges.
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* Option B — cancel immediately */}
              <button
                onClick={() => handleCancel(true)}
                disabled={cancelling}
                className="text-left border-2 border-slate-200 hover:border-red-400 rounded-xl p-4 transition-all disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Cancel immediately</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Move to Starter right now. You will lose {PLAN_CONFIG[info.plan].label} features immediately. No refund is issued for the remaining period.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {cancelling && (
              <div className="flex items-center justify-center gap-2 py-2 text-slate-500 text-sm mb-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Processing…
              </div>
            )}

            <div className="flex flex-col gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl p-3 mb-5">
              <p>• After cancelling, your plan limits will apply (max 1 facility, 2 courts, 1 worker)</p>
              <p>• You can re-subscribe at any time from this page</p>
              <p>• No refunds are issued for unused days</p>
            </div>

            <button
              onClick={() => setCancelModal(false)}
              disabled={cancelling}
              className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Keep My Plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
