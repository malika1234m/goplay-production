"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { XCircle, MapPin, RefreshCw } from "lucide-react";

interface BookingDetail {
  id: string;
  facility: { id: string; name: string; city: string };
}

function CancelledContent() {
  const params    = useSearchParams();
  const bookingId = params.get("bookingId");

  const [booking, setBooking] = useState<BookingDetail | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    fetch(`/api/user/bookings/${bookingId}`)
      .then((r) => r.json())
      .then((d) => { if (d.booking) setBooking(d.booking); });
  }, [bookingId]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-10 max-w-md w-full text-center">

        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-9 h-9 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Cancelled</h1>
        <p className="text-slate-500 text-sm mb-2">
          Your payment was not completed. The slot has been released and is available again.
        </p>
        <p className="text-slate-400 text-xs mb-6">
          No charge was made to your account. You can try booking again right now.
        </p>

        {booking && (
          <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3 mb-6 flex items-center gap-3 text-left">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{booking.facility.name}</p>
              <p className="text-xs text-slate-400">{booking.facility.city}</p>
            </div>
          </div>
        )}

        {booking && (
          <Link
            href={`/grounds/${booking.facility.id}`}
            className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm mb-3"
          >
            <RefreshCw className="w-4 h-4" />
            Try Booking Again
          </Link>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          {!booking && (
            <Link
              href="/grounds"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              Browse Grounds
            </Link>
          )}
          {booking && (
            <Link
              href="/grounds"
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              Browse Other Grounds
            </Link>
          )}
          <Link
            href="/my-bookings"
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            My Bookings
          </Link>
        </div>

        {booking && (
          <div className="mt-5 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
            <strong>Payment issues?</strong> If your card was charged but booking shows cancelled, contact us — we'll sort it out immediately.
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookingCancelledPage() {
  return (
    <Suspense fallback={null}>
      <CancelledContent />
    </Suspense>
  );
}
