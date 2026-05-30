"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck, Loader2, CheckCircle, Building2, Users,
  CalendarOff, TrendingUp, Lock, ArrowRight, RefreshCw,
} from "lucide-react";
import { REGISTRATION_FEE, PLAN_CONFIG } from "@/lib/plan-constants";

const FEATURES = [
  { icon: Building2,    text: "Manage your sports facility" },
  { icon: Users,        text: "Add workers & manage teams" },
  { icon: CalendarOff,  text: "Block maintenance dates" },
  { icon: TrendingUp,   text: "Track earnings & payouts" },
  { icon: ShieldCheck,  text: "Accept & confirm bookings" },
];

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

export default function ActivatePage() {
  const searchParams = useSearchParams();
  const status       = searchParams.get("status");

  const [loading,   setLoading]   = useState(false);
  const [polling,   setPolling]   = useState(status === "success");
  const [error,     setError]     = useState("");

  // Auto-refresh after redirect back from PayHere (webhook may be slightly delayed)
  useEffect(() => {
    if (!polling) return;
    const timer = setTimeout(() => window.location.reload(), 4000);
    return () => clearTimeout(timer);
  }, [polling]);

  async function handlePay() {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/ground-owner/register-payment", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to initiate payment."); return; }
      submitToPayHere(data.payHereParams);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (polling) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-green-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <RefreshCw className="w-9 h-9 text-green-600 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Confirming Your Payment</h2>
          <p className="text-slate-500 text-sm mb-6">
            Payment received. We&apos;re activating your account — this takes a moment.
            This page will refresh automatically.
          </p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-1.5 bg-green-500 rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-green-900 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-4xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/logo.jpeg" alt="GoPlay" width={48} height={48} className="rounded-xl bg-white p-1 object-contain" />
            <span className="text-3xl font-extrabold text-white">Go<span className="text-green-400">Play</span></span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">One Last Step</h1>
          <p className="text-slate-400 text-base max-w-md mx-auto">
            Your application has been approved. Complete your account activation to start managing your facility.
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-0 mb-10">
          {["Application Approved", "Activate Account", "Start Managing"].map((step, i) => (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                  i === 0 ? "bg-green-500 text-white" :
                  i === 1 ? "bg-white text-slate-900 ring-4 ring-white/30" :
                  "bg-slate-700 text-slate-400"
                }`}>
                  {i === 0 ? <CheckCircle className="w-5 h-5" /> : i + 1}
                </div>
                <span className={`text-xs mt-1.5 font-medium whitespace-nowrap ${
                  i === 0 ? "text-green-400" : i === 1 ? "text-white" : "text-slate-500"
                }`}>{step}</span>
              </div>
              {i < 2 && <div className={`w-16 sm:w-24 h-0.5 mx-1 mb-4 ${i === 0 ? "bg-green-500" : "bg-slate-700"}`} />}
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">

          {/* Features list */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-7 border border-white/10">
            <h2 className="text-white font-bold text-lg mb-5">What you get access to</h2>
            <div className="flex flex-col gap-4">
              {FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-slate-300 text-sm">{text}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-5 border-t border-white/10">
              <p className="text-xs text-slate-400">
                You start on the <span className="text-white font-semibold">Starter plan</span> (free) after activation.
                Upgrade anytime for lower commission rates and more features.
              </p>
            </div>
          </div>

          {/* Payment card */}
          <div className="bg-white rounded-2xl shadow-2xl p-7 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-slate-900 font-bold text-base">Account Activation</h2>
                <p className="text-slate-500 text-xs">One-time registration fee</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-5 mb-6 border border-slate-100">
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-extrabold text-slate-900">
                  Rs. {REGISTRATION_FEE.toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-slate-500">Paid once. No recurring charges on this fee.</p>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              {[
                "Secure payment via PayHere",
                "Instant account activation on payment",
                "Access to ground owner dashboard",
              ].map((pt) => (
                <div key={pt} className="flex items-center gap-2.5 text-sm text-slate-600">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  {pt}
                </div>
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
                {error}
              </p>
            )}

            <button
              onClick={handlePay}
              disabled={loading}
              className="flex items-center justify-center gap-2.5 w-full py-3.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl transition-colors text-sm mt-auto"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Preparing checkout…</>
              ) : (
                <>Pay Rs. {REGISTRATION_FEE.toLocaleString()} &amp; Activate <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 mt-3">
              <Lock className="w-3 h-3 text-slate-400" />
              <p className="text-xs text-slate-400 text-center">Secured by PayHere — Sri Lanka&apos;s trusted payment gateway</p>
            </div>
          </div>
        </div>

        {/* Plan tiers preview */}
        <div className="mt-8">
          <p className="text-center text-slate-400 text-sm mb-4">After activation, choose the plan that fits your business</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["STARTER", "GROWTH", "PRO"] as const).map((key) => {
              const cfg = PLAN_CONFIG[key];
              return (
                <div key={key} className="bg-white/8 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
                  <p className="text-white font-bold text-sm mb-1">{cfg.label}</p>
                  <p className="text-green-400 font-extrabold text-lg">
                    {cfg.monthlyFee === 0 ? "Free" : `Rs. ${cfg.monthlyFee.toLocaleString()}`}
                  </p>
                  {cfg.monthlyFee > 0 && <p className="text-slate-500 text-xs">/month</p>}
                  <p className="text-slate-400 text-xs mt-2">{cfg.commissionPct}% commission</p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
