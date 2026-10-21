"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Calendar, Search, Loader2, RefreshCw, ChevronLeft, ChevronRight, ChevronRight as Open, X } from "lucide-react";
import BookingDrawer, { BOOKING_STATUS } from "@/components/admin/BookingDrawer";

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
  isOpenMatch:     boolean;
  noShowReview:    string | null;
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

const FILTERS = [
  { key: "",          label: "All"       },
  { key: "PENDING",   label: "Pending"   },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "NO_SHOW",   label: "No-show"   },
];

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "awaiting payment", RECEIPT_SUBMITTED: "receipt sent", PAID: "paid", REJECTED: "receipt rejected", REFUNDED: "refunded",
};

function fmt(dateStr: string, utc = false) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(utc && { timeZone: "UTC" }) });
}
const fmtMoney = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

function BookingsContent() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  const [input,   setInput]   = useState(params.get("q") ?? "");
  const [q,       setQ]       = useState(params.get("q") ?? "");
  const [status,  setStatusF] = useState(params.get("status") ?? "");
  const [payment, setPaymentF]= useState(params.get("payment") ?? "");
  const [from,    setFromF]   = useState(params.get("from") ?? "");
  const [to,      setToF]     = useState(params.get("to") ?? "");
  const [page,    setPage]    = useState(1);
  const [nonce,   setNonce]   = useState(0);
  const openId = params.get("booking");

  // Changing a filter always goes back to page 1
  const setStatus  = (v: string) => { setStatusF(v);  setPage(1); };
  const setPayment = (v: string) => { setPaymentF(v); setPage(1); };
  const setFrom    = (v: string) => { setFromF(v);    setPage(1); };
  const setTo      = (v: string) => { setToF(v);      setPage(1); };

  // Debounce typing so the list doesn't reload on every key
  useEffect(() => {
    const t = setTimeout(() => { setQ(input.trim()); if (input.trim() !== q) setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [input, q]);

  // The list for the current filters; "loading" is simply "the result we have isn't for these filters yet"
  const query = new URLSearchParams({ page: String(page), ...(q && { q }), ...(status && { status }), ...(payment && { payment }), ...(from && { from }), ...(to && { to }) }).toString();
  const key   = `${query}#${nonce}`;
  const [result, setResult] = useState<{ key: string; data?: ApiResponse; error?: string } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res  = await fetch(`/api/admin/bookings?${query}`, { cache: "no-store" });
        const json = await res.json();
        if (live) setResult(res.ok ? { key, data: json } : { key, error: json.error ?? "Couldn't load bookings.", data: result?.data });
      } catch {
        if (live) setResult({ key, error: "Couldn't reach the server. Check your connection and refresh.", data: result?.data });
      }
    })();
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const data       = result?.data ?? null;
  const error      = result?.key === key ? result.error ?? "" : "";
  const loading    = !data && result?.key !== key;
  const refreshing = !!data && result?.key !== key;
  const load       = () => setNonce((n) => n + 1);

  const openBooking = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("booking", id); else next.delete("booking");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const filtered = !!(q || status || payment || from || to);
  const clear = () => { setInput(""); setQ(""); setStatusF(""); setPaymentF(""); setFromF(""); setToF(""); setPage(1); };

  const isWalkIn   = (b: Booking) => b.specialRequests?.startsWith("[Walk-in]") ?? false;
  const playerName = (b: Booking) =>
    isWalkIn(b) ? b.specialRequests!.replace("[Walk-in]", "").trim().split(" — ")[0].trim() : b.user.name;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {data ? `${data.total.toLocaleString()} ${filtered ? "matching" : "in total"} · open one to see its history or cancel it` : "Loading…"}
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Status counters */}
      {data && (
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3" role="tablist" aria-label="Filter by status">
          {FILTERS.map(({ key, label }) => {
            const count = key
              ? (data.statusCounts[key] ?? 0)
              : Object.values(data.statusCounts).reduce((a, b) => a + b, 0);
            const on = status === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={on}
                onClick={() => setStatus(key)}
                className={`rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 outline-none ${
                  on ? "border-blue-500 bg-blue-50" : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <p className={`text-xl font-bold tabular-nums ${on ? "text-blue-700" : "text-slate-900"}`}>{count.toLocaleString()}</p>
                <p className={`text-xs font-medium mt-0.5 ${on ? "text-blue-700" : "text-slate-500"}`}>{label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Search and filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            aria-label="Search bookings"
            placeholder="Player, email, phone, ground or booking ID"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select aria-label="Payment method" value={payment} onChange={(e) => setPayment(e.target.value)}
            className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Any payment</option>
            <option value="ON_ARRIVAL">Cash at ground</option>
            <option value="ONLINE">Bank transfer</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-500">
            <span className="sr-only sm:not-sr-only">Played</span>
            <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)}
              className="py-2 px-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <span className="text-slate-400 text-sm">to</span>
          <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)}
            className="py-2 px-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-blue-500" />
          {filtered && (
            <button onClick={clear} className="flex items-center gap-1 px-3 py-2.5 text-sm text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100">
              <X className="w-3.5 h-3.5" />Clear
            </button>
          )}
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">{error}</div>}

      {/* Table */}
      <div className={`bg-white rounded-2xl border border-slate-100 overflow-hidden transition-opacity ${refreshing ? "opacity-60" : ""}`} aria-busy={refreshing || loading}>
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading bookings…</span>
          </div>
        ) : !data || data.bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
            <Calendar className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-medium">{filtered ? "No bookings match these filters" : "No bookings yet"}</p>
            {filtered && <button onClick={clear} className="text-sm text-blue-600 hover:underline">Clear filters</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Player", "Ground", "When", "Amount", "Payment", "Status", ""].map((h, i) => (
                    <th key={i} scope="col" className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.bookings.map((b) => {
                  const st = BOOKING_STATUS[b.status];
                  return (
                    <tr key={b.id} onClick={() => openBooking(b.id)}
                      className={`cursor-pointer transition-colors ${openId === b.id ? "bg-blue-50/60" : "hover:bg-slate-50/80"}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                            {playerName(b)[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate max-w-[160px]">{playerName(b)}</p>
                            <p className="text-xs text-slate-500 truncate max-w-[160px]">
                              {b.isOpenMatch ? "Open match" : isWalkIn(b) ? "Walk-in" : b.user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800 truncate max-w-[160px]">{b.facility.name}</p>
                        <p className="text-xs text-slate-500">{b.facility.city}{b.court ? `, ${b.court.name}` : ""}</p>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="font-medium text-slate-800">{fmt(b.bookingDate, true)}</p>
                        <p className="text-xs text-slate-500 tabular-nums">{b.startTime}–{b.endTime} ({b.totalHours}h)</p>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap font-semibold text-slate-800 tabular-nums">{fmtMoney(b.totalAmount)}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="text-slate-700">{b.paymentMethod === "ONLINE" ? "Bank transfer" : "Cash"}</p>
                        {b.paymentMethod === "ONLINE" && <p className="text-xs text-slate-500">{PAYMENT_LABEL[b.paymentStatus] ?? b.paymentStatus}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${st?.cls ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                          {st?.label ?? b.status}
                        </span>
                        {b.noShowReview === "PENDING" && <p className="text-[11px] text-amber-700 mt-1">awaiting review</p>}
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <button onClick={(e) => { e.stopPropagation(); openBooking(b.id); }} aria-label={`Open booking for ${playerName(b)} at ${b.facility.name}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none">
                          <Open className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {data.page} of {data.pages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
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

      <BookingDrawer bookingId={openId} onClose={() => openBooking(null)} onChanged={() => load()} />
    </div>
  );
}

export default function AdminBookingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96 text-slate-400 gap-3"><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Loading…</span></div>}>
      <BookingsContent />
    </Suspense>
  );
}
