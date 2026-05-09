"use client";

import { useState, useEffect } from "react";
import {
  Loader2, ChevronDown, ChevronUp, BadgeDollarSign, CheckCircle,
  Users, AlertCircle, Banknote, CreditCard, Calendar, MapPin, X, Download,
} from "lucide-react";

/* ── Types ── */
interface EarningRow {
  platformFee:        number;
  commissionPaid:     boolean;
  paymentMethod:      string;
  earnedAt:           string;
  commissionSettledAt: string | null;
  commissionNote:     string | null;
  facility: { name: string };
  booking:  { bookingDate: string; user?: { name: string } };
}

interface OwnerCommission {
  ownerId:          string;
  ownerName:        string;
  ownerEmail:       string;
  totalCommission:  number;
  paidCommission:   number;
  unpaidCommission: number;
  cashUnpaid:       number;
  onlineUnpaid:     number;
  onlineHeld:       number;
  canNet:           boolean;
  earnings:         EarningRow[];
}

interface Summary {
  totalUnpaid:       number;
  totalCashUnpaid:   number;
  totalOnlineUnpaid: number;
  totalCollected:    number;
  ownersWithDebt:    number;
}

/* ── Helpers ── */
const fmt  = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const fmtD = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/* ── Owner accordion card ── */
function OwnerCard({ owner, onSettle }: { owner: OwnerCommission; onSettle: (o: OwnerCommission) => void }) {
  const [open, setOpen] = useState(false);
  const hasDebt     = owner.unpaidCommission > 0;
  const hasCashDebt = owner.cashUnpaid > 0;

  return (
    <div className={`border rounded-2xl overflow-hidden ${hasDebt ? "border-orange-200" : "border-slate-100 bg-white"}`}>
      <div
        role="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {owner.ownerName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{owner.ownerName}</p>
            <p className="text-xs text-slate-400 truncate">{owner.ownerEmail}</p>
          </div>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">Total Commission</p>
            <p className="text-sm font-medium text-slate-600">{fmt(owner.totalCommission)}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">Collected</p>
            <p className="text-sm font-medium text-green-600">{fmt(owner.paidCommission)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Outstanding</p>
            <p className={`text-base font-bold ${hasDebt ? "text-orange-600" : "text-slate-400"}`}>
              {fmt(owner.unpaidCommission)}
            </p>
          </div>
          {hasCashDebt && (
            <button
              onClick={(e) => { e.stopPropagation(); onSettle(owner); }}
              className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Settle
            </button>
          )}
          {hasDebt && !hasCashDebt && (
            <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-medium">
              Auto on payout
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-100">
          {/* Mini stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 bg-slate-50 text-center">
            {[
              { label: "Cash Commission Due",   value: fmt(owner.cashUnpaid),   color: owner.cashUnpaid > 0 ? "text-orange-600" : "text-slate-400" },
              { label: "Online Commission Due", value: fmt(owner.onlineUnpaid), color: owner.onlineUnpaid > 0 ? "text-blue-600" : "text-slate-400" },
              { label: "Admin Holds (Online)",  value: fmt(owner.onlineHeld),   color: "text-green-600" },
              { label: "Can Net?",              value: owner.canNet ? "Yes" : "No", color: owner.canNet ? "text-green-600 font-bold" : "text-slate-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-4 py-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
                <p className={`text-sm font-semibold mt-0.5 ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Per-booking commission table */}
          <div className="bg-white">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-5 py-2 bg-slate-50 border-t border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <span>Booking</span>
              <span className="text-center">Method</span>
              <span className="text-right">Commission</span>
              <span className="text-center">Status</span>
            </div>
            <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {owner.earnings.map((e, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-5 py-3 hover:bg-slate-50/40 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-700 truncate">{e.facility.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span>{fmtD(e.booking.bookingDate)}</span>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    {e.paymentMethod === "ONLINE" ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                        <CreditCard className="w-2.5 h-2.5" />Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                        <Banknote className="w-2.5 h-2.5" />Cash
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-slate-700 text-right">{fmt(e.platformFee)}</p>

                  <div className="flex justify-center">
                    {e.commissionPaid ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                        <CheckCircle className="w-2.5 h-2.5" />Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                        <AlertCircle className="w-2.5 h-2.5" />Pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Settle modal ── */
function SettleModal({
  owner,
  onClose,
  onDone,
}: {
  owner: OwnerCommission;
  onClose: () => void;
  onDone:  () => void;
}) {
  const [type,     setType]     = useState<"net" | "direct">(owner.canNet ? "net" : "direct");
  const [note,     setNote]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    const res  = await fetch(`/api/admin/commissions/${owner.ownerId}/settle`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ type, note }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Settlement failed."); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Settle Commission</h3>
            <p className="text-xs text-slate-500 mt-0.5">{owner.ownerName}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        {/* Summary */}
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Outstanding cash commission</span>
            <span className="font-bold text-orange-700">{fmt(owner.cashUnpaid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Admin holds (online)</span>
            <span className="font-semibold text-green-700">{fmt(owner.onlineHeld)}</span>
          </div>
        </div>

        {/* Settlement type */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Settlement Method</p>

          <button
            onClick={() => setType("net")}
            disabled={!owner.canNet}
            className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
              type === "net"
                ? "border-blue-400 bg-blue-50"
                : owner.canNet
                ? "border-slate-200 hover:border-slate-300"
                : "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-800">Net from Online Balance</span>
            </div>
            <p className="text-xs text-slate-500 pl-6">
              Deduct {fmt(owner.cashUnpaid)} from the {fmt(owner.onlineHeld)} admin holds.
              Owner receives {fmt(Math.max(0, owner.onlineHeld - owner.cashUnpaid))} on next payout.
            </p>
            {!owner.canNet && <p className="text-xs text-red-500 pl-6 mt-1">Not enough online balance to net.</p>}
          </button>

          <button
            onClick={() => setType("direct")}
            className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
              type === "direct" ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-slate-800">Mark as Collected Directly</span>
            </div>
            <p className="text-xs text-slate-500 pl-6">
              Owner paid {fmt(owner.cashUnpaid)} separately (cash, bank transfer, etc.). Mark as settled.
            </p>
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Any note for the ground owner or internal record…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Settlement
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function AdminCommissionsPage() {
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [owners,   setOwners]   = useState<OwnerCommission[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [settling, setSettling] = useState<OwnerCommission | null>(null);
  const [filter,   setFilter]   = useState<"all" | "outstanding" | "settled">("outstanding");

  // Export filters
  const [exporting,      setExporting]      = useState(false);
  const [exportStatus,   setExportStatus]   = useState<"all" | "paid" | "unpaid">("all");
  const [exportFrom,     setExportFrom]     = useState("");
  const [exportTo,       setExportTo]       = useState("");
  const [exportOwner,    setExportOwner]    = useState("");
  const [showExport,     setShowExport]     = useState(false);

  const load = async () => {
    const res  = await fetch("/api/admin/commissions");
    const data = await res.json();
    setSummary(data.summary ?? null);
    setOwners(data.owners   ?? []);
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const handleSettled = async () => {
    setSettling(null);
    setLoading(true);
    await load();
    setLoading(false);
  };

  const handleExport = async () => {
    setExporting(true);
    const params = new URLSearchParams({ status: exportStatus });
    if (exportOwner) params.set("ownerId", exportOwner);
    if (exportFrom)  params.set("from",    exportFrom);
    if (exportTo)    params.set("to",      exportTo);

    const res  = await fetch(`/api/admin/commissions/export?${params}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `goplay-commissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const s = summary ?? { totalUnpaid: 0, totalCashUnpaid: 0, totalOnlineUnpaid: 0, totalCollected: 0, ownersWithDebt: 0 };

  const displayed = owners.filter((o) => {
    if (filter === "outstanding") return o.unpaidCommission > 0;
    if (filter === "settled")     return o.unpaidCommission === 0 && o.totalCommission > 0;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading commissions…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Commission Tracking</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Platform commission from every completed booking — track what each ground owner owes
          </p>
        </div>
        <button
          onClick={() => setShowExport((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Export panel */}
      {showExport && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
          <p className="text-sm font-semibold text-slate-700">Export Commission Records</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                value={exportStatus}
                onChange={(e) => setExportStatus(e.target.value as typeof exportStatus)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All</option>
                <option value="unpaid">Unpaid only</option>
                <option value="paid">Paid only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Ground Owner</label>
              <select
                value={exportOwner}
                onChange={(e) => setExportOwner(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All owners</option>
                {owners.map((o) => (
                  <option key={o.ownerId} value={o.ownerId}>{o.ownerName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">From date</label>
              <input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">To date</label>
              <input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? "Generating…" : "Download CSV"}
            </button>
            <p className="text-xs text-slate-400">
              Each row = one booking. Columns: owner, facility, date, payment method, commission amount, status.
            </p>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-orange-500 rounded-2xl border border-orange-400 p-5">
          <div className="w-10 h-10 rounded-xl bg-orange-400 flex items-center justify-center mb-3">
            <BadgeDollarSign className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-white">{fmt(s.totalUnpaid)}</p>
          <p className="text-xs text-orange-100 mt-1">Total Outstanding</p>
          <p className="text-xs text-orange-200 mt-0.5">across all owners</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <Banknote className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(s.totalCashUnpaid)}</p>
          <p className="text-xs text-slate-500 mt-1">Cash Booking Commission</p>
          <p className="text-xs text-slate-400 mt-0.5">must chase or net</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(s.totalOnlineUnpaid)}</p>
          <p className="text-xs text-slate-500 mt-1">Online Commission</p>
          <p className="text-xs text-slate-400 mt-0.5">auto-settled on payout</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(s.totalCollected)}</p>
          <p className="text-xs text-slate-500 mt-1">Total Collected</p>
          <p className="text-xs text-slate-400 mt-0.5">all time</p>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-800 space-y-1">
        <p><strong>Online commissions</strong> are automatically collected when admin completes a payout — no manual action needed.</p>
        <p><strong>Cash commissions</strong> require manual settlement: either collect directly from the owner or net it from their online balance (if admin holds enough).</p>
      </div>

      {s.ownersWithDebt > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 shrink-0" />
          <p className="text-sm text-orange-800">
            <strong>{s.ownersWithDebt} ground owner{s.ownersWithDebt !== 1 ? "s" : ""}</strong> have outstanding commission totalling <strong>{fmt(s.totalUnpaid)}</strong>.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { key: "outstanding", label: `Outstanding (${owners.filter((o) => o.unpaidCommission > 0).length})` },
          { key: "all",         label: `All Owners (${owners.length})` },
          { key: "settled",     label: "Fully Settled" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              filter === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Owner list */}
      {displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-6 py-16 text-center">
          <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No owners found for this filter</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map((o) => (
            <OwnerCard key={o.ownerId} owner={o} onSettle={setSettling} />
          ))}
        </div>
      )}

      {settling && (
        <SettleModal owner={settling} onClose={() => setSettling(null)} onDone={handleSettled} />
      )}
    </div>
  );
}
