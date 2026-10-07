"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, FileText, Loader2, Phone, Undo2, X } from "lucide-react";
import { isPdf } from "./types";
import type { PaymentDetails } from "./types";

interface Ground { id: string; name: string; status: string; account: PaymentDetails | null }
interface Slot   { facilityId: string; facilityName: string; court: string | null; date: string; startTime: string; endTime: string; player: string; phone: string | null }
interface Receipt  extends Slot { kind: "booking" | "spot"; id: string; label: string | null; amount: number; receiptUrl: string; receiptUploadedAt: string | null }
interface Cash     extends Slot { id: string; amount: number }
interface Awaiting extends Slot { id: string; amount: number; rejected: boolean; rejectReason: string | null; disputed: boolean; bookedAt: string }
interface Refund   extends Slot { id: string; amount: number; percent: number; cancelledBy: string | null }

interface Inbox {
  canEditAccounts:  boolean;
  grounds:          Ground[];
  toReview:         Receipt[];
  cashToConfirm:    Cash[];
  awaitingTransfer: Awaiting[];
  refunds:          Refund[];
}

const day = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00");
const ago = (iso: string | null) => {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

/** The date block on the left of every row — the thing an owner scans first. */
function When({ date, startTime, endTime }: { date: string; startTime: string; endTime: string }) {
  const d = day(date);
  return (
    <div className="w-24 shrink-0">
      <p className="text-xs text-slate-500">{d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</p>
      <p className="font-scoreboard text-[22px] leading-tight font-semibold text-pitch-deep tabular-nums">{startTime}</p>
      <p className="text-xs text-slate-400 tabular-nums">to {endTime}</p>
    </div>
  );
}

function Who({ s, extra }: { s: Slot; extra?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[15px] font-semibold text-pitch-deep truncate">{s.player}</p>
      <p className="text-sm text-slate-500 truncate">
        {[s.facilityName, extra ?? s.court].filter(Boolean).join(", ")}
      </p>
      {s.phone && (
        <a href={`tel:${s.phone}`} className="mt-0.5 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-pitch">
          <Phone className="w-3.5 h-3.5" /> {s.phone}
        </a>
      )}
    </div>
  );
}

function Section({ title, hint, count, children }: { title: string; hint: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="mt-8 first:mt-0">
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-[17px] font-semibold text-pitch-deep">{title}</h2>
        <span className="text-sm text-slate-500 tabular-nums">{count}</span>
      </div>
      <p className="text-sm text-slate-500 mb-3 max-w-prose">{hint}</p>
      <ul className="bg-white rounded-xl border border-rule divide-y divide-rule">{children}</ul>
    </section>
  );
}

/**
 * Everything the ground needs to act on, in one place: receipts to check (accepting one
 * confirms the booking), cash bookings to confirm, refunds owed, transfers still awaited.
 */
export default function ActionInbox({ role, onCount }: { role: "owner" | "worker"; onCount?: (n: number) => void }) {
  const [groundId, setGroundId] = useState("");
  const [data,     setData]     = useState<Inbox | null>(null);
  const [error,    setError]    = useState("");
  const [busy,     setBusy]     = useState<string | null>(null);
  const [flash,    setFlash]    = useState("");
  const [viewing,  setViewing]  = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Receipt | null>(null);
  const [reason,   setReason]   = useState("");

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/ground-owner/inbox${groundId ? `?facilityId=${groundId}` : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Couldn't load your bookings."); return; }
      setError("");
      setData(json);
      onCount?.(json.toReview.length + json.cashToConfirm.length + json.refunds.length);
    } catch {
      setError("You're offline. Reconnect and refresh.");
    }
  }, [groundId, onCount]);

  useEffect(() => { load(); }, [load]);

  async function act(key: string, run: () => Promise<Response>, done: string) {
    setBusy(key);
    setError("");
    try {
      const res  = await run();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "That didn't go through. Try again."); return; }
      setFlash(done);
      setRejecting(null);
      setReason("");
      await load();
    } finally {
      setBusy(null);
    }
  }

  const post = (url: string, body: unknown, method = "POST") =>
    fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const confirmReceipt = (r: Receipt) =>
    act(r.id, () => post(`/api/ground-owner/payments/${r.kind}/${r.id}`, { action: "confirm" }),
      r.kind === "booking" ? `Booking confirmed for ${r.player}.` : `${r.player}'s open match spot is confirmed.`);
  const rejectReceipt = (r: Receipt) =>
    act(r.id, () => post(`/api/ground-owner/payments/${r.kind}/${r.id}`, { action: "reject", reason: reason.trim() || undefined }),
      `Receipt sent back to ${r.player}.`);
  const confirmCash = (c: Cash) =>
    act(c.id, () => post(role === "owner" ? `/api/ground-owner/bookings/${c.id}/status` : `/api/worker/bookings/${c.id}/status`, { status: "CONFIRMED" }, "PUT"),
      `Booking confirmed for ${c.player}.`);
  const markRefunded = (r: Refund) =>
    act(r.id, () => post(`/api/ground-owner/bookings/${r.id}/refund`, {}), `Refund to ${r.player} marked as sent.`);

  if (!data) {
    return error
      ? <p className="text-sm text-red-700">{error}</p>
      : <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  const shown    = groundId ? data.grounds.filter((g) => g.id === groundId) : data.grounds;
  const noAccount = shown.filter((g) => g.status === "ACTIVE" && !g.account);
  const total    = data.toReview.length + data.cashToConfirm.length + data.refunds.length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {data.grounds.length > 1 ? (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Ground
            <select value={groundId} onChange={(e) => { setData(null); setGroundId(e.target.value); }}
              className="bg-white border border-rule rounded-lg px-3 py-2 text-sm text-pitch-deep focus-visible:outline-2 focus-visible:outline-pitch">
              <option value="">All grounds</option>
              {data.grounds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
        ) : <span />}
        {role === "owner" && (
          <Link href="/ground-owner/payment-details" className="text-sm font-medium text-pitch hover:underline">Payment accounts</Link>
        )}
      </div>

      {noAccount.length > 0 && (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-deadline shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            Players can&apos;t pay online for {noAccount.map((g) => g.name).join(", ")} — no bank account is set.{" "}
            {data.canEditAccounts
              ? <Link href="/ground-owner/payment-details" className="font-semibold underline">Add one</Link>
              : "Ask the owner to add one."}
          </p>
        </div>
      )}

      {flash && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-pitch text-white px-4 py-3" role="status">
          <span className="flex items-center gap-2 text-sm font-medium"><Check className="w-4 h-4" />{flash}</span>
          <button onClick={() => setFlash("")} aria-label="Dismiss" className="opacity-80 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}
      {error && <p className="mb-6 text-sm text-red-700">{error}</p>}

      {total === 0 && data.awaitingTransfer.length === 0 && (
        <div className="rounded-xl border border-rule bg-white px-6 py-14 text-center">
          <p className="text-[17px] font-semibold text-pitch-deep">Nothing needs you right now</p>
          <p className="mt-1 text-sm text-slate-500">New receipts and booking requests show up here as they arrive.</p>
        </div>
      )}

      <Section title="Receipts to check" count={data.toReview.length}
        hint="Check your bank app for the amount, then confirm. Confirming a receipt confirms the booking and tells the player.">
        {data.toReview.map((r) => {
          const account = data.grounds.find((g) => g.id === r.facilityId)?.account;
          return (
            <li key={`${r.kind}-${r.id}`} className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
              <When date={r.date} startTime={r.startTime} endTime={r.endTime} />
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 min-w-0">
                  <Who s={r} extra={r.label} />
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-scoreboard text-xl font-semibold text-pitch-deep tabular-nums">Rs. {r.amount.toLocaleString()}</span>
                    {account && <> to {account.bankName} ••{account.accountNumber.replace(/\s+/g, "").slice(-4)}</>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Remark {r.id.slice(0, 8).toUpperCase()}, sent {ago(r.receiptUploadedAt)}</p>
                </div>
                <button type="button" onClick={() => isPdf(r.receiptUrl) ? window.open(r.receiptUrl, "_blank", "noopener") : setViewing(r.receiptUrl)}
                  className="w-28 h-28 shrink-0 rounded-lg border border-rule bg-slip overflow-hidden grid place-items-center hover:ring-2 hover:ring-pitch focus-visible:outline-2 focus-visible:outline-pitch"
                  aria-label={`Open ${r.player}'s receipt`}>
                  {isPdf(r.receiptUrl)
                    ? <span className="flex flex-col items-center gap-1 text-slate-500 text-xs"><FileText className="w-7 h-7" />PDF</span>
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={r.receiptUrl} alt="" className="w-full h-full object-cover" />}
                </button>
              </div>
              <div className="flex sm:flex-col gap-2 sm:w-44 shrink-0">
                <button type="button" onClick={() => confirmReceipt(r)} disabled={busy === r.id}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-pitch px-4 py-2.5 text-sm font-semibold text-white hover:bg-pitch-deep disabled:opacity-60">
                  {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirm booking
                </button>
                <button type="button" onClick={() => { setRejecting(r); setReason(""); }} disabled={busy === r.id}
                  className="flex-1 rounded-lg border border-rule px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-red-300 hover:text-red-700">
                  Not received
                </button>
              </div>
            </li>
          );
        })}
      </Section>

      <Section title="Cash bookings to confirm" count={data.cashToConfirm.length}
        hint="These players will pay at the ground. Confirm if the slot works for you.">
        {data.cashToConfirm.map((c) => (
          <li key={c.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <When date={c.date} startTime={c.startTime} endTime={c.endTime} />
            <div className="flex-1 min-w-0"><Who s={c} /></div>
            <p className="font-scoreboard text-xl font-semibold text-pitch-deep tabular-nums sm:w-28 sm:text-right">Rs. {c.amount.toLocaleString()}</p>
            <button type="button" onClick={() => confirmCash(c)} disabled={busy === c.id}
              className="sm:w-44 inline-flex items-center justify-center gap-1.5 rounded-lg bg-pitch px-4 py-2.5 text-sm font-semibold text-white hover:bg-pitch-deep disabled:opacity-60">
              {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirm booking
            </button>
          </li>
        ))}
      </Section>

      <Section title="Refunds you owe" count={data.refunds.length}
        hint="These bookings were cancelled after the player paid. Send the money back from your bank, then mark it sent.">
        {data.refunds.map((r) => (
          <li key={r.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <When date={r.date} startTime={r.startTime} endTime={r.endTime} />
            <div className="flex-1 min-w-0"><Who s={r} extra={`cancelled by ${r.cancelledBy ?? "—"}`} /></div>
            <p className="sm:w-28 sm:text-right">
              <span className="font-scoreboard text-xl font-semibold text-pitch-deep tabular-nums">Rs. {r.amount.toLocaleString()}</span>
              <span className="block text-xs text-slate-400">{r.percent}% refund</span>
            </p>
            <button type="button" onClick={() => markRefunded(r)} disabled={busy === r.id}
              className="sm:w-44 inline-flex items-center justify-center gap-1.5 rounded-lg border border-pitch-deep px-4 py-2.5 text-sm font-semibold text-pitch-deep hover:bg-pitch-deep hover:text-white disabled:opacity-60">
              {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Mark refund sent
            </button>
          </li>
        ))}
      </Section>

      <Section title="Waiting for the player's transfer" count={data.awaitingTransfer.length}
        hint="Booked with Pay online but no receipt yet. Nothing to do — unpaid slots are released automatically.">
        {data.awaitingTransfer.map((a) => (
          <li key={a.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 text-slate-500">
            <When date={a.date} startTime={a.startTime} endTime={a.endTime} />
            <div className="flex-1 min-w-0"><Who s={a} /></div>
            <p className="text-sm sm:w-72 sm:text-right">
              {a.disputed ? "Player raised a complaint — GoPlay is checking"
                : a.rejected ? `You sent the receipt back${a.rejectReason ? `: ${a.rejectReason}` : ""}`
                : `Booked ${ago(a.bookedAt)}`}
            </p>
          </li>
        ))}
      </Section>

      {/* Receipt viewer */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-pitch-deep/90 flex items-center justify-center p-4" onClick={() => setViewing(null)}
          onKeyDown={(e) => e.key === "Escape" && setViewing(null)} role="dialog" aria-label="Receipt" tabIndex={-1}>
          <button className="absolute top-4 right-4 text-white p-2" aria-label="Close receipt" autoFocus><X className="w-6 h-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewing} alt="Transfer receipt" className="max-w-full max-h-full object-contain rounded-lg bg-white" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Send-back dialog */}
      {rejecting && (
        <div className="fixed inset-0 z-50 bg-pitch-deep/50 flex items-center justify-center p-4" role="dialog" aria-label="Send receipt back">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-pitch-deep">Money not in your account?</h2>
            <p className="mt-1 text-sm text-slate-600">
              {rejecting.player} will be asked to check and send the receipt again. Say what&apos;s wrong — without a reason they can take it to GoPlay.
            </p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500}
              placeholder={`e.g. Rs. ${rejecting.amount.toLocaleString()} hasn't arrived yet / amount is short / receipt is unreadable`}
              className="mt-4 w-full rounded-lg border border-rule px-3 py-2 text-sm text-pitch-deep outline-none focus:ring-2 focus:ring-pitch resize-none" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setRejecting(null)} className="flex-1 rounded-lg py-2.5 text-sm font-medium text-slate-600 hover:bg-slip">Keep it</button>
              <button onClick={() => rejectReceipt(rejecting)} disabled={busy === rejecting.id}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
                {busy === rejecting.id && <Loader2 className="w-4 h-4 animate-spin" />} Send back to player
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
