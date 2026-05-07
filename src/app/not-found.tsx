"use client";

import Link from "next/link";
import { HardHat, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-green-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="w-24 h-24 bg-yellow-400/10 border-2 border-yellow-400/30 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <HardHat className="w-12 h-12 text-yellow-400" />
        </div>

        {/* Badge */}
        <span className="inline-block bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 text-xs font-semibold px-3 py-1 rounded-full mb-5 tracking-wide uppercase">
          Under Construction
        </span>

        {/* Heading */}
        <h1 className="text-4xl font-black text-white mb-3">
          Coming Soon
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          This page is still being built. We're working hard to get it ready —
          check back soon!
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-600 text-xs">GoPlay</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Homepage
          </Link>
          <button
            onClick={() => history.back()}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-6 py-3 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
