"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, CheckCircle2, ExternalLink, FileText, Loader2, Mail, MapPin, Phone, User, X } from "lucide-react";
import { isPdf } from "@/components/payments/types";

type Status = "OPEN" | "RESOLVED" | "DISMISSED";

interface ComplaintRow {
  id:         string;
  message:    string;
  status:     Status;
  adminNote:  string | null;
  createdAt:  string;
  resolvedAt: string | null;
  user:       { id: string; name: string; email: string; phone: string | null };
  facility:   { id: string; name: string; owner: { user: { name: string; email: string; phone: string | null } } };
  booking: {
    id: string; bookingDate: string; startTime: string; endTime: string; totalAmount: number;
    status: string; paymentStatus: string; receiptUrl: string | null; receiptRejectReason: string | null; receiptReviewedAt: string | null;
  } | null;
  spot: {
    id: string; amountDue: number; status: string; paymentStatus: string;
    receiptUrl: string | null; receiptRejectReason: string | null; receiptReviewedAt: string | null;
    match: { id: string; preferredDate: string; preferredStartTime: string; preferredEndTime: string };
  } | null;
}

const fmtDate = (d: string) => new Date(d.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const fmtWhen = (d: string | null) => (d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

const statusChip: Record<Status, string> = {
  OPEN:      "bg-amber-50 text-amber-700 border-amber-200",
  RESOLVED:  "bg-green-50 text-green-700 border-green-200",
  DISMISSED: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function AdminComplaintsPage() {
  const [filter,     setFilter]     = useState<Status | "ALL">("OPEN");
  const [rows,       setRows]       = useState<ComplaintRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [lightbox,   setLightbox]   = useState<string | null>(null);
  const [acting,     setActing]     = useState<ComplaintRow | null>(null);
  const [note,       setNote]       = useState("");
  const [markPaid,   setMarkPaid]   = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/admin/complaints?status=${filter}`);
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Failed to load complaints.");
      else { setError(""); setRows(data.complaints ?? []); }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const close = async (status: "RESOLVED" | "DISMISSED") => {
    if (!acting) return;
    setSubmitting(true);
    setError("");
    try {
      const res  = await fetch(`/api/admin/complaints/${acting.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status, adminNote: note || undefined, markPaid: status === "RESOLVED" && markPaid }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to update complaint."); return; }
      setActing(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Payment Complaints</h1>
        <p className="text-slate-500 text-sm mt-1">
          Players dispute bank transfer receipts a ground rejected. Check with the owner, then resolve — optionally accepting the payment on their behalf.
        </p>
      </div>

      <div className="flex gap-2 mb-5">
        {(["OPEN", "RESOLVED", "DISMISSED", "ALL"] as const).map((s) => (
          <button key={s} onClick={() => { if (s !== filter) { setLoading(true); setFilter(s); } }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border ${filter === s ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border-slate-200"}`}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : rows.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-16 bg-white rounded-2xl border border-slate-100">No complaints.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map((c) => {
            const item = c.booking ?? c.spot;
            const receiptUrl = item?.receiptUrl ?? null;
            const when = c.booking
              ? `${fmtDate(c.booking.bookingDate)} · ${c.booking.startTime}–${c.booking.endTime}`
              : c.spot ? `${fmtDate(c.spot.match.preferredDate)} · ${c.spot.match.preferredStartTime}–${c.spot.match.preferredEndTime} (open match)` : "";
            const amount = c.booking?.totalAmount ?? c.spot?.amountDue ?? 0;
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col md:flex-row gap-5">
                {receiptUrl && (
                  isPdf(receiptUrl) ? (
                    <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                      className="w-28 h-28 shrink-0 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-1 text-slate-500">
                      <FileText className="w-7 h-7" /><span className="text-xs">Open PDF</span>
                    </a>
                  ) : (
                    <button onClick={() => setLightbox(receiptUrl)} className="w-28 h-28 shrink-0 rounded-xl border border-slate-200 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={receiptUrl} alt="Receipt" className="w-full h-full object-cover" />
                    </button>
                  )
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-slate-900 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" />{c.facility.name}</p>
                      <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{when} · Rs. {amount.toLocaleString()}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusChip[c.status]}`}>{c.status}</span>
                  </div>

                  <div className="mt-3 bg-slate-50 rounded-xl p-3 text-sm text-slate-700 whitespace-pre-line">{c.message}</div>
                  <p className="text-xs text-red-600 mt-2">
                    Owner&apos;s rejection: {item?.receiptRejectReason ?? "no reason given"} · {fmtWhen(item?.receiptReviewedAt ?? null)}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs text-slate-600">
                    <div>
                      <p className="font-semibold text-slate-800 flex items-center gap-1"><User className="w-3.5 h-3.5" />Player: {c.user.name}</p>
                      <p className="flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{c.user.email}</p>
                      {c.user.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.user.phone}</p>}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 flex items-center gap-1"><User className="w-3.5 h-3.5" />Owner: {c.facility.owner.user.name}</p>
                      <p className="flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{c.facility.owner.user.email}</p>
                      {c.facility.owner.user.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.facility.owner.user.phone}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-4 flex-wrap">
                    <span className="text-xs text-slate-400">Raised {fmtWhen(c.createdAt)}</span>
                    {receiptUrl && (
                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 inline-flex items-center gap-1 hover:underline">
                        Full receipt <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {c.status === "OPEN" ? (
                      <button onClick={() => { setActing(c); setNote(""); setMarkPaid(false); }}
                        className="ml-auto bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-xl">
                        Review complaint
                      </button>
                    ) : (
                      <span className="ml-auto text-xs text-slate-500">Closed {fmtWhen(c.resolvedAt)}{c.adminNote ? ` · ${c.adminNote}` : ""}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white p-2" aria-label="Close"><X className="w-6 h-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Receipt" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {acting && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-slate-900">Close complaint</h2>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000}
              placeholder="Note to the player (and owner, if you accept the payment)"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            {(acting.booking?.paymentStatus === "REJECTED" || acting.spot?.paymentStatus === "REJECTED") && (
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} className="mt-1" />
                <span>Accept the payment — the owner confirmed it arrived, or I verified the transfer. The booking/spot becomes paid.</span>
              </label>
            )}
            <div className="flex gap-2">
              <button onClick={() => setActing(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => close("DISMISSED")} disabled={submitting}
                className="flex-1 border border-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50">Dismiss</button>
              <button onClick={() => close("RESOLVED")} disabled={submitting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
