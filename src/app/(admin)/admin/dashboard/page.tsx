"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Users, DollarSign, MapPin, TrendingUp, Loader2, UserPlus, CheckCircle } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

interface Stats {
  totalUsers:      number;
  newUsersThisMonth: number;
  usersChange:     number;
  totalRevenue:    number;
  monthlyRevenue:  number;
  revenueChange:   number;
  activeGrounds:   number;
  pendingGrounds:  number;
}

interface RecentUser {
  id:            string;
  name:          string;
  email:         string;
  role:          string;
  createdAt:     string;
  totalBookings: number;
}

interface ChartPoint { label: string; revenue: number }

const ROLE_STYLE: Record<string, string> = {
  USER:         "bg-blue-50 text-blue-700",
  GROUND_OWNER: "bg-amber-50 text-amber-700",
  ADMIN:        "bg-red-50 text-red-700",
};

export default function AdminDashboardPage() {
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [chartData,  setChartData]  = useState<ChartPoint[]>([]);
  const [chartDays,  setChartDays]  = useState(30);
  const [loading,    setLoading]    = useState(true);

  const loadChart = useCallback(async (days: number) => {
    try {
      const res  = await fetch(`/api/admin/earnings/trends?days=${days}`);
      const data = await res.json();
      const labels:  string[] = data.trends?.labels  ?? [];
      const revenue: number[] = data.trends?.revenue ?? [];
      setChartData(labels.map((l, i) => ({ label: l, revenue: revenue[i] ?? 0 })));
    } catch {
      // keep existing chart data on network error
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/users?role=").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/earnings/trends?days=30").then((r) => r.json()).catch(() => ({})),
    ]).then(([s, u, t]) => {
      setStats(s.stats ?? null);
      setRecentUsers((u.users ?? []).slice(0, 8));
      const labels:  string[] = t.trends?.labels  ?? [];
      const revenue: number[] = t.trends?.revenue ?? [];
      setChartData(labels.map((l: string, i: number) => ({ label: l, revenue: revenue[i] ?? 0 })));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadChart(chartDays); }, [chartDays, loadChart]);

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
        <p className="text-slate-500 text-sm mt-0.5">Platform-wide stats and recent activity</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Users",
            value: (stats?.totalUsers ?? 0).toLocaleString(),
            sub:   `+${stats?.newUsersThisMonth ?? 0} this month`,
            icon:  Users,
            color: "bg-blue-50 text-blue-600",
          },
          {
            label: "Total Revenue",
            value: `Rs. ${(stats?.totalRevenue ?? 0).toLocaleString()}`,
            sub:   `Rs. ${(stats?.monthlyRevenue ?? 0).toLocaleString()} this month`,
            icon:  DollarSign,
            color: "bg-green-50 text-green-600",
          },
          {
            label: "Active Grounds",
            value: stats?.activeGrounds ?? 0,
            sub:   `${stats?.pendingGrounds ?? 0} pending approval`,
            icon:  MapPin,
            color: "bg-purple-50 text-purple-600",
          },
          {
            label: "Revenue Change",
            value: `${stats?.revenueChange ?? 0 >= 0 ? "+" : ""}${stats?.revenueChange ?? 0}%`,
            sub:   "vs last month",
            icon:  TrendingUp,
            color: "bg-amber-50 text-amber-600",
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-slate-900">Revenue Trend</h2>
            <select
              value={chartDays}
              onChange={(e) => setChartDays(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value={7}>7 Days</option>
              <option value={30}>30 Days</option>
              <option value={90}>90 Days</option>
            </select>
          </div>
          <div className="h-56">
            {chartData.every((d) => d.revenue === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                <TrendingUp className="w-8 h-8" />
                <p className="text-sm">No revenue data for this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `Rs.${(v / 1000).toFixed(0)}k`} width={52} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(v) => [`Rs. ${Number(v ?? 0).toLocaleString()}`, "Revenue"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#adminRevGrad)" dot={false} activeDot={{ r: 5, fill: "#3b82f6" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-5">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Manage Users",    href: "/admin/users",   icon: Users,       color: "bg-blue-50 text-blue-600"   },
              { label: "Approve Grounds", href: "/admin/grounds", icon: CheckCircle, color: "bg-green-50 text-green-600" },
              { label: "New Users",       href: "/admin/users",   icon: UserPlus,    color: "bg-purple-50 text-purple-600"},
              { label: "Analytics",       href: "/admin/analytics",icon: TrendingUp, color: "bg-amber-50 text-amber-600" },
            ].map(({ label, href, icon: Icon, color }) => (
              <Link
                key={label}
                href={href}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-center"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-slate-700">{label}</span>
              </Link>
            ))}
          </div>

          {stats && stats.pendingGrounds > 0 && (
            <Link
              href="/admin/grounds?status=PENDING"
              className="mt-4 flex items-center gap-2 w-full px-4 py-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors"
            >
              <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">
                  {stats.pendingGrounds} ground{stats.pendingGrounds !== 1 ? "s" : ""} pending
                </p>
                <p className="text-xs text-amber-600">Click to review</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Recent registrations */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Recent Registrations</h2>
          <Link href="/admin/users" className="text-xs text-blue-600 hover:underline font-medium">
            View All
          </Link>
        </div>

        {recentUsers.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">No users yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">User</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Role</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Joined</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Bookings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                          {u.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{u.name}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_STYLE[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                        {u.role === "GROUND_OWNER" ? "Ground Owner" : u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 text-xs">
                      {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 text-xs font-medium">
                      {u.totalBookings}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
