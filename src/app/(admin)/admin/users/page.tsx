"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Users, Search, Loader2, UserCheck, Building2, Shield, Ban, HardHat, ChevronLeft, ChevronRight, X } from "lucide-react";
import UserDrawer, { ROLE_LABEL } from "@/components/admin/UserDrawer";

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

interface Counts { all: number; users: number; owners: number; admins: number; workers: number; inactive: number }

const PER_PAGE = 25;

const ROLE_BADGE: Record<string, string> = {
  USER:          "bg-blue-50 text-blue-700",
  GROUND_OWNER:  "bg-amber-50 text-amber-800",
  ADMIN:         "bg-red-50 text-red-700",
  GROUND_WORKER: "bg-purple-50 text-purple-700",
};

const ROLE_ICON: Record<string, React.ElementType> = {
  USER:          UserCheck,
  GROUND_OWNER:  Building2,
  ADMIN:         Shield,
  GROUND_WORKER: HardHat,
};

function UsersContent() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const openId   = params.get("user");

  const [input,   setInput]   = useState("");
  const [q,       setQ]       = useState("");
  const [role,    setRoleF]   = useState(params.get("role") ?? "");
  const [state,   setStateF]  = useState("");
  const [page,    setPage]    = useState(1);
  const [nonce,   setNonce]   = useState(0);

  useEffect(() => {
    const t = setTimeout(() => { setQ(input.trim()); if (input.trim() !== q) setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [input, q]);

  type Res = { users: User[]; total: number; hasMore: boolean; counts: Counts };
  const query = new URLSearchParams({ ...(q && { q }), ...(role && { role }), ...(state && { state }), ...(page > 1 && { page: String(page) }) }).toString();
  const key   = `${query}#${nonce}`;
  const [result, setResult] = useState<{ key: string; data?: Res; error?: string } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res  = await fetch(`/api/admin/users?${query}`, { cache: "no-store" });
        const json = await res.json();
        if (live) setResult(res.ok ? { key, data: json } : { key, error: json.error ?? "Couldn't load accounts.", data: result?.data });
      } catch {
        if (live) setResult({ key, error: "Couldn't reach the server. Check your connection and refresh.", data: result?.data });
      }
    })();
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = result?.key !== key;
  const error   = result?.key === key ? result.error ?? "" : "";
  const users   = result?.data?.users ?? [];
  const total   = result?.data?.total ?? 0;
  const hasMore = result?.data?.hasMore ?? false;
  const counts  = result?.data?.counts ?? { all: 0, users: 0, owners: 0, admins: 0, workers: 0, inactive: 0 };
  const load    = () => setNonce((n) => n + 1);

  const openUser = (id: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("user", id); else next.delete("user");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to   = Math.min(page * PER_PAGE, total);
  const filtered = !!(q || role || state);
  const clear = () => { setInput(""); setQ(""); setRoleF(""); setStateF(""); setPage(1); };

  const cards = [
    { label: "Everyone",      value: counts.all,      icon: Users,     color: "bg-slate-100 text-slate-700", roleKey: "",              stateKey: "" },
    { label: "Players",       value: counts.users,    icon: UserCheck, color: "bg-blue-50 text-blue-600",    roleKey: "USER",          stateKey: "" },
    { label: "Ground owners", value: counts.owners,   icon: Building2, color: "bg-amber-50 text-amber-700",  roleKey: "GROUND_OWNER",  stateKey: "" },
    { label: "Ground workers",value: counts.workers,  icon: HardHat,   color: "bg-purple-50 text-purple-600",roleKey: "GROUND_WORKER", stateKey: "" },
    { label: "Admins",        value: counts.admins,   icon: Shield,    color: "bg-red-50 text-red-600",      roleKey: "ADMIN",         stateKey: "" },
    { label: "Deactivated",   value: counts.inactive, icon: Ban,       color: "bg-slate-800 text-white",     roleKey: "",              stateKey: "inactive" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-slate-500 text-sm mt-0.5">Players, ground owners and staff. Open an account to see its history or act on it.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3" role="tablist" aria-label="Filter accounts">
        {cards.map(({ label, value, icon: Icon, color, roleKey, stateKey }) => {
          const on = role === roleKey && state === stateKey;
          return (
            <button key={label} role="tab" aria-selected={on}
              onClick={() => { setRoleF(roleKey); setStateF(stateKey); setPage(1); }}
              className={`bg-white rounded-2xl border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                on ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-100 hover:border-slate-200"
              }`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${color}`}><Icon className="w-4 h-4" /></div>
              <p className="text-xl font-bold text-slate-900 tabular-nums">{value.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="search" aria-label="Search accounts" placeholder="Name, email or phone"
            value={input} onChange={(e) => setInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 bg-white" />
        </div>
        {filtered && (
          <button onClick={clear} className="flex items-center gap-1 px-3 py-2.5 text-sm text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100">
            <X className="w-3.5 h-3.5" />Clear
          </button>
        )}
      </div>

      {error && <div role="alert" className="rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="text-base font-semibold text-slate-900">
            Accounts <span className="text-slate-500 font-normal text-sm">{total > 0 ? `${from}–${to} of ${total.toLocaleString()}` : ""}</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : users.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">{filtered ? "No accounts match." : "No accounts yet."}</p>
            {filtered && <button onClick={clear} className="mt-2 text-sm text-blue-600 hover:underline">Clear filters</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50">
                  {["Account", "Role", "Phone", "Joined", "Bookings", "Status", ""].map((h, i) => (
                    <th key={i} scope="col" className="text-left px-6 py-3 text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => {
                  const RoleIcon = ROLE_ICON[u.role] ?? UserCheck;
                  return (
                    <tr key={u.id} onClick={() => openUser(u.id)}
                      className={`cursor-pointer transition-colors ${openId === u.id ? "bg-blue-50/60" : "hover:bg-slate-50/80"}`}>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-bold shrink-0">
                            {u.name?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{u.name}</p>
                            <p className="text-xs text-slate-500 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${ROLE_BADGE[u.role] ?? "bg-slate-100 text-slate-600"}`}>
                          <RoleIcon className="w-3 h-3" />{ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 text-xs tabular-nums whitespace-nowrap">{u.phone ?? "—"}</td>
                      <td className="px-6 py-3.5 text-slate-600 text-xs whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-medium text-slate-700 tabular-nums">{u.totalBookings}</td>
                      <td className="px-6 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${u.isActive ? "bg-green-50 text-green-700" : "bg-slate-800 text-white"}`}>
                          {u.isActive ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button onClick={(e) => { e.stopPropagation(); openUser(u.id); }} aria-label={`Open ${u.name}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 outline-none">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && total > PER_PAGE && (
          <div className="px-6 py-4 border-t border-slate-50 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-slate-500">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50">
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={!hasMore}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <UserDrawer userId={openId} onClose={() => openUser(null)} onChanged={load} />
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96 text-slate-400 gap-3"><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Loading…</span></div>}>
      <UsersContent />
    </Suspense>
  );
}
