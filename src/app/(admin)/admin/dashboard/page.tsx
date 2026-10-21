"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Users, DollarSign, MapPin, TrendingUp, Loader2, UserPlus, CheckCircle, RefreshCw, CalendarDays, BadgeDollarSign, Landmark, ChevronRight, ShieldCheck, Wallet, Info } from "lucide-react";
import MoneyTrendChart from "@/components/admin/MoneyTrendChart";

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

/** GoPlay's money (see src/lib/admin-finance.ts). Booking value is the grounds' money, paid to them directly. */
interface Finance {
  goplay:       { total: number; month: number; lastMonth: number; change: number | null };
  commission:   { total: number; month: number; outstanding: number; collected: number };
  lobbyMargin:  { total: number; month: number };
  bookingValue: { total: number; month: number; change: number | null; bookings: number };
  lobbyHeld:    { payoutsDue: number; inOpenLobbies: number };
}

const rs  = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const pct = (n: number | null) => (n === null ? "no data last month" : `${n >= 0 ? "+" : ""}${n}% vs last month`);

interface LobbyTasks { receiptsToCheck: number; payoutsDue: number; payoutsDueTotal: number; refundsDue: number; refundsDueTotal: number; bankAccountSet: boolean }

const ROLE_STYLE: Record<string, string> = {
  USER:          "bg-blue-50 text-blue-700",
  GROUND_OWNER:  "bg-amber-50 text-amber-700",
  ADMIN:         "bg-red-50 text-red-700",
  GROUND_WORKER: "bg-purple-50 text-purple-700",
};

export default function AdminDashboardPage() {
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [finance,    setFinance]    = useState<Finance | null>(null);
  const [chartKey,   setChartKey]   = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [lobby,      setLobby]      = useState<LobbyTasks | null>(null);
  const [trust,      setTrust]      = useState<{ reportsToReview: number; disputed: number; unresolved: number } | null>(null);

  const loadLobby = useCallback(async () => {
    try {
      const d = await (await fetch("/api/admin/lobby-payments", { cache: "no-store" })).json();
      if (d.summary) setLobby({ ...d.summary, bankAccountSet: d.bankAccountSet });
      const t = await (await fetch("/api/admin/trust", { cache: "no-store" })).json();
      if (t.summary) setTrust(t.summary);
    } catch { /* keep the last value */ }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/users?role=").then((r) => r.json()).catch(() => ({})),
    ]).then(([s, u]) => {
      setStats(s.stats ?? null);
      setFinance(s.finance ?? null);
      setRecentUsers((u.users ?? []).slice(0, 8));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { void loadLobby(); }, [loadLobby]);

  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, u] = await Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/admin/users?role=").then((r) => r.json()).catch(() => ({})),
      ]);
      setStats(s.stats ?? null);
      setFinance(s.finance ?? null);
      setRecentUsers((u.users ?? []).slice(0, 8));
      setChartKey((k) => k + 1);
      void loadLobby();
    } finally {
      setRefreshing(false);
    }
  }, [loadLobby]);

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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">Platform-wide stats and recent activity</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Open match money waiting on an admin */}
      {lobby && (lobby.receiptsToCheck + lobby.payoutsDue + lobby.refundsDue > 0 || !lobby.bankAccountSet) && (
        <Link href={lobby.bankAccountSet ? "/admin/lobby-payments" : "/admin/settings"}
          className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 hover:bg-amber-100/60 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><Landmark className="w-5 h-5 text-amber-700" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">{lobby.bankAccountSet ? "Lobby payments need attention" : "Set GoPlay's bank account to enable open matches"}</p>
            {lobby.bankAccountSet && (
              <p className="text-xs text-amber-800 mt-0.5">
                {[
                  lobby.receiptsToCheck > 0 && `${lobby.receiptsToCheck} receipt${lobby.receiptsToCheck > 1 ? "s" : ""} to check`,
                  lobby.payoutsDue > 0 && `${lobby.payoutsDue} payout${lobby.payoutsDue > 1 ? "s" : ""} due (Rs. ${Math.round(lobby.payoutsDueTotal).toLocaleString()})`,
                  lobby.refundsDue > 0 && `${lobby.refundsDue} refund${lobby.refundsDue > 1 ? "s" : ""} due (Rs. ${Math.round(lobby.refundsDueTotal).toLocaleString()})`,
                ].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-amber-700" />
        </Link>
      )}

      {/* No-shows and unsettled cash bookings waiting on an admin */}
      {trust && trust.reportsToReview + trust.unresolved > 0 && (
        <Link href="/admin/trust" className="flex items-center gap-4 bg-purple-50 border border-purple-200 rounded-2xl px-5 py-4 hover:bg-purple-100/60 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5 text-purple-700" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-purple-900">Cash bookings need review</p>
            <p className="text-xs text-purple-800 mt-0.5">
              {[
                trust.reportsToReview > 0 && `${trust.reportsToReview} no-show report${trust.reportsToReview > 1 ? "s" : ""}${trust.disputed ? ` (${trust.disputed} disputed)` : ""}`,
                trust.unresolved > 0 && `${trust.unresolved} unsettled cash booking${trust.unresolved > 1 ? "s" : ""}`,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-purple-700" />
        </Link>
      )}

      {/* Stat cards — GoPlay's own money first; booking value belongs to the grounds */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "GoPlay Earnings",
            value: rs(finance?.goplay.month ?? 0),
            sub:   `this month · ${pct(finance?.goplay.change ?? null)}`,
            icon:  BadgeDollarSign,
            color: "bg-green-50 text-green-600",
            href:  "/admin/earnings",
          },
          {
            label: "Commission Owed",
            value: rs(finance?.commission.outstanding ?? 0),
            sub:   "grounds still to settle",
            icon:  Wallet,
            color: (finance?.commission.outstanding ?? 0) > 0 ? "bg-orange-50 text-orange-600" : "bg-slate-50 text-slate-500",
            href:  "/admin/commissions",
          },
          {
            label: "Booking Value",
            value: rs(finance?.bookingValue.month ?? 0),
            sub:   "this month · paid to grounds directly",
            icon:  DollarSign,
            color: "bg-blue-50 text-blue-600",
            href:  "/admin/earnings",
          },
          {
            label: "Total Users",
            value: (stats?.totalUsers ?? 0).toLocaleString(),
            sub:   `+${stats?.newUsersThisMonth ?? 0} this month`,
            icon:  Users,
            color: "bg-indigo-50 text-indigo-600",
            href:  "/admin/users",
          },
          {
            label: "Active Grounds",
            value: stats?.activeGrounds ?? 0,
            sub:   `${stats?.pendingGrounds ?? 0} pending approval`,
            icon:  MapPin,
            color: "bg-purple-50 text-purple-600",
            href:  "/admin/grounds",
          },
        ].map(({ label, value, sub, icon: Icon, color, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-white rounded-2xl border border-slate-100 p-5 hover:border-slate-200 hover:shadow-sm transition-all"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </Link>
        ))}
      </div>

      {/* How money moves */}
      {finance && (
        <div className="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs text-slate-600">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p>
            Players pay grounds directly, so booking value is the grounds&apos; money. GoPlay earns commission
            ({rs(finance.commission.month)} this month, {rs(finance.commission.collected)} collected so far) and the open match
            margin ({rs(finance.lobbyMargin.month)} this month).
            {(finance.lobbyHeld.payoutsDue + finance.lobbyHeld.inOpenLobbies) > 0 && (
              <> GoPlay is holding {rs(finance.lobbyHeld.payoutsDue + finance.lobbyHeld.inOpenLobbies)} of lobby money:{" "}
                {rs(finance.lobbyHeld.payoutsDue)} to pay grounds and {rs(finance.lobbyHeld.inOpenLobbies)} in lobbies still filling.</>
            )}
          </p>
        </div>
      )}

      {/* Chart + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MoneyTrendChart key={chartKey} />
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-5">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Users",       href: "/admin/users",     icon: Users,        color: "bg-blue-50 text-blue-600"    },
              { label: "Grounds",     href: "/admin/grounds",   icon: MapPin,       color: "bg-green-50 text-green-600"  },
              { label: "Bookings",    href: "/admin/bookings",  icon: CalendarDays, color: "bg-purple-50 text-purple-600"},
              { label: "Analytics",   href: "/admin/analytics", icon: TrendingUp,   color: "bg-amber-50 text-amber-600"  },
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
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">User</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide hidden sm:table-cell">Joined</th>
                  <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Bookings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 sm:px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0">
                          {u.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{u.name}</p>
                          <p className="text-xs text-slate-400 truncate hidden sm:block">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_STYLE[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                        {u.role === "GROUND_OWNER" ? "Owner" : u.role === "GROUND_WORKER" ? "Worker" : u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 text-slate-500 text-xs hidden sm:table-cell">
                      {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 sm:px-6 py-3.5 text-slate-600 text-xs font-medium">
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
