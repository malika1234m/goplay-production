"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import PaymentCheckout from "@/components/payments/PaymentCheckout";
import type { Complaint, PaymentDetails, PaymentStatus } from "@/components/payments/types";
import { useT } from "@/i18n/I18nProvider";

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
  refundStatus:         "NONE" | "NEEDED" | "PROCESSED";
  refundAmount:         number | null;
  facility:             { name: string; address: string; city: string; image: string | null };
}

export default function BookingPayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [booking, setBooking] = useState<BookingPay | null>(null);
  const [error,   setError]   = useState("");
  const { t } = useT();

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/user/bookings/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t("We couldn't find this booking.")); return; }
      setError("");
      setBooking(data.booking);
    } catch {
      setError(t("You're offline. Reconnect and refresh the page."));
    }
  }, [id, t]);

  useEffect(() => { load(); }, [load]);

  if (error) return <p className="max-w-5xl mx-auto text-red-700">{t(error)}</p>;
  if (!booking) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  if (booking.paymentMethod !== "ONLINE" || booking.status === "CANCELLED") {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <p className="text-lg font-semibold text-slate-900">{booking.status === "CANCELLED" ? t("This booking was cancelled.") : t("This booking is paid at the ground.")}</p>
        {booking.status === "CANCELLED" && booking.refundStatus === "NEEDED" && (
          <p className="mt-2 text-sm text-slate-600">{t("The ground owes you a refund of Rs. {amount}.", { amount: (booking.refundAmount ?? booking.totalAmount).toLocaleString() })}</p>
        )}
        {booking.status === "CANCELLED" && booking.refundStatus === "PROCESSED" && <RefundDispute bookingId={booking.id} />}
        <a href="/my-bookings" className="mt-4 inline-block text-pitch font-medium hover:underline">{t("Back to my bookings")}</a>
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
      backLabel={t("Back to my bookings")}
      doneLabel={t("Go to my bookings")}
      groundName={booking.facility.name}
      groundAddress={`${booking.facility.address}, ${booking.facility.city}`}
      image={booking.facility.image}
      date={booking.bookingDate}
      startTime={booking.startTime}
      endTime={booking.endTime}
      detail={booking.court?.name ?? t("Whole ground")}
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

/** The ground marked the refund sent; if the money never came, the player tells GoPlay here. */
function RefundDispute({ bookingId }: { bookingId: string }) {
  const { t } = useT();
  const [open,    setOpen]    = useState(false);
  const [message, setMessage] = useState("");
  const [state,   setState]   = useState<"idle" | "sending" | "sent">("idle");
  const [error,   setError]   = useState("");

  const send = async () => {
    setState("sending"); setError("");
    try {
      const res  = await fetch(`/api/user/bookings/${bookingId}/refund-dispute`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? t("Something went wrong. Please try again.")); setState("idle"); return; }
      setState("sent");
    } catch {
      setError(t("Network error. Check your connection and try again.")); setState("idle");
    }
  };

  if (state === "sent") return <p role="status" className="mt-4 text-sm text-green-700">{t("Thanks — GoPlay will check with the ground and get back to you.")}</p>;
  return (
    <div className="mt-4 text-left space-y-3">
      <p className="text-sm text-slate-600 text-center">{t("The ground marked your refund as sent.")}</p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="block mx-auto text-sm font-medium text-red-600 hover:underline">
          {t("Refund didn't arrive?")}
        </button>
      ) : (
        <>
          <label htmlFor="refund-dispute" className="block text-sm font-medium text-slate-700">{t("What happened?")}</label>
          <textarea id="refund-dispute" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000}
            placeholder={t("For example: it's been a week and nothing has reached my account.")}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch" />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="button" onClick={send} disabled={state === "sending" || message.trim().length < 10}
            className="w-full rounded-xl bg-pitch-deep px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {state === "sending" ? t("Sending…") : t("Tell GoPlay")}
          </button>
        </>
      )}
    </div>
  );
}
