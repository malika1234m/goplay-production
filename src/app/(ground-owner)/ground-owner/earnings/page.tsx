"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, CalendarCheck, Loader2, ChevronDown, ChevronUp,
  CreditCard, Banknote, AlertCircle, MapPin, Wallet,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { tk, type T, formatDay } from "@/i18n/core";
import { useT } from "@/i18n/I18nProvider";

/* ── Types ── */
interface EarningRecord {
  id:             string;
  earnedAt:       string;
  grossAmount:    number;
  platformFee:    number;
  netAmount:      number;
  paymentMethod:  "ONLINE" | "ON_ARRIVAL";
  cashConfirmed:  boolean;
  commissionNote: string | null;
  booking: {
    bookingDate:     string;
    startTime:       string;
    endTime:         string;
    totalHours:      number;
    paymentStatus:   string;
    specialRequests: string | null;
    user:            { name: string; email: string };
    court:           { name: string } | null;
  };
  facility: { id: string; name: string; city: string };
}

interface FacilityGroup {
  facilityId:   string;
  facilityName: string;
  facilityCity: string;
  gross: number;
  fee:   number;
  net:   number;
  count: number;
  earnings: EarningRecord[];
}

interface Summary {
  totalGross:  number;
  totalFee:    number;
  totalNet:    number;
  totalCount:  number;
  cashPending: number;
}

interface ChartPoint { label: string; revenue: number }

/* ── Helpers ── */
function fmt(t: T, n: number) { return `${t("Rs.")} ${Math.round(n).toLocaleString()}`; }

function fmtDate(d: string, locale: string) {
  return formatDay(new Date(d), locale, { month: "short", day: "numeric", year: "numeric" });
}

function PayBadge({ method, confirmed }: { method: string; confirmed: boolean }) {
  const { t } = useT();
  if (method === "ONLINE") {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
        <CreditCard className="w-3 h-3" />{t("Online")}
      </span>
    );
  }
  if (confirmed) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
        <Banknote className="w-3 h-3" />{t("Cash Received")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
      <AlertCircle className="w-3 h-3" />{t("Cash Pending")}
    </span>
  );
}

/* ── Facility accordion row ── */
function FacilityBlock({
  group,
  totalNet,
}: {
  group: FacilityGroup;
  totalNet: number;
}) {
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  const pct = totalNet > 0 ? Math.round((group.net / totalNet) * 100) : 0;

  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden">
      {/* Facility header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-start gap-3 text-left min-w-0">
          <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{group.facilityName}</p>
            <p className="text-xs text-slate-400 mt-0.5">{group.facilityCity} · {group.count} booking{group.count !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">{t("Gross")}</p>
            <p className="text-sm font-medium text-slate-600">{fmt(t, group.gross)}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">{t("Platform fee")}</p>
            <p className="text-sm font-medium text-red-500">−{fmt(t, group.fee)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">{t("Your earnings")}</p>
            <p className="text-base font-bold text-slate-900">{fmt(t, group.net)}</p>
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </div>
      </button>

      {/* Share bar */}
      <div className="px-5 pb-3 -mt-1">
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-1">{pct}% of total earnings</p>
      </div>

      {/* Expanded booking list */}
      {open && (
        <div className="border-t border-slate-100">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-5 py-2.5 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <span>{t("Booking")}</span>
            <span className="text-right hidden sm:block">{t("Payment")}</span>
            <span className="text-right">{t("Gross")}</span>
            <span className="text-right">{t("Fee")}</span>
            <span className="text-right">{t("Net")}</span>
          </div>

          <div className="divide-y divide-slate-50">
            {group.earnings.map((e) => {
              const isWalkIn = e.booking.specialRequests?.startsWith("[Walk-in]") ?? false;
              const walkInPlayerName = isWalkIn
                ? e.booking.specialRequests!.replace("[Walk-in] ", "").split(" — ")[0]
                : null;
              return (
                <div
                  key={e.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                >
                  {/* Left: player + date + time */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800 truncate">
                        {walkInPlayerName ?? e.booking.user.name}
                      </span>
                      {isWalkIn && (
                        <span className="text-[10px] font-medium bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{t("Walk-in")}</span>
                      )}
                      <PayBadge method={e.paymentMethod} confirmed={e.cashConfirmed} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fmtDate(e.booking.bookingDate, locale)} · {e.booking.startTime}–{e.booking.endTime}
                      {" "}({e.booking.totalHours} hr{e.booking.totalHours !== 1 ? "s" : ""})
                    </p>
                    {e.booking.court && (
                      <span className="mt-1 inline-flex items-center text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                        {e.booking.court.name}
                      </span>
                    )}
                  </div>

                  {/* Payment method — hidden on mobile */}
                  <div className="hidden sm:block" />

                  {/* Amounts */}
                  <p className="text-sm text-slate-600 text-right">{fmt(t, e.grossAmount)}</p>
                  {isWalkIn ? (
                    <p className="text-xs text-slate-400 text-right italic">{t("No commission")}</p>
                  ) : (
                    <p className="text-sm text-red-400 text-right">−{fmt(t, e.platformFee)}</p>
                  )}
                  <p className="text-sm font-semibold text-green-700 text-right">{fmt(t, e.netAmount)}</p>
                </div>
              );
            })}
          </div>

          {/* Facility totals footer */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-5 py-3 bg-slate-50 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500">{t("Facility Total")}</p>
            <div className="hidden sm:block" />
            <p className="text-sm font-semibold text-slate-700 text-right">{fmt(t, group.gross)}</p>
            <p className="text-sm font-semibold text-red-500 text-right">−{fmt(t, group.fee)}</p>
            <p className="text-sm font-bold text-green-700 text-right">{fmt(t, group.net)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
export default function EarningsPage() {
  const { t, tn } = useT();
  const [summary,   setSummary]   = useState<Summary | null>(null);
  const [byFacility, setByFacility] = useState<FacilityGroup[]>([]);
  const [chartData,  setChartData]  = useState<ChartPoint[]>([]);
  const [chartDays,  setChartDays]  = useState(30);
  const [range,      setRange]      = useState("all");
  const [loading,    setLoading]    = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  const loadChart = useCallback(async (days: number) => {
    setChartLoading(true);
    const res  = await fetch(`/api/ground-owner/earnings/trends?days=${days}`);
    const data = await res.json();
    const labels:  string[] = data.trends?.labels  ?? [];
    const revenue: number[] = data.trends?.revenue ?? [];
    setChartData(labels.map((l, i) => ({ label: l, revenue: revenue[i] ?? 0 })));
    setChartLoading(false);
  }, []);

  const loadEarnings = useCallback(async (r: string) => {
    setLoading(true);
    const res  = await fetch(`/api/ground-owner/earnings?range=${r}`);
    const data = await res.json();
    setSummary(data.summary ?? null);
    setByFacility(data.byFacility ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEarnings(range);
    loadChart(chartDays);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadChart(chartDays); }, [chartDays, loadChart]);
  useEffect(() => { loadEarnings(range);  }, [range, loadEarnings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">{t("Loading earnings…")}</span>
      </div>
    );
  }

  const s = summary ?? { totalGross: 0, totalFee: 0, totalNet: 0, totalCount: 0, cashPending: 0 };

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("Earnings")}</h1>
        </div>

        {/* Range selector */}
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          <option value="all">{t("All Time")}</option>
          <option value="month">{t("This Month")}</option>
          <option value="30d">{t("Last 30 Days")}</option>
          <option value="90d">{t("Last 90 Days")}</option>
        </select>
      </div>

      {/* Cash pending notice */}
      {s.cashPending > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            {tn(s.cashPending, "{n} pay-at-ground booking has no cash confirmation yet.", "{n} pay-at-ground bookings have no cash confirmation yet.")}{" "}
            {t("Close them from Bookings → To complete.")}{" "}
            <a href="/ground-owner/bookings" className="underline font-medium">{t("Bookings")}</a>
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: tk("Total Collected"),
            value: fmt(t, s.totalGross),
            sub:   tk("gross booking value"),
            icon:  TrendingUp,
            color: "bg-blue-50 text-blue-600",
          },
          {
            label: tk("Platform Fee"),
            value: fmt(t, s.totalFee),
            sub:   tk("deducted commission"),
            icon:  CalendarCheck,
            color: "bg-red-50 text-red-500",
          },
          {
            label: tk("Your Net Earnings"),
            value: fmt(t, s.totalNet),
            sub:   tk("after platform fee"),
            icon:  Wallet,
            color: "bg-green-50 text-green-600",
            highlight: true,
          },
          {
            label: tk("Completed Bookings"),
            value: s.totalCount,
            sub:   tk("total sessions finished"),
            icon:  CalendarCheck,
            color: "bg-purple-50 text-purple-600",
          },
        ].map(({ label, value, sub, icon: Icon, color, highlight }) => (
          <div
            key={label}
            className={`rounded-2xl border p-5 ${highlight ? "bg-green-600 border-green-500" : "bg-white border-slate-100"}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${highlight ? "bg-green-500" : color}`}>
              <Icon className={`w-5 h-5 ${highlight ? "text-white" : ""}`} />
            </div>
            <p className={`text-xl font-bold ${highlight ? "text-white" : "text-slate-900"}`}>{value}</p>
            <p className={`text-xs font-medium mt-1 ${highlight ? "text-green-100" : "text-slate-500"}`}>{t(label)}</p>
            <p className={`text-xs mt-0.5 ${highlight ? "text-green-200" : "text-slate-400"}`}>{t(sub)}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{t("Net Earnings Trend")}</h2>
          </div>
          <select
            value={chartDays}
            onChange={(e) => setChartDays(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value={7}>{t("7 Days")}</option>
            <option value={30}>{t("30 Days")}</option>
            <option value={90}>{t("90 Days")}</option>
          </select>
        </div>
        <div className="h-56 relative">
          {chartLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
              <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
            </div>
          )}
          {chartData.every((d) => d.revenue === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
              <TrendingUp className="w-10 h-10" />
              <p className="text-sm">{t("No earnings in this period")}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.2} />
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
                  tickFormatter={(v) => `${t("Rs.")}${(v / 1000).toFixed(0)}k`}
                  width={56}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                  formatter={(v) => [`${t("Rs.")} ${Number(v ?? 0).toLocaleString()}`, t("Net Earnings")]}
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

      {/* Per-facility breakdown */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">{t("Earnings by Ground")}</h2>
        </div>

        {byFacility.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 px-6 py-16 text-center">
            <Wallet className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">{t("No completed bookings in this period.")}</p>
            <p className="text-xs text-slate-300 mt-1">{t("Earnings appear here once a booking is marked complete.")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {byFacility.map((g) => (
              <FacilityBlock key={g.facilityId} group={g} totalNet={s.totalNet} />
            ))}

            {/* Grand total row */}
            <div className="bg-slate-900 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-white">Grand Total ({byFacility.length} ground{byFacility.length !== 1 ? "s" : ""})</p>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-slate-400 hidden sm:block">{t("{amount} collected", { amount: fmt(t, s.totalGross) })}</span>
                <span className="text-red-400 hidden sm:block">−{t("{amount} fee", { amount: fmt(t, s.totalFee) })}</span>
                <span className="text-green-400 font-bold text-base">{fmt(t, s.totalNet)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
