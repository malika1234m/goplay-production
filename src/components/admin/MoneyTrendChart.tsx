"use client";

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface Point { date: string; bookingValue: number; goplay: number }

const SERIES = {
  goplay:       { label: "GoPlay earnings", color: "#16a34a", hint: "Commission + open match margin" },
  bookingValue: { label: "Booking value",   color: "#3b82f6", hint: "Paid by players directly to grounds" },
} as const;
type Series = keyof typeof SERIES;

const short = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Day-by-day money chart for admins: GoPlay's own earnings, or the booking value grounds received. */
export default function MoneyTrendChart({ height = "h-56", title = "Money Trend" }: { height?: string; title?: string }) {
  const [days,   setDays]   = useState(30);
  const [series, setSeries] = useState<Series>("goplay");
  const [data,   setData]   = useState<Point[]>([]);

  useEffect(() => {
    let live = true;
    fetch(`/api/admin/earnings/trends?days=${days}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (live) setData(Array.isArray(d.trends) ? d.trends : []); })
      .catch(() => { /* keep the last data */ });
    return () => { live = false; };
  }, [days]);

  const s     = SERIES[series];
  const total = data.reduce((sum, p) => sum + p[series], 0);
  const empty = data.every((p) => p[series] === 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 h-full">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{s.hint} · Rs. {Math.round(total).toLocaleString()} in {days} days</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-0.5 rounded-lg">
            {(Object.keys(SERIES) as Series[]).map((k) => (
              <button key={k} onClick={() => setSeries(k)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${series === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {SERIES[k].label}
              </button>
            ))}
          </div>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value={7}>7 Days</option>
            <option value={30}>30 Days</option>
            <option value={90}>90 Days</option>
          </select>
        </div>
      </div>
      <div className={height}>
        {empty ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
            <TrendingUp className="w-8 h-8" />
            <p className="text-sm">Nothing in this period</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.map((p) => ({ ...p, label: short(p.date) }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`money-${series}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={s.color} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={56}
                tickFormatter={(v) => (v >= 1000 ? `Rs.${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `Rs.${v}`)} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                formatter={(v) => [`Rs. ${Number(v ?? 0).toLocaleString()}`, s.label]} />
              <Area type="monotone" dataKey={series} stroke={s.color} strokeWidth={2.5} fill={`url(#money-${series})`} dot={false} activeDot={{ r: 5, fill: s.color }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
