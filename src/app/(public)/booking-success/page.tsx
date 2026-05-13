"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Calendar, Clock, MapPin, CreditCard, CalendarPlus, Loader2 } from "lucide-react";

interface BookingDetail {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  totalAmount: number;
  court: { name: string } | null;
  facility: { id: string; name: string; address: string; city: string };
}

function toGCalDate(bookingDate: string, time: string) {
  const d = new Date(bookingDate);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const [h, min] = time.split(":");
  return `${y}${m}${day}T${h.padStart(2, "0")}${min.padStart(2, "0")}00`;
}

function buildCalendarLink(b: BookingDetail) {
  const start = toGCalDate(b.bookingDate, b.startTime);
  const end   = toGCalDate(b.bookingDate, b.endTime);
  const title = encodeURIComponent(`GoPlay — ${b.facility.name}`);
  const loc   = encodeURIComponent(`${b.facility.address}, ${b.facility.city}`);
  const details = encodeURIComponent(`Booking ID: ${b.id}\nAmount: Rs. ${b.totalAmount.toLocaleString()}${b.court ? `\nCourt: ${b.court.name}` : ""}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${loc}`;
}

function SuccessContent() {
  const params    = useSearchParams();
  const bookingId = params.get("bookingId");

  const [booking,  setBooking]  = useState<BookingDetail | null>(null);
  const [loading,  setLoading]  = useState(!!bookingId);

  useEffect(() => {
    if (!bookingId) return;
    fetch(`/api/user/bookings/${bookingId}`)
      .then((r) => r.json())
      .then((d) => { if (d.booking) setBooking(d.booking); })
      .finally(() => setLoading(false));
  }, [bookingId]);

  const dateStr = booking
    ? new Date(booking.bookingDate).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-10 max-w-md w-full text-center">

        {/* Icon */}
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-9 h-9 text-green-600" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">Booking Confirmed!</h1>
        <p className="text-slate-500 text-sm mb-6">
          Your booking is confirmed and payment received. See you at the ground!
        </p>

        {/* Booking details */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading booking details…</span>
          </div>
        ) : booking ? (
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 text-left space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{booking.facility.name}</p>
                <p className="text-xs text-slate-400">{booking.facility.address}, {booking.facility.city}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-sm text-slate-700">{dateStr}</p>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-sm text-slate-700">
                {booking.startTime} – {booking.endTime}
                <span className="text-slate-400 ml-1.5">({booking.totalHours} {booking.totalHours === 1 ? "hr" : "hrs"})</span>
              </p>
            </div>
            {booking.court && (
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 shrink-0 flex items-center justify-center text-slate-400 font-bold text-xs">C</span>
                <p className="text-sm text-slate-700">{booking.court.name}</p>
              </div>
            )}
            <div className="flex items-center gap-3 border-t border-slate-200 pt-3">
              <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-sm font-bold text-slate-900">Rs. {booking.totalAmount.toLocaleString()}</p>
            </div>
            <p className="text-[10px] text-slate-300 pt-1">Booking ID: {booking.id}</p>
          </div>
        ) : bookingId ? (
          <p className="text-xs text-slate-400 mb-6">Booking ID: {bookingId}</p>
        ) : null}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {booking && (
            <a
              href={buildCalendarLink(booking)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              <CalendarPlus className="w-4 h-4" />
              Add to Google Calendar
            </a>
          )}
          <Link
            href="/my-bookings"
            className="inline-flex items-center justify-center w-full bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
          >
            View My Bookings
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessContent />
    </Suspense>
  );
}
