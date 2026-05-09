"use client";

import { useState, useEffect, useCallback } from "react";
import {
  History, Search, Calendar, Filter, Download,
  ChevronLeft, ChevronRight, User, Phone, Clock,
  CheckCircle2, XCircle, AlertCircle, StickyNote,
} from "lucide-react";

interface Booking {
  id: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  paymentMethod: "ONLINE" | "ON_ARRIVAL";
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  totalAmount: number;
  totalHours: number;
  contactNumber: string | null;
  specialRequests: string | null;
  playerName: string;
  playerEmail: string;
  playerPhone: string | null;
  courtName: string | null;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:   { label: "Pending",   color: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20", icon: AlertCircle  },
  CONFIRMED: { label: "Confirmed", color: "bg-blue-500/10 text-blue-400 border border-blue-500/20",       icon: CheckCircle2 },
  COMPLETED: { label: "Completed", color: "bg-green-500/10 text-green-400 border border-green-500/20",    icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "bg-red-500/10 text-red-400 border border-red-500/20",          icon: XCircle      },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}
function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}
function isWalkIn(b: Booking) {
  return b.specialRequests?.startsWith("[Walk-in]") ?? false;
}
function walkInName(b: Booking) {
  if (!isWalkIn(b)) return null;
  const raw = b.specialRequests!.replace("[Walk-in]", "").trim();
  return raw.split(" — ")[0].trim();
}
function displayName(b: Booking) {
  return isWalkIn(b) ? walkInName(b) ?? b.playerName : b.playerName;
}

const PAGE_SIZE = 20;

export default function WorkerBookingHistoryPage() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [from, setFrom]       = useState(thirtyDaysAgo);
  const [to, setTo]           = useState(today);
  const [search, setSearch]   = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]  = useState(false);
  const [fetched, setFetched]  = useState(false);
  const [page, setPage]        = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ history: "true" });
      if (from) params.set("from", from);
      if (to)   params.set("to", to);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res  = await fetch(`/api/worker/bookings?${params}`);
      const data = await res.json();
      setBookings(data.bookings ?? []);
      setPage(1);
      setFetched(true);
    } finally {
      setLoading(false);
    }
  }, [from, to, statusFilter]);

  useEffect(() => { load(); }, []);

  const filtered = bookings.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      displayName(b).toLowerCase().includes(q) ||
      b.playerEmail.toLowerCase().includes(q) ||
      (b.contactNumber ?? "").includes(q) ||
      (b.playerPhone ?? "").includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCsv() {
    const rows = [
      ["Date", "Court", "Player", "Contact", "Start", "End", "Hours", "Amount", "Status", "Payment"],
      ...filtered.map((b) => [
        fmtDate(b.bookingDate),
        b.courtName ?? "",
        displayName(b),
        b.contactNumber ?? b.playerPhone ?? "",
        fmtTime(b.startTime),
        fmtTime(b.endTime),
        b.totalHours.toFixed(1),
        b.totalAmount.toFixed(2),
        b.status,
        b.paymentMethod,
      ]),
    ];
    const csv  = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `booking-history-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center">
            <History className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Booking History</h1>
            <p className="text-slate-400 text-sm">Browse and export past bookings</p>
          </div>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-sm rounded-xl transition-colors"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium">From</label>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-transparent text-white text-sm outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium">To</label>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-transparent text-white text-sm outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium">Status</label>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-white text-sm outline-none pr-2"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PENDING">Pending</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </div>

        {fetched && (
          <div className="mt-4 flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Filter by name, email, phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="bg-transparent text-white text-sm outline-none w-full placeholder:text-slate-500"
            />
          </div>
        )}
      </div>

      {/* Results */}
      {loading && (
        <div className="flex justify-center py-16">
          <span className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && fetched && filtered.length === 0 && (
        <div className="text-center py-16">
          <History className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No bookings found</p>
          <p className="text-slate-600 text-sm mt-1">Try adjusting the date range or filters</p>
        </div>
      )}

      {!loading && paginated.length > 0 && (
        <>
          <div className="text-sm text-slate-400 mb-3">
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
            <span className="text-white font-medium">{filtered.length}</span> bookings
          </div>

          <div className="space-y-3">
            {paginated.map((b) => {
              const sm    = STATUS_META[b.status];
              const Icon  = sm.icon;
              const phone = b.contactNumber ?? b.playerPhone;
              const walkin = isWalkIn(b);
              return (
                <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    {/* Date + time + court */}
                    <div className="min-w-[130px]">
                      <p className="text-white text-sm font-semibold">{fmtDate(b.bookingDate)}</p>
                      <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtTime(b.startTime)} – {fmtTime(b.endTime)}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">{b.totalHours}h · Rs. {b.totalAmount.toLocaleString()}</p>
                      {b.courtName && (
                        <span className="mt-1 inline-flex items-center text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">
                          {b.courtName}
                        </span>
                      )}
                    </div>

                    {/* Player */}
                    <div className="flex-1 min-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        {walkin && (
                          <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-md font-medium">
                            Phone
                          </span>
                        )}
                        <p className="text-slate-200 text-sm font-medium flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          {displayName(b)}
                        </p>
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">{b.playerEmail}</p>
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          className="inline-flex items-center gap-1 text-blue-400 text-xs mt-0.5 hover:text-blue-300"
                        >
                          <Phone className="w-3 h-3" />
                          {phone}
                        </a>
                      )}
                    </div>

                    {/* Notes */}
                    {b.specialRequests && !walkin && (
                      <div className="min-w-[120px] max-w-[200px]">
                        <p className="text-slate-500 text-xs flex items-center gap-1">
                          <StickyNote className="w-3 h-3" />
                          {b.specialRequests}
                        </p>
                      </div>
                    )}

                    {/* Status */}
                    <div className="ml-auto flex items-center">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${sm.color}`}>
                        <Icon className="w-3 h-3" />
                        {sm.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-400">
                Page <span className="text-white font-medium">{page}</span> of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
