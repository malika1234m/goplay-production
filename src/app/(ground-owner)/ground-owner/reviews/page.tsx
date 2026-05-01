"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, MessageSquare, TrendingUp, Flag, Loader2, AlertTriangle, CheckCircle } from "lucide-react";

interface Stats {
  avgRating:   number | null;
  total:       number;
  reported:    number;
  thisWeek:    number;
  distribution: { star: number; count: number }[];
}

interface Review {
  id:           string;
  rating:       number;
  reviewText:   string | null;
  reported:     boolean;
  reportReason: string | null;
  createdAt:    string;
  userName:     string;
  facilityName: string;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-4 h-4 ${s <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [reviews,      setReviews]      = useState<Review[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filterRating, setFilterRating] = useState("");
  const [filterReport, setFilterReport] = useState("");
  const [sort,         setSort]         = useState("newest");

  // Report modal state
  const [reportingId,     setReportingId]     = useState<string | null>(null);
  const [reportReason,    setReportReason]    = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportError,     setReportError]     = useState("");

  const load = useCallback(async (r: string, rep: string, s: string) => {
    const params = new URLSearchParams();
    if (r)   params.set("rating",   r);
    if (rep) params.set("reported", rep);
    if (s)   params.set("sort",     s);
    const res  = await fetch(`/api/ground-owner/reviews?${params}`);
    const data = await res.json();
    setStats(data.stats   ?? null);
    setReviews(data.reviews ?? []);
  }, []);

  useEffect(() => {
    load(filterRating, filterReport, sort).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => load(filterRating, filterReport, sort);

  const openReport = (id: string) => {
    setReportingId(id);
    setReportReason("");
    setReportError("");
  };

  const submitReport = async () => {
    if (!reportingId) return;
    setSubmittingReport(true);
    setReportError("");
    try {
      const res = await fetch(`/api/ground-owner/reviews/${reportingId}/report`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ reason: reportReason.trim() || undefined }),
      });
      if (res.ok) {
        setReviews((prev) =>
          prev.map((rv) => rv.id === reportingId
            ? { ...rv, reported: true, reportReason: reportReason.trim() || null }
            : rv
          )
        );
        if (stats) setStats({ ...stats, reported: stats.reported + 1 });
        setReportingId(null);
      } else {
        const data = await res.json();
        setReportError(data.error ?? "Failed to report.");
      }
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading reviews…</span>
      </div>
    );
  }

  const maxCount = Math.max(...(stats?.distribution.map((d) => d.count) ?? [1]), 1);

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reviews</h1>
        <p className="text-slate-500 text-sm mt-0.5">Customer feedback about your facilities</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Average Rating", value: stats?.avgRating ? `${stats.avgRating} / 5` : "—", icon: Star,           color: "bg-amber-50 text-amber-500" },
          { label: "Total Reviews",  value: stats?.total ?? 0,                                  icon: MessageSquare,  color: "bg-blue-50 text-blue-500"   },
          { label: "Reported",       value: stats?.reported ?? 0,                               icon: Flag,           color: "bg-red-50 text-red-500"     },
          { label: "This Week",      value: stats?.thisWeek ?? 0,                               icon: TrendingUp,     color: "bg-green-50 text-green-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Distribution + Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Rating Distribution</h2>
          <div className="flex flex-col gap-2.5">
            {(stats?.distribution ?? []).map(({ star, count }) => (
              <div key={star} className="flex items-center gap-2.5">
                <span className="text-xs text-slate-500 w-4">{star}</span>
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
                <span className="text-xs text-slate-400 w-5 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 lg:col-span-2 flex flex-col justify-between">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Filter Reviews</h2>
          <div className="flex flex-wrap gap-3">
            <select value={filterRating} onChange={(e) => setFilterRating(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-600 outline-none focus:ring-2 focus:ring-green-500 bg-white">
              <option value="">All Ratings</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>{r} Star{r !== 1 ? "s" : ""}</option>
              ))}
            </select>
            <select value={filterReport} onChange={(e) => setFilterReport(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-600 outline-none focus:ring-2 focus:ring-green-500 bg-white">
              <option value="">All Reviews</option>
              <option value="yes">Reported Only</option>
              <option value="no">Not Reported</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-600 outline-none focus:ring-2 focus:ring-green-500 bg-white">
              <option value="newest">Newest First</option>
              <option value="highest">Highest Rated</option>
              <option value="lowest">Lowest Rated</option>
            </select>
            <button onClick={applyFilters}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Reviews list */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="text-base font-semibold text-slate-900">
            Reviews <span className="text-slate-400 font-normal text-sm">({reviews.length})</span>
          </h2>
        </div>

        {reviews.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Star className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No reviews match the current filters</p>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{rv.userName}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-400">{rv.facilityName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <StarRow rating={rv.rating} />
                        <span className="text-xs text-slate-400">
                          {new Date(rv.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      {rv.reviewText && (
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{rv.reviewText}</p>
                      )}
                      {rv.reported && rv.reportReason && (
                        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                          <Flag className="w-3 h-3 shrink-0" />
                          Reported: {rv.reportReason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {rv.reported ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full font-medium">
                        <Flag className="w-3 h-3" />Reported
                      </span>
                    ) : (
                      <button
                        onClick={() => openReport(rv.id)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-200 px-2.5 py-1 rounded-full transition-colors"
                      >
                        <Flag className="w-3 h-3" />Report
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report modal */}
      {reportingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-5">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mb-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">Report Review</h3>
              <p className="text-sm text-slate-500 mb-4">
                This review will be flagged for admin review. Please provide a brief reason.
              </p>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Reason for reporting (e.g. inappropriate content, spam)…"
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-red-400 placeholder:text-slate-400 resize-none"
              />
              {reportError && (
                <p className="text-xs text-red-500 mt-1">{reportError}</p>
              )}
              <div className="flex gap-3 mt-4">
                <button onClick={() => setReportingId(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={submitReport} disabled={submittingReport}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-slate-100 disabled:text-slate-400 rounded-xl transition-colors">
                  {submittingReport && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
