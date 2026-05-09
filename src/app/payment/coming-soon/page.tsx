import Link from "next/link";
import Image from "next/image";
import { Construction, CreditCard, ShieldCheck, Clock, ArrowLeft, Banknote } from "lucide-react";

export default function PaymentComingSoonPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">

          {/* Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur ring-1 ring-white/30">
                <Construction className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Online Payments</h1>
            <p className="text-blue-100 text-sm">Coming Soon</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            {/* Logo + brand */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <Image
                src="/logo.jpeg"
                alt="GoPlay"
                width={32}
                height={32}
                className="rounded-lg object-contain"
              />
              <span className="font-bold text-slate-800">GoPlay</span>
              <span className="text-slate-300">×</span>
              <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">PayHere</span>
            </div>

            <p className="text-slate-600 text-sm text-center leading-relaxed mb-6">
              We&apos;re in the process of registering with <strong>PayHere</strong> to bring you
              secure online card payments. This feature will be available very soon.
            </p>

            {/* What's coming */}
            <div className="bg-slate-50 rounded-2xl p-5 mb-6 space-y-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">What to expect</p>
              {[
                { icon: CreditCard,   text: "Pay securely with Visa, Mastercard & more" },
                { icon: ShieldCheck,  text: "Bank-level encryption via PayHere gateway"  },
                { icon: Clock,        text: "Instant booking confirmation on payment"     },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-sm text-slate-600">{text}</p>
                </div>
              ))}
            </div>

            {/* CTA — go back and use cash */}
            <div className="bg-green-50 border border-green-100 rounded-2xl p-5 mb-6 text-center">
              <Banknote className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-green-800 mb-1">Pay on Arrival is available now</p>
              <p className="text-xs text-green-600">
                Go back and select <strong>Pay on Arrival</strong> to book your session today and pay in cash at the ground.
              </p>
            </div>

            <Link
              href="javascript:history.back()"
              className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back & Book with Cash
            </Link>

            <p className="text-center text-xs text-slate-400 mt-4">
              Online payments will be enabled once PayHere registration is complete.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
