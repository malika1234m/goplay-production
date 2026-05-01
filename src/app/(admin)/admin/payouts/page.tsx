"use client";

import { useState, useEffect } from "react";
import {
  Wallet, CheckCircle, Clock, AlertCircle, Loader2,
  Search, Landmark, X, CreditCard, ChevronDown, ChevronUp,
  Calendar, MapPin, TrendingDown, BadgeDollarSign,
} from "lucide-react";

/* ── Types ── */
interface Summary {
  pending:            number;
  processing:         number;
  totalPendingAmount: number;
  totalPaidOut:       number;
  totalOwed:          number;
}

interface PayoutRequest {
  id:               string;
  ownerName:        string;
  ownerEmail:       string;
  bankName:         string | null;
  bankBranch:       string | null;
  accountNumber:    string | null;
  accountHolderName: string | null;
  amount:           number;
  commission:       number;
  netAmount:        number;
  status:           string;
  requestedAt:      string;
  processedAt:      string | null;
  reference:        string | null;
  notes:            string | null;
}

interface OnlineEarning {
  ownerId:  string;
  earnedAt: string;
  grossAmount: number;
  platformFee: number;
  netAmount:   number;
  facility: { name: string; city: string };
  booking: {
    bookingDate: string;
    startTime:   string;
    endTime:     string;
    user:        { name: string };
  };
}

interface OwedOwner {
  ownerId:      string;
  ownerName:    string;
  ownerEmail:   string;
  grossOnline:  number;
  feeOnline:    number;
  netOnline:    number;
  paidOut:      number;
  inFlight:     number;
  currentlyOwed: number;
  bookingCount: number;
  earnings:     OnlineEarning[];
}

/* ── Helpers ── */
function fmt(n: number) { return `Rs. ${Math.round(n).toLocaleString()}`; }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const statusStyle: Record<string, string> = {
  PENDING:    "bg-amber-50 text-amber-700 border-amber-200",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED:  "bg-green-50 text-green-700 border-green-200",
  FAILED:     "bg-red-50 text-red-600 border-red-200",
};

/* ── Owner balance card ── */
function OwnerBalanceCard({ owner }: { owner: OwedOwner }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${
      owner.currentlyOwed > 0 ? "border-amber-200 bg-amber-50/30" : "border-slate-100 bg-white"
    }`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {owner.ownerName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{owner.ownerName}</p>
            <p className="text-xs text-slate-400">{owner.ownerEmail} · {owner.bookingCount} online booking{owner.bookingCount !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">Total Collected</p>
            <p className="text-sm font-medium text-slate-600">{fmt(owner.grossOnline)}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">Already Paid</p>
            <p className="text-sm font-medium text-slate-500">{fmt(owner.paidOut)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Currently Owed</p>
            <p className={`text-base font-bold ${owner.currentlyOwed > 0 ? "text-amber-700" : "text-slate-400"}`}>
              {fmt(owner.currentlyOwed)}
            </p>
            {owner.inFlight > 0 && (
              <p className="text-xs text-blue-600">{fmt(owner.inFlight)} in progress</p>
            )}
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {/* Balance breakdown */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 bg-white px-0">
            {[
              { label: "Gross Collected", value: owner.grossOnline, color: "text-slate-700" },
              { label: "Platform Fee (10%)", value: owner.feeOnline, color: "text-red-500", prefix: "−" },
              { label: "Net Owed to Owner", value: owner.netOnline, color: "text-green-700" },
            ].map(({ label, value, color, prefix }) => (
              <div key={label} className="px-5 py-3 text-center">
                <p className="text-xs text-slate-400">{label}</p>
                <p className={`text-sm font-bold mt-0.5 ${color}`}>{prefix}{fmt(value)}</p>
              </div>
            ))}
          </div>

          {/* Transaction list */}
          <div className="border-t border-slate-100">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <span>Booking / Ground</span>
              <span className="text-right">Gross</span>
              <span className="text-right">Fee</span>
              <span className="text-right">Net</span>
            </div>
            <div className="divide-y divide-slate-50 bg-white">
              {owner.earnings.map((e, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{e.booking.user.name}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">
                        <CreditCard className="w-2.5 h-2.5" />Online
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.facility.name}, {e.facility.city}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(e.booking.bookingDate)}</span>
                      <span>{e.booking.startTime}–{e.booking.endTime}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 text-right">{fmt(e.grossAmount)}</p>
                  <p className="text-sm text-red-400 text-right">−{fmt(e.platformFee)}</p>
                  <p className="text-sm font-semibold text-green-700 text-right">{fmt(e.netAmount)}</p>
                </div>
              ))}
            </div>
            {/* Owner subtotal */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 bg-slate-50 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500">Owner Total</p>
              <p className="text-sm font-semibold text-slate-700 text-right">{fmt(owner.grossOnline)}</p>
              <p className="text-sm font-semibold text-red-500 text-right">−{fmt(owner.feeOnline)}</p>
              <p className="text-sm font-bold text-green-700 text-right">{fmt(owner.netOnline)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
export default function AdminPayoutsPage() {
  const [summary,       setSummary]       = useState<Summary | null>(null);
  const [payouts,       setPayouts]       = useState<PayoutRequest[]>([]);
  const [owedToOwners,  setOwedToOwners]  = useState<OwedOwner[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [tab,           setTab]           = useState<"owed" | "requests">("owed");
  const [filter,        setFilter]        = useState("ALL");
  const [search,        setSearch]        = useState("");
  const [selected,      setSelected]      = useState<PayoutRequest | null>(null);
  const [updating,      setUpdating]      = useState(false);
  const [newStatus,     setNewStatus]     = useState("");
  const [reference,     setReference]     = useState("");
  const [notes,         setNotes]         = useState("");
  const [modalError,    setModalError]    = useState("");

  const load = async () => {
    const res  = await fetch("/api/admin/payouts");
    const data = await res.json();
    setSummary(data.summary   ?? null);
    setPayouts(data.payouts   ?? []);
    setOwedToOwners(data.owedToOwners ?? []);
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const openModal = (p: PayoutRequest) => {
    setSelected(p);
    setNewStatus(p.status === "PENDING" ? "PROCESSING" : "COMPLETED");
    setReference(p.reference ?? "");
    setNotes(p.notes ?? "");
    setModalError("");
  };

  const closeModal = () => { setSelected(null); setModalError(""); };

  const submitUpdate = async () => {
    if (!selected) return;
    setUpdating(true);
    setModalError("");
    const res  = await fetch(`/api/admin/payouts/${selected.id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: newStatus, reference, notes }),
    });
    const data = await res.json();
    setUpdating(false);
    if (!res.ok) { setModalError(data.error ?? "Update failed."); return; }
    closeModal();
    setLoading(true);
    await load();
    setLoading(false);
  };

  const filteredPayouts = payouts.filter((p) => {
    const matchStatus = filter === "ALL" || p.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || p.ownerName.toLowerCase().includes(q)
      || p.ownerEmail.toLowerCase().includes(q)
      || (p.reference ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  const s = summary ?? { pending: 0, processing: 0, totalPendingAmount: 0, totalPaidOut: 0, totalOwed: 0 };

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payout Management</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Online card payments (PayHere) land in your account — track what you owe each ground owner and process their requests
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-amber-500 rounded-2xl border border-amber-400 p-5">
          <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center mb-3">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-white">{fmt(s.totalOwed)}</p>
          <p className="text-xs text-amber-100 mt-1">Total Currently Owed</p>
          <p className="text-xs text-amber-200 mt-0.5">to all ground owners</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{s.pending}</p>
          <p className="text-xs text-slate-500 mt-1">Pending Requests</p>
          <p className="text-xs text-slate-400 mt-0.5">{fmt(s.totalPendingAmount)} awaiting action</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <BadgeDollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{s.processing}</p>
          <p className="text-xs text-slate-500 mt-1">In Processing</p>
          <p className="text-xs text-slate-400 mt-0.5">bank transfers initiated</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(s.totalPaidOut)}</p>
          <p className="text-xs text-slate-500 mt-1">Total Paid Out</p>
          <p className="text-xs text-slate-400 mt-0.5">all time completed</p>
        </div>
      </div>

      {/* Pending request alert */}
      {s.pending > 0 && (
        <div
          onClick={() => setTab("requests")}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 cursor-pointer hover:bg-amber-100/60 transition-colors"
        >
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {s.pending} payout request{s.pending !== 1 ? "s" : ""} need your action
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Click to view → initiate bank transfers, then mark as completed with the reference number.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { key: "owed",     label: `Money Owed (${owedToOwners.length})` },
          { key: "requests", label: `Payout Requests (${payouts.length})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Money Owed ── */}
      {tab === "owed" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-slate-400">
            Every online (PayHere) booking that has been marked complete — the net amounts below are sitting in your account and owe to the respective ground owners.
          </p>

          {owedToOwners.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 px-6 py-16 text-center">
              <CreditCard className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No completed online bookings yet</p>
            </div>
          ) : (
            <>
              {owedToOwners.map((owner) => (
                <OwnerBalanceCard key={owner.ownerId} owner={owner} />
              ))}

              {/* Platform summary footer */}
              <div className="bg-slate-900 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-white">Platform Summary</p>
                  <p className="text-xs text-slate-400 mt-0.5">{owedToOwners.length} ground owner{owedToOwners.length !== 1 ? "s" : ""} with online earnings</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-400">Your commission</p>
                    <p className="text-sm font-bold text-green-400">
                      {fmt(owedToOwners.reduce((s, o) => s + o.feeOnline, 0))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">You owe owners</p>
                    <p className="text-base font-bold text-amber-400">{fmt(s.totalOwed)}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Payout Requests ── */}
      {tab === "requests" && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search owner name, email, reference…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {["ALL", "PENDING", "PROCESSING", "COMPLETED", "FAILED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                    filter === s
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            {filteredPayouts.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <Wallet className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No payout requests found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bank Details</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Amount</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Requested</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reference</th>
                      <th className="px-5 py-3.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredPayouts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">{p.ownerName}</p>
                          <p className="text-xs text-slate-400">{p.ownerEmail}</p>
                        </td>
                        <td className="px-5 py-4">
                          {p.bankName ? (
                            <div>
                              <p className="text-slate-700 font-medium text-xs">{p.bankName}{p.bankBranch ? ` · ${p.bankBranch}` : ""}</p>
                              <p className="text-xs text-slate-400">{p.accountNumber} · {p.accountHolderName}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-red-500">No bank details</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <p className="font-bold text-slate-900">{fmt(p.netAmount)}</p>
                          <p className="text-xs text-slate-400">
                            Gross {fmt(p.amount)} · Fee {fmt(p.commission)}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusStyle[p.status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                            {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {fmtDate(p.requestedAt)}
                          {p.processedAt && <p className="text-slate-400">Done {fmtDate(p.processedAt)}</p>}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {p.reference ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-4">
                          {(p.status === "PENDING" || p.status === "PROCESSING") && (
                            <button
                              onClick={() => openModal(p)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              Process
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Process payout modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-900">Process Payout</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selected.ownerName} · {fmt(selected.netAmount)}</p>
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Bank info */}
              <div className="bg-slate-50 rounded-xl p-4 flex items-start gap-3">
                <Landmark className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-slate-800">
                    {selected.bankName ?? "—"}{selected.bankBranch ? ` · ${selected.bankBranch}` : ""}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Account: {selected.accountNumber ?? "—"} · {selected.accountHolderName ?? "—"}
                  </p>
                </div>
              </div>

              {/* Amount */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>Transfer to owner</span>
                  <span>{fmt(selected.netAmount)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  This is the net amount after platform fees. Transfer exactly this amount to the owner&apos;s bank account.
                </p>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Update Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="PROCESSING">Processing — bank transfer initiated</option>
                  <option value="COMPLETED">Completed — funds transferred to owner</option>
                  <option value="FAILED">Failed — could not process</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Bank Reference Number</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. TXN123456789"
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes for owner (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any message to send to the ground owner…"
                  rows={2}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 resize-none"
                />
              </div>

              {modalError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{modalError}</p>}
            </div>

            <div className="px-6 pb-5 flex gap-3 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitUpdate}
                disabled={updating}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {updating && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
