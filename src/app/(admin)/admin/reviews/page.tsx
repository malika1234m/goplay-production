"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, Flag, Trash2, Loader2, AlertTriangle } from "lucide-react";

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

export default function AdminReviewsPage() {
  const [reviews,        setReviews]        = useState<Review[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [onlyReported,   setOnlyReported]   = useState(true);
  const [deleting,       setDeleting]       = useState<string | null>(null);
  const [totalReported,  setTotalReported]  = useState(0);

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
    if (!confirm("Permanently delete this review? This cannot be undone.")) return;
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
    }
  };

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reviews</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage customer reviews and reported content</p>
        </div>
        <div className="flex items-center gap-2">
          {totalReported > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-full font-medium">
              <Flag className="w-3 h-3" />
              {totalReported} reported
            </span>
          )}
        </div>
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
              <div key={rv.id} className="px-6 py-5">
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
                      onClick={() => handleDelete(rv.id)}
                      disabled={deleting === rv.id}
                      title="Delete review"
                      className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
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
    </div>
  );
}
