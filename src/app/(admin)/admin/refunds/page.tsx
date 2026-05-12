"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, CreditCard, Banknote, AlertCircle, CheckCircle,
  Calendar, MapPin, User, X, RefreshCw, Settings, Plus, Trash2, Save,
} from "lucide-react";
import type { PolicyTier } from "@/lib/cancellation-policy";

interface BookingRow {
  id:                string;
  bookingDate:       string;
  startTime:         string;
  endTime:           string;
  totalAmount:       number;
  paymentMethod:     string;
  paymentStatus:     string;
  refundStatus:      string;
  refundNote:        string | null;
  refundProcessedAt: string | null;
  refundPercent:     number | null;
  refundAmount:      number | null;
  cancelledBy:       string | null;
  cancelledAt:       string | null;
  updatedAt:         string;
  user: { name: string; email: string; phone: string | null };
  facility: {
    name: string; city: string;
    owner: { user: { name: string; email: string } };
  };
}

interface Summary {
  totalCancelled:   number;
  onlineTotal:      number;
  onlinePaid:       number;
  refundNeeded:     number;
  refundProcessed:  number;
  cashTotal:        number;
  totalRefundValue: number;
}

const fmt  = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const fmtD = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ── Refund Policy Settings Panel ─────────────────────────────────────────────

function PolicyPanel({ onClose }: { onClose: () => void }) {
  const [tiers,   setTiers]   = useState<PolicyTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/admin/refund-policy")
      .then((r) => r.json())
      .then((d) => setTiers(d.tiers ?? []))
      .finally(() => setLoading(false));
  }, []);

  const update = (idx: number, field: keyof PolicyTier, val: number) => {
    setSuccess(false);
    setTiers((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: val } : t));
  };

  const addTier = () => {
    setSuccess(false);
    setTiers((prev) => {
      const sorted  = [...prev].sort((a, b) => b.minHours - a.minHours);
      const highest = sorted[0]?.minHours ?? 48;
      return [...prev, { minHours: highest + 12, refundPercent: 75 }].sort((a, b) => b.minHours - a.minHours);
    });
  };

  const removeTier = (idx: number) => {
    if (tiers.length <= 1) return;
    setSuccess(false);
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setError("");
    setSuccess(false);

    const sorted = [...tiers].sort((a, b) => b.minHours - a.minHours);
    const hasZero = sorted.some((t) => t.minHours === 0);
    if (!hasZero) {
      setError("One tier must have a threshold of 0 hours (the final fallback).");
      return;
    }

    setSaving(true);
    const res  = await fetch("/api/admin/refund-policy", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ tiers: sorted }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
    setTiers(data.tiers);
    setSuccess(true);
  };

  const sorted = [...tiers].sort((a, b) => b.minHours - a.minHours);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-500" />
            Cancellation Refund Policy
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Define how much players get back when they cancel an online booking.
            Changes apply to all new cancellations immediately.
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />Loading policy…
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left pb-2 font-medium pr-4">Tier</th>
                  <th className="text-left pb-2 font-medium pr-4">Min. hours before booking</th>
                  <th className="text-left pb-2 font-medium pr-4">Refund %</th>
                  <th className="text-left pb-2 font-medium">Preview</th>
                  <th className="pb-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map((tier, idx) => {
                  const next = sorted[idx - 1];
                  const label = next
                    ? `${tier.minHours}–${next.minHours} hrs before`
                    : `${tier.minHours}+ hrs before`;
                  const isLast = tier.minHours === 0;
                  const pctColor =
                    tier.refundPercent === 100 ? "text-green-600 bg-green-50" :
                    tier.refundPercent >= 50   ? "text-blue-600 bg-blue-50"   :
                    tier.refundPercent >= 25   ? "text-amber-600 bg-amber-50" :
                                                  "text-red-600 bg-red-50";

                  const origIdx = tiers.indexOf(tier);

                  return (
                    <tr key={idx} className="group">
                      <td className="py-3 pr-4 text-slate-400 text-xs">{idx + 1}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={tier.minHours}
                            onChange={(e) => update(origIdx, "minHours", Number(e.target.value))}
                            disabled={isLast}
                            className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
                          />
                          <span className="text-slate-400 text-xs">hours</span>
                          {isLast && <span className="text-xs text-slate-400 italic">(fallback)</span>}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={tier.refundPercent}
                            onChange={(e) => update(origIdx, "refundPercent", Number(e.target.value))}
                            className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <span className="text-slate-400 text-xs">%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">{label}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pctColor}`}>
                            {tier.refundPercent}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        {tiers.length > 1 && !isLast && (
                          <button
                            onClick={() => removeTier(origIdx)}
                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <button
              onClick={addTier}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />Add tier
            </button>
            <div className="flex items-center gap-3">
              {error   && <p className="text-xs text-red-600">{error}</p>}
              {success && <p className="text-xs text-green-600 font-medium">Saved!</p>}
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Policy
              </button>
            </div>
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            <strong>Note:</strong> Policy changes only affect cancellations made after saving.
            Existing bookings already cancelled keep their recorded refund amount.
          </div>
        </>
      )}
    </div>
  );
}

// ── Refund Modal ──────────────────────────────────────────────────────────────

function RefundModal({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingRow;
  onClose: () => void;
  onDone:  () => void;
}) {
  const [note,    setNote]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const refundAmt = booking.refundAmount ?? booking.totalAmount;

  const submit = async () => {
    setLoading(true);
    setError("");
    const res  = await fetch(`/api/admin/refunds/${booking.id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ note }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Failed."); return; }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Mark Refund Processed</h3>
            <p className="text-xs text-slate-500 mt-0.5">{booking.user.name} · {fmt(refundAmt)}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>Player</span>
            <span className="font-medium">{booking.user.name}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Email</span>
            <span className="text-xs">{booking.user.email}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Ground</span>
            <span className="font-medium">{booking.facility.name}</span>
          </div>
          <div className="flex justify-between text-slate-600 border-t border-blue-100 pt-1.5">
            <span>Booking Total</span>
            <span>{fmt(booking.totalAmount)}</span>
          </div>
          {booking.refundPercent != null && booking.refundPercent < 100 && (
            <div className="flex justify-between text-slate-600">
              <span>Refund Tier</span>
              <span className="font-medium text-amber-700">{booking.refundPercent}% of total</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 border-t border-blue-100 pt-1.5">
            <span>Amount to Refund</span>
            <span className="text-green-700">{fmt(refundAmt)}</span>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
          Process the refund via PayHere merchant dashboard first, then mark it here to notify the player.
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Reference / Note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Refund processed via PayHere ref #TXN123"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Refund Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Booking Card ──────────────────────────────────────────────────────────────

function BookingCard({ b, onRefund }: { b: BookingRow; onRefund?: (b: BookingRow) => void }) {
  const needsRefund = b.refundStatus === "NEEDED";
  const refunded    = b.refundStatus === "PROCESSED";
  const refundAmt   = b.refundAmount ?? b.totalAmount;

  const pctBadgeColor =
    (b.refundPercent ?? 0) === 100 ? "bg-green-50 text-green-700 border-green-100" :
    (b.refundPercent ?? 0) >= 50   ? "bg-blue-50 text-blue-700 border-blue-100"    :
    (b.refundPercent ?? 0) >= 25   ? "bg-amber-50 text-amber-700 border-amber-100" :
                                      "bg-red-50 text-red-600 border-red-100";

  const cancellerLabel =
    b.cancelledBy === "owner"  ? "by owner"  :
    b.cancelledBy === "worker" ? "by worker" :
    b.cancelledBy === "user"   ? "by player" : "";

  return (
    <div className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 ${needsRefund ? "border-red-200" : "border-slate-100"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
            {b.user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{b.user.name}</p>
            <p className="text-xs text-slate-400 truncate">{b.user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {b.paymentMethod === "ONLINE" && (
            <>
              {needsRefund && (
                <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full font-medium">
                  <AlertCircle className="w-3 h-3" />Refund Needed
                </span>
              )}
              {refunded && (
                <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium">
                  <CheckCircle className="w-3 h-3" />Refunded
                </span>
              )}
              {!needsRefund && !refunded && (
                <span className="text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">
                  {b.paymentStatus === "PAID" ? "Paid" : b.paymentStatus === "FAILED" ? "Payment Failed" : "Not Paid"}
                </span>
              )}
              {b.refundPercent != null && (needsRefund || refunded) && (
                <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${pctBadgeColor}`}>
                  {b.refundPercent}% refund
                </span>
              )}
            </>
          )}

          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">{fmt(b.totalAmount)}</p>
            {(needsRefund || refunded) && b.refundPercent != null && b.refundPercent !== 100 && (
              <p className="text-xs text-green-700 font-medium">{fmt(refundAmt)} owed</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3 shrink-0" />{b.facility.name}, {b.facility.city}</span>
        <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3 shrink-0" />{fmtD(b.bookingDate)} · {b.startTime}–{b.endTime}</span>
        <span className="flex items-center gap-1.5"><User className="w-3 h-3 shrink-0" />Owner: {b.facility.owner.user.name}</span>
      </div>

      {refunded && b.refundNote && (
        <p className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
          Note: {b.refundNote} · {b.refundProcessedAt ? fmtD(b.refundProcessedAt) : ""}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-50">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Cancelled {b.cancelledAt ? fmtD(b.cancelledAt) : fmtD(b.updatedAt)}</span>
          {cancellerLabel && (
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-md">{cancellerLabel}</span>
          )}
        </div>
        {needsRefund && onRefund && (
          <button
            onClick={() => onRefund(b)}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Mark Refunded
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminRefundsPage() {
  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [online,       setOnline]       = useState<BookingRow[]>([]);
  const [cash,         setCash]         = useState<BookingRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState<"online" | "cash">("online");
  const [refundFilter, setRefundFilter] = useState<"all" | "needed" | "processed" | "notpaid">("needed");
  const [modal,        setModal]        = useState<BookingRow | null>(null);
  const [showPolicy,   setShowPolicy]   = useState(false);

  const load = useCallback(async () => {
    const res  = await fetch("/api/admin/refunds");
    const data = await res.json();
    setSummary(data.summary ?? null);
    setOnline(data.online   ?? []);
    setCash(data.cash       ?? []);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const handleDone = async () => {
    setModal(null);
    setLoading(true);
    await load();
    setLoading(false);
  };

  const s = summary ?? {
    totalCancelled: 0, onlineTotal: 0, onlinePaid: 0,
    refundNeeded: 0, refundProcessed: 0, cashTotal: 0, totalRefundValue: 0,
  };

  const filteredOnline = online.filter((b) => {
    if (refundFilter === "needed")    return b.refundStatus === "NEEDED";
    if (refundFilter === "processed") return b.refundStatus === "PROCESSED";
    if (refundFilter === "notpaid")   return b.paymentStatus !== "PAID";
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading refunds…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cancelled Bookings & Refunds</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Track online cancellations that need refunds and cash cancellations separately
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPolicy((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium transition-colors ${
              showPolicy
                ? "bg-slate-900 border-slate-900 text-white"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Settings className="w-4 h-4" />Refund Policy
          </button>
          <button
            onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
        </div>
      </div>

      {/* Policy Settings Panel */}
      {showPolicy && <PolicyPanel onClose={() => setShowPolicy(false)} />}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`rounded-2xl border p-5 ${s.refundNeeded > 0 ? "bg-red-500 border-red-400" : "bg-white border-slate-100"}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.refundNeeded > 0 ? "bg-red-400" : "bg-red-50"}`}>
            <AlertCircle className={`w-5 h-5 ${s.refundNeeded > 0 ? "text-white" : "text-red-500"}`} />
          </div>
          <p className={`text-2xl font-bold ${s.refundNeeded > 0 ? "text-white" : "text-slate-900"}`}>{s.refundNeeded}</p>
          <p className={`text-xs mt-1 ${s.refundNeeded > 0 ? "text-red-100" : "text-slate-500"}`}>Refunds Needed</p>
          <p className={`text-xs mt-0.5 ${s.refundNeeded > 0 ? "text-red-200" : "text-slate-400"}`}>{fmt(s.totalRefundValue)} total</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{s.refundProcessed}</p>
          <p className="text-xs text-slate-500 mt-1">Refunds Done</p>
          <p className="text-xs text-slate-400 mt-0.5">online payments</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{s.onlineTotal}</p>
          <p className="text-xs text-slate-500 mt-1">Online Cancellations</p>
          <p className="text-xs text-slate-400 mt-0.5">{s.onlinePaid} had paid</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <Banknote className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{s.cashTotal}</p>
          <p className="text-xs text-slate-500 mt-1">Cash Cancellations</p>
          <p className="text-xs text-slate-400 mt-0.5">no payment to refund</p>
        </div>
      </div>

      {s.refundNeeded > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {s.refundNeeded} refund{s.refundNeeded !== 1 ? "s" : ""} pending — {fmt(s.totalRefundValue)} to return to players
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              Process each refund via the PayHere merchant dashboard, then mark it done here to notify the player.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { key: "online", label: `Online (PayHere) (${s.onlineTotal})`,  icon: CreditCard },
          { key: "cash",   label: `Cash on Arrival (${s.cashTotal})`,      icon: Banknote  },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* Online tab */}
      {tab === "online" && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {([
              { key: "needed",    label: `Needs Refund (${s.refundNeeded})`   },
              { key: "processed", label: `Refunded (${s.refundProcessed})`    },
              { key: "notpaid",   label: "Not Paid"                           },
              { key: "all",       label: `All (${online.length})`             },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setRefundFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  refundFilter === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredOnline.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 px-6 py-16 text-center">
              <CreditCard className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No online cancellations for this filter</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredOnline.map((b) => (
                <BookingCard key={b.id} b={b} onRefund={setModal} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cash tab */}
      {tab === "cash" && (
        <div className="flex flex-col gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-800">
            Cash on arrival bookings that were cancelled. No online payment was made, so no refund is needed.
            These are shown for record-keeping only.
          </div>

          {cash.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 px-6 py-16 text-center">
              <Banknote className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No cash cancellations</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cash.map((b) => (
                <BookingCard key={b.id} b={b} />
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <RefundModal booking={modal} onClose={() => setModal(null)} onDone={handleDone} />
      )}
    </div>
  );
}
