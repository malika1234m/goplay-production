"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle, Clock, ExternalLink, Landmark, Loader2,
  ReceiptText, RefreshCw, Undo2, Wallet, XCircle,
} from "lucide-react";

// Money for open match lobbies GoPlay collects: players pay GoPlay, GoPlay pays the ground
// when the lobby fills, and refunds lobbies that don't go ahead. Admin-only figures.

interface Person { id: string; name: string; email: string; phone: string | null }
interface Lobby {
  id: string; lobbyCode: string | null; status: string; preferredDate: string; preferredStartTime: string; preferredEndTime: string;
  category: { name: string }; facility: { id?: string; name: string; city: string };
}
interface Receipt { id: string; groupSize: number; amountDue: number; receiptUrl: string | null; receiptUploadedAt: string | null; user: Person; match: Lobby }
interface Payout {
  id: string; status: "DUE" | "PAID" | "CANCELLED"; collectedAmount: number; courtAmount: number; commissionRate: number;
  commissionAmount: number; amount: number; reference: string | null; paidAt: string | null; createdAt: string; match: Lobby;
  facility: { name: string; owner: { bankName: string | null; bankBranch: string | null; accountHolderName: string | null; accountNumber: string | null; user: { name: string; email: string; phone: string | null } } };
}
interface Refund {
  id: string; groupSize: number; amountDue: number; paymentStatus: string; receiptUrl: string | null; cancelledAt: string | null;
  refundStatus: "NEEDED" | "PROCESSED"; refundAmount: number | null; verified: boolean;
  refundBankName: string | null; refundBankBranch: string | null; refundAccountName: string | null; refundAccountNumber: string | null;
  refundDetailsAt: string | null; refundReference: string | null; refundedAt: string | null; user: Person; match: Lobby;
}
interface Summary {
  receiptsToCheck: number; payoutsDue: number; payoutsDueTotal: number; refundsDue: number; refundsDueTotal: number;
  received: number; paidOut: number; refunded: number; goplayEarned: number; commission: number;
}
interface Data { bankAccountSet: boolean; receipts: Receipt[]; payouts: Payout[]; refunds: Refund[]; summary: Summary }

const fmt   = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const fmtD  = (d: string) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const when  = (m: Lobby) => `${fmtD(m.preferredDate)} · ${m.preferredStartTime}–${m.preferredEndTime}`;
const input = "border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400";

function LobbyLine({ m }: { m: Lobby }) {
  return (
    <p className="text-xs text-slate-500">
      {m.category.name} · {m.facility.name}, {m.facility.city} · {when(m)}
      {m.lobbyCode && <span className="ml-1.5 font-mono text-slate-400">#{m.lobbyCode}</span>}
    </p>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? "font-bold text-slate-900" : "text-slate-700"}>{value}</span>
    </div>
  );
}

export default function LobbyPaymentsPage() {
  const [data,    setData]    = useState<Data | null>(null);
  const [tab,     setTab]     = useState<"receipts" | "payouts" | "refunds">("receipts");
  const [busy,    setBusy]    = useState<string | null>(null);
  const [error,   setError]   = useState("");
  const [refs,    setRefs]    = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [arrived, setArrived] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/lobby-payments", { cache: "no-store" });
    const d   = await res.json();
    if (!res.ok) { setError(d.error ?? "Couldn't load lobby payments."); return; }
    setData(d);
    window.dispatchEvent(new Event("admin-tasks-changed")); // refresh the sidebar badges
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(key: string, url: string, body: object) {
    setBusy(key); setError("");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d   = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(d.error ?? "That didn't work."); return; }
    await load();
  }

  if (!data && !error) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!data) return <p className="text-red-600">{error}</p>;
  const s = data.summary;

  const tabs = [
    { id: "receipts", label: "Receipts to check", count: s.receiptsToCheck, icon: ReceiptText },
    { id: "payouts",  label: "Payouts to grounds", count: s.payoutsDue,     icon: ArrowUpRight },
    { id: "refunds",  label: "Refunds to players", count: s.refundsDue,     icon: Undo2 },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lobby Payments</h1>
          <p className="text-slate-500 text-sm mt-0.5">Open match money GoPlay collects — check receipts, pay grounds, refund players</p>
        </div>
        <button onClick={() => void load()} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl px-3 py-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {!data.bankAccountSet && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-4 py-3 text-sm">
          <Landmark className="w-5 h-5 shrink-0" />
          <span className="flex-1">GoPlay&apos;s bank account isn&apos;t set, so players can&apos;t create or join open matches.</span>
          <Link href="/admin/settings" className="font-semibold underline">Set it in Settings</Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Received from players", value: fmt(s.received),     icon: ArrowDownLeft, tone: "text-emerald-700 bg-emerald-50" },
          { label: "Paid out to grounds",   value: fmt(s.paidOut),      sub: s.payoutsDue ? `${fmt(s.payoutsDueTotal)} still due` : "nothing due", icon: ArrowUpRight, tone: "text-blue-700 bg-blue-50" },
          { label: "Refunded to players",   value: fmt(s.refunded),     sub: s.refundsDue ? `${fmt(s.refundsDueTotal)} still due` : "nothing due",  icon: Undo2,        tone: "text-amber-700 bg-amber-50" },
          { label: "GoPlay earned",         value: fmt(s.goplayEarned), sub: `incl. ${fmt(s.commission)} commission`, icon: Wallet, tone: "text-violet-700 bg-violet-50" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.tone}`}><c.icon className="w-4 h-4" /></div>
            <p className="mt-3 text-xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-500">{c.label}</p>
            {c.sub && <p className="text-[11px] text-slate-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <t.icon className="w-4 h-4" /> {t.label}
            {t.count > 0 && <span className="bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5">{t.count}</span>}
          </button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle className="w-4 h-4" />{error}</div>}

      {/* Receipts: confirm only once the money shows in GoPlay's account */}
      {tab === "receipts" && (
        data.receipts.length === 0 ? <Empty text="No lobby receipts waiting." /> :
        <div className="flex flex-col gap-3">
          {data.receipts.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col md:flex-row gap-4">
              {r.receiptUrl && (
                <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.receiptUrl} alt="Receipt" className="w-28 h-36 object-cover rounded-xl border border-slate-200" />
                </a>
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <p className="font-semibold text-slate-900">{r.user.name} <span className="font-normal text-slate-400">· {r.user.phone ?? r.user.email}</span></p>
                <LobbyLine m={r.match} />
                <p className="text-sm text-slate-700 mt-1">Expect <strong>{fmt(r.amountDue)}</strong> for {r.groupSize} player{r.groupSize > 1 ? "s" : ""} · reference <span className="font-mono">{r.id.slice(0, 8).toUpperCase()}</span></p>
                {r.receiptUploadedAt && <p className="text-[11px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />Uploaded {new Date(r.receiptUploadedAt).toLocaleString()}</p>}
              </div>
              <div className="flex flex-col gap-2 md:w-64">
                <button disabled={busy === r.id} onClick={() => act(r.id, `/api/admin/lobby-payments/spots/${r.id}`, { action: "confirm" })}
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2.5">
                  {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Money received — confirm
                </button>
                <input className={input} placeholder="Reason, if rejecting" value={reasons[r.id] ?? ""} onChange={(e) => setReasons({ ...reasons, [r.id]: e.target.value })} />
                <button disabled={busy === r.id} onClick={() => act(r.id, `/api/admin/lobby-payments/spots/${r.id}`, { action: "reject", reason: reasons[r.id] })}
                  className="flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm font-semibold rounded-xl py-2">
                  <XCircle className="w-4 h-4" /> Not received — reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payouts: what GoPlay owes each ground for a filled lobby */}
      {tab === "payouts" && (
        data.payouts.length === 0 ? <Empty text="No payouts yet — they appear when a lobby fills." /> :
        <div className="flex flex-col gap-3">
          {data.payouts.map((p) => {
            const o = p.facility.owner;
            const hasBank = !!(o.bankName && o.accountNumber);
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-slate-100 p-4 grid md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{p.facility.name}</p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${p.status === "DUE" ? "bg-amber-100 text-amber-800" : p.status === "PAID" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>{p.status}</span>
                  </div>
                  <LobbyLine m={p.match} />
                  <p className="text-xs text-slate-500 mt-1">Owner: {o.user.name} · {o.user.phone ?? o.user.email}</p>
                </div>
                <div className="flex flex-col gap-1 bg-slate-50 rounded-xl p-3">
                  <Row label="Collected from players" value={fmt(p.collectedAmount)} />
                  <Row label="Court price" value={fmt(p.courtAmount)} />
                  <Row label={`Commission (${Math.round(p.commissionRate * 1000) / 10}%)`} value={`−${fmt(p.commissionAmount)}`} />
                  <Row label="Pay the ground" value={fmt(p.amount)} strong />
                  <Row label="GoPlay keeps" value={fmt(p.collectedAmount - p.amount)} />
                </div>
                <div className="flex flex-col gap-2">
                  {hasBank ? (
                    <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 leading-5">
                      <p className="font-semibold text-slate-800">{o.accountHolderName}</p>
                      <p>{o.bankName}{o.bankBranch ? `, ${o.bankBranch}` : ""}</p>
                      <p className="font-mono">{o.accountNumber}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3">The owner hasn&apos;t added bank details to their profile yet — contact them.</p>
                  )}
                  {p.status === "DUE" ? (
                    <>
                      <input className={input} placeholder="Bank transfer reference" value={refs[p.id] ?? ""} onChange={(e) => setRefs({ ...refs, [p.id]: e.target.value })} />
                      <button disabled={busy === p.id} onClick={() => act(p.id, `/api/admin/lobby-payments/payouts/${p.id}`, { reference: refs[p.id] })}
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2.5">
                        {busy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Mark paid
                      </button>
                    </>
                  ) : p.paidAt && (
                    <p className="text-xs text-green-700">Paid {new Date(p.paidAt).toLocaleDateString()} · ref <span className="font-mono">{p.reference}</span></p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Refunds: lobbies that didn't go ahead, or players who left */}
      {tab === "refunds" && (
        data.refunds.length === 0 ? <Empty text="No lobby refunds." /> :
        <div className="flex flex-col gap-3">
          {data.refunds.map((r) => {
            const hasDetails = !!(r.refundBankName && r.refundAccountNumber);
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 p-4 grid md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{r.user.name}</p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.refundStatus === "NEEDED" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>{r.refundStatus === "NEEDED" ? "DUE" : "REFUNDED"}</span>
                  </div>
                  <p className="text-xs text-slate-500">{r.user.phone ?? r.user.email}</p>
                  <LobbyLine m={r.match} />
                  <p className="text-sm text-slate-800 mt-1">Refund <strong>{fmt(r.refundAmount ?? 0)}</strong>{r.refundAmount !== r.amountDue && <span className="text-slate-400"> of {fmt(r.amountDue)} paid</span>}</p>
                </div>
                <div>
                  {!r.verified && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-3 mb-2">
                      This receipt was never checked. Make sure {fmt(r.amountDue)} actually reached GoPlay&apos;s account before refunding.
                      {r.receiptUrl && <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-1 font-semibold underline">View receipt <ExternalLink className="w-3 h-3" /></a>}
                    </div>
                  )}
                  {hasDetails ? (
                    <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 leading-5">
                      <p className="font-semibold text-slate-800">{r.refundAccountName}</p>
                      <p>{r.refundBankName}{r.refundBankBranch ? `, ${r.refundBankBranch}` : ""}</p>
                      <p className="font-mono">{r.refundAccountNumber}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">Waiting for the player to add their bank details.</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {r.refundStatus === "NEEDED" ? (
                    <>
                      {!r.verified && (
                        <label className="flex items-start gap-2 text-xs text-slate-700">
                          <input type="checkbox" className="mt-0.5" checked={!!arrived[r.id]} onChange={(e) => setArrived({ ...arrived, [r.id]: e.target.checked })} />
                          I checked: the money arrived in GoPlay&apos;s account
                        </label>
                      )}
                      <input className={input} placeholder="Bank transfer reference" value={refs[r.id] ?? ""} onChange={(e) => setRefs({ ...refs, [r.id]: e.target.value })} disabled={!hasDetails} />
                      <button disabled={busy === r.id || !hasDetails || (!r.verified && !arrived[r.id])}
                        onClick={() => act(r.id, `/api/admin/lobby-payments/refunds/${r.id}`, { action: "refunded", reference: refs[r.id], moneyReceived: arrived[r.id] })}
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5">
                        {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Mark refunded
                      </button>
                      {!r.verified && (
                        <button disabled={busy === r.id} onClick={() => act(r.id, `/api/admin/lobby-payments/refunds/${r.id}`, { action: "not_received" })}
                          className="text-xs font-semibold text-red-600 hover:underline">Money never arrived — close without refund</button>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-green-700">Refunded {r.refundedAt && new Date(r.refundedAt).toLocaleDateString()} · ref <span className="font-mono">{r.refundReference}</span></p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">{text}</div>;
}
