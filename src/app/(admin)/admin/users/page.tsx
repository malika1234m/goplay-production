"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { Users, Search, Loader2, UserCheck, Building2, Shield, Ban, CircleCheck, ChevronLeft, ChevronRight } from "lucide-react";

interface User {
  id:            string;
  name:          string;
  email:         string;
  phone:         string | null;
  role:          string;
  isActive:      boolean;
  createdAt:     string;
  totalBookings: number;
}

interface Counts { all: number; users: number; owners: number; admins: number }

const PER_PAGE = 25;

const ROLE_BADGE: Record<string, string> = {
  USER:          "bg-blue-50 text-blue-700",
  GROUND_OWNER:  "bg-amber-50 text-amber-700",
  ADMIN:         "bg-red-50 text-red-700",
  GROUND_WORKER: "bg-purple-50 text-purple-700",
};

const ROLE_ICON: Record<string, React.ElementType> = {
  USER:          UserCheck,
  GROUND_OWNER:  Building2,
  ADMIN:         Shield,
  GROUND_WORKER: UserCheck,
};

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users,    setUsers]    = useState<User[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [q,        setQ]        = useState("");
  const [role,     setRole]     = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [hasMore,  setHasMore]  = useState(false);
  const [counts,   setCounts]   = useState<Counts>({ all: 0, users: 0, owners: 0, admins: 0 });

  const load = useCallback(async (query: string, roleFilter: string, pageNum = 1) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query)       params.set("q",    query);
    if (roleFilter)  params.set("role", roleFilter);
    if (pageNum > 1) params.set("page", String(pageNum));
    const res  = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users ?? []);
    setTotal(data.total ?? 0);
    setHasMore(data.hasMore ?? false);
    setPage(pageNum);
    if (data.counts) setCounts(data.counts);
    setLoading(false);
  }, []);

  useEffect(() => { load("", ""); }, [load]);

  const initializedRef = useRef(false);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!initializedRef.current) { initializedRef.current = true; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { load(q, role, 1); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, role]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleActive = async (u: User) => {
    setToggling(u.id);
    const res = await fetch(`/api/admin/users/${u.id}/status`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive: !u.isActive }),
    });
    setToggling(null);
    if (res.ok) {
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to   = Math.min(page * PER_PAGE, total);

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
          { label: "Total Users",   value: counts.all,    icon: Users,    color: "bg-blue-50 text-blue-600",   roleKey: ""             },
          { label: "Players",       value: counts.users,  icon: UserCheck,color: "bg-green-50 text-green-600", roleKey: "USER"         },
          { label: "Ground Owners", value: counts.owners, icon: Building2,color: "bg-amber-50 text-amber-600", roleKey: "GROUND_OWNER" },
          { label: "Admins",        value: counts.admins, icon: Shield,   color: "bg-red-50 text-red-600",     roleKey: "ADMIN"        },
        ].map(({ label, value, icon: Icon, color, roleKey }) => {
          const active = role === roleKey;
          return (
            <button
              key={label}
              onClick={() => setRole(active && roleKey !== "" ? "" : roleKey)}
              className={`bg-white rounded-2xl border p-5 text-left transition-all ${
                active ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-100 hover:border-slate-200 hover:shadow-sm"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs text-slate-500 mt-1">{label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-600"
        >
          <option value="">All Roles</option>
          <option value="USER">Players</option>
          <option value="GROUND_OWNER">Ground Owners</option>
          <option value="ADMIN">Admins</option>
        </select>
        {(q || role) && (
          <button
            onClick={() => { setQ(""); setRole(""); }}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-xl transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="text-base font-semibold text-slate-900">
            Users{" "}
            <span className="text-slate-400 font-normal text-sm">
              {total > 0 ? `(${from}–${to} of ${total})` : "(0)"}
            </span>
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
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => {
                  const RoleIcon = ROLE_ICON[u.role] ?? UserCheck;
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
                          {u.role === "GROUND_OWNER" ? "Ground Owner" : u.role === "GROUND_WORKER" ? "Ground Worker" : u.role.charAt(0) + u.role.slice(1).toLowerCase()}
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
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                          u.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                        }`}>
                          {u.isActive ? (
                            <><CircleCheck className="w-3 h-3" /> Active</>
                          ) : (
                            <><Ban className="w-3 h-3" /> Deactivated</>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {u.role !== "ADMIN" && u.id !== session?.user?.id && (
                          <button
                            onClick={() => toggleActive(u)}
                            disabled={toggling === u.id}
                            title={u.isActive ? "Deactivate user" : "Activate user"}
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                              u.isActive
                                ? "border-red-200 text-red-600 hover:bg-red-50"
                                : "border-green-200 text-green-600 hover:bg-green-50"
                            }`}
                          >
                            {toggling === u.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : u.isActive ? (
                              <><Ban className="w-3 h-3" /> Deactivate</>
                            ) : (
                              <><CircleCheck className="w-3 h-3" /> Activate</>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && total > PER_PAGE && (
          <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-slate-400">
              Showing {from}–{to} of {total} users
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => load(q, role, page - 1)}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <span className="text-xs text-slate-500 px-1">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => load(q, role, page + 1)}
                disabled={!hasMore}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
