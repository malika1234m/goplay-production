"use client";

import { useState, useEffect } from "react";
import {
  Wallet, Landmark, CheckCircle, AlertCircle,
  Loader2, Save, CreditCard, Info, MapPin, Calendar, Clock,
} from "lucide-react";

interface Balance {
  grossOnline:       number;
  feeOnline:         number;
  netOnline:         number;
  paidOut:           number;
  inFlight:          number;
  availableBalance:  number;
}

interface Commission {
  totalCommission:  number;
  paidCommission:   number;
  unpaidCommission: number;
  cashUnpaid:       number;
}

interface OnlineEarning {
  id:          string;
  earnedAt:    string;
  grossAmount: number;
  platformFee: number;
  netAmount:   number;
  facility: { id: string; name: string; city: string };
  booking: {
    bookingDate: string;
    startTime:   string;
    endTime:     string;
    totalHours:  number;
    user:        { name: string };
  };
}

interface PayoutRecord {
  id:          string;
  netAmount:   number;
  status:      string;
  requestedAt: string;
  processedAt: string | null;
  reference:   string | null;
  notes:       string | null;
}

interface CommissionSettlement {
  id:          string;
  netAmount:   number;
  requestedAt: string;
  notes:       string | null;
}

interface BankDetails {
  bankName:          string;
  bankBranch:        string;
  accountNumber:     string;
  accountHolderName: string;
}

const statusStyle: Record<string, string> = {
  PENDING:    "bg-amber-50 text-amber-700",
  PROCESSING: "bg-blue-50 text-blue-700",
  COMPLETED:  "bg-green-50 text-green-700",
  FAILED:     "bg-red-50 text-red-600",
};

function fmt(n: number) {
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function GroundOwnerPayoutsPage() {
  const [balance,               setBalance]               = useState<Balance | null>(null);
  const [commission,            setCommission]            = useState<Commission | null>(null);
  const [onlineEarnings,        setOnlineEarnings]        = useState<OnlineEarning[]>([]);
  const [payouts,               setPayouts]               = useState<PayoutRecord[]>([]);
  const [commissionSettlements, setCommissionSettlements] = useState<CommissionSettlement[]>([]);
  const [bank,           setBank]           = useState<BankDetails>({ bankName: "", bankBranch: "", accountNumber: "", accountHolderName: "" });
  const [hasBankDetails, setHasBankDetails] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [minPayout,      setMinPayout]      = useState(1000);
  const [loading,        setLoading]        = useState(true);
  const [savingBank,     setSavingBank]     = useState(false);
  const [requesting,     setRequesting]     = useState(false);
  const [bankSaved,      setBankSaved]      = useState(false);
  const [error,          setError]          = useState("");
  const [tab,            setTab]            = useState<"breakdown" | "history" | "bank">("breakdown");

  const load = async () => {
    const [payRes, bankRes] = await Promise.all([
      fetch("/api/ground-owner/payout").then((r) => r.json()),
      fetch("/api/ground-owner/bank-details").then((r) => r.json()),
    ]);
    setBalance(payRes.balance ?? null);
    setCommission(payRes.commission ?? null);
    setOnlineEarnings(payRes.onlineEarnings ?? []);
    setPayouts(payRes.payouts ?? []);
    setCommissionSettlements(payRes.commissionSettlements ?? []);
    setHasBankDetails(payRes.hasBankDetails ?? false);
    setCooldownRemaining(payRes.cooldownRemaining ?? 0);
    setMinPayout(payRes.settings?.minPayout ?? 1000);
    if (bankRes.bankDetails) {
      setBank({
        bankName:          bankRes.bankDetails.bankName          ?? "",
        bankBranch:        bankRes.bankDetails.bankBranch        ?? "",
        accountNumber:     bankRes.bankDetails.accountNumber     ?? "",
        accountHolderName: bankRes.bankDetails.accountHolderName ?? "",
      });
    }
  };

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const saveBank = async () => {
    setSavingBank(true);
    setError("");
    const res  = await fetch("/api/ground-owner/bank-details", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(bank),
    });
    const data = await res.json();
    setSavingBank(false);
    if (!res.ok) { setError(data.error ?? "Failed to save."); return; }
    setHasBankDetails(true);
    setBankSaved(true);
    setTimeout(() => setBankSaved(false), 3000);
  };

  const requestPayout = async () => {
    setRequesting(true);
    setError("");
    const res  = await fetch("/api/ground-owner/payout", { method: "POST" });
    const data = await res.json();
    setRequesting(false);
    if (!res.ok) { setError(data.error ?? "Failed to request payout."); return; }
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  const b            = balance ?? { grossOnline: 0, feeOnline: 0, netOnline: 0, paidOut: 0, inFlight: 0, availableBalance: 0 };
  const c            = commission ?? { totalCommission: 0, paidCommission: 0, unpaidCommission: 0, cashUnpaid: 0 };
  const hasPending   = payouts.some((p) => p.status === "PENDING" || p.status === "PROCESSING");
  const canRequest   = hasBankDetails && !hasPending && b.availableBalance >= minPayout && cooldownRemaining === 0;

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payouts</h1>
        <p className="text-slate-500 text-sm mt-0.5">Request your online booking earnings from the admin</p>
      </div>

      {/* How it works callout */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800 leading-relaxed">
          When players pay online via card (PayHere), that money goes directly to the admin&apos;s account.
          The admin holds it on your behalf. Only those <strong>online card payments</strong> appear here — cash
          collected at the ground is already in your hands and is <strong>not included</strong>.
          Request a payout and the admin will transfer your net earnings to your bank account.
        </p>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(b.grossOnline)}</p>
          <p className="text-xs text-slate-500 mt-1">Online Bookings (Gross)</p>
          <p className="text-xs text-slate-400 mt-0.5">total from card payments</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
            <Info className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(b.feeOnline)}</p>
          <p className="text-xs text-slate-500 mt-1">Platform Fee (10%)</p>
          <p className="text-xs text-slate-400 mt-0.5">deducted by GoPlay</p>
        </div>

        <div className="bg-green-600 rounded-2xl border border-green-500 p-5">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center mb-3">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-white">{fmt(b.availableBalance)}</p>
          <p className="text-xs text-green-100 mt-1">Available to Request</p>
          <p className="text-xs text-green-200 mt-0.5">held by admin for you</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
            <CheckCircle className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{fmt(b.paidOut)}</p>
          <p className="text-xs text-slate-500 mt-1">Already Paid Out</p>
          {b.inFlight > 0 && <p className="text-xs text-amber-600 mt-0.5">{fmt(b.inFlight)} in progress</p>}
        </div>
      </div>

      {/* Warnings */}
      {!hasBankDetails && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Bank details required</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Add your bank account in the <button onClick={() => setTab("bank")} className="underline font-medium">Bank Details</button> tab before you can request a payout.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">{error}</p>
      )}

      {/* Commission status panel */}
      {c.unpaidCommission > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-600 shrink-0" />
            <p className="text-sm font-semibold text-orange-800">Outstanding Platform Commission</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-orange-600">Total Owed</p>
              <p className="font-bold text-orange-800">{fmt(c.unpaidCommission)}</p>
            </div>
            {c.cashUnpaid > 0 && (
              <div>
                <p className="text-xs text-orange-600">From Cash Bookings</p>
                <p className="font-bold text-orange-800">{fmt(c.cashUnpaid)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-orange-600">Already Paid</p>
              <p className="font-bold text-green-700">{fmt(c.paidCommission)}</p>
            </div>
          </div>
          <p className="text-xs text-orange-700">
            Online commissions are automatically settled when the admin processes your payout.
            {c.cashUnpaid > 0 && " Cash booking commission may be deducted from your online balance or collected separately by the admin."}
          </p>
        </div>
      )}

      {/* Request payout CTA */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="font-semibold text-slate-900">Request Payout</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {cooldownRemaining > 0
              ? <>Payout requests are limited to once per 7 days. Available again in <span className="font-semibold text-slate-700">{cooldownRemaining} day{cooldownRemaining !== 1 ? "s" : ""}</span></>
              : canRequest
              ? <>You can request <span className="font-semibold text-green-600">{fmt(b.availableBalance)}</span> from the admin</>
              : hasPending
              ? "A payout request is already in progress"
              : b.availableBalance < minPayout
              ? `Minimum payout amount is Rs. ${minPayout.toLocaleString()}`
              : "Add bank details to enable payouts"}
          </p>
        </div>
        <button
          onClick={requestPayout}
          disabled={!canRequest || requesting}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
          Request Payout
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="flex border-b border-slate-100">
          {([
            { key: "breakdown", label: `Online Bookings (${onlineEarnings.length})` },
            { key: "history",   label: `History (${payouts.length + commissionSettlements.length})` },
            { key: "bank",      label: "Bank Details" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
                tab === key
                  ? "border-b-2 border-green-500 text-green-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Online bookings breakdown */}
        {tab === "breakdown" && (
          <>
            {onlineEarnings.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <CreditCard className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No completed online bookings yet</p>
                <p className="text-xs text-slate-300 mt-1">Online earnings appear here once a booking is marked complete</p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <span>Booking</span>
                  <span className="text-right">Gross</span>
                  <span className="text-right">Fee</span>
                  <span className="text-right">Your Net</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {onlineEarnings.map((e) => (
                    <div key={e.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800">{e.booking.user.name}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                            <CreditCard className="w-2.5 h-2.5" />Card
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{e.facility.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />{fmtDate(e.booking.bookingDate)}
                          </span>
                          <span>{e.booking.startTime}–{e.booking.endTime}</span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 text-right">{fmt(e.grossAmount)}</p>
                      <p className="text-sm text-red-400 text-right">−{fmt(e.platformFee)}</p>
                      <p className="text-sm font-semibold text-green-700 text-right">{fmt(e.netAmount)}</p>
                    </div>
                  ))}
                </div>

                {/* Total row */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3.5 bg-slate-50 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500">Total from admin</p>
                  <p className="text-sm font-semibold text-slate-700 text-right">{fmt(b.grossOnline)}</p>
                  <p className="text-sm font-semibold text-red-500 text-right">−{fmt(b.feeOnline)}</p>
                  <p className="text-sm font-bold text-green-700 text-right">{fmt(b.netOnline)}</p>
                </div>
              </>
            )}
          </>
        )}

        {/* Payout history */}
        {tab === "history" && (
          <>
            {/* Payout requests */}
            {payouts.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Wallet className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No payout requests yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {payouts.map((p) => (
                  <div key={p.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{fmt(p.netAmount)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Requested {fmtDate(p.requestedAt)}
                        {p.processedAt && ` · Processed ${fmtDate(p.processedAt)}`}
                      </p>
                      {p.reference && <p className="text-xs text-slate-500 mt-0.5">Ref: {p.reference}</p>}
                      {p.notes     && <p className="text-xs text-slate-400 mt-0.5 italic">{p.notes}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Commission settlements (balance deductions by admin) */}
            {commissionSettlements.length > 0 && (
              <>
                <div className="px-5 py-2.5 bg-orange-50 border-t border-orange-100">
                  <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Commission Deductions</p>
                  <p className="text-[11px] text-orange-600 mt-0.5">These amounts were deducted from your online balance by the admin as platform commission settlement.</p>
                </div>
                <div className="divide-y divide-slate-50">
                  {commissionSettlements.map((s) => (
                    <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap bg-orange-50/30">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-orange-800">−{fmt(s.netAmount)}</p>
                          <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">Commission</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">Settled {fmtDate(s.requestedAt)}</p>
                        {s.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{s.notes}</p>}
                      </div>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-orange-50 text-orange-700">
                        Collected
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Bank details */}
        {tab === "bank" && (
          <div className="p-6 max-w-lg">
            <div className="flex items-center gap-2 mb-5">
              <Landmark className="w-5 h-5 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">Bank Account Details</h3>
            </div>
            <div className="flex flex-col gap-4">
              {[
                { label: "Bank Name",           key: "bankName",          placeholder: "e.g. Bank of Ceylon" },
                { label: "Branch",              key: "bankBranch",        placeholder: "e.g. Colombo 03" },
                { label: "Account Number",      key: "accountNumber",     placeholder: "e.g. 0001234567" },
                { label: "Account Holder Name", key: "accountHolderName", placeholder: "Full name on account" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
                  <input
                    type="text"
                    value={bank[key as keyof BankDetails]}
                    onChange={(e) => setBank((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 placeholder:text-slate-400"
                  />
                </div>
              ))}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={saveBank}
                  disabled={savingBank}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {savingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {bankSaved ? "Saved!" : "Save Bank Details"}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Used only for payout transfers by the platform admin. Not shared with players or third parties.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* How payouts work */}
      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">How Payouts Work</p>
        <ol className="flex flex-col gap-3">
          {[
            { icon: CreditCard,  color: "text-blue-500",   text: "Player pays online via PayHere → money goes to admin's account" },
            { icon: Clock,       color: "text-amber-500",  text: "You mark the session complete → net earnings show here as available balance" },
            { icon: Wallet,      color: "text-green-500",  text: "You request a payout → admin receives notification and reviews" },
            { icon: CheckCircle, color: "text-green-600",  text: "Admin transfers to your bank → you get a notification with the bank reference" },
          ].map(({ icon: Icon, color, text }, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className={`w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <p className="text-sm text-slate-600 pt-0.5">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
