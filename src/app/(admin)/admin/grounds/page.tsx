"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { MapPin, Search, Loader2, CheckCircle, XCircle, PauseCircle, Eye } from "lucide-react";

interface Ground {
  id:            string;
  name:          string;
  city:          string;
  address:       string;
  hourlyRate:    number;
  status:        string;
  createdAt:     string;
  category:      string;
  ownerName:     string;
  ownerEmail:    string;
  totalBookings: number;
  totalReviews:  number;
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:   "bg-green-50 text-green-700",
  PENDING:  "bg-amber-50 text-amber-700",
  INACTIVE: "bg-slate-100 text-slate-600",
  REJECTED: "bg-red-50 text-red-700",
};

function GroundsContent() {
  const searchParams = useSearchParams();
  const [grounds,  setGrounds]  = useState<Ground[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [q,        setQ]        = useState("");
  const [status,   setStatus]   = useState(searchParams.get("status") ?? "");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async (query: string, statusFilter: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query)        params.set("q",      query);
    if (statusFilter) params.set("status", statusFilter);
    const res  = await fetch(`/api/admin/grounds?${params}`);
    const data = await res.json();
    setGrounds(data.grounds ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(q, status); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/grounds/${id}/status`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setGrounds((prev) =>
          prev.map((g) => g.id === id ? { ...g, status: newStatus } : g)
        );
      }
    } finally {
      setUpdating(null);
    }
  };

  const totals = {
    all:      grounds.length,
    active:   grounds.filter((g) => g.status === "ACTIVE").length,
    pending:  grounds.filter((g) => g.status === "PENDING").length,
    inactive: grounds.filter((g) => g.status === "INACTIVE").length,
    rejected: grounds.filter((g) => g.status === "REJECTED").length,
  };

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ground Management</h1>
        <p className="text-slate-500 text-sm mt-0.5">Approve, manage and monitor all sports grounds</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "All Grounds", value: totals.all,      color: "bg-slate-50 text-slate-600",  click: "" },
          { label: "Active",      value: totals.active,   color: "bg-green-50 text-green-600",  click: "ACTIVE" },
          { label: "Pending",     value: totals.pending,  color: "bg-amber-50 text-amber-600",  click: "PENDING" },
          { label: "Rejected",    value: totals.rejected, color: "bg-red-50 text-red-600",      click: "REJECTED" },
        ].map(({ label, value, color, click }) => (
          <button
            key={label}
            onClick={() => { setStatus(click); load(q, click); }}
            className={`bg-white rounded-2xl border p-5 text-left transition-all ${
              status === click ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-100 hover:border-slate-200"
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <MapPin className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name or city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(q, status); }}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-600"
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <button
          onClick={() => load(q, status)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Search
        </button>
        <button
          onClick={() => { setQ(""); setStatus(""); load("", ""); }}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50">
          <h2 className="text-base font-semibold text-slate-900">
            Grounds <span className="text-slate-400 font-normal text-sm">({grounds.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : grounds.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <MapPin className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No grounds found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Ground</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Owner</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Category</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Rate</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Bookings</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {grounds.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{g.name}</p>
                          <p className="text-xs text-slate-400">{g.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <p className="text-slate-700 font-medium">{g.ownerName}</p>
                      <p className="text-xs text-slate-400">{g.ownerEmail}</p>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 text-xs">{g.category}</td>
                    <td className="px-6 py-3.5 text-slate-700 text-xs font-medium">Rs. {g.hourlyRate.toLocaleString()}/hr</td>
                    <td className="px-6 py-3.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[g.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {g.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-500 text-xs">{g.totalBookings}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/admin/grounds/${g.id}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Link>
                        {g.status !== "ACTIVE" && (
                          <button
                            onClick={() => updateStatus(g.id, "ACTIVE")}
                            disabled={updating === g.id}
                            title="Approve"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            {updating === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                        )}
                        {g.status === "ACTIVE" && (
                          <button
                            onClick={() => updateStatus(g.id, "INACTIVE")}
                            disabled={updating === g.id}
                            title="Deactivate"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            {updating === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
                            Deactivate
                          </button>
                        )}
                        {g.status !== "REJECTED" && g.status !== "ACTIVE" && (
                          <button
                            onClick={() => updateStatus(g.id, "REJECTED")}
                            disabled={updating === g.id}
                            title="Reject"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            {updating === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                            Reject
                          </button>
                        )}
                      </div>
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

export default function AdminGroundsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-96 text-slate-400 gap-3"><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Loading…</span></div>}>
      <GroundsContent />
    </Suspense>
  );
}
