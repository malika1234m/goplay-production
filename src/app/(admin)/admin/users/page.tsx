"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Search, Loader2, UserCheck, UserX, Building2, Shield } from "lucide-react";

interface User {
  id:            string;
  name:          string;
  email:         string;
  phone:         string | null;
  role:          string;
  createdAt:     string;
  totalBookings: number;
}

const ROLE_BADGE: Record<string, string> = {
  USER:         "bg-blue-50 text-blue-700",
  GROUND_OWNER: "bg-amber-50 text-amber-700",
  ADMIN:        "bg-red-50 text-red-700",
};

const ROLE_ICON: Record<string, React.ElementType> = {
  USER:         UserCheck,
  GROUND_OWNER: Building2,
  ADMIN:        Shield,
};

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [q,       setQ]       = useState("");
  const [role,    setRole]    = useState("");

  const load = useCallback(async (query: string, roleFilter: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query)      params.set("q",    query);
    if (roleFilter) params.set("role", roleFilter);
    const res  = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load("", ""); }, [load]);

  const totals = {
    all:    users.length,
    users:  users.filter((u) => u.role === "USER").length,
    owners: users.filter((u) => u.role === "GROUND_OWNER").length,
    admins: users.filter((u) => u.role === "ADMIN").length,
  };

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage all registered users and their roles</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Users",    value: totals.all,    icon: Users,    color: "bg-blue-50 text-blue-600"   },
          { label: "Players",        value: totals.users,  icon: UserCheck,color: "bg-green-50 text-green-600" },
          { label: "Ground Owners",  value: totals.owners, icon: Building2,color: "bg-amber-50 text-amber-600" },
          { label: "Admins",         value: totals.admins, icon: Shield,   color: "bg-red-50 text-red-600"     },
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

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(q, role); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-600"
        >
          <option value="">All Roles</option>
          <option value="USER">Players</option>
          <option value="GROUND_OWNER">Ground Owners</option>
          <option value="ADMIN">Admins</option>
        </select>
        <button
          onClick={() => load(q, role)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Search
        </button>
        <button
          onClick={() => { setQ(""); setRole(""); load("", ""); }}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="text-base font-semibold text-slate-900">
            Users <span className="text-slate-400 font-normal text-sm">({users.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : users.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">User</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Role</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Phone</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Joined</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Bookings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => {
                  const RoleIcon = ROLE_ICON[u.role] ?? UserX;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-bold shrink-0">
                            {u.name?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_BADGE[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                          <RoleIcon className="w-3 h-3" />
                          {u.role === "GROUND_OWNER" ? "Ground Owner" : u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 text-xs">{u.phone ?? "—"}</td>
                      <td className="px-6 py-3.5 text-slate-500 text-xs">
                        {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
                          {u.totalBookings}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
