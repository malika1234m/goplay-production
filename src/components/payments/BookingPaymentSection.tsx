"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import PlayerPaymentPanel from "./PlayerPaymentPanel";
import type { Complaint, PaymentDetails, PaymentStatus } from "./types";

interface BookingPayment {
  id:                   string;
  totalAmount:          number;
  paymentStatus:        PaymentStatus;
  receiptUrl:           string | null;
  receiptRejectReason:  string | null;
  latestComplaint:      Complaint | null;
  paymentDetails:       PaymentDetails | null;
  receiptWindowMinutes: number;
}

/** Loads a "Pay online" booking's payment info and renders the transfer + receipt flow. */
export default function BookingPaymentSection({ bookingId, onChanged }: { bookingId: string; onChanged: () => void }) {
  const [data,  setData]  = useState<BookingPayment | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/user/bookings/${bookingId}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Could not load payment details."); return; }
      setError("");
      setData(json.booking);
    } catch {
      setError("Network error. Please try again.");
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!data) return <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Loading payment details…</p>;

  return (
    <PlayerPaymentPanel
      paymentStatus={data.paymentStatus}
      amount={data.totalAmount}
      reference={data.id.slice(0, 8).toUpperCase()}
      paymentDetails={data.paymentDetails}
      receiptUrl={data.receiptUrl}
      rejectReason={data.receiptRejectReason}
      latestComplaint={data.latestComplaint}
      receiptWindowMinutes={data.receiptWindowMinutes}
      uploadEndpoint={`/api/bookings/${data.id}/receipt`}
      bookingId={data.id}
      onChanged={() => { load(); onChanged(); }}
    />
  );
}
