"use client";

import { useState, useEffect } from "react";
import { Loader2, Users, MapPin, CalendarCheck, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface Stats {
  totalUsers:        number;
  newUsersThisMonth: number;
  activeGrounds:     number;
  totalRevenue:      number;
  monthlyRevenue:    number;
  revenueChange:     number;
}

interface TrendPoint { date: string; revenue: number }

export default function AdminAnalyticsPage() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [trends,  setTrends]  = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch("/api/admin/earnings/trends").then((r) => r.json()),
    ]).then(([s, t]) => {
      setStats(s.stats ?? null);
      setTrends(t.trends ?? []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading analytics…</span>
      </div>
    );
  }

  // Aggregate by month from daily trends
  const monthly: Record<string, number> = {};
  trends.forEach(({ date, revenue }) => {
    const month = date.slice(0, 7); // YYYY-MM
    monthly[month] = (monthly[month] ?? 0) + revenue;
  });
  const monthlyData = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, revenue]) => ({
      label: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      revenue,
    }));

  const last30 = trends.slice(-30);

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Platform-wide performance overview</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Users",       value: stats?.totalUsers        ?? 0, sub: `+${stats?.newUsersThisMonth ?? 0} this month`, icon: Users,        color: "bg-blue-50 text-blue-600" },
          { label: "Active Grounds",    value: stats?.activeGrounds     ?? 0, sub: "Currently live",                               icon: MapPin,        color: "bg-green-50 text-green-600" },
          { label: "Monthly Revenue",   value: `Rs. ${(stats?.monthlyRevenue ?? 0).toLocaleString()}`, sub: `${stats?.revenueChange ?? 0 >= 0 ? "+" : ""}${stats?.revenueChange ?? 0}% vs last month`, icon: TrendingUp, color: "bg-purple-50 text-purple-600" },
          { label: "Total Revenue",     value: `Rs. ${(stats?.totalRevenue ?? 0).toLocaleString()}`,   sub: "All time",                                  icon: CalendarCheck, color: "bg-amber-50 text-amber-600" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Daily revenue — last 30 days */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-5">Daily Revenue — Last 30 Days</h2>
        {last30.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={last30} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `Rs.${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: unknown) => [`Rs. ${Number(v).toLocaleString()}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly revenue bar chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-5">Monthly Revenue — Last 6 Months</h2>
        {monthlyData.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `Rs.${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: unknown) => [`Rs. ${Number(v).toLocaleString()}`, "Revenue"]} />
              <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
