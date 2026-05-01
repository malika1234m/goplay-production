"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, TrendingUp, CalendarCheck, BarChart2,
  Loader2, ChevronUp, ChevronDown,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────
interface Summary {
  totalRevenue:   number;
  monthlyRevenue: number;
  totalBookings:  number;
  avgPerBooking:  number;
}

interface OwnerRow {
  ownerId:       string;
  ownerName:     string;
  ownerEmail:    string;
  totalRevenue:  number;
  totalBookings: number;
  facilityCount: number;
  revenueShare:  number;
}

interface FacilityRow {
  facilityId:    string;
  facilityName:  string;
  city:          string;
  ownerName:     string;
  revenue:       number;
  bookings:      number;
  avgPerBooking: number;
  revenueShare:  number;
}

interface ChartPoint { label: string; revenue: number }

type SortDir = "asc" | "desc";

function useSorted<T extends object>(rows: T[], defaultKey: keyof T) {
  const [key, setKey] = useState<keyof T>(defaultKey);
  const [dir, setDir] = useState<SortDir>("desc");

  const toggle = (k: keyof T) => {
    if (k === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setKey(k); setDir("desc"); }
  };

  const sorted = [...rows].sort((a, b) => {
    const av = a[key], bv = b[key];
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv));
    return dir === "desc" ? -cmp : cmp;
  });

  return { sorted, key, dir, toggle };
}

function SortIcon<T>({ col, sortKey, dir }: { col: keyof T; sortKey: keyof T; dir: SortDir }) {
  if (col !== sortKey) return <ChevronUp className="w-3 h-3 opacity-20" />;
  return dir === "desc"
    ? <ChevronDown className="w-3 h-3 text-blue-500" />
    : <ChevronUp   className="w-3 h-3 text-blue-500" />;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminEarningsPage() {
  const [summary,     setSummary]     = useState<Summary | null>(null);
  const [ownerRows,   setOwnerRows]   = useState<OwnerRow[]>([]);
  const [facilityRows,setFacilityRows]= useState<FacilityRow[]>([]);
  const [chartData,   setChartData]   = useState<ChartPoint[]>([]);
  const [chartDays,   setChartDays]   = useState(30);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<"owners" | "facilities">("owners");

  const ownerSort    = useSorted(ownerRows,    "totalRevenue");
  const facilitySort = useSorted(facilityRows, "revenue");

  const loadChart = useCallback(async (days: number) => {
    const res  = await fetch(`/api/admin/earnings/trends?days=${days}`);
    const data = await res.json();
    const labels:  string[] = data.trends?.labels  ?? [];
    const revenue: number[] = data.trends?.revenue ?? [];
    setChartData(labels.map((l, i) => ({ label: l, revenue: revenue[i] ?? 0 })));
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/earnings").then((r) => r.json()),
      fetch("/api/admin/earnings/trends?days=30").then((r) => r.json()),
    ]).then(([earn, trends]) => {
      setSummary(earn.summary     ?? null);
      setOwnerRows(earn.byOwner   ?? []);
      setFacilityRows(earn.byFacility ?? []);
      const labels:  string[] = trends.trends?.labels  ?? [];
      const revenue: number[] = trends.trends?.revenue ?? [];
      setChartData(labels.map((l: string, i: number) => ({ label: l, revenue: revenue[i] ?? 0 })));
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (!loading) loadChart(chartDays); }, [chartDays]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading earnings…</span>
      </div>
    );
  }

  const maxOwnerRev    = Math.max(...ownerRows.map((o) => o.totalRevenue), 1);
  const maxFacilityRev = Math.max(...facilityRows.map((f) => f.revenue), 1);

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Earnings Overview</h1>
        <p className="text-slate-500 text-sm mt-0.5">Platform-wide revenue by facility and ground owner</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue",    value: `Rs. ${(summary?.totalRevenue  ?? 0).toLocaleString()}`, sub: "all time (completed)",        icon: DollarSign,    color: "bg-green-50 text-green-600"  },
          { label: "This Month",       value: `Rs. ${(summary?.monthlyRevenue ?? 0).toLocaleString()}`, sub: "completed bookings only",     icon: TrendingUp,    color: "bg-blue-50 text-blue-600"    },
          { label: "Total Bookings",   value: (summary?.totalBookings ?? 0).toLocaleString(),           sub: "completed",                   icon: CalendarCheck, color: "bg-purple-50 text-purple-600"},
          { label: "Avg per Booking",  value: `Rs. ${(summary?.avgPerBooking  ?? 0).toLocaleString()}`, sub: "across all facilities",       icon: BarChart2,     color: "bg-amber-50 text-amber-600"  },
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

      {/* Revenue chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">Platform Revenue Trend</h2>
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
        <div className="h-60">
          {chartData.every((d) => d.revenue === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
              <TrendingUp className="w-10 h-10" />
              <p className="text-sm">No revenue data for this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminEarnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `Rs.${(v / 1000).toFixed(0)}k`} width={52} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={(v) => [`Rs. ${Number(v ?? 0).toLocaleString()}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fill="url(#adminEarnGrad)" dot={false} activeDot={{ r: 5, fill: "#3b82f6" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Breakdown tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-slate-100">
          {(["owners", "facilities"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-4 text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "owners" ? `By Ground Owner (${ownerRows.length})` : `By Facility (${facilityRows.length})`}
            </button>
          ))}
        </div>

        {/* ── By Owner ── */}
        {tab === "owners" && (
          <>
            {ownerRows.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-slate-400">No completed bookings yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-50">
                      {([
                        { key: "ownerName",     label: "Ground Owner"  },
                        { key: "facilityCount", label: "Facilities"    },
                        { key: "totalBookings", label: "Bookings"      },
                        { key: "totalRevenue",  label: "Total Revenue" },
                        { key: "revenueShare",  label: "Share"         },
                      ] as { key: keyof OwnerRow; label: string }[]).map(({ key, label }) => (
                        <th
                          key={key as string}
                          onClick={() => ownerSort.toggle(key)}
                          className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600 select-none"
                        >
                          <span className="inline-flex items-center gap-1">
                            {label}
                            <SortIcon col={key} sortKey={ownerSort.key} dir={ownerSort.dir} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ownerSort.sorted.map((o) => (
                      <tr key={o.ownerId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-bold shrink-0">
                              {o.ownerName?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{o.ownerName}</p>
                              <p className="text-xs text-slate-400">{o.ownerEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-xs font-medium">{o.facilityCount}</td>
                        <td className="px-6 py-4 text-slate-600 text-xs font-medium">{o.totalBookings}</td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">Rs. {o.totalRevenue.toLocaleString()}</p>
                            <div className="mt-1.5 h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${(o.totalRevenue / maxOwnerRev) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                            {o.revenueShare}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── By Facility ── */}
        {tab === "facilities" && (
          <>
            {facilityRows.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-slate-400">No completed bookings yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-50">
                      {([
                        { key: "facilityName",  label: "Facility"      },
                        { key: "ownerName",     label: "Owner"         },
                        { key: "bookings",      label: "Bookings"      },
                        { key: "avgPerBooking", label: "Avg / Booking" },
                        { key: "revenue",       label: "Total Revenue" },
                        { key: "revenueShare",  label: "Share"         },
                      ] as { key: keyof FacilityRow; label: string }[]).map(({ key, label }) => (
                        <th
                          key={key as string}
                          onClick={() => facilitySort.toggle(key)}
                          className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600 select-none"
                        >
                          <span className="inline-flex items-center gap-1">
                            {label}
                            <SortIcon col={key} sortKey={facilitySort.key} dir={facilitySort.dir} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {facilitySort.sorted.map((f) => (
                      <tr key={f.facilityId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">{f.facilityName}</p>
                          <p className="text-xs text-slate-400">{f.city}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-xs">{f.ownerName}</td>
                        <td className="px-6 py-4 text-slate-600 text-xs font-medium">{f.bookings}</td>
                        <td className="px-6 py-4 text-slate-600 text-xs font-medium">
                          Rs. {f.avgPerBooking.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-semibold text-slate-900">Rs. {f.revenue.toLocaleString()}</p>
                            <div className="mt-1.5 h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${(f.revenue / maxFacilityRev) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700">
                            {f.revenueShare}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
