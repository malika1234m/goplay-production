"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  DollarSign, CalendarCheck, Building2, Star,
  Clock, ChevronRight, Check, X, Loader2, TrendingUp,
  MapPin, Wrench, CreditCard, Banknote,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

/* ── Types ──────────────────────────────────────────────── */
interface Stats {
  monthlyRevenue: number;
  totalBookings:  number;
  activeGrounds:  number;
  totalGrounds:   number;
  avgRating:      number | null;
  totalReviews:   number;
}

interface TodayBooking {
  id:            string;
  userName:      string;
  facilityName:  string;
  courtName:     string | null;
  startTime:     string;
  endTime:       string;
  totalAmount:   number;
  status:        string;
  paymentMethod: string;
  paymentStatus: string;
}

interface PendingBooking {
  id:           string;
  userName:     string;
  facilityName: string;
  bookingDate:  string;
  startTime:    string;
  endTime:      string;
  totalAmount:  number;
  createdAt:    string;
}

interface GroundPerf {
  id:            string;
  name:          string;
  totalBookings: number;
  avgRating:     number | null;
  totalRevenue?: number;
}

interface Review {
  id:           string;
  rating:       number;
  reviewText:   string | null;
  createdAt:    string;
  userName:     string;
  facilityName: string;
}

interface ChartPoint { label: string; revenue: number }

const statusStyles: Record<string, string> = {
  PENDING:   "bg-amber-50 text-amber-700 border-amber-100",
  CONFIRMED: "bg-green-50 text-green-700 border-green-100",
  COMPLETED: "bg-slate-100 text-slate-600 border-slate-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-100",
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ── Dashboard ──────────────────────────────────────────── */
export default function GroundOwnerDashboard() {
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [todayList,   setTodayList]   = useState<TodayBooking[]>([]);
  const [pending,     setPending]     = useState<PendingBooking[]>([]);
  const [performance, setPerformance] = useState<GroundPerf[]>([]);
  const [reviews,     setReviews]     = useState<Review[]>([]);
  const [chartData,   setChartData]   = useState<ChartPoint[]>([]);
  const [chartDays,   setChartDays]   = useState(30);
  const [loading,     setLoading]     = useState(true);
  const [updatingId,  setUpdatingId]  = useState<string | null>(null);

  /* ── Fetch stats + today + performance ─── */
  const loadStats = useCallback(async () => {
    const res  = await fetch("/api/ground-owner/stats");
    const data = await res.json();
    if (!res.ok) return;
    setStats(data.stats);
    setTodayList(data.todayBookings ?? []);
  }, []);

  /* ── Fetch pending bookings ─── */
  const loadPending = useCallback(async () => {
    const res  = await fetch("/api/ground-owner/bookings?status=PENDING");
    const data = await res.json();
    setPending(
      (data.bookings ?? []).slice(0, 5).map((b: any) => ({
        id:           b.id,
        userName:     b.user.name,
        facilityName: b.facility.name,
        bookingDate:  b.bookingDate,
        startTime:    b.startTime,
        endTime:      b.endTime,
        totalAmount:  b.totalAmount,
        createdAt:    b.createdAt,
      }))
    );
  }, []);

  /* ── Fetch grounds with performance data ─── */
  const loadPerformance = useCallback(async () => {
    const res  = await fetch("/api/ground-owner/grounds");
    const data = await res.json();
    if (!res.ok) return;
    const grounds: GroundPerf[] = (data.grounds ?? []).map((g: any) => ({
      id:            g.id,
      name:          g.name,
      totalBookings: g.totalBookings,
      avgRating:     g.avgRating,
      totalRevenue:  (g.totalBookings ?? 0) * (g.hourlyRate ?? 0),
    }));
    setPerformance(grounds.slice(0, 5));
  }, []);

  /* ── Fetch recent reviews ─── */
  const loadReviews = useCallback(async () => {
    const res  = await fetch("/api/ground-owner/reviews?limit=3");
    const data = await res.json();
    setReviews(data.reviews ?? []);
  }, []);

  /* ── Fetch earnings chart ─── */
  const loadChart = useCallback(async (days: number) => {
    const res  = await fetch(`/api/ground-owner/earnings/trends?days=${days}`);
    const data = await res.json();
    const labels:  string[] = data.trends?.labels  ?? [];
    const revenue: number[] = data.trends?.revenue ?? [];
    setChartData(labels.map((l, i) => ({ label: l, revenue: revenue[i] ?? 0 })));
  }, []);

  /* ── Boot ─── */
  useEffect(() => {
    Promise.allSettled([
      loadStats(),
      loadPending(),
      loadPerformance(),
      loadReviews(),
    ]).finally(() => setLoading(false));
    loadChart(30);
  }, [loadStats, loadPending, loadPerformance, loadReviews, loadChart]);

  useEffect(() => { loadChart(chartDays); }, [chartDays, loadChart]);

  /* ── Approve / decline pending ─── */
  const updateStatus = async (id: string, status: "CONFIRMED" | "CANCELLED") => {
    setUpdatingId(id);
    const res = await fetch(`/api/ground-owner/bookings/${id}/status`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    setUpdatingId(null);
    if (res.ok) {
      setPending((p) => p.filter((b) => b.id !== id));
      loadStats();
    }
  };

  /* ── Derived ─── */
  const maxRevenue = Math.max(...performance.map((g) => g.totalRevenue ?? 0), 1);

  const statCards = [
    {
      label: "Monthly Earnings",
      value: `Rs. ${(stats?.monthlyRevenue ?? 0).toLocaleString()}`,
      sub:   `Rs. ${(stats?.monthlyRevenue ?? 0).toLocaleString()} this month`,
      icon:  DollarSign,
      color: "bg-green-50 text-green-600",
    },
    {
      label: "Total Bookings",
      value: stats?.totalBookings ?? "—",
      sub:   "all time",
      icon:  CalendarCheck,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Active Grounds",
      value: stats?.activeGrounds ?? "—",
      sub:   `${stats?.totalGrounds ?? 0} total grounds`,
      icon:  Building2,
      color: "bg-purple-50 text-purple-600",
    },
    {
      label: "Avg Rating",
      value: stats?.avgRating ? `${stats.avgRating} ★` : "—",
      sub:   `${stats?.totalReviews ?? 0} review${stats?.totalReviews !== 1 ? "s" : ""}`,
      icon:  Star,
      color: "bg-amber-50 text-amber-600",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Your ground business overview</p>
        </div>
        <Link
          href="/ground-owner/grounds/new"
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shrink-0"
        >
          + Add Ground
        </Link>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-400 mt-1">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Earnings Chart — spans 2 cols */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-slate-900">Earnings Overview</h2>
            <select
              value={chartDays}
              onChange={(e) => setChartDays(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value={7}>7 Days</option>
              <option value={30}>30 Days</option>
              <option value={90}>90 Days</option>
            </select>
          </div>
          <div className="h-56">
            {chartData.every((d) => d.revenue === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                <TrendingUp className="w-10 h-10" />
                <p className="text-sm">No earnings data for this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `Rs.${(v / 1000).toFixed(0)}k`}
                    width={52}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                    formatter={(v) => [`Rs. ${Number(v ?? 0).toLocaleString()}`, "Earnings"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#16a34a"
                    strokeWidth={2.5}
                    fill="url(#earningsGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#16a34a" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Today's Bookings */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="text-base font-semibold text-slate-900">Today&apos;s Bookings</h2>
            <Link href="/ground-owner/bookings" className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {todayList.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CalendarCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No bookings today</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {todayList.map((b) => (
                <div key={b.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{b.facilityName}</p>
                      <p className="text-xs text-slate-500 truncate">{b.userName}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {b.startTime} – {b.endTime}
                      </div>
                      {b.courtName && (
                        <span className="mt-0.5 inline-flex items-center text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                          {b.courtName}
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyles[b.status] ?? ""}`}>
                        {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                      </span>
                      <div className="mt-1 flex items-center justify-end gap-1">
                        {b.paymentMethod === "ONLINE"
                          ? <CreditCard className="w-3 h-3 text-blue-500" />
                          : <Banknote    className="w-3 h-3 text-green-600" />}
                        <span className={`text-xs ${b.paymentMethod === "ONLINE" ? "text-blue-600" : "text-green-700"}`}>
                          {b.paymentMethod === "ONLINE"
                            ? b.paymentStatus === "PAID" ? "Paid" : "Awaiting"
                            : "On Arrival"}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">Rs. {b.totalAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ground Performance */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-slate-900">Ground Performance</h2>
            <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-full">This Month</span>
          </div>
          {performance.length === 0 ? (
            <div className="py-8 text-center">
              <Building2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No performance data yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {performance.map((g) => {
                const pct = Math.round(((g.totalRevenue ?? 0) / maxRevenue) * 100);
                return (
                  <div key={g.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-slate-800 truncate pr-2">{g.name}</p>
                      <div className="flex items-center gap-2 shrink-0 text-xs text-slate-400">
                        <span>{g.totalBookings} bookings</span>
                        {g.avgRating && (
                          <span className="flex items-center gap-0.5 text-amber-500">
                            <Star className="w-3 h-3 fill-amber-400" /> {g.avgRating}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Rs. {(g.totalRevenue ?? 0).toLocaleString()}
                      <span className="ml-1 text-slate-300">({pct}%)</span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Pending Approvals</h2>
              {pending.length > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {pending.length}
                </span>
              )}
            </div>
            <Link href="/ground-owner/bookings?status=PENDING" className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {pending.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Check className="w-8 h-8 text-green-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">All caught up!</p>
              <p className="text-xs text-slate-300 mt-0.5">No pending bookings</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {pending.map((b) => (
                <div key={b.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{b.userName}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <MapPin className="w-3 h-3" /> {b.facilityName}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(b.bookingDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        &nbsp;·&nbsp;{b.startTime} – {b.endTime}
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">{timeAgo(b.createdAt)}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => updateStatus(b.id, "CONFIRMED")}
                        disabled={updatingId === b.id}
                        className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {updatingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus(b.id, "CANCELLED")}
                        disabled={updatingId === b.id}
                        className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <X className="w-3 h-3" /> Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/ground-owner/grounds",      icon: Building2,     label: "My Grounds",  color: "bg-green-50 text-green-700 hover:bg-green-100" },
              { href: "/ground-owner/bookings",      icon: CalendarCheck, label: "Bookings",    color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
              { href: "/ground-owner/availability",  icon: Clock,         label: "Availability", color: "bg-purple-50 text-purple-700 hover:bg-purple-100" },
              { href: "/ground-owner/maintenance",   icon: Wrench,        label: "Maintenance", color: "bg-orange-50 text-orange-700 hover:bg-orange-100" },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-transparent text-sm font-medium transition-colors ${color}`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs text-center">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Reviews */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="text-base font-semibold text-slate-900">Recent Reviews</h2>
            <Link href="/ground-owner/reviews" className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {reviews.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Star className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No reviews yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {reviews.map((r) => (
                <div key={r.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="w-9 h-9 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                    {r.userName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div>
                        <span className="text-sm font-medium text-slate-900">{r.userName}</span>
                        <span className="text-xs text-slate-400 ml-2">{r.facilityName}</span>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{timeAgo(r.createdAt)}</span>
                    </div>
                    <div className="flex gap-0.5 mb-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${s <= r.rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"}`}
                        />
                      ))}
                    </div>
                    {r.reviewText && (
                      <p className="text-sm text-slate-600 line-clamp-2">&ldquo;{r.reviewText}&rdquo;</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
