"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MapPin, Clock, Loader2, Search, Calendar, XCircle, CreditCard, Banknote, AlertTriangle, RefreshCw, CheckCircle, Star } from "lucide-react";

interface Booking {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  totalAmount: number;
  status: string;
  paymentMethod: "ONLINE" | "ON_ARRIVAL";
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  refundStatus: "NONE" | "NEEDED" | "PROCESSED";
  refundNote: string | null;
  contactNumber: string | null;
  specialRequests: string | null;
  createdAt: string;
  hasReview: boolean;
  facility: {
    name: string;
    city: string;
    address: string;
    category: { name: string; icon: string | null };
  };
}

const paymentBadge = (method: string, pStatus: string) => {
  if (method === "ONLINE") {
    if (pStatus === "PAID")    return <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"><CreditCard className="w-3 h-3"/>Paid Online</span>;
    if (pStatus === "FAILED")  return <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full"><CreditCard className="w-3 h-3"/>Payment Failed</span>;
    if (pStatus === "REFUNDED")return <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full"><CreditCard className="w-3 h-3"/>Refunded</span>;
    return <span className="inline-flex items-center gap-1 text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full"><CreditCard className="w-3 h-3"/>Awaiting Payment</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full"><Banknote className="w-3 h-3"/>Pay on Arrival</span>;
};

const statusStyles: Record<string, string> = {
  PENDING:   "bg-amber-50 text-amber-700 border-amber-100",
  CONFIRMED: "bg-green-50 text-green-700 border-green-100",
  COMPLETED: "bg-slate-100 text-slate-600 border-slate-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-100",
};

const categoryEmoji: Record<string, string> = {
  Cricket: "🏏", Football: "⚽", Tennis: "🎾",
  Badminton: "🏸", Basketball: "🏀", Volleyball: "🏐",
};

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          className="focus:outline-none"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              s <= (hovered || value) ? "fill-amber-400 text-amber-400" : "text-slate-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch]     = useState("");
  const [cancelling,       setCancelling]       = useState<string | null>(null);
  const [checkingPayment,  setCheckingPayment]  = useState<string | null>(null);
  const [paymentMessages,  setPaymentMessages]  = useState<Record<string, { type: "success" | "error" | "info"; text: string }>>({});
  const [error, setError]       = useState("");

  // Review state
  const [reviewOpen,      setReviewOpen]      = useState<string | null>(null);
  const [reviewRating,    setReviewRating]    = useState(0);
  const [reviewText,      setReviewText]      = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError,     setReviewError]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const url = statusFilter
      ? `/api/user/bookings?status=${statusFilter}`
      : "/api/user/bookings";
    const res  = await fetch(url);
    const data = await res.json();
    setBookings(data.bookings ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCheckPayment = async (id: string) => {
    setCheckingPayment(id);
    setPaymentMessages((prev) => ({ ...prev, [id]: { type: "info", text: "Checking with PayHere…" } }));
    try {
      const res  = await fetch(`/api/payhere/check/${id}`, { method: "POST" });
      const data = await res.json();
      if (data.confirmed || data.alreadyConfirmed) {
        setPaymentMessages((prev) => ({ ...prev, [id]: { type: "success", text: data.message ?? "Payment confirmed! Your booking is now active." } }));
        await load();
      } else if (data.failed) {
        setPaymentMessages((prev) => ({ ...prev, [id]: { type: "error", text: data.message ?? "Payment was marked as failed by PayHere." } }));
      } else if (data.pending) {
        setPaymentMessages((prev) => ({ ...prev, [id]: { type: "info", text: data.message ?? "Payment is still being processed. Please wait a moment." } }));
      } else {
        setPaymentMessages((prev) => ({ ...prev, [id]: { type: "error", text: data.error ?? "Could not verify payment. Try again shortly." } }));
      }
    } catch {
      setPaymentMessages((prev) => ({ ...prev, [id]: { type: "error", text: "Network error. Please try again." } }));
    } finally {
      setCheckingPayment(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    setCancelling(id);
    setError("");
    const res  = await fetch(`/api/user/bookings/${id}/cancel`, { method: "PUT" });
    const data = await res.json();
    setCancelling(null);
    if (!res.ok) {
      setError(data.error ?? "Failed to cancel booking.");
    } else {
      await load();
    }
  };

  const openReview = (id: string) => {
    setReviewOpen(id);
    setReviewRating(0);
    setReviewText("");
    setReviewError("");
  };

  const submitReview = async (bookingId: string) => {
    if (!reviewRating) { setReviewError("Please select a rating."); return; }
    setSubmittingReview(true);
    setReviewError("");
    try {
      const res  = await fetch(`/api/user/bookings/${bookingId}/review`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rating: reviewRating, reviewText: reviewText.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, hasReview: true } : b));
        setReviewOpen(null);
      } else {
        setReviewError(data.error ?? "Failed to submit review.");
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const filtered = bookings.filter((b) =>
    b.facility.name.toLowerCase().includes(search.toLowerCase()) ||
    b.facility.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Bookings</h1>
          <p className="text-slate-500 text-sm mt-1">All your ground bookings in one place</p>
        </div>
        <Link
          href="/grounds"
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          + New Booking
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ground name or city..."
            className="bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All Status</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
          {error}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading bookings...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-6 py-20 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">No bookings found</h3>
          <p className="text-sm text-slate-400 mb-6 max-w-xs mx-auto">
            {search || statusFilter
              ? "Try adjusting your search or filter."
              : "Once you book a ground, your bookings will show up here."}
          </p>
          {!search && !statusFilter && (
            <Link
              href="/grounds"
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors inline-block"
            >
              Browse Grounds
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((b) => {
            const icon =
              b.facility.category.icon ??
              categoryEmoji[b.facility.category.name] ??
              "🏟️";
            const isCancellable = b.status === "PENDING" || b.status === "CONFIRMED";
            const canReview     = b.status === "COMPLETED" && !b.hasReview;

            return (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center text-3xl shrink-0 border border-green-100">
                    {icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="font-semibold text-slate-900">{b.facility.name}</h3>
                        <div className="flex items-center gap-1 text-slate-400 text-sm mt-0.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {b.facility.address}, {b.facility.city}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusStyles[b.status]}`}
                      >
                        {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {paymentBadge(b.paymentMethod, b.paymentStatus)}
                      {b.status === "CANCELLED" && b.paymentMethod === "ONLINE" && b.refundStatus === "NEEDED" && (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                          <AlertTriangle className="w-3 h-3" />Refund Pending
                        </span>
                      )}
                      {b.status === "CANCELLED" && b.paymentMethod === "ONLINE" && b.refundStatus === "PROCESSED" && (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle className="w-3 h-3" />Refunded
                        </span>
                      )}
                      {b.status === "COMPLETED" && b.hasReview && (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-medium">
                          <Star className="w-3 h-3 fill-amber-500" />Reviewed
                        </span>
                      )}
                    </div>
                    {b.status === "CANCELLED" && b.refundStatus === "PROCESSED" && b.refundNote && (
                      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg mt-1">
                        Refund note: {b.refundNote}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-50 text-sm text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(b.bookingDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          month:   "short",
                          day:     "numeric",
                          year:    "numeric",
                        })}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {b.startTime} – {b.endTime}
                        <span className="text-slate-400 text-xs">
                          ({b.totalHours} {b.totalHours === 1 ? "hr" : "hrs"})
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900 ml-auto">
                        Rs. {b.totalAmount.toLocaleString()}
                      </span>
                    </div>

                    {b.specialRequests && (
                      <p className="mt-2 text-xs text-slate-500 italic">
                        &ldquo;{b.specialRequests}&rdquo;
                      </p>
                    )}

                    {/* PayHere payment recovery banner */}
                    {b.status === "PENDING" && b.paymentMethod === "ONLINE" && b.paymentStatus !== "PAID" && (
                      <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                        <div className="flex items-start gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700 font-medium">
                            Payment not confirmed. If you already completed your PayHere payment, click below to verify it.
                          </p>
                        </div>
                        {paymentMessages[b.id] && (
                          <div className={`mb-2 flex items-start gap-1.5 text-xs rounded-lg px-3 py-2 ${
                            paymentMessages[b.id].type === "success"
                              ? "bg-green-50 text-green-700 border border-green-100"
                              : paymentMessages[b.id].type === "error"
                              ? "bg-red-50 text-red-600 border border-red-100"
                              : "bg-blue-50 text-blue-600 border border-blue-100"
                          }`}>
                            {paymentMessages[b.id].type === "success" && <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                            {paymentMessages[b.id].text}
                          </div>
                        )}
                        <button
                          onClick={() => handleCheckPayment(b.id)}
                          disabled={checkingPayment === b.id}
                          className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                        >
                          {checkingPayment === b.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          {checkingPayment === b.id ? "Checking…" : "Check Payment Status"}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-3 flex-wrap">
                      {isCancellable && (
                        <button
                          onClick={() => handleCancel(b.id)}
                          disabled={cancelling === b.id}
                          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
                        >
                          {cancelling === b.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5" />
                          )}
                          Cancel Booking
                        </button>
                      )}
                      {canReview && (
                        <button
                          onClick={() => openReview(b.id)}
                          className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
                        >
                          <Star className="w-3.5 h-3.5" />
                          Leave a Review
                        </button>
                      )}
                    </div>

                    {/* Inline review form */}
                    {reviewOpen === b.id && (
                      <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <p className="text-xs font-semibold text-slate-700 mb-3">Rate your experience at {b.facility.name}</p>
                        <StarPicker value={reviewRating} onChange={setReviewRating} />
                        <textarea
                          value={reviewText}
                          onChange={(e) => setReviewText(e.target.value)}
                          placeholder="Share your experience (optional)…"
                          rows={3}
                          className="mt-3 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-400 resize-none bg-white"
                        />
                        {reviewError && (
                          <p className="text-xs text-red-500 mt-1">{reviewError}</p>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => { setReviewOpen(null); setReviewRating(0); setReviewText(""); }}
                            className="flex-1 text-xs text-slate-500 hover:text-slate-700 font-medium py-2 rounded-lg bg-white border border-slate-200 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => submitReview(b.id)}
                            disabled={submittingReview || !reviewRating}
                            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-white bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 font-semibold py-2 rounded-lg transition-colors"
                          >
                            {submittingReview && <Loader2 className="w-3 h-3 animate-spin" />}
                            Submit Review
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
