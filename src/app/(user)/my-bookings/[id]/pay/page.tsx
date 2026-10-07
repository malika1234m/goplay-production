"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import PaymentCheckout from "@/components/payments/PaymentCheckout";
import type { Complaint, PaymentDetails, PaymentStatus } from "@/components/payments/types";

interface BookingPay {
  id:                   string;
  bookingDate:          string;
  startTime:            string;
  endTime:              string;
  totalAmount:          number;
  status:               string;
  paymentMethod:        string;
  paymentStatus:        PaymentStatus;
  createdAt:            string;
  receiptUrl:           string | null;
  receiptReviewedAt:    string | null;
  receiptRejectReason:  string | null;
  latestComplaint:      Complaint | null;
  paymentDetails:       PaymentDetails | null;
  receiptWindowMinutes: number;
  court:                { name: string } | null;
  facility:             { name: string; address: string; city: string; image: string | null };
}

export default function BookingPayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [booking, setBooking] = useState<BookingPay | null>(null);
  const [error,   setError]   = useState("");

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/user/bookings/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "We couldn't find this booking."); return; }
      setError("");
      setBooking(data.booking);
    } catch {
      setError("You're offline. Reconnect and refresh the page.");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <p className="max-w-5xl mx-auto text-red-700">{error}</p>;
  if (!booking) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  if (booking.paymentMethod !== "ONLINE" || booking.status === "CANCELLED") {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <p className="text-lg font-semibold text-slate-900">{booking.status === "CANCELLED" ? "This booking was cancelled." : "This booking is paid at the ground."}</p>
        <a href="/my-bookings" className="mt-4 inline-block text-pitch font-medium hover:underline">Back to my bookings</a>
      </div>
    );
  }

  const windowMs = booking.receiptWindowMinutes * 60_000;
  const deadline =
    booking.paymentStatus === "PENDING"  ? new Date(new Date(booking.createdAt).getTime() + windowMs) :
    booking.paymentStatus === "REJECTED" && booking.receiptReviewedAt ? new Date(new Date(booking.receiptReviewedAt).getTime() + windowMs) :
    null;

  return (
    <PaymentCheckout
      backHref="/my-bookings"
      backLabel="Back to my bookings"
      groundName={booking.facility.name}
      groundAddress={`${booking.facility.address}, ${booking.facility.city}`}
      image={booking.facility.image}
      date={booking.bookingDate}
      startTime={booking.startTime}
      endTime={booking.endTime}
      detail={booking.court?.name ?? "Whole ground"}
      amount={booking.totalAmount}
      reference={booking.id.slice(0, 8).toUpperCase()}
      paymentStatus={booking.paymentStatus}
      deadline={deadline}
      details={booking.paymentDetails}
      receiptUrl={booking.receiptUrl}
      rejectReason={booking.receiptRejectReason}
      latestComplaint={booking.latestComplaint}
      uploadEndpoint={`/api/bookings/${booking.id}/receipt`}
      bookingId={booking.id}
      onChanged={load}
    />
  );
}
