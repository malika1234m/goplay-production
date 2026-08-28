import Link from "next/link";
import { RefreshCcw, Lock, FileText, ChevronRight } from "lucide-react";
import AdSlot from "@/components/ads/AdSlot";

export const metadata = { title: "Policies — GoPlay" };

const policies = [
  {
    href:    "/refund-policy",
    icon:    RefreshCcw,
    color:   "bg-green-50 text-green-600 border-green-100",
    title:   "Refund & Return Policy",
    desc:    "How cancellations and refunds work for ground bookings and GoPlay Connect open match spots.",
  },
  {
    href:    "/privacy",
    icon:    Lock,
    color:   "bg-blue-50 text-blue-600 border-blue-100",
    title:   "Privacy Policy",
    desc:    "What personal data we collect, how we use it, and your rights under Sri Lankan data protection law.",
  },
  {
    href:    "/terms",
    icon:    FileText,
    color:   "bg-slate-50 text-slate-600 border-slate-200",
    title:   "Terms of Service",
    desc:    "The rules and conditions that govern your use of the GoPlay platform.",
  },
];

export default function PoliciesPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-center">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Policies</h1>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Everything you need to know about how GoPlay handles bookings, refunds, your data, and your rights.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-4">
        {policies.map(({ href, icon: Icon, color, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-5 bg-white rounded-2xl border border-slate-100 px-6 py-5 hover:shadow-md hover:-translate-y-0.5 transition-all group"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm sm:text-base">{title}</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
          </Link>
        ))}
      </div>

      <AdSlot name="info_page" format="auto" className="mt-10" />
    </div>
  );
}
