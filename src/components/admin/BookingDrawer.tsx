"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, Phone, Mail, ExternalLink, AlertTriangle, CheckCircle2, XCircle, Circle, FileText } from "lucide-react";
import Drawer, { Fact, Section } from "./Drawer";

interface Detail {
  id: string; bookingDate: string; startTime: string; endTime: string; totalHours: number; totalAmount: number;
  status: string; paymentMethod: string; paymentStatus: string; refundStatus: string; refundAmount: number | null;
  contactNumber: string | null; contactEmail: string | null; specialRequests: string | null; receiptUrl: string | null;
  noShowReview: string | null; isOpenMatch: boolean; isWalkIn: boolean; canCancel: boolean;
  user: { id: string; name: string; email: string; phone: string | null; isActive: boolean; noShowCount: number; cashCancelCount: number; requiresOnlinePayment: boolean; isBookingSuspended: boolean };
  facility: { id: string; name: string; city: string; owner: { user: { id: string; name: string; email: string; phone: string | null } } };
  court: { name: string } | null;
  earning: { grossAmount: number; platformFee: number; commissionPaid: boolean; commissionNote: string | null } | null;
  complaints: { id: string; status: string; message: string; createdAt: string }[];
  openMatch: { id: string } | null;
}
interface Step { at: string; label: string; detail?: string; tone: "neutral" | "good" | "warn" | "bad" }

export const BOOKING_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: "Pending",   cls: "bg-amber-50 text-amber-800 border-amber-200" },
  CONFIRMED: { label: "Confirmed", cls: "bg-green-50 text-green-800 border-green-200" },
  COMPLETED: { label: "Completed", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-50 text-red-700 border-red-200" },
  NO_SHOW:   { label: "No-show",   cls: "bg-orange-50 text-orange-800 border-orange-200" },
};

const rs   = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const day  = (d: string) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const when = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const TONE = {
  good:    { icon: CheckCircle2,  cls: "text-green-600" },
  bad:     { icon: XCircle,       cls: "text-red-500" },
  warn:    { icon: AlertTriangle, cls: "text-amber-500" },
  neutral: { icon: Circle,        cls: "text-slate-400" },
};

/** Admin view of one booking, with the option to cancel it. Remounts per booking so no state leaks between them. */
export default function BookingDrawer(props: { bookingId: string | null; onClose: () => void; onChanged?: () => void }) {
  return <BookingPanel key={props.bookingId ?? "none"} {...props} />;
}

function BookingPanel({ bookingId, onClose, onChanged }: { bookingId: string | null; onClose: () => void; onChanged?: () => void }) {
  const [data,     setData]     = useState<{ booking: Detail; timeline: Step[] } | null>(null);
  const [error,    setError]    = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reason,   setReason]   = useState("");
  const [busy,     setBusy]     = useState(false);
  const [notice,   setNotice]   = useState("");

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/bookings/${id}`, { cache: "no-store" }).catch(() => null);
    const d   = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { setError(d.error ?? "Couldn't load this booking."); return; }
    setError(""); setData(d);
  }, []);

  useEffect(() => {
    if (!bookingId) return;
    let live = true;
    fetch(`/api/admin/bookings/${bookingId}`, { cache: "no-store" })
      .then(async (res) => { const d = await res.json().catch(() => ({})); if (live) { if (res.ok) setData(d); else setError(d.error ?? "Couldn't load this booking."); } })
      .catch(() => { if (live) setError("Couldn't load this booking."); });
    return () => { live = false; };
  }, [bookingId]);

  async function cancel() {
    if (!bookingId) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/cancel`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Couldn't cancel the booking."); return; }
      setNotice(d.message ?? "Booking cancelled.");
      setCancelling(false);
      await load(bookingId);
      onChanged?.();
    } catch { setError("Network error. Try again."); }
    finally { setBusy(false); }
  }

  const b  = data?.booking;
  const st = b ? BOOKING_STATUS[b.status] : null;
  const walkInName = b?.isWalkIn ? b.specialRequests!.replace("[Walk-in]", "").trim().split(" — ")[0].trim() : null;

  const footer = !b ? null : b.isOpenMatch && b.openMatch ? (
    <p className="text-sm text-slate-600">
      This is an open match court booking. Manage it from the lobby on{" "}
      <Link href="/admin/open-matches" className="text-blue-600 hover:underline font-medium">Open Matches</Link>.
    </p>
  ) : b.canCancel ? (
    cancelling ? (
      <div className="flex flex-col gap-3">
        <label htmlFor="cancel-reason" className="text-sm font-medium text-slate-800">Why is GoPlay cancelling this booking?</label>
        <textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} autoFocus
          placeholder="e.g. The ground is closed for repairs that day"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300" />
        <p className="text-xs text-slate-500">
          The player and the ground both see this reason.
          {b.paymentMethod === "ONLINE" && ["PAID", "RECEIPT_SUBMITTED"].includes(b.paymentStatus) && " The player paid the ground, so the ground will be asked to refund them in full."}
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setCancelling(false)} className="px-4 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-100">Keep booking</button>
          <button onClick={cancel} disabled={busy || reason.trim().length < 5}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50 flex items-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Cancel booking
          </button>
        </div>
      </div>
    ) : (
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Cancelling frees the slot. No strike for the player or the ground.</p>
        <button onClick={() => setCancelling(true)} className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 rounded-xl shrink-0">
          Cancel booking…
        </button>
      </div>
    )
  ) : null;

  return (
    <Drawer open={!!bookingId} onClose={onClose}
      title={b ? `${walkInName ?? b.user.name} at ${b.facility.name}` : "Booking"}
      subtitle={b && st && (
        <span className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
          <span>{day(b.bookingDate)}, {b.startTime}–{b.endTime}</span>
        </span>
      )}
      footer={footer}>
      {error && <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-xl bg-green-50 border border-green-100 text-green-800 text-sm px-4 py-3">{notice}</div>}
      {!b && !error && <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" />Loading booking…</div>}

      {b && (
        <>
          <Section title="What happened">
            <ol className="relative ml-2 border-l border-slate-200">
              {data!.timeline.map((s, i) => {
                const T = TONE[s.tone];
                return (
                  <li key={i} className="ml-5 pb-4 last:pb-0">
                    <span className="absolute -left-[9px] bg-white"><T.icon className={`w-[18px] h-[18px] ${T.cls}`} /></span>
                    <p className="text-sm font-medium text-slate-900">{s.label}</p>
                    <p className="text-xs text-slate-500">{when(s.at)}{s.detail ? ` — ${s.detail}` : ""}</p>
                  </li>
                );
              })}
            </ol>
          </Section>

          <Section title="Player" action={!b.isWalkIn && (
            <Link href={`/admin/users?user=${b.user.id}`} className="text-xs font-medium text-blue-600 hover:underline">Open player</Link>
          )}>
            {b.isWalkIn ? (
              <p className="text-sm text-slate-700">Walk-in entered by the ground: {b.specialRequests!.replace("[Walk-in]", "").trim()}</p>
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Fact label="Name">{b.user.name}{!b.user.isActive && <span className="ml-1.5 text-xs text-red-600">(deactivated)</span>}</Fact>
                <Fact label="Email"><a href={`mailto:${b.contactEmail ?? b.user.email}`} className="text-blue-600 hover:underline inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{b.contactEmail ?? b.user.email}</a></Fact>
                <Fact label="Phone">{(b.contactNumber ?? b.user.phone)
                  ? <a href={`tel:${b.contactNumber ?? b.user.phone}`} className="text-blue-600 hover:underline inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{b.contactNumber ?? b.user.phone}</a>
                  : "—"}</Fact>
                <Fact label="Track record">
                  {b.user.noShowCount} no-show{b.user.noShowCount === 1 ? "" : "s"}, {b.user.cashCancelCount} late cash cancel{b.user.cashCancelCount === 1 ? "" : "s"}
                  {(b.user.requiresOnlinePayment || b.user.isBookingSuspended) && (
                    <span className="block text-xs text-amber-700 mt-0.5">{b.user.isBookingSuspended ? "Booking suspended" : "Must pay online"}</span>
                  )}
                </Fact>
              </dl>
            )}
          </Section>

          <Section title="Ground">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Fact label="Ground">{b.facility.name}{b.court ? `, ${b.court.name}` : ""}<span className="block text-xs text-slate-500">{b.facility.city}</span></Fact>
              <Fact label="Owner">{b.facility.owner.user.name}
                {b.facility.owner.user.phone && <a href={`tel:${b.facility.owner.user.phone}`} className="block text-xs text-blue-600 hover:underline">{b.facility.owner.user.phone}</a>}
              </Fact>
            </dl>
          </Section>

          <Section title="Money">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Fact label="Price">{rs(b.totalAmount)} <span className="text-xs text-slate-500">for {b.totalHours}h</span></Fact>
              <Fact label="Paid">
                {b.paymentMethod === "ONLINE" ? "Bank transfer to the ground" : "Cash at the ground"}
                <span className="block text-xs text-slate-500">{b.paymentStatus.replace("_", " ").toLowerCase()}</span>
              </Fact>
              <Fact label="GoPlay commission">
                {b.earning
                  ? <>{rs(b.earning.platformFee)} <span className={`text-xs ${b.earning.commissionPaid ? "text-green-700" : "text-amber-700"}`}>{b.earning.commissionPaid ? "settled" : "owed by the ground"}</span></>
                  : <span className="text-slate-500">Recorded when the booking completes</span>}
              </Fact>
              {b.refundStatus !== "NONE" && (
                <Fact label="Refund">{b.refundAmount ? rs(b.refundAmount) : "—"} <span className="text-xs text-slate-500">{b.refundStatus.toLowerCase()}</span>
                  <Link href="/admin/refunds" className="block text-xs text-blue-600 hover:underline">Open Refunds</Link>
                </Fact>
              )}
            </dl>
            {b.receiptUrl && (
              <a href={b.receiptUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
                <FileText className="w-4 h-4" />View transfer receipt<ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </Section>

          {(b.noShowReview || b.complaints.length > 0) && (
            <Section title="Follow-up">
              {b.noShowReview && (
                <p className="text-sm text-slate-700 mb-2">
                  No-show review: <span className="font-medium">{b.noShowReview.toLowerCase()}</span>.{" "}
                  <Link href="/admin/trust" className="text-blue-600 hover:underline">Open Cash &amp; Trust</Link>
                </p>
              )}
              {b.complaints.map((c) => (
                <div key={c.id} className="text-sm rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 mb-2">
                  <p className="text-slate-800">{c.message}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Payment complaint, {c.status.toLowerCase()}, {when(c.createdAt)} · <Link href="/admin/complaints" className="text-blue-600 hover:underline">Open</Link></p>
                </div>
              ))}
            </Section>
          )}

          <p className="text-[11px] text-slate-400 mt-4 select-all">Booking {b.id}</p>
        </>
      )}
    </Drawer>
  );
}
