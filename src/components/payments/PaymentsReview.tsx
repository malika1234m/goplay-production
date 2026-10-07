"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar, CheckCircle2, Clock, ExternalLink, FileText, Loader2, Phone, RotateCcw, User, X, XCircle,
} from "lucide-react";
import { isPdf } from "./types";

interface PaymentItem {
  kind:                "booking" | "spot";
  id:                  string;
  playerName:          string;
  playerPhone:         string | null;
  playerEmail:         string;
  facilityName:        string;
  label:               string;
  date:                string;
  startTime:           string;
  endTime:             string;
  amount:              number;
  paymentStatus:       "RECEIPT_SUBMITTED" | "REJECTED" | "PAID" | "REFUNDED";
  receiptUrl:          string;
  receiptUploadedAt:   string | null;
  receiptReviewedAt:   string | null;
  receiptRejectReason: string | null;
}

interface RefundItem {
  id:            string;
  bookingDate:   string;
  startTime:     string;
  endTime:       string;
  totalAmount:   number;
  refundAmount:  number | null;
  refundPercent: number | null;
  cancelledAt:   string | null;
  cancelledBy:   string | null;
  contactNumber: string | null;
  user:          { name: string; phone: string | null; email: string };
  facility:      { name: string };
}

type Filter = "review" | "rejected" | "confirmed" | "all" | "refunds";

const TABS: { key: Filter; label: string }[] = [
  { key: "review",    label: "To review" },
  { key: "rejected",  label: "Rejected" },
  { key: "confirmed", label: "Confirmed" },
  { key: "all",       label: "All receipts" },
  { key: "refunds",   label: "Refunds due" },
];

const fmtDate = (d: string) =>
  new Date(d.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtWhen = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

const statusChip: Record<PaymentItem["paymentStatus"], string> = {
  RECEIPT_SUBMITTED: "bg-amber-50 text-amber-700 border-amber-200",
  REJECTED:          "bg-red-50 text-red-600 border-red-200",
  PAID:              "bg-green-50 text-green-700 border-green-200",
  REFUNDED:          "bg-slate-100 text-slate-600 border-slate-200",
};
const statusLabel: Record<PaymentItem["paymentStatus"], string> = {
  RECEIPT_SUBMITTED: "Needs review",
  REJECTED:          "Rejected",
  PAID:              "Confirmed",
  REFUNDED:          "Refunded",
};

function ReceiptThumb({ url, onOpen }: { url: string; onOpen: () => void }) {
  if (isPdf(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="w-24 h-24 shrink-0 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-600">
        <FileText className="w-7 h-7" /><span className="text-[11px] font-medium">Open PDF</span>
      </a>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="w-24 h-24 shrink-0 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 hover:ring-2 hover:ring-blue-400">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Payment receipt" className="w-full h-full object-cover" />
    </button>
  );
}

/**
 * Bank transfer receipts for the owner's (or worker's) grounds: view, confirm or reject,
 * plus refunds the ground owes after cancellations.
 */
export default function PaymentsReview() {
  const initial = useSearchParams().get("filter") as Filter | null;
  const [filter,      setFilter]      = useState<Filter>(initial && TABS.some((t) => t.key === initial) ? initial : "review");
  const [items,       setItems]       = useState<PaymentItem[]>([]);
  const [refunds,     setRefunds]     = useState<RefundItem[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [flash,       setFlash]       = useState("");
  const [busy,        setBusy]        = useState<string | null>(null);
  const [lightbox,    setLightbox]    = useState<string | null>(null);
  const [rejecting,   setRejecting]   = useState<PaymentItem | null>(null);
  const [reason,      setReason]      = useState("");
  const [refunding,   setRefunding]   = useState<RefundItem | null>(null);
  const [refundNote,  setRefundNote]  = useState("");

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/ground-owner/payments?filter=${filter}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to load payments."); return; }
      setError("");
      if (filter === "refunds") setRefunds(data.refunds ?? []);
      else { setItems(data.items ?? []); setReviewCount(data.reviewCount ?? 0); }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const review = async (item: PaymentItem, action: "confirm" | "reject", rejectReason?: string) => {
    setBusy(item.id);
    setError("");
    try {
      const res  = await fetch(`/api/ground-owner/payments/${item.kind}/${item.id}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action, reason: rejectReason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not update the payment."); return; }
      setFlash(action === "confirm" ? `Payment from ${item.playerName} confirmed.` : `Receipt from ${item.playerName} rejected.`);
      setRejecting(null);
      setReason("");
      await load();
    } finally {
      setBusy(null);
    }
  };

  const markRefunded = async (r: RefundItem) => {
    setBusy(r.id);
    setError("");
    try {
      const res  = await fetch(`/api/ground-owner/bookings/${r.id}/refund`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ note: refundNote || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not update the refund."); return; }
      setFlash(`Refund to ${r.user.name} marked as sent.`);
      setRefunding(null);
      setRefundNote("");
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="text-slate-500 text-sm mt-1">
          Players pay online by bank transfer and upload the receipt. Check that the money reached your account, then confirm the booking.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { if (t.key !== filter) { setLoading(true); setFilter(t.key); } }}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              filter === t.key ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {t.label}
            {t.key === "review" && reviewCount > 0 && (
              <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${filter === "review" ? "bg-white/20" : "bg-amber-100 text-amber-700"}`}>{reviewCount}</span>
            )}
          </button>
        ))}
      </div>

      {flash && (
        <div className="mb-4 flex items-center justify-between gap-3 text-sm bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{flash}</span>
          <button onClick={() => setFlash("")} aria-label="Dismiss"><X className="w-4 h-4" /></button>
        </div>
      )}
      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : filter === "refunds" ? (
        refunds.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-16 bg-white rounded-2xl border border-slate-100">No refunds due. 🎉</p>
        ) : (
          <div className="flex flex-col gap-3">
            {refunds.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900">{r.user.name} <span className="text-slate-400 font-normal">· {r.facility.name}</span></p>
                  <p className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{fmtDate(r.bookingDate)} {r.startTime}–{r.endTime}</span>
                    {(r.contactNumber ?? r.user.phone) && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{r.contactNumber ?? r.user.phone}</span>}
                    <span>Cancelled by {r.cancelledBy ?? "—"} {fmtWhen(r.cancelledAt)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900">Rs. {(r.refundAmount ?? r.totalAmount).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">{r.refundPercent ?? 100}% of Rs. {r.totalAmount.toLocaleString()}</p>
                </div>
                <button
                  onClick={() => { setRefunding(r); setRefundNote(""); }}
                  className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
                >
                  <RotateCcw className="w-4 h-4" /> Mark refunded
                </button>
              </div>
            ))}
          </div>
        )
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-16 bg-white rounded-2xl border border-slate-100">
          {filter === "review" ? "No receipts waiting for review." : "Nothing here yet."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col sm:flex-row gap-4">
              <ReceiptThumb url={item.receiptUrl} onOpen={() => setLightbox(item.receiptUrl)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-slate-900 flex items-center gap-1.5"><User className="w-4 h-4 text-slate-400" />{item.playerName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.facilityName} · {item.label}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusChip[item.paymentStatus]}`}>{statusLabel[item.paymentStatus]}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 mt-3">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" />{fmtDate(item.date)}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" />{item.startTime}–{item.endTime}</span>
                  {item.playerPhone && <a href={`tel:${item.playerPhone}`} className="flex items-center gap-1 hover:text-green-700"><Phone className="w-3.5 h-3.5 text-slate-400" />{item.playerPhone}</a>}
                  <span className="font-semibold text-slate-900">Rs. {item.amount.toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Ref {item.id.slice(0, 8).toUpperCase()} · uploaded {fmtWhen(item.receiptUploadedAt)}
                  {item.receiptReviewedAt && item.paymentStatus !== "RECEIPT_SUBMITTED" && <> · reviewed {fmtWhen(item.receiptReviewedAt)}</>}
                </p>
                {item.paymentStatus === "REJECTED" && (
                  <p className="text-xs text-red-600 mt-1">{item.receiptRejectReason ? `Reason: ${item.receiptRejectReason}` : "Rejected without a reason"}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <a href={item.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    Open full receipt <ExternalLink className="w-3 h-3" />
                  </a>
                  {item.paymentStatus === "RECEIPT_SUBMITTED" && (
                    <div className="flex gap-2 ml-auto">
                      <button
                        onClick={() => { setRejecting(item); setReason(""); }}
                        disabled={busy === item.id}
                        className="flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={() => review(item, "confirm")}
                        disabled={busy === item.id}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
                      >
                        {busy === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Confirm payment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Receipt lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white p-2" aria-label="Close"><X className="w-6 h-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Payment receipt" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Reject receipt?</h2>
              <p className="text-sm text-slate-500 mt-1">
                {rejecting.playerName} will be asked to upload a new receipt. Tell them why so they can fix it —
                players can raise a complaint with GoPlay if no reason is given.
              </p>
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. No transfer of Rs. 2,000 received on this date / amount is short / receipt is unreadable"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setRejecting(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => review(rejecting, "reject", reason.trim())}
                disabled={busy === rejecting.id}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy === rejecting.id && <Loader2 className="w-4 h-4 animate-spin" />} Reject receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund modal */}
      {refunding && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Mark refund as sent</h2>
              <p className="text-sm text-slate-500 mt-1">
                Confirm you transferred Rs. {(refunding.refundAmount ?? refunding.totalAmount).toLocaleString()} back to {refunding.user.name}. They&apos;ll be notified.
              </p>
            </div>
            <input
              value={refundNote}
              onChange={(e) => setRefundNote(e.target.value)}
              maxLength={500}
              placeholder="Transfer reference (optional)"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex gap-2">
              <button onClick={() => setRefunding(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                onClick={() => markRefunded(refunding)}
                disabled={busy === refunding.id}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy === refunding.id && <Loader2 className="w-4 h-4 animate-spin" />} Mark refunded
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
