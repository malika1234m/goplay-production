"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, Flag, Trash2, Loader2, AlertTriangle, X } from "lucide-react";

interface Review {
  id:           string;
  rating:       number;
  reviewText:   string | null;
  reported:     boolean;
  reportReason: string | null;
  createdAt:    string;
  userName:     string;
  userEmail:    string;
  facilityName: string;
  facilityCity: string;
  bookingDate:  string;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
      ))}
    </div>
  );
}

function DeleteConfirmModal({
  review,
  onConfirm,
  onCancel,
  loading,
}: {
  review: Review;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">Delete Review?</h3>
        <p className="text-sm text-slate-500 mb-1">
          Review by <span className="font-medium text-slate-700">{review.userName}</span> for{" "}
          <span className="font-medium text-slate-700">{review.facilityName}</span>.
        </p>
        <p className="text-xs text-red-600 mb-5">This cannot be undone.</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminReviewsPage() {
  const [reviews,       setReviews]       = useState<Review[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [onlyReported,  setOnlyReported]  = useState(true);
  const [deleting,      setDeleting]      = useState<string | null>(null);
  const [totalReported, setTotalReported] = useState(0);
  const [confirmId,     setConfirmId]     = useState<string | null>(null);

  const load = useCallback(async (reported: boolean) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/reviews?reported=${reported}`);
      const data = await res.json();
      setReviews(data.reviews ?? []);
      setTotalReported(data.totalReported ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(onlyReported); }, [load, onlyReported]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
      if (res.ok) {
        const deleted = reviews.find((r) => r.id === id);
        setReviews((prev) => prev.filter((r) => r.id !== id));
        if (deleted?.reported) setTotalReported((n) => Math.max(0, n - 1));
      }
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  };

  const confirmReview = reviews.find((r) => r.id === confirmId);

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reviews</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage customer reviews and reported content</p>
        </div>
        {totalReported > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-full font-medium">
            <Flag className="w-3 h-3" />
            {totalReported} reported
          </span>
        )}
      </div>

      {/* Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setOnlyReported(true)}
          className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
            onlyReported ? "border-red-400 bg-red-50 text-red-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
          }`}
        >
          <Flag className="w-3.5 h-3.5 inline mr-1.5" />Reported Reviews
          {totalReported > 0 && (
            <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalReported}</span>
          )}
        </button>
        <button
          onClick={() => setOnlyReported(false)}
          className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
            !onlyReported ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
          }`}
        >
          All Reviews
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {onlyReported ? "Reported Reviews" : "All Reviews"}
            <span className="ml-2 text-slate-400 font-normal text-sm">({reviews.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Star className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">
              {onlyReported ? "No reported reviews — all clean!" : "No reviews yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {reviews.map((rv) => (
              <div key={rv.id} className="px-6 py-5 hover:bg-slate-50/40 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-bold shrink-0">
                      {rv.userName?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-slate-900">{rv.userName}</span>
                        <span className="text-xs text-slate-400">{rv.userEmail}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <StarRow rating={rv.rating} />
                        <span className="text-xs text-slate-400">
                          {new Date(rv.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500 font-medium">{rv.facilityName}</span>
                        <span className="text-xs text-slate-400">{rv.facilityCity}</span>
                      </div>
                      {rv.reviewText && (
                        <p className="text-sm text-slate-600 leading-relaxed mb-2">{rv.reviewText}</p>
                      )}
                      {rv.reported && (
                        <div className="flex items-start gap-1.5 mt-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-600">
                            <span className="font-medium">Reported by facility owner</span>
                            {rv.reportReason && <span className="text-red-500"> — {rv.reportReason}</span>}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {rv.reported && (
                      <span className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">
                        Reported
                      </span>
                    )}
                    <button
                      onClick={() => setConfirmId(rv.id)}
                      disabled={deleting === rv.id}
                      title="Delete review"
                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {deleting === rv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmReview && (
        <DeleteConfirmModal
          review={confirmReview}
          onConfirm={() => handleDelete(confirmReview.id)}
          onCancel={() => setConfirmId(null)}
          loading={deleting === confirmReview.id}
        />
      )}
    </div>
  );
}
