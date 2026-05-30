import Link from "next/link";
import {
  CheckCircle, XCircle, Building2, Users, CalendarOff,
  BarChart2, Download, Star, Shield, Zap, Crown,
  ArrowRight, HelpCircle, CreditCard, Clock,
} from "lucide-react";
import { PLAN_CONFIG } from "@/lib/plan-constants";

export const metadata = {
  title: "Pricing — GoPlay Ground Owner Plans",
  description: "Simple, transparent pricing for sports ground owners in Sri Lanka. Start free, upgrade when you need more.",
};

const FEATURES = [
  { label: "Facilities",            starter: "1",          growth: "3",           pro: "Unlimited" },
  { label: "Courts / fields",       starter: "2 per facility", growth: "5 per facility", pro: "Unlimited" },
  { label: "Workers",               starter: "1",          growth: "5",           pro: "Unlimited" },
  { label: "Blocked dates / month", starter: "5",          growth: "20",          pro: "Unlimited" },
  { label: "Platform commission",   starter: "8%",         growth: "5%",          pro: "3%" },
  { label: "Booking management",    starter: true,         growth: true,          pro: true },
  { label: "Availability scheduling", starter: true,       growth: true,          pro: true },
  { label: "Walk-in bookings",      starter: true,         growth: true,          pro: true },
  { label: "Earnings dashboard",    starter: "Basic",      growth: "Full",        pro: "Full" },
  { label: "Monthly analytics",     starter: false,        growth: true,          pro: true },
  { label: "CSV export",            starter: false,        growth: false,         pro: true },
  { label: "Featured listing",      starter: false,        growth: false,         pro: true },
  { label: "Priority support",      starter: false,        growth: false,         pro: true },
];

const FAQS = [
  {
    q: "Is there a fee to apply as a ground owner?",
    a: "Applying is free. Once your application is approved by our team, a one-time account activation fee of Rs. 2,500 is required to access your dashboard. This covers the cost of verifying and onboarding your facility.",
  },
  {
    q: "What happens after I pay the activation fee?",
    a: "Your account is activated immediately and you are placed on the free Starter plan. You can start managing bookings right away. Upgrade to Growth or Pro at any time from your Billing page.",
  },
  {
    q: "How is the platform commission charged?",
    a: "The commission is deducted from each completed booking's earnings record. You see your gross amount, the platform fee, and your net earnings clearly in your Earnings dashboard. You are never billed separately — it comes out of your booking revenue.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes, anytime. You can cancel at the end of your billing period (keeping features until expiry) or immediately. Plans are month-to-month with no lock-in period. No refunds are issued for remaining days.",
  },
  {
    q: "What happens when my paid plan expires?",
    a: "You automatically move to the free Starter plan. You keep all your existing data, grounds, and bookings. You just can't add more than Starter limits allow until you renew.",
  },
  {
    q: "How do I pay for a subscription?",
    a: "All payments go through PayHere — Sri Lanka's trusted payment gateway. You can pay by card or online banking. Payments are processed securely and your plan is activated instantly.",
  },
  {
    q: "Can I upgrade or downgrade mid-month?",
    a: "You can upgrade anytime and the new plan starts immediately. Downgrading happens at the end of your billing period so you keep your paid features until expiry.",
  },
  {
    q: "What does 'Featured listing' mean?",
    a: "Pro plan facilities appear with a prominent ⭐ Featured badge on the Browse Grounds page and on your individual facility page. This increases visibility significantly, especially in competitive cities.",
  },
];

function Cell({ value }: { value: string | boolean | undefined }) {
  if (value === true)  return <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />;
  if (value === false) return <XCircle className="w-4 h-4 text-slate-200 mx-auto" />;
  return <span className="text-sm text-slate-700 font-medium">{value}</span>;
}

export default function PricingPage() {
  const PLAN_ICONS = { STARTER: Shield, GROWTH: Zap, PRO: Crown } as const;
  const PLAN_COLORS = {
    STARTER: { card: "border-slate-200 bg-white",       badge: "bg-slate-100 text-slate-600",    btn: "bg-slate-800 hover:bg-slate-700 text-white",    icon: "bg-slate-100 text-slate-600" },
    GROWTH:  { card: "border-blue-300 bg-blue-50/30",   badge: "bg-blue-100 text-blue-700",      btn: "bg-blue-600 hover:bg-blue-700 text-white",      icon: "bg-blue-100 text-blue-600" },
    PRO:     { card: "border-purple-300 bg-purple-50/30 shadow-lg shadow-purple-100", badge: "bg-purple-100 text-purple-700", btn: "bg-purple-600 hover:bg-purple-700 text-white", icon: "bg-purple-100 text-purple-600" },
  } as const;

  return (
    <div className="bg-slate-50 min-h-screen">

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-green-950 text-white pt-20 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <CreditCard className="w-3.5 h-3.5" /> Ground Owner Plans
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-5 leading-tight">
            Simple, transparent pricing
          </h1>
          <p className="text-slate-300 text-lg max-w-xl mx-auto leading-relaxed">
            Start for free. Pay only when your business grows.
            All plans include full booking management and a dedicated ground owner dashboard.
          </p>
          <p className="mt-4 text-slate-400 text-sm">
            One-time activation fee of <span className="text-white font-semibold">Rs. 2,500</span> after admin approval.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 space-y-20">

        {/* ── Plan Cards ── */}
        <div className="grid md:grid-cols-3 gap-6 -mt-8 relative z-10">
          {(["STARTER", "GROWTH", "PRO"] as const).map((key) => {
            const cfg    = PLAN_CONFIG[key];
            const colors = PLAN_COLORS[key];
            const Icon   = PLAN_ICONS[key];
            const isPro  = key === "PRO";

            return (
              <div key={key} className={`relative rounded-2xl border-2 p-7 flex flex-col ${colors.card}`}>
                {isPro && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow">
                    ⭐ Best Value — Most Popular
                  </div>
                )}

                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${colors.icon}`}>
                  <Icon className="w-6 h-6" />
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-slate-900">{cfg.label}</h2>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                      {key === "STARTER" ? "Free forever" : "Monthly"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-3">
                    <span className="text-4xl font-extrabold text-slate-900">
                      {cfg.monthlyFee === 0 ? "Free" : `Rs. ${cfg.monthlyFee.toLocaleString()}`}
                    </span>
                    {cfg.monthlyFee > 0 && <span className="text-slate-400 text-sm">/month</span>}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{cfg.commissionPct}% platform commission per booking</p>
                </div>

                <ul className="flex flex-col gap-3 flex-1 mb-8">
                  {[
                    { icon: Building2,   text: `${cfg.maxFacilities ?? "Unlimited"} facilit${cfg.maxFacilities === 1 ? "y" : "ies"}` },
                    { icon: CreditCard,  text: `${cfg.maxCourtsPerFacility ?? "Unlimited"} courts per facility` },
                    { icon: Users,       text: `${cfg.maxWorkers ?? "Unlimited"} worker${cfg.maxWorkers === 1 ? "" : "s"}` },
                    { icon: CalendarOff, text: `${cfg.maxBlockedDatesPerMonth ?? "Unlimited"} blocked dates/mo` },
                    ...(cfg.analyticsMonthly ? [{ icon: BarChart2, text: "Monthly analytics" }] : []),
                    ...(cfg.csvExport       ? [{ icon: Download,  text: "CSV export" }]         : []),
                    ...(cfg.featured        ? [{ icon: Star,      text: "Featured listing ⭐" }] : []),
                  ].map(({ icon: LIcon, text }) => (
                    <li key={text} className="flex items-center gap-2.5 text-sm text-slate-700">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      <LIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/become-provider"
                  className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-colors ${colors.btn}`}
                >
                  {key === "STARTER" ? "Get Started Free" : `Upgrade to ${cfg.label}`}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>

        {/* ── Activation fee callout ── */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">One-time account activation fee — Rs. 2,500</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Paid once after your application is approved by our team. This is not a recurring charge.
              You start on the free Starter plan immediately after activation.
            </p>
          </div>
          <Link href="/become-provider" className="shrink-0 text-sm font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-4 py-2 rounded-xl transition-colors">
            Apply Now
          </Link>
        </div>

        {/* ── Full Feature Comparison ── */}
        <div>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900">Compare all features</h2>
            <p className="text-slate-500 text-sm mt-2">Everything included across all plans</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                {/* Header */}
                <div className="grid grid-cols-4 bg-slate-50 border-b border-slate-100">
                  <div className="px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Feature</div>
                  {(["STARTER", "GROWTH", "PRO"] as const).map((key) => {
                    const Icon = PLAN_ICONS[key];
                    const colors = PLAN_COLORS[key];
                    return (
                      <div key={key} className="px-3 py-4 text-center">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-1.5 ${colors.icon}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-bold text-slate-900">{PLAN_CONFIG[key].label}</p>
                        <p className="text-xs text-slate-400">
                          {PLAN_CONFIG[key].monthlyFee === 0 ? "Free" : `Rs. ${PLAN_CONFIG[key].monthlyFee.toLocaleString()}/mo`}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {/* Rows */}
                {FEATURES.map(({ label, starter, growth, pro }, i) => (
                  <div key={label} className={`grid grid-cols-4 border-b border-slate-50 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                    <div className="px-5 py-3.5 text-sm text-slate-700">{label}</div>
                    <div className="px-3 py-3.5 text-center"><Cell value={starter} /></div>
                    <div className="px-3 py-3.5 text-center"><Cell value={growth} /></div>
                    <div className="px-3 py-3.5 text-center"><Cell value={pro} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── How billing works ── */}
        <div>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900">How billing works</h2>
            <p className="text-slate-500 text-sm mt-2">No surprises, no hidden fees</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                icon: Building2,
                color: "bg-green-100 text-green-600",
                title: "Apply & get approved",
                desc: "Submit your facility details. Our team reviews and approves your application — usually within 1–2 business days.",
              },
              {
                step: "2",
                icon: CreditCard,
                color: "bg-blue-100 text-blue-600",
                title: "Pay the activation fee",
                desc: "A one-time Rs. 2,500 fee via PayHere activates your Ground Owner dashboard. This is not a subscription — you pay it once.",
              },
              {
                step: "3",
                icon: Clock,
                color: "bg-purple-100 text-purple-600",
                title: "Start free, upgrade anytime",
                desc: "You start on Starter (free). Upgrade to Growth or Pro whenever you need lower commissions or more features. Cancel anytime.",
              },
            ].map(({ step, icon: SIcon, color, title, desc }) => (
              <div key={step} className="bg-white rounded-2xl border border-slate-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                    <SIcon className="w-5 h-5" />
                  </div>
                  <span className="text-3xl font-black text-slate-100">{step}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <div>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900">Frequently asked questions</h2>
            <p className="text-slate-500 text-sm mt-2">Can't find your answer? <a href="mailto:official.goplay.support@gmail.com" className="text-green-600 underline underline-offset-2">Contact our team</a></p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="bg-white rounded-2xl border border-slate-100 p-6">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 mb-1.5">{q}</p>
                    <p className="text-sm text-slate-500 leading-relaxed">{a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl text-white text-center p-12">
          <h2 className="text-3xl font-extrabold mb-3">Ready to list your ground?</h2>
          <p className="text-green-100 text-base mb-8 max-w-md mx-auto">
            Join hundreds of facility owners across Sri Lanka already using GoPlay to manage bookings effortlessly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/become-provider"
              className="flex items-center gap-2 bg-white text-green-700 font-bold px-7 py-3.5 rounded-xl hover:bg-green-50 transition-colors text-sm shadow"
            >
              <Building2 className="w-4 h-4" /> Apply as a Ground Owner
            </Link>
            <Link
              href="/support#billing"
              className="flex items-center gap-2 bg-white/10 border border-white/30 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-white/20 transition-colors text-sm"
            >
              Learn more in Support Center
            </Link>
          </div>
          <p className="mt-5 text-xs text-green-200">
            Free to apply · One-time Rs. 2,500 activation · Cancel anytime
          </p>
        </div>

      </div>
    </div>
  );
}
