"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BadgeDollarSign, Wallet, CheckCircle, Zap, DollarSign,
  Loader2, ChevronUp, ChevronDown, Info, Percent,
} from "lucide-react";
import MoneyTrendChart from "@/components/admin/MoneyTrendChart";

// ── Types ────────────────────────────────────────────────────────────────────
interface Summary {
  goplay:       { total: number; month: number; lastMonth: number; change: number | null };
  commission:   { total: number; month: number; outstanding: number; collected: number };
  lobbyMargin:  { total: number; month: number };
  bookingValue: { total: number; month: number; change: number | null; bookings: number };
  lobbyHeld:    { payoutsDue: number; inOpenLobbies: number };
  defaultCommissionRate: number;
}

interface OwnerRow {
  ownerId:      string;
  ownerName:    string;
  ownerEmail:   string;
  facilities:   number;
  bookings:     number;
  bookingValue: number;
  commission:   number;
  outstanding:  number;
  lobbyMargin:  number;
  goplay:       number;
}

interface FacilityRow {
  facilityId:     string;
  facilityName:   string;
  city:           string;
  ownerName:      string;
  commissionRate: number;
  customRate:     boolean;
  bookings:       number;
  bookingValue:   number;
  commission:     number;
  outstanding:    number;
  lobbyMargin:    number;
  goplay:         number;
}

type SortDir = "asc" | "desc";

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

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

function SortHeader<T>({ cols, sort }: { cols: { key: keyof T; label: string }[]; sort: ReturnType<typeof useSorted<T & object>> }) {
  return (
    <tr className="border-b border-slate-50">
      {cols.map(({ key, label }) => (
        <th key={key as string} onClick={() => sort.toggle(key as keyof (T & object))}
          className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-600 select-none whitespace-nowrap">
          <span className="inline-flex items-center gap-1">
            {label}
            {key !== sort.key
              ? <ChevronUp className="w-3 h-3 opacity-20" />
              : sort.dir === "desc" ? <ChevronDown className="w-3 h-3 text-blue-500" /> : <ChevronUp className="w-3 h-3 text-blue-500" />}
          </span>
        </th>
      ))}
    </tr>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AdminEarningsPage() {
  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [ownerRows,    setOwnerRows]    = useState<OwnerRow[]>([]);
  const [facilityRows, setFacilityRows] = useState<FacilityRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [tab,          setTab]          = useState<"facilities" | "owners">("facilities");

  const ownerSort    = useSorted(ownerRows,    "goplay");
  const facilitySort = useSorted(facilityRows, "goplay");

  useEffect(() => {
    fetch("/api/admin/earnings", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setSummary(d.summary ?? null);
        setOwnerRows(d.byOwner ?? []);
        setFacilityRows(d.byFacility ?? []);
      })
      .catch(() => setError("Couldn't load earnings."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading earnings…</span>
      </div>
    );
  }

  const s = summary;

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">GoPlay Earnings</h1>
        <p className="text-slate-500 text-sm mt-0.5">What GoPlay earns: commission from grounds and the open match margin</p>
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "GoPlay Earnings",     value: rs(s?.goplay.total ?? 0),            sub: `${rs(s?.goplay.month ?? 0)} this month`,           icon: BadgeDollarSign, color: "bg-green-50 text-green-600" },
          { label: "Commission Collected", value: rs(s?.commission.collected ?? 0),   sub: "settled by grounds",                              icon: CheckCircle,     color: "bg-emerald-50 text-emerald-600" },
          { label: "Commission Owed",      value: rs(s?.commission.outstanding ?? 0), sub: "grounds still to settle",                         icon: Wallet,          color: "bg-orange-50 text-orange-600", href: "/admin/commissions" },
          { label: "Open Match Margin",    value: rs(s?.lobbyMargin.total ?? 0),      sub: `${rs(s?.lobbyMargin.month ?? 0)} this month`,      icon: Zap,             color: "bg-purple-50 text-purple-600", href: "/admin/lobby-payments" },
          { label: "Booking Value",        value: rs(s?.bookingValue.total ?? 0),     sub: `${(s?.bookingValue.bookings ?? 0).toLocaleString()} bookings · grounds' money`, icon: DollarSign, color: "bg-blue-50 text-blue-600" },
        ].map(({ label, value, sub, icon: Icon, color, href }) => {
          const body = (
            <>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color}`}><Icon className="w-5 h-5" /></div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
              <p className="text-xs font-medium text-slate-500 mt-1">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
            </>
          );
          return href
            ? <Link key={label} href={href} className="bg-white rounded-2xl border border-slate-100 p-5 hover:border-slate-200 hover:shadow-sm transition-all">{body}</Link>
            : <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5">{body}</div>;
        })}
      </div>

      {/* How the money moves */}
      <div className="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs text-slate-600">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            <span className="font-semibold text-slate-700">Bookings:</span> players pay the ground directly (cash or bank transfer).
            GoPlay never holds this money and makes no payouts for it; the ground owes GoPlay its commission, collected on the{" "}
            <Link href="/admin/commissions" className="text-blue-600 hover:underline">Commissions</Link> page.
          </p>
          <p>
            <span className="font-semibold text-slate-700">Open matches:</span> players pay GoPlay; GoPlay pays the ground the court
            price minus commission once the lobby fills, on <Link href="/admin/lobby-payments" className="text-blue-600 hover:underline">Lobby Payments</Link>.
            {s && (s.lobbyHeld.payoutsDue + s.lobbyHeld.inOpenLobbies) > 0 && (
              <> GoPlay is holding {rs(s.lobbyHeld.payoutsDue)} owed to grounds and {rs(s.lobbyHeld.inOpenLobbies)} in lobbies still filling.</>
            )}
          </p>
          <p>
            <span className="font-semibold text-slate-700">Commission:</span> {s?.defaultCommissionRate ?? 10}% by default; grounds can have their own rate in{" "}
            <Link href="/admin/grounds" className="text-blue-600 hover:underline">Ground Management</Link>. Only admins see these figures.
          </p>
        </div>
      </div>

      <MoneyTrendChart title="Earnings Trend" height="h-60" />

      {/* Breakdown tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="flex border-b border-slate-100">
          {(["facilities", "owners"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-4 text-sm font-medium transition-colors ${tab === t ? "border-b-2 border-blue-500 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}>
              {t === "facilities" ? `By Ground (${facilityRows.length})` : `By Ground Owner (${ownerRows.length})`}
            </button>
          ))}
        </div>

        {tab === "facilities" && (
          facilityRows.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-400">No completed bookings yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <SortHeader<FacilityRow> sort={facilitySort} cols={[
                    { key: "facilityName",   label: "Ground"        },
                    { key: "commissionRate", label: "Rate"          },
                    { key: "bookings",       label: "Bookings"      },
                    { key: "bookingValue",   label: "Booking value" },
                    { key: "commission",     label: "Commission"    },
                    { key: "outstanding",    label: "Owed"          },
                    { key: "lobbyMargin",    label: "Lobby margin"  },
                    { key: "goplay",         label: "GoPlay earned" },
                  ]} />
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {facilitySort.sorted.map((f) => (
                    <tr key={f.facilityId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{f.facilityName}</p>
                        <p className="text-xs text-slate-400">{f.city} · {f.ownerName}</p>
                      </td>
                      <td className="px-5 py-4">
                        <Link href="/admin/grounds" title="Change on Ground Management"
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${f.customRate ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-500"}`}>
                          {f.commissionRate}%{!f.customRate && <span className="font-normal">default</span>}
                          <Percent className="w-3 h-3 opacity-50" />
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-600 text-xs font-medium">{f.bookings}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{rs(f.bookingValue)}</td>
                      <td className="px-5 py-4 text-slate-700 text-xs font-medium">{rs(f.commission)}</td>
                      <td className="px-5 py-4 text-xs font-medium">
                        {f.outstanding > 0 ? <span className="text-orange-600">{rs(f.outstanding)}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">{f.lobbyMargin ? rs(f.lobbyMargin) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-5 py-4 font-semibold text-green-700">{rs(f.goplay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === "owners" && (
          ownerRows.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-400">No completed bookings yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <SortHeader<OwnerRow> sort={ownerSort} cols={[
                    { key: "ownerName",    label: "Ground Owner"  },
                    { key: "facilities",   label: "Grounds"       },
                    { key: "bookings",     label: "Bookings"      },
                    { key: "bookingValue", label: "Booking value" },
                    { key: "commission",   label: "Commission"    },
                    { key: "outstanding",  label: "Owed"          },
                    { key: "lobbyMargin",  label: "Lobby margin"  },
                    { key: "goplay",       label: "GoPlay earned" },
                  ]} />
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {ownerSort.sorted.map((o) => (
                    <tr key={o.ownerId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
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
                      <td className="px-5 py-4 text-slate-600 text-xs font-medium">{o.facilities}</td>
                      <td className="px-5 py-4 text-slate-600 text-xs font-medium">{o.bookings}</td>
                      <td className="px-5 py-4 text-slate-500 text-xs">{rs(o.bookingValue)}</td>
                      <td className="px-5 py-4 text-slate-700 text-xs font-medium">{rs(o.commission)}</td>
                      <td className="px-5 py-4 text-xs font-medium">
                        {o.outstanding > 0 ? <span className="text-orange-600">{rs(o.outstanding)}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600">{o.lobbyMargin ? rs(o.lobbyMargin) : <span className="text-slate-300">—</span>}</td>
                      <td className="px-5 py-4 font-semibold text-green-700">{rs(o.goplay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
