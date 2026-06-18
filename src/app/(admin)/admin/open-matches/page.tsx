"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Loader2, RefreshCw, Search, Zap, Users, Calendar, Clock, MapPin,
  XCircle, ChevronDown, ChevronUp, ExternalLink, AlertTriangle,
  CheckCircle2, RotateCcw, TrendingUp, Trophy, Timer, Banknote,
  BarChart3, Activity, Info, DollarSign, X,
} from "lucide-react";

/* ── Types ───────────────────────────────────────────────── */
interface Spot {
  id: string; groupSize: number; status: string; paymentStatus: string;
  amountPaid: number; cancelledAt: string | null; createdAt: string;
  user: { id: string; name: string; email: string; phone: string | null };
}
interface Match {
  id: string; preferredDate: string; preferredStartTime: string; preferredEndTime: string;
  totalSpotsNeeded: number; spotsReserved: number; status: string;
  serviceFeePct: number; expiresAt: string; matchedAt: string | null; createdAt: string;
  category: { id: string; name: string; icon: string; minPlayers: number };
  facility: { id: string; name: string; city: string; hourlyRate: number };
  spots: Spot[];
}

type Tab = "overview" | "lobbies" | "refunds" | "revenue";

/* ── Status config ──────────────────────────────────────── */
const STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  COLLECTING: { label: "Filling",   pill: "bg-amber-100 text-amber-700 border-amber-200",  dot: "bg-amber-400"  },
  MATCHED:    { label: "Matched",   pill: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500"  },
  EXPIRED:    { label: "Expired",   pill: "bg-slate-100 text-slate-500 border-slate-200",  dot: "bg-slate-400"  },
  CANCELLED:  { label: "Cancelled", pill: "bg-red-100 text-red-600 border-red-200",        dot: "bg-red-400"    },
};

/* ── Helpers ─────────────────────────────────────────────── */
function toMins(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function calcHrs(s: string, e: string) { return (toMins(e) - toMins(s)) / 60; }
function lobbyCourt(m: Match) { return m.facility.hourlyRate * calcHrs(m.preferredStartTime, m.preferredEndTime); }
function lobbyRevenue(m: Match) { return Math.round(lobbyCourt(m) * (1 + m.serviceFeePct / 100 + 0.025)); }
function fmt(n: number) { return `Rs. ${Math.round(n).toLocaleString()}`; }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-LK", { weekday: "short", month: "short", day: "numeric" });
}
function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString("en-LK", { month: "short", day: "numeric", year: "numeric" });
}

/* ── Countdown ───────────────────────────────────────────── */
function Countdown({ target, compact = false }: { target: string; compact?: boolean }) {
  const [diff, setDiff] = useState(0);
  useEffect(() => {
    const tick = () => setDiff(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  if (diff === 0) return <span className="text-red-500 font-semibold">Expired</span>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const urgent = diff < 3600000;
  const cls = `font-bold tabular-nums ${urgent ? "text-red-600" : "text-amber-700"} ${compact ? "text-xs" : "text-sm"}`;
  return <span className={cls}>{h > 0 && `${h}h `}{m}m {String(s).padStart(2, "0")}s</span>;
}

/* ── Toast ───────────────────────────────────────────────── */
function Toast({ type, msg, onClose }: { type: "success" | "error"; msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium max-w-sm animate-in slide-in-from-bottom-4 ${
      type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
    }`}>
      {type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      <span className="flex-1">{msg}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 shrink-0"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

/* ── Inline confirm dialog ────────────────────────────────── */
function ConfirmCancel({ lobbyName, onConfirm, onCancel, loading }:
  { lobbyName: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-6 h-6 text-red-600" />
        </div>
        <h3 className="text-base font-bold text-slate-900 text-center mb-2">Cancel Lobby?</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Cancel <span className="font-semibold text-slate-700">{lobbyName}</span>? All reserved players will be notified and refunded.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">
            Keep Lobby
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Yes, Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function AdminOpenMatchesPage() {
  const [matches,     setMatches]     = useState<Match[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [tab,         setTab]         = useState<Tab>("overview");
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("");
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Match | null>(null);
  const [cancelling,  setCancelling]  = useState(false);
  const [processing,  setProcessing]  = useState<string | null>(null);
  const [toast,       setToast]       = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMatches = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const res = await fetch("/api/admin/open-matches");
    if (res.ok) { setMatches(await res.json()); setLastUpdated(new Date()); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  useEffect(() => {
    timerRef.current = setInterval(() => fetchMatches(true), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchMatches]);

  async function doCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    const res  = await fetch("/api/admin/open-matches", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body:   JSON.stringify({ matchId: cancelTarget.id }),
    });
    const data = await res.json();
    setCancelling(false);
    setCancelTarget(null);
    setToast({ type: res.ok ? "success" : "error", msg: data.message ?? data.error ?? "Error" });
    if (res.ok) fetchMatches(true);
  }

  async function markRefundProcessed(spotId: string) {
    setProcessing(spotId);
    const res  = await fetch("/api/admin/open-matches", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body:   JSON.stringify({ spotId }),
    });
    const data = await res.json();
    setProcessing(null);
    setToast({ type: res.ok ? "success" : "error", msg: data.message ?? data.error ?? "Error" });
    if (res.ok) fetchMatches(true);
  }

  /* ── Derived ── */
  const collecting = matches.filter((m) => m.status === "COLLECTING");
  const matched    = matches.filter((m) => m.status === "MATCHED");
  const expired    = matches.filter((m) => m.status === "EXPIRED");
  const cancelled  = matches.filter((m) => m.status === "CANCELLED");

  const totalRevenue  = matched.reduce((s, m) => s + lobbyRevenue(m), 0);
  const matchedCourt  = matched.reduce((s, m) => s + lobbyCourt(m), 0);
  const totalPlayers  = matches.reduce((s, m) => s + m.spotsReserved, 0);

  const refundSpots = matches.flatMap((m) =>
    m.spots
      .filter((s) => s.status === "REFUNDED" && s.paymentStatus === "REFUNDED" && s.amountPaid > 0)
      .map((s) => ({ ...s, match: m }))
  );
  const refundTotal = refundSpots.reduce((s, sp) => s + sp.amountPaid, 0);

  const clearedSpots = matches.flatMap((m) =>
    m.spots
      .filter((s) => s.status === "REFUNDED" && s.paymentStatus === "PENDING")
      .map((s) => ({ ...s, match: m }))
  );

  const filtered = matches.filter((m) => {
    if (filter && m.status !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.facility.name.toLowerCase().includes(q) ||
      m.category.name.toLowerCase().includes(q) ||
      m.facility.city.toLowerCase().includes(q) ||
      m.spots.some((s) => s.user.name.toLowerCase().includes(q) || s.user.email.toLowerCase().includes(q))
    );
  });

  const matchRate = matches.length ? Math.round(matched.length / matches.length * 100) : 0;
  const avgFill   = matches.length
    ? Math.round(matches.reduce((s, m) => s + m.spotsReserved / m.totalSpotsNeeded, 0) / matches.length * 100)
    : 0;

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-3 text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin text-green-600" />
      <p className="text-sm">Loading open match data…</p>
    </div>
  );

  /* ── Tab config ── */
  const TABS: { key: Tab; label: string; icon: React.ElementType; badge?: number; badgeColor?: string }[] = [
    { key: "overview", label: "Overview",  icon: Activity },
    { key: "lobbies",  label: "Lobbies",   icon: Zap,      badge: collecting.length || undefined, badgeColor: "bg-amber-400 text-white" },
    { key: "refunds",  label: "Refunds",   icon: RotateCcw, badge: refundSpots.length || undefined, badgeColor: "bg-red-500 text-white" },
    { key: "revenue",  label: "Revenue",   icon: DollarSign },
  ];

  /* ── Spot status style ── */
  const spotStatusStyle = (s: Spot) => {
    if (s.status === "CONFIRMED") return "bg-green-100 text-green-700";
    if (s.status === "REFUNDED")  return "bg-blue-100  text-blue-700";
    if (s.status === "RESERVED")  return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-500";
  };
  const payStatusLabel = (s: Spot) => {
    if (s.status === "REFUNDED" && s.paymentStatus === "PENDING") return { label: "Cleared", cls: "bg-slate-100 text-slate-500" };
    if (s.paymentStatus === "PAID")     return { label: "Paid",     cls: "bg-green-100 text-green-700" };
    if (s.paymentStatus === "REFUNDED") return { label: "Refunded", cls: "bg-orange-100 text-orange-700" };
    return { label: "Pending", cls: "bg-amber-100 text-amber-700" };
  };

  return (
    <div className="p-5 lg:p-7 max-w-7xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center shadow-sm">
              <Zap className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">GoPlay Connect</h1>
            <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full font-medium">Open Matches</span>
          </div>
          <p className="text-xs text-slate-400 ml-11">
            {matches.length} total lobbies ·{" "}
            {lastUpdated ? (
              <span>Updated {lastUpdated.toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            ) : "Loading…"}
          </p>
        </div>
        <button onClick={() => fetchMatches(true)} disabled={refreshing}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2 transition-colors bg-white shadow-sm">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-green-600" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* ── Top KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Active",    value: collecting.length, sub: `${collecting.reduce((s, m) => s + m.spotsReserved, 0)} waiting`, icon: Activity,   bg: "bg-amber-50",  ic: "text-amber-600", vl: "text-amber-700", clickTab: "lobbies" as Tab, clickFilter: "COLLECTING" },
          { label: "Matched",   value: matched.length,    sub: `${matched.reduce((s, m) => s + m.totalSpotsNeeded, 0)} played`,  icon: Trophy,     bg: "bg-green-50",  ic: "text-green-600", vl: "text-green-700", clickTab: "lobbies" as Tab, clickFilter: "MATCHED"    },
          { label: "Total Players", value: totalPlayers,  sub: `across all lobbies`,                                              icon: Users,      bg: "bg-blue-50",   ic: "text-blue-600",  vl: "text-blue-700",  clickTab: undefined,         clickFilter: ""           },
          { label: "Total Revenue", value: fmt(totalRevenue), sub: `from ${matched.length} matched`,                              icon: TrendingUp, bg: "bg-purple-50", ic: "text-purple-600",vl: "text-purple-700",clickTab: "revenue" as Tab,  clickFilter: ""           },
          { label: "Pending Refunds", value: refundSpots.length, sub: refundSpots.length ? fmt(refundTotal) + " owed" : "All clear", icon: RotateCcw, bg: refundSpots.length ? "bg-red-50" : "bg-slate-50", ic: refundSpots.length ? "text-red-600" : "text-slate-400", vl: refundSpots.length ? "text-red-700" : "text-slate-500", clickTab: "refunds" as Tab, clickFilter: "" },
        ].map(({ label, value, sub, icon: Icon, bg, ic, vl, clickTab, clickFilter }) => (
          <button
            key={label}
            onClick={() => { if (clickTab) { setTab(clickTab); if (clickFilter) setFilter(clickFilter); } }}
            className={`text-left bg-white rounded-2xl border border-slate-100 p-4 transition-all ${
              clickTab ? "hover:border-slate-300 hover:shadow-sm cursor-pointer" : "cursor-default"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${bg}`}>
              <Icon className={`w-4 h-4 ${ic}`} />
            </div>
            <p className={`text-2xl font-bold ${vl}`}>{value}</p>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">{label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
          </button>
        ))}
      </div>

      {/* ── Tab nav ── */}
      <div className="overflow-x-auto">
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 min-w-max w-fit">
        {TABS.map(({ key, label, icon: Icon, badge, badgeColor }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {badge && badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${badgeColor}`}>
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </button>
        ))}
      </div>
      </div>

      {/* ══════════════ OVERVIEW ══════════════ */}
      {tab === "overview" && (
        <div className="space-y-5">

          {/* Two-column: revenue feed + status panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Revenue feed */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" /> Matched Lobby Revenue
                </h2>
                <button onClick={() => setTab("revenue")} className="text-xs text-green-600 hover:text-green-700 font-medium">
                  Full breakdown →
                </button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  {[
                    { label: "Total collected",     value: fmt(totalRevenue),                  color: "text-green-700 text-xl" },
                    { label: "Court value",          value: fmt(matchedCourt),                  color: "text-slate-700 text-lg" },
                    { label: "GoPlay margin",        value: fmt(totalRevenue - matchedCourt),   color: "text-blue-700 text-lg"  },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3.5">
                      <p className={`font-bold ${color}`}>{value}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                {matched.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                    <Trophy className="w-8 h-8 mb-2" />
                    <p className="text-sm">No matched lobbies yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {matched.slice(0, 8).map((m) => (
                      <Link href={`/open-matches/${m.id}`} target="_blank" key={m.id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center font-bold text-green-700 text-xs shrink-0">
                          {m.category.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate group-hover:text-green-700 transition-colors">{m.category.name} · {m.facility.name}</p>
                          <p className="text-[11px] text-slate-400">{fmtDate(m.preferredDate)} · {m.preferredStartTime}–{m.preferredEndTime}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold text-green-700">{fmt(lobbyRevenue(m))}</p>
                          <p className="text-[10px] text-slate-400">{m.totalSpotsNeeded} players</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stats panel */}
            <div className="bg-white rounded-2xl border border-slate-100">
              <div className="px-6 py-4 border-b border-slate-50">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-slate-400" /> Platform Health
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: "Filling",    count: collecting.length, color: "bg-amber-400", pct: matches.length ? collecting.length / matches.length : 0 },
                  { label: "Matched",    count: matched.length,    color: "bg-green-500", pct: matches.length ? matched.length    / matches.length : 0 },
                  { label: "Expired",    count: expired.length,    color: "bg-slate-300", pct: matches.length ? expired.length    / matches.length : 0 },
                  { label: "Cancelled",  count: cancelled.length,  color: "bg-red-400",   pct: matches.length ? cancelled.length  / matches.length : 0 },
                ].map(({ label, count, color, pct }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-slate-600">{label}</span>
                      <span className="font-semibold text-slate-800">{count} <span className="text-slate-400 font-normal text-xs">({Math.round(pct * 100)}%)</span></span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct * 100}%` }} />
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-slate-50 grid grid-cols-2 gap-3">
                  {[
                    { label: "Match rate",   value: `${matchRate}%`,    color: "text-green-700" },
                    { label: "Avg fill",     value: `${avgFill}%`,      color: "text-blue-700"  },
                    { label: "Total lobbies",value: matches.length,      color: "text-slate-800" },
                    { label: "Active now",   value: collecting.length,   color: "text-amber-700" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                      <p className={`text-lg font-bold ${color}`}>{value}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live lobbies */}
          <div className="bg-white rounded-2xl border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  {collecting.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${collecting.length > 0 ? "bg-amber-500" : "bg-slate-300"}`} />
                </span>
                Live Lobbies
                {collecting.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{collecting.length} active</span>
                )}
              </h2>
              {collecting.length > 0 && (
                <button onClick={() => { setTab("lobbies"); setFilter("COLLECTING"); }}
                  className="text-xs text-green-600 hover:text-green-700 font-medium">
                  Manage all →
                </button>
              )}
            </div>
            <div className="p-6">
              {collecting.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                  <Zap className="w-10 h-10 mb-2" />
                  <p className="text-sm text-slate-400">No active lobbies right now</p>
                  <p className="text-xs text-slate-300 mt-1">New lobbies will appear here in real-time</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {collecting.map((m) => {
                    const pct       = Math.round(m.spotsReserved / m.totalSpotsNeeded * 100);
                    const spotsLeft = m.totalSpotsNeeded - m.spotsReserved;
                    const isUrgent  = new Date(m.expiresAt).getTime() - Date.now() < 3600000;
                    return (
                      <div key={m.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${isUrgent ? "border-red-200 bg-red-50/30" : "border-slate-100 hover:border-amber-200 hover:bg-amber-50/20"}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${isUrgent ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {m.category.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate mb-0.5">{m.category.name} — {m.facility.name}, {m.facility.city}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mb-2">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(m.preferredDate)}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.preferredStartTime}–{m.preferredEndTime}</span>
                            <span className={`flex items-center gap-1 font-medium ${spotsLeft <= 2 ? "text-red-500" : ""}`}>
                              <Users className="w-3 h-3" />{m.spotsReserved}/{m.totalSpotsNeeded}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${isUrgent ? "bg-red-400" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0">{pct}%</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right space-y-1 min-w-[80px]">
                          <div className="flex items-center gap-1 justify-end">
                            <Timer className={`w-3 h-3 ${isUrgent ? "text-red-500" : "text-amber-500"}`} />
                            <Countdown target={m.expiresAt} compact />
                          </div>
                          <p className={`text-[11px] ${spotsLeft <= 2 ? "text-red-500 font-semibold" : "text-slate-400"}`}>{spotsLeft} left</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Link href={`/open-matches/${m.id}`} target="_blank"
                            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View lobby">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                          <button onClick={() => setCancelTarget(m)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Cancel lobby">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ LOBBIES ══════════════ */}
      {tab === "lobbies" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <div className="overflow-x-auto -mx-4 px-4">
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1 min-w-max">
                {(["", "COLLECTING", "MATCHED", "EXPIRED", "CANCELLED"] as const).map((s) => (
                  <button key={s} onClick={() => setFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                      filter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}>
                    {s && <span className={`w-1.5 h-1.5 rounded-full ${STATUS[s]?.dot}`} />}
                    {s ? STATUS[s]?.label : "All"}
                    <span className="text-[10px] text-slate-400">({s ? matches.filter((m) => m.status === s).length : matches.length})</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search facility, sport, player…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
              </div>
              <span className="text-xs text-slate-400 font-medium shrink-0">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-14 flex flex-col items-center text-slate-300">
              <Search className="w-10 h-10 mb-3" />
              <p className="font-semibold text-slate-500">No lobbies found</p>
              <p className="text-sm mt-1">Try adjusting your search or filter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((m) => {
                const isOpen    = expanded === m.id;
                const pct       = Math.round(m.spotsReserved / m.totalSpotsNeeded * 100);
                const revenue   = lobbyRevenue(m);
                const courtCost = lobbyCourt(m);
                const st        = STATUS[m.status];

                return (
                  <div key={m.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-slate-200 transition-colors">
                    {/* Row */}
                    <button onClick={() => setExpanded(isOpen ? null : m.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors text-left">

                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        m.status === "MATCHED" ? "bg-green-100 text-green-700" :
                        m.status === "COLLECTING" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {m.category.name.charAt(0)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-slate-800 text-sm">{m.category.name}</span>
                          {st && (
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${st.pill}`}>
                              <span className={`w-1 h-1 rounded-full ${st.dot}`} />
                              {st.label}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.facility.name}, {m.facility.city}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(m.preferredDate)}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.preferredStartTime}–{m.preferredEndTime}</span>
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{m.spotsReserved}/{m.totalSpotsNeeded} players</span>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="w-24 shrink-0 hidden sm:block">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                          <div className={`h-full rounded-full ${m.status === "MATCHED" ? "bg-green-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-400 text-right">{pct}% full</p>
                      </div>

                      {m.status === "MATCHED" && (
                        <div className="shrink-0 hidden md:block text-right">
                          <p className="text-sm font-bold text-green-700">{fmt(revenue)}</p>
                          <p className="text-[10px] text-slate-400">revenue</p>
                        </div>
                      )}

                      {m.status === "COLLECTING" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="hidden md:block text-right">
                            <Countdown target={m.expiresAt} compact />
                            <p className="text-[10px] text-slate-400">expires</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setCancelTarget(m); }}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Cancel lobby">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      <div className="shrink-0">
                        {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>

                    {/* Expanded */}
                    {isOpen && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5 space-y-4">
                        {/* Meta grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {[
                            { label: "Lobby ID",    value: m.id.slice(0, 12) + "…", mono: true },
                            { label: "Created",     value: new Date(m.createdAt).toLocaleString("en-LK", { dateStyle: "short", timeStyle: "short" }) },
                            { label: "Expires",     value: new Date(m.expiresAt).toLocaleString("en-LK", { dateStyle: "short", timeStyle: "short" }) },
                            ...(m.matchedAt ? [{ label: "Matched at", value: new Date(m.matchedAt).toLocaleString("en-LK", { dateStyle: "short", timeStyle: "short" }) }] : []),
                            { label: "Court rate",  value: `${fmt(m.facility.hourlyRate)}/hr` },
                            { label: "Duration",    value: `${calcHrs(m.preferredStartTime, m.preferredEndTime)}h` },
                            { label: "Court total", value: fmt(courtCost) },
                            ...(m.status === "MATCHED" ? [{ label: "Total revenue", value: fmt(revenue), highlight: true }] : []),
                          ].map(({ label, value, mono, highlight }) => (
                            <div key={label} className="bg-white rounded-xl p-3 border border-slate-100">
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                              <p className={`text-sm font-semibold ${highlight ? "text-green-700" : "text-slate-800"} ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Action bar */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/open-matches/${m.id}`} target="_blank"
                            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-1.5 transition-colors">
                            <ExternalLink className="w-3 h-3" /> View public lobby
                          </Link>
                          {m.status === "COLLECTING" && (
                            <button onClick={() => setCancelTarget(m)}
                              className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg px-3 py-1.5 transition-colors">
                              <XCircle className="w-3 h-3" /> Cancel lobby
                            </button>
                          )}
                          {m.spots.some((s) => s.status === "REFUNDED" && s.paymentStatus === "REFUNDED" && s.amountPaid > 0) && (
                            <button onClick={() => setTab("refunds")}
                              className="flex items-center gap-1.5 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                              <RotateCcw className="w-3 h-3" /> Pending refunds in this lobby
                            </button>
                          )}
                        </div>

                        {/* Players table */}
                        <div>
                          <p className="text-xs font-semibold text-slate-600 mb-2.5">Players ({m.spots.length})</p>
                          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                  {["Player", "Contact", "Spots", "Spot Status", "Payment", "Paid"].map((h) => (
                                    <th key={h} className="text-left px-3.5 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {m.spots.map((s) => {
                                  const pay = payStatusLabel(s);
                                  return (
                                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-3.5 py-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                                            {s.user.name.charAt(0).toUpperCase()}
                                          </div>
                                          <span className="font-medium text-slate-800">{s.user.name}</span>
                                        </div>
                                      </td>
                                      <td className="px-3.5 py-3 text-xs text-slate-500">
                                        <p>{s.user.email}</p>
                                        {s.user.phone && <p className="text-slate-400">{s.user.phone}</p>}
                                      </td>
                                      <td className="px-3.5 py-3 text-center">
                                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">{s.groupSize}</span>
                                      </td>
                                      <td className="px-3.5 py-3">
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${spotStatusStyle(s)}`}>{s.status}</span>
                                      </td>
                                      <td className="px-3.5 py-3">
                                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${pay.cls}`}>{pay.label}</span>
                                      </td>
                                      <td className="px-3.5 py-3 font-medium text-slate-700">
                                        {s.amountPaid > 0 ? fmt(s.amountPaid) : <span className="text-slate-300">—</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ REFUNDS ══════════════ */}
      {tab === "refunds" && (
        <div className="space-y-5">

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`rounded-2xl border p-5 ${refundSpots.length ? "bg-red-50 border-red-200" : "bg-white border-slate-100"}`}>
              <div className="flex items-center gap-2 mb-2">
                <RotateCcw className={`w-4 h-4 ${refundSpots.length ? "text-red-500" : "text-slate-400"}`} />
                <span className={`text-sm font-semibold ${refundSpots.length ? "text-red-700" : "text-slate-600"}`}>Pending Refunds</span>
              </div>
              <p className={`text-3xl font-bold ${refundSpots.length ? "text-red-700" : "text-slate-400"}`}>{refundSpots.length}</p>
              <p className={`text-xs mt-1 ${refundSpots.length ? "text-red-500" : "text-slate-400"}`}>
                {refundSpots.length ? `${fmt(refundTotal)} to send back` : "Nothing to do"}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-600">Total Owed</span>
              </div>
              <p className="text-3xl font-bold text-slate-800">{fmt(refundTotal)}</p>
              <p className="text-xs text-slate-400 mt-1">across {refundSpots.length} player spot{refundSpots.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm font-semibold text-slate-600">Cleared</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{clearedSpots.length}</p>
              <p className="text-xs text-slate-400 mt-1">refunds already processed</p>
            </div>
          </div>

          {refundSpots.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-16 flex flex-col items-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <p className="font-bold text-slate-800 text-lg mb-1">All refunds cleared!</p>
              <p className="text-sm text-slate-400 text-center max-w-xs">No players are waiting for a refund right now. Refunds appear here when a lobby expires or is cancelled.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold mb-0.5">Action required</p>
                  <p className="text-amber-700">These players paid for a lobby that expired or was cancelled. Transfer the refund via bank or PayHere, then click <strong>Mark Processed</strong> to notify them and clear the entry.</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Pending Refunds
                  </h3>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">{refundSpots.length} entries · {fmt(refundTotal)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {["Player", "Contact", "Lobby", "Sport / Date", "Amount Owed", "Action"].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {refundSpots.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center font-bold text-red-700 text-xs shrink-0">
                                {s.user.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-slate-800 whitespace-nowrap">{s.user.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-500">
                            <p>{s.user.email}</p>
                            {s.user.phone && <p className="text-slate-400 mt-0.5">{s.user.phone}</p>}
                          </td>
                          <td className="px-4 py-3.5">
                            <Link href={`/open-matches/${s.match.id}`} target="_blank"
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-mono">
                              {s.match.id.slice(0, 8)}… <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-slate-700 font-medium text-xs">{s.match.category.name}</p>
                            <p className="text-slate-400 text-[11px]">{fmtDateShort(s.match.preferredDate)}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-bold text-red-600 text-base">{fmt(s.amountPaid)}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <button onClick={() => markRefundProcessed(s.id)} disabled={processing === s.id}
                              className="flex items-center gap-1.5 text-xs text-white font-semibold bg-green-600 hover:bg-green-700 rounded-lg px-3 py-2 transition-colors whitespace-nowrap shadow-sm disabled:opacity-60">
                              {processing === s.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <CheckCircle2 className="w-3 h-3" />}
                              Mark Processed
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Cleared / history */}
          {clearedSpots.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> Processed History ({clearedSpots.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {["Player", "Email", "Sport", "Date", "Status"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {clearedSpots.map((s) => (
                      <tr key={s.id} className="opacity-70">
                        <td className="px-4 py-3 font-medium text-slate-600">{s.user.name}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{s.user.email}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{s.match.category.name}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{fmtDateShort(s.match.preferredDate)}</td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> Cleared
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ REVENUE ══════════════ */}
      {tab === "revenue" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total collected",      value: fmt(totalRevenue),   sub: `${matched.length} matched lobbies`,  icon: DollarSign,  bg: "bg-green-50",  ic: "text-green-600",  vl: "text-green-700"  },
              { label: "Court bookings",        value: fmt(matchedCourt),   sub: "paid to owners",                     icon: MapPin,      bg: "bg-slate-50",  ic: "text-slate-500",  vl: "text-slate-800"  },
              { label: "Service fee",           value: fmt(matched.reduce((s, m) => s + lobbyCourt(m) * m.serviceFeePct / 100, 0)),
                                                                            sub: `avg ${matched.length > 0 ? (matched.reduce((s, m) => s + m.serviceFeePct, 0) / matched.length).toFixed(1) : 0}% rate`, icon: TrendingUp,  bg: "bg-blue-50",   ic: "text-blue-600",   vl: "text-blue-700"   },
              { label: "Processing fees",       value: fmt(matched.reduce((s, m) => s + lobbyCourt(m) * 0.025, 0)),
                                                                            sub: "2.5% PayHere pass-through",          icon: Banknote,    bg: "bg-purple-50", ic: "text-purple-600", vl: "text-purple-700" },
            ].map(({ label, value, sub, icon: Icon, bg, ic, vl }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${bg}`}>
                  <Icon className={`w-4 h-4 ${ic}`} />
                </div>
                <p className={`text-2xl font-bold ${vl}`}>{value}</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {matched.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-16 flex flex-col items-center text-slate-300">
              <Banknote className="w-12 h-12 mb-3" />
              <p className="text-slate-500 font-semibold">No revenue yet</p>
              <p className="text-sm text-slate-400 mt-1">Revenue appears here once lobbies fill and match</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-green-500" /> Matched Lobby Revenue
                </h3>
                <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full font-semibold">
                  {matched.length} lobbies · {fmt(totalRevenue)} total
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {["Sport", "Facility", "Session", "Players", "Court", "Service", "Processing", "Total"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {matched.map((m) => {
                      const court  = lobbyCourt(m);
                      const svcFee = Math.round(court * m.serviceFeePct / 100);
                      const phFee  = Math.round(court * 0.025);
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center font-bold text-green-700 text-xs shrink-0">{m.category.name.charAt(0)}</div>
                              <span className="font-semibold text-slate-800 whitespace-nowrap">{m.category.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{m.facility.name}</td>
                          <td className="px-4 py-3.5 text-xs">
                            <p className="text-slate-600">{fmtDateShort(m.preferredDate)}</p>
                            <p className="text-slate-400">{m.preferredStartTime}–{m.preferredEndTime}</p>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold">{m.totalSpotsNeeded}</span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-700 font-medium whitespace-nowrap">{fmt(court)}</td>
                          <td className="px-4 py-3.5 text-blue-700 whitespace-nowrap">+{fmt(svcFee)}</td>
                          <td className="px-4 py-3.5 text-purple-700 whitespace-nowrap">+{fmt(phFee)}</td>
                          <td className="px-4 py-3.5">
                            <span className="font-bold text-green-700 whitespace-nowrap">{fmt(court + svcFee + phFee)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td colSpan={4} className="px-4 py-3.5 text-xs font-bold text-slate-600 uppercase tracking-wide">Total ({matched.length})</td>
                      <td className="px-4 py-3.5 font-bold text-slate-800 whitespace-nowrap">{fmt(matchedCourt)}</td>
                      <td className="px-4 py-3.5 font-bold text-blue-700 whitespace-nowrap">+{fmt(matched.reduce((s, m) => s + Math.round(lobbyCourt(m) * m.serviceFeePct / 100), 0))}</td>
                      <td className="px-4 py-3.5 font-bold text-purple-700 whitespace-nowrap">+{fmt(matched.reduce((s, m) => s + Math.round(lobbyCourt(m) * 0.025), 0))}</td>
                      <td className="px-4 py-3.5 font-bold text-green-700 text-base whitespace-nowrap">{fmt(totalRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Cancel confirmation modal ── */}
      {cancelTarget && (
        <ConfirmCancel
          lobbyName={`${cancelTarget.category.name} at ${cancelTarget.facility.name}`}
          onConfirm={doCancel}
          onCancel={() => setCancelTarget(null)}
          loading={cancelling}
        />
      )}

      {/* ── Toast ── */}
      {toast && <Toast type={toast.type} msg={toast.msg} onClose={() => setToast(null)} />}
    </div>
  );
}
