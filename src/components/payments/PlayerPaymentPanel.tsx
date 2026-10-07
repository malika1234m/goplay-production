"use client";

import { CheckCircle2, Clock, ExternalLink, XCircle } from "lucide-react";
import BankDetailsCard from "./BankDetailsCard";
import ReceiptUploader from "./ReceiptUploader";
import ComplaintForm from "./ComplaintForm";
import type { Complaint, PaymentDetails, PaymentStatus } from "./types";

/**
 * Everything a player needs for a "Pay online" booking or lobby spot: where to transfer,
 * the receipt upload, review status, and a complaint route if the ground rejects it.
 */
export default function PlayerPaymentPanel({
  paymentStatus,
  amount,
  reference,
  paymentDetails,
  receiptUrl,
  rejectReason,
  latestComplaint,
  receiptWindowMinutes,
  uploadEndpoint,
  bookingId,
  spotId,
  onChanged,
}: {
  paymentStatus:         PaymentStatus;
  amount:                number;
  reference:             string;
  paymentDetails:        PaymentDetails | null;
  receiptUrl:            string | null;
  rejectReason:          string | null;
  latestComplaint:       Complaint | null;
  receiptWindowMinutes?: number | null;
  uploadEndpoint:        string;
  bookingId?:            string;
  spotId?:               string;
  onChanged:             () => void;
}) {
  const windowLabel = receiptWindowMinutes
    ? receiptWindowMinutes >= 60
      ? `${Math.round(receiptWindowMinutes / 60 * 10) / 10} hour${receiptWindowMinutes === 60 ? "" : "s"}`
      : `${receiptWindowMinutes} minutes`
    : null;

  if (paymentStatus === "PAID") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <CheckCircle2 className="w-4 h-4 shrink-0" /> Payment confirmed by the ground.
      </div>
    );
  }

  if (paymentStatus === "RECEIPT_SUBMITTED") {
    return (
      <div className="flex flex-col gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <span className="flex items-center gap-2 font-medium"><Clock className="w-4 h-4 shrink-0" /> Receipt sent — waiting for the ground to confirm.</span>
        {receiptUrl && (
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-amber-700 underline">
            View your receipt <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  if (paymentStatus !== "PENDING" && paymentStatus !== "REJECTED") return null;

  const complaintOpen = latestComplaint?.status === "OPEN";

  return (
    <div className="flex flex-col gap-3">
      {paymentStatus === "REJECTED" && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-700"><XCircle className="w-4 h-4 shrink-0" /> The ground rejected your receipt</p>
          <p className="text-xs text-red-700 mt-1">
            {rejectReason ? <>Reason: {rejectReason}</> : <>No reason was given. If you paid correctly, raise a complaint and GoPlay will look into it.</>}
          </p>
        </div>
      )}

      {complaintOpen ? (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          Your complaint is with the GoPlay team. Your slot is held until it&apos;s resolved.
        </p>
      ) : latestComplaint && latestComplaint.status !== "OPEN" && paymentStatus === "REJECTED" ? (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          Complaint {latestComplaint.status.toLowerCase()}.{latestComplaint.adminNote ? ` GoPlay: ${latestComplaint.adminNote}` : ""}
        </p>
      ) : null}

      {paymentDetails ? (
        <BankDetailsCard details={paymentDetails} amount={amount} reference={reference} />
      ) : (
        <p className="text-xs text-slate-500">The ground&apos;s bank details are unavailable. Please contact the ground.</p>
      )}

      {windowLabel && paymentStatus === "PENDING" && (
        <p className="text-xs text-slate-500">Upload your receipt within {windowLabel} of booking, or the slot is released.</p>
      )}

      <ReceiptUploader
        endpoint={uploadEndpoint}
        onUploaded={onChanged}
        label={paymentStatus === "REJECTED" ? "Upload a new receipt" : "Send receipt to the ground"}
      />

      {paymentStatus === "REJECTED" && !complaintOpen && (
        <ComplaintForm bookingId={bookingId} spotId={spotId} onSubmitted={onChanged} />
      )}
    </div>
  );
}
