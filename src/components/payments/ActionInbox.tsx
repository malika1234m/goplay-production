"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, FileText, Loader2, Undo2, UserX, X } from "lucide-react";
import { RowAmount, RowGroup, RowTag, RowWhen, RowWho, TypeBadge, TypeLegend, primaryBtn, quietBtn, rowClass, typedRow, type BookingType } from "./BookingRow";
import { isPdf } from "./types";
import type { PaymentDetails } from "./types";
import type { T } from "@/i18n/core";
import { useT } from "@/i18n/I18nProvider";

interface Ground { id: string; name: string; status: string; account: PaymentDetails | null }
interface Slot   { facilityId: string; facilityName: string; court: string | null; date: string; startTime: string; endTime: string; player: string; phone: string | null }
interface Receipt  extends Slot { kind: "booking" | "spot"; id: string; label: string | null; amount: number; receiptUrl: string; receiptUploadedAt: string | null }
interface Cash     extends Slot { id: string; amount: number; past: boolean; type: BookingType }
interface Close    extends Slot { id: string; amount: number; cash: boolean; openMatch: boolean; type: BookingType }
interface Awaiting extends Slot { id: string; amount: number; rejected: boolean; rejectReason: string | null; disputed: boolean; bookedAt: string }
interface Refund   extends Slot { id: string; amount: number; percent: number; cancelledBy: string | null }

interface Inbox {
  canEditAccounts:  boolean;
  grounds:          Ground[];
  toReview:         Receipt[];
  cashToConfirm:    Cash[];
  toClose:          Close[];
  awaitingTransfer: Awaiting[];
  refunds:          Refund[];
}

const ago = (t: T, iso: string | null) => {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return t("just now");
  if (mins < 60) return t("{n} min ago", { n: mins });
  const h = Math.round(mins / 60);
  return h < 24 ? t("{n} h ago", { n: h }) : t("{n} d ago", { n: Math.round(h / 24) });
};

/**
 * Everything the ground needs to act on, in one place: receipts to check (accepting one
 * confirms the booking), cash bookings to confirm, refunds owed, transfers still awaited.
 */
const place = (s: Slot, extra?: string | null) => [s.facilityName, extra ?? s.court].filter(Boolean).join(", ");

export type InboxView = "requests" | "receipts" | "complete";
export interface InboxCounts { requests: number; receipts: number; complete: number }

/**
 * One tab of the ground's to-do list: booking requests to confirm, bank transfer receipts
 * (plus transfers awaited and refunds owed), or finished sessions to close.
 */
export default function ActionInbox({ role, view, onCounts }: { role: "owner" | "worker"; view: InboxView; onCounts?: (c: InboxCounts) => void }) {
  const [groundId, setGroundId] = useState("");
  const [data,     setData]     = useState<Inbox | null>(null);
  const [error,    setError]    = useState("");
  const [busy,     setBusy]     = useState<string | null>(null);
  const [flash,    setFlash]    = useState("");
  const [viewing,  setViewing]  = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Receipt | null>(null);
  const [reason,   setReason]   = useState("");
  const { t } = useT();

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/ground-owner/inbox${groundId ? `?facilityId=${groundId}` : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? t("Couldn't load your bookings.")); return; }
      setError("");
      setData(json);
      onCounts?.({
        requests: json.cashToConfirm.length,
        receipts: json.toReview.length + json.refunds.length,
        complete: json.toClose.length,
      });
    } catch {
      setError(t("You're offline. Reconnect and refresh."));
    }
  }, [groundId, onCounts, t]);

  useEffect(() => { load(); }, [load]);

  async function act(key: string, run: () => Promise<Response>, done: string) {
    setBusy(key);
    setError("");
    try {
      const res  = await run();
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? t("That didn't go through. Try again.")); return; }
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
      r.kind === "booking" ? t("Booking confirmed for {name}.", { name: r.player }) : t("{name}'s open match spot is confirmed.", { name: r.player }));
  const rejectReceipt = (r: Receipt) =>
    act(r.id, () => post(`/api/ground-owner/payments/${r.kind}/${r.id}`, { action: "reject", reason: reason.trim() || undefined }),
      t("Receipt sent back to {name}.", { name: r.player }));
  const confirmCash = (c: Cash) =>
    act(c.id, () => post(role === "owner" ? `/api/ground-owner/bookings/${c.id}/status` : `/api/worker/bookings/${c.id}/status`, { status: "CONFIRMED" }, "PUT"),
      t("Booking confirmed for {name}.", { name: c.player }));
  const statusUrl = (id: string) => role === "owner" ? `/api/ground-owner/bookings/${id}/status` : `/api/worker/bookings/${id}/status`;
  const closePlayed = (c: Close, cashReceived?: boolean) =>
    act(c.id, () => post(statusUrl(c.id), { status: "COMPLETED", ...(cashReceived !== undefined && { cashReceived }) }, "PUT"),
      t("{name}'s session marked as played.", { name: c.player }));
  const markNoShow = (c: Close) =>
    act(c.id, () => role === "owner" ? post(`/api/ground-owner/bookings/${c.id}/noshow`, {}, "PUT") : post(statusUrl(c.id), { status: "NO_SHOW" }, "PUT"),
      t("{name} marked as a no-show.", { name: c.player }));
  const markRefunded = (r: Refund) =>
    act(r.id, () => post(`/api/ground-owner/bookings/${r.id}/refund`, {}), t("Refund to {name} marked as sent.", { name: r.player }));

  if (!data) {
    return error
      ? <p className="text-sm text-red-700">{t(error)}</p>
      : <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  const shown    = groundId ? data.grounds.filter((g) => g.id === groundId) : data.grounds;
  const noAccount = shown.filter((g) => g.status === "ACTIVE" && !g.account);
  const empty =
    view === "requests" ? data.cashToConfirm.length === 0 :
    view === "receipts" ? data.toReview.length + data.refunds.length + data.awaitingTransfer.length === 0 :
    data.toClose.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {data.grounds.length > 1 ? (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            {t("Ground")}
            <select value={groundId} onChange={(e) => { setData(null); setGroundId(e.target.value); }}
              className="bg-white border border-rule rounded-lg px-3 py-2 text-sm text-pitch-deep focus-visible:outline-2 focus-visible:outline-pitch">
              <option value="">{t("All grounds")}</option>
              {data.grounds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
        ) : <span />}
        {role === "owner" && (
          <Link href="/ground-owner/payment-details" className="text-sm font-medium text-pitch hover:underline">{t("Payment accounts")}</Link>
        )}
      </div>

      {noAccount.length > 0 && (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-deadline shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900">
            {t("No bank account for {grounds}.", { grounds: noAccount.map((g) => g.name).join(", ") })}{" "}
            {data.canEditAccounts
              ? <Link href="/ground-owner/payment-details" className="font-semibold underline">{t("Add one")}</Link>
              : t("Ask the owner to add one.")}
          </p>
        </div>
      )}

      {flash && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-pitch text-white px-4 py-3" role="status">
          <span className="flex items-center gap-2 text-sm font-medium"><Check className="w-4 h-4" />{flash}</span>
          <button onClick={() => setFlash("")} aria-label={t("Dismiss")} className="opacity-80 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}
      {error && <p className="mb-6 text-sm text-red-700">{t(error)}</p>}

      {view !== "receipts" && !empty && <div className="mb-5"><TypeLegend /></div>}

      {empty && (
        <div className="rounded-xl border border-rule bg-white px-6 py-14 text-center">
          <p className="text-[17px] font-semibold text-pitch-deep">
            {view === "requests" ? t("No booking requests waiting") : view === "receipts" ? t("No receipts to check") : t("Nothing to close")}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {view === "requests" ? t("New requests show up here.")
              : view === "receipts" ? t("New receipts show up here.")
              : t("Finished sessions show up here.")}
          </p>
        </div>
      )}

      {view === "receipts" && <>
      <RowGroup title={t("Receipts to check")} count={data.toReview.length}
        hint={t("Check your bank, then confirm.")}>
        {data.toReview.map((r) => {
          const account = data.grounds.find((g) => g.id === r.facilityId)?.account;
          return (
            <li key={`${r.kind}-${r.id}`} className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 border-l-4 border-l-pitch">
              <RowWhen date={r.date} startTime={r.startTime} endTime={r.endTime} />
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 min-w-0">
                  <RowWho name={r.player} place={place(r, r.label)} phone={r.phone}>
                    <p className="mt-1.5"><TypeBadge type="online" /></p>
                  </RowWho>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-scoreboard text-xl font-semibold text-pitch-deep tabular-nums">{t("Rs.")} {r.amount.toLocaleString()}</span>
                    {account && <> {t("to {bank}", { bank: `${account.bankName} ••${account.accountNumber.replace(/\s+/g, "").slice(-4)}` })}</>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{t("Remark {ref}, sent {when}", { ref: r.id.slice(0, 8).toUpperCase(), when: ago(t, r.receiptUploadedAt) })}</p>
                </div>
                <button type="button" onClick={() => isPdf(r.receiptUrl) ? window.open(r.receiptUrl, "_blank", "noopener") : setViewing(r.receiptUrl)}
                  className="w-28 h-28 shrink-0 rounded-lg border border-rule bg-slip overflow-hidden grid place-items-center hover:ring-2 hover:ring-pitch focus-visible:outline-2 focus-visible:outline-pitch"
                  aria-label={t("Open {name}'s receipt", { name: r.player })}>
                  {isPdf(r.receiptUrl)
                    ? <span className="flex flex-col items-center gap-1 text-slate-500 text-xs"><FileText className="w-7 h-7" />PDF</span>
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={r.receiptUrl} alt="" className="w-full h-full object-cover" />}
                </button>
              </div>
              <div className="flex sm:flex-col gap-2 sm:w-44 shrink-0">
                <button type="button" onClick={() => confirmReceipt(r)} disabled={busy === r.id}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-pitch px-4 py-2.5 text-sm font-semibold text-white hover:bg-pitch-deep disabled:opacity-60">
                  {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t("Confirm booking")}
                </button>
                <button type="button" onClick={() => { setRejecting(r); setReason(""); }} disabled={busy === r.id}
                  className="flex-1 rounded-lg border border-rule px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-red-300 hover:text-red-700">
                  {t("Not received")}
                </button>
              </div>
            </li>
          );
        })}
      </RowGroup>

      <RowGroup title={t("Refunds you owe")} count={data.refunds.length}
        hint={t("Send the money back, then mark it sent.")}>
        {data.refunds.map((r) => (
          <li key={r.id} className={typedRow("online")}>
            <RowWhen date={r.date} startTime={r.startTime} endTime={r.endTime} />
            <div className="flex-1 min-w-0"><RowWho name={r.player} place={place(r, t("cancelled by {who}", { who: r.cancelledBy ? t(r.cancelledBy) : "—" }))} phone={r.phone} /></div>
            <RowAmount amount={r.amount} note={t("{n}% refund", { n: r.percent })} />
            <button type="button" onClick={() => markRefunded(r)} disabled={busy === r.id}
              className="sm:w-44 inline-flex items-center justify-center gap-1.5 rounded-lg border border-pitch-deep px-4 py-2.5 text-sm font-semibold text-pitch-deep hover:bg-pitch-deep hover:text-white disabled:opacity-60">
              {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} {t("Mark refund sent")}
            </button>
          </li>
        ))}
      </RowGroup>

      <RowGroup title={t("Waiting for the player's transfer")} count={data.awaitingTransfer.length}
        hint={t("No action needed.")}>
        {data.awaitingTransfer.map((a) => (
          <li key={a.id} className={`${typedRow("online")} opacity-80`}>
            <RowWhen date={a.date} startTime={a.startTime} endTime={a.endTime} />
            <div className="flex-1 min-w-0"><RowWho name={a.player} place={place(a)} phone={a.phone} /></div>
            <p className="text-sm sm:w-72 sm:text-right text-slate-500">
              {a.disputed ? t("Complaint — GoPlay checking")
                : a.rejected ? (a.rejectReason ? t("You sent the receipt back: {reason}", { reason: a.rejectReason }) : t("You sent the receipt back"))
                : t("Booked {when}", { when: ago(t, a.bookedAt) })}
            </p>
          </li>
        ))}
      </RowGroup>
      </>}

      {view === "requests" && (
      <RowGroup title={t("Booking requests")} count={data.cashToConfirm.length}
        hint={t("Players pay at the ground.")}>
        {data.cashToConfirm.map((c) => (
          <li key={c.id} className={typedRow(c.type)}>
            <RowWhen date={c.date} startTime={c.startTime} endTime={c.endTime} />
            <div className="flex-1 min-w-0">
              <RowWho name={c.player} place={place(c)} phone={c.phone}>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <TypeBadge type={c.type} />
                  {c.past && <RowTag tone="amber">{t("Date passed")}</RowTag>}
                </div>
              </RowWho>
            </div>
            <RowAmount amount={c.amount} />
            <button type="button" onClick={() => confirmCash(c)} disabled={busy === c.id}
              className={`sm:w-44 ${primaryBtn}`}>
              {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t("Confirm booking")}
            </button>
          </li>
        ))}
      </RowGroup>

      )}

      {view === "complete" && (
      <RowGroup title={t("Sessions to close")} count={data.toClose.length}
        hint={t("Mark played or no-show.")}>
        {data.toClose.map((c) => (
          <li key={c.id} className={typedRow(c.type)}>
            <RowWhen date={c.date} startTime={c.startTime} endTime={c.endTime} />
            <div className="flex-1 min-w-0">
              <RowWho name={c.player} place={place(c)} phone={c.phone}>
                <p className="mt-1.5"><TypeBadge type={c.type} /></p>
              </RowWho>
            </div>
            <RowAmount amount={c.amount} note={c.cash ? t("Collect at the ground") : t("Already paid")} />
            <div className="flex sm:flex-col gap-2 sm:w-44 shrink-0">
              <button type="button" onClick={() => closePlayed(c, c.cash ? true : undefined)} disabled={busy === c.id} className={`flex-1 ${primaryBtn}`}>
                {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {c.cash ? t("Played & paid") : t("Played")}
              </button>
              {c.cash && (
                <button type="button" onClick={() => closePlayed(c, false)} disabled={busy === c.id} className={`flex-1 ${quietBtn}`}>{t("Played, not paid")}</button>
              )}
              {!c.openMatch && (
                <button type="button" onClick={() => markNoShow(c)} disabled={busy === c.id} className={`flex-1 ${quietBtn}`}>
                  <UserX className="w-4 h-4" /> {t("No-show")}
                </button>
              )}
            </div>
          </li>
        ))}
      </RowGroup>

      )}

      {/* Receipt viewer */}
      {viewing && (
        <div className="fixed inset-0 z-50 bg-pitch-deep/90 flex items-center justify-center p-4" onClick={() => setViewing(null)}
          onKeyDown={(e) => e.key === "Escape" && setViewing(null)} role="dialog" aria-label={t("Receipt")} tabIndex={-1}>
          <button className="absolute top-4 right-4 text-white p-2" aria-label={t("Close receipt")} autoFocus><X className="w-6 h-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewing} alt={t("Transfer receipt")} className="max-w-full max-h-full object-contain rounded-lg bg-white" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Send-back dialog */}
      {rejecting && (
        <div className="fixed inset-0 z-50 bg-pitch-deep/50 flex items-center justify-center p-4" role="dialog" aria-label={t("Send receipt back")}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-pitch-deep">{t("Money not in your account?")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("Tell {name} what's wrong. Without a reason, they can complain to GoPlay.", { name: rejecting.player })}
            </p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500}
              placeholder={t("e.g. Rs. {amount} hasn't arrived yet / amount is short / receipt is unreadable", { amount: rejecting.amount.toLocaleString() })}
              className="mt-4 w-full rounded-lg border border-rule px-3 py-2 text-sm text-pitch-deep outline-none focus:ring-2 focus:ring-pitch resize-none" />
            <div className="mt-4 flex gap-2">
              <button onClick={() => setRejecting(null)} className="flex-1 rounded-lg py-2.5 text-sm font-medium text-slate-600 hover:bg-slip">{t("Keep it")}</button>
              <button onClick={() => rejectReceipt(rejecting)} disabled={busy === rejecting.id}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
                {busy === rejecting.id && <Loader2 className="w-4 h-4 animate-spin" />} {t("Send back to player")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
