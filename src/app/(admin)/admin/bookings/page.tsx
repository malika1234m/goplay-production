"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Search, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

interface Booking {
  id:              string;
  bookingDate:     string;
  startTime:       string;
  endTime:         string;
  totalAmount:     number;
  totalHours:      number;
  status:          string;
  paymentMethod:   string;
  paymentStatus:   string;
  createdAt:       string;
  specialRequests: string | null;
  user:     { id: string; name: string; email: string };
  facility: { id: string; name: string; city: string };
  court:    { id: string; name: string } | null;
}

interface ApiResponse {
  bookings:     Booking[];
  total:        number;
  page:         number;
  pages:        number;
  statusCounts: Record<string, number>;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING:   "bg-amber-50  text-amber-700  border-amber-200",
  CONFIRMED: "bg-green-50  text-green-700  border-green-200",
  COMPLETED: "bg-blue-50   text-blue-700   border-blue-200",
  CANCELLED: "bg-red-50    text-red-700    border-red-200",
  NO_SHOW:   "bg-orange-50 text-orange-700 border-orange-200",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:   "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW:   "No Show",
};

const FILTERS = [
  { key: "",          label: "All"       },
  { key: "PENDING",   label: "Pending"   },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "NO_SHOW",   label: "No Show"   },
];

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtMoney(n: number) {
  return `Rs. ${n.toLocaleString()}`;
}

export default function AdminBookingsPage() {
  const [data,    setData]    = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q,       setQ]       = useState("");
  const [status,  setStatus]  = useState("");
  const [page,    setPage]    = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q.trim()) params.set("q", q.trim());
      if (status)   params.set("status", status);
      const res = await fetch(`/api/admin/bookings?${params}`);
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [q, status, page]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filter/search changes
  useEffect(() => { setPage(1); }, [q, status]);

  const isWalkIn = (b: Booking) => b.specialRequests?.startsWith("[Walk-in]") ?? false;
  const playerName = (b: Booking) =>
    isWalkIn(b)
      ? b.specialRequests!.replace("[Walk-in]", "").trim().split(" — ")[0].trim()
      : b.user.name;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Bookings</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {data ? `${data.total.toLocaleString()} total bookings` : "Loading…"}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Status counters */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {FILTERS.map(({ key, label }) => {
            const count = key
              ? (data.statusCounts[key] ?? 0)
              : Object.values(data.statusCounts).reduce((a, b) => a + b, 0);
            return (
              <button
                key={key}
                onClick={() => setStatus(key)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  status === key
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <p className={`text-xl font-bold ${status === key ? "text-blue-700" : "text-slate-900"}`}>
                  {count}
                </p>
                <p className={`text-xs font-medium mt-0.5 ${status === key ? "text-blue-600" : "text-slate-500"}`}>
                  {label}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by player name, email or facility…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading bookings…</span>
          </div>
        ) : !data || data.bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <Calendar className="w-10 h-10" />
            <p className="text-sm font-medium">No bookings found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Player", "Facility", "Date & Time", "Amount", "Payment", "Status", "Booked At"].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">

                    {/* Player */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                          {playerName(b)[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate max-w-[140px]">{playerName(b)}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[140px]">
                            {isWalkIn(b) ? "Walk-in" : b.user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Facility */}
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800 truncate max-w-[140px]">{b.facility.name}</p>
                      <p className="text-xs text-slate-400">{b.facility.city}{b.court ? ` · ${b.court.name}` : ""}</p>
                    </td>

                    {/* Date & Time */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="font-medium text-slate-800">{fmt(b.bookingDate)}</p>
                      <p className="text-xs text-slate-400">{b.startTime} – {b.endTime} ({b.totalHours}h)</p>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-slate-800">
                      {fmtMoney(b.totalAmount)}
                    </td>

                    {/* Payment */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <p className="text-slate-700">{b.paymentMethod === "ONLINE" ? "Online" : "Cash"}</p>
                      {b.paymentMethod === "ONLINE" && (
                        <p className="text-xs text-slate-400">{b.paymentStatus}</p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLE[b.status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                        {STATUS_LABEL[b.status] ?? b.status}
                      </span>
                    </td>

                    {/* Booked At */}
                    <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                      {fmt(b.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {data.page} of {data.pages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
