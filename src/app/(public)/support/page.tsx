import Link from "next/link";
import {
  LifeBuoy, UserPlus, Building2, Users, ChevronRight,
  Mail, Phone, CheckCircle, CreditCard, Shield, Zap,
  Crown, HelpCircle, XCircle, Clock, ArrowRight,
} from "lucide-react";
import { PLAN_CONFIG } from "@/lib/plan-constants";

export const metadata = { title: "Support Center — GoPlay" };

function Step({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-9 h-9 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center">
        {number}
      </div>
      <div className="pt-1">
        <p className="font-semibold text-slate-900 mb-1">{title}</p>
        <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="flex items-start gap-3 py-5 border-b border-slate-50 last:border-0">
      <HelpCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-slate-900 mb-1">{q}</p>
        <p className="text-sm text-slate-500 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

export default function SupportPage() {
  const PLAN_ICONS = { STARTER: Shield, GROWTH: Zap, PRO: Crown } as const;

  return (
    <div className="bg-slate-50 min-h-screen">

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <LifeBuoy className="w-7 h-7 text-green-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">Support Center</h1>
          <p className="text-slate-300 text-base max-w-xl mx-auto">
            Everything you need to know about using GoPlay — from booking your first ground to managing a full facility operation.
          </p>
        </div>
      </div>

      {/* Quick nav */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto py-3 text-sm font-medium">
          {[
            { href: "#become-owner", label: "Become a Facility Owner" },
            { href: "#billing",      label: "Billing & Subscriptions" },
            { href: "#add-workers",  label: "Add Workers" },
            { href: "#players",      label: "For Players" },
            { href: "#contact",      label: "Contact" },
          ].map(({ href, label }) => (
            <a key={href} href={href} className="shrink-0 px-4 py-1.5 rounded-full text-slate-500 hover:text-green-600 hover:bg-green-50 transition-colors whitespace-nowrap">
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-16">

        {/* ── Become a Facility Owner ── */}
        <section id="become-owner">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">How to Become a Facility Owner</h2>
              <p className="text-sm text-slate-500">Get your sports ground listed on GoPlay in 4 steps.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-7 space-y-7">
            <Step number={1} title="Create a GoPlay Account" desc="Go to goplay.lk/register and create a regular player account with your name, email, phone, and password." />
            <Step number={2} title="Apply as a Provider" desc={`Log in and go to your dashboard. Scroll to the bottom and click "Join as Provider". Fill in a 3-step application form with your personal details and facility information.`} />
            <Step number={3} title="Get Approved" desc="Once approved, your facility status changes from Pending to Active and it becomes publicly visible on the Browse Grounds page. You will receive an email notification when this happens." />
            <Step number={4} title="Activate Your Account" desc="After approval, pay the one-time Rs. 2,500 activation fee via PayHere. Your dashboard unlocks instantly and you start on the free Starter plan." />
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl px-5 py-4 text-sm text-amber-800">
            <strong>Tip:</strong> Adding high-quality photos and filling in all amenities significantly increases your booking rate. Facilities with 3+ photos get 2× more views.
          </div>
        </section>

        {/* ── Billing & Subscriptions ── */}
        <section id="billing">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Billing & Subscriptions</h2>
              <p className="text-sm text-slate-500">Everything about costs, plans, and payments for Ground Owners.</p>
            </div>
          </div>

          {/* Activation fee */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-5">
            <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-500" />
              One-Time Activation Fee — Rs. 2,500
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-3">
              After your application is approved, you pay a <strong>single, non-recurring</strong> activation fee of <strong>Rs. 2,500</strong> via PayHere.
              This unlocks your Ground Owner dashboard. You are never charged this amount again.
            </p>
            <div className="flex flex-wrap gap-3">
              {["Secure payment via PayHere", "Dashboard unlocks instantly", "Not a recurring subscription", "Covers your account setup & verification"].map((pt) => (
                <span key={pt} className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-1.5 rounded-full font-medium">
                  <CheckCircle className="w-3 h-3" /> {pt}
                </span>
              ))}
            </div>
          </div>

          {/* Plan comparison */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-5">
            <h3 className="text-base font-bold text-slate-900 mb-5">Subscription Plans</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {(["STARTER", "GROWTH", "PRO"] as const).map((key) => {
                const cfg  = PLAN_CONFIG[key];
                const Icon = PLAN_ICONS[key];
                const styles = {
                  STARTER: { bg: "bg-slate-50 border-slate-200",   icon: "bg-slate-100 text-slate-600",   badge: "bg-slate-100 text-slate-600" },
                  GROWTH:  { bg: "bg-blue-50 border-blue-200",     icon: "bg-blue-100 text-blue-600",     badge: "bg-blue-100 text-blue-700" },
                  PRO:     { bg: "bg-purple-50 border-purple-200", icon: "bg-purple-100 text-purple-600", badge: "bg-purple-100 text-purple-700" },
                }[key];

                return (
                  <div key={key} className={`rounded-xl border p-4 ${styles.bg}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${styles.icon}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-slate-900">{cfg.label}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${styles.badge}`}>
                        {cfg.monthlyFee === 0 ? "FREE" : `Rs. ${cfg.monthlyFee.toLocaleString()}/mo`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{cfg.commissionPct}% commission per booking</p>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" /> {cfg.maxFacilities ?? "Unlimited"} facilit{cfg.maxFacilities === 1 ? "y" : "ies"}</li>
                      <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" /> {cfg.maxCourtsPerFacility ?? "Unlimited"} courts/facility</li>
                      <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" /> {cfg.maxWorkers ?? "Unlimited"} worker{cfg.maxWorkers === 1 ? "" : "s"}</li>
                      <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" /> {cfg.maxBlockedDatesPerMonth ?? "Unlimited"} blocked dates/mo</li>
                      {cfg.featured && <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" /> Featured listing ⭐</li>}
                      {cfg.csvExport && <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-500" /> CSV export</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-center">
              <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-green-600 font-semibold hover:underline">
                See full plan comparison <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Commission explained */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 mb-5">
            <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-slate-400" /> How Commission Works
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              When a booking is completed, GoPlay deducts a small percentage from the booking revenue as a platform fee. This is based on your active plan.
              You always see a clear breakdown: <strong>Gross → Fee → Your Net</strong> in your Earnings dashboard.
            </p>
            <div className="bg-slate-50 rounded-xl p-4 text-sm">
              <p className="text-slate-600 font-medium mb-2">Example: Rs. 3,000 booking</p>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Starter (8%)</span><span className="text-slate-700">Rs. 3,000 − Rs. 240 = <strong>Rs. 2,760 net</strong></span></div>
                <div className="flex justify-between"><span className="text-slate-500">Growth (5%)</span><span className="text-slate-700">Rs. 3,000 − Rs. 150 = <strong>Rs. 2,850 net</strong></span></div>
                <div className="flex justify-between"><span className="text-slate-500">Pro (3%)</span><span className="text-slate-700">Rs. 3,000 − Rs. 90 = <strong>Rs. 2,910 net</strong></span></div>
              </div>
            </div>
          </div>

          {/* Billing FAQ */}
          <div className="bg-white rounded-2xl border border-slate-100 px-6 py-2">
            <h3 className="text-base font-bold text-slate-900 py-4 border-b border-slate-50">Billing FAQs</h3>
            <FaqItem q="How do I upgrade my plan?" a="Go to Ground Owner Dashboard → Billing & Plan. Click 'Upgrade to Growth' or 'Upgrade to Pro', complete payment via PayHere, and your plan activates immediately." />
            <FaqItem q="Can I cancel my subscription?" a="Yes. In your Billing page, click 'Cancel Plan'. You can choose to cancel at the end of the billing period (keeping features until expiry) or cancel immediately. No refunds for unused days." />
            <FaqItem q="What happens when my paid plan expires?" a="You automatically move back to the free Starter plan. All your data, grounds, and booking history are preserved — you just can't exceed Starter limits until you renew." />
            <FaqItem q="Can I get a refund for the activation fee?" a="The Rs. 2,500 activation fee is non-refundable as it covers the cost of reviewing and setting up your account. Monthly subscription fees are also non-refundable for past periods." />
            <FaqItem q="Is my payment information stored?" a="No. GoPlay does not store card details. All payments are processed securely through PayHere, Sri Lanka's trusted payment gateway." />
            <FaqItem q="Do plans auto-renew?" a="No — plans do not auto-renew. You pay manually each month when you want to continue. If you don't renew, your plan expires and you move to Starter. No surprise charges." />
          </div>
        </section>

        {/* ── Add Workers ── */}
        <section id="add-workers">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Adding Workers to Your Facility</h2>
              <p className="text-sm text-slate-500">Assign ground-level staff who can manage bookings on-site.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-7 space-y-7">
            <Step number={1} title="The Worker Creates Their Account" desc="Your staff member registers a regular player account at goplay.lk/register. Once their account exists, you can link them to your facility from your dashboard." />
            <Step number={2} title="You Assign Them to Your Facility" desc={`In your Ground Owner Dashboard, go to Settings → Workers. Enter the worker's registered email address and click "Add Worker". The worker is immediately linked to your facility.`} />
            <Step number={3} title="Worker Logs In and Starts Working" desc="The worker logs in and sees the facility data on their Worker Dashboard. They can view the daily schedule, add walk-in bookings, and see upcoming sessions — but cannot modify facility settings." />
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-800">
            <strong>Plan note:</strong> Starter plan allows 1 worker. Growth allows 5. Pro allows unlimited workers across all your facilities.
          </div>
        </section>

        {/* ── For Players ── */}
        <section id="players">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">For Players — How to Book</h2>
              <p className="text-sm text-slate-500">From browsing to playing in 4 easy steps.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-7 space-y-7">
            <Step number={1} title="Find a Ground" desc={`Go to Browse Grounds, filter by sport, city, or use "Near Me" to find facilities close to your location. Click on any ground to see photos, pricing, reviews, and opening hours.`} />
            <Step number={2} title="Choose a Time Slot" desc="On the facility page, select the date you want. Available hourly slots are shown in green — blocked or booked slots are greyed out. Click a slot to select it." />
            <Step number={3} title="Pay & Confirm" desc="Enter your contact number and any special requests. Proceed to payment via PayHere (card or online banking). Your booking is confirmed instantly." />
            <Step number={4} title="Show Up & Play" desc="Your confirmed booking appears under My Bookings in your dashboard. Show up at the facility at your booked time. Staff can verify your booking by name or booking reference." />
          </div>
        </section>

        {/* ── Contact ── */}
        <section id="contact" className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl text-white p-10 text-center">
          <h2 className="text-2xl font-bold mb-2">Still Need Help?</h2>
          <p className="text-green-100 text-sm mb-8 max-w-md mx-auto">
            Can't find what you're looking for? Our support team is here to help you.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="mailto:official.goplay.support@gmail.com" className="flex items-center gap-2 bg-white text-green-700 font-semibold px-5 py-3 rounded-xl hover:bg-green-50 transition-colors text-sm">
              <Mail className="w-4 h-4" /> official.goplay.support@gmail.com
            </a>
            <a href="tel:+94740984416" className="flex items-center gap-2 bg-white/10 border border-white/30 text-white font-semibold px-5 py-3 rounded-xl hover:bg-white/20 transition-colors text-sm">
              <Phone className="w-4 h-4" /> +94 74 098 4416
            </a>
          </div>
          <p className="mt-6 text-xs text-green-200">Monday – Friday · 9 AM – 6 PM Sri Lanka Time</p>
        </section>

      </div>
    </div>
  );
}
