"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, Mail, Phone, ShieldAlert, Ban, CircleCheck, MessageSquareWarning, Unlock, ChevronRight } from "lucide-react";
import Drawer, { Fact, Section } from "./Drawer";
import { BOOKING_STATUS } from "./BookingDrawer";

interface Detail {
  user: {
    id: string; name: string; email: string; phone: string | null; role: string; isActive: boolean; createdAt: string; emailVerifiedAt: string | null;
    noShowCount: number; cashCancelCount: number; requiresOnlinePayment: boolean; isBookingSuspended: boolean;
    groundOwnerProfile: { businessName: string | null; phone: string | null; city: string | null; bankName: string | null; accountHolderName: string | null; accountNumber: string | null; commissionRequestedAmount: number | null } | null;
    facilityWorker: { facility: { id: string; name: string } } | null;
  };
  bookings: { total: number; completed: number; upcoming: number; cancelled: number; noShows: number; spent: number; lobbySpots: number;
    recent: { id: string; bookingDate: string; startTime: string; status: string; totalAmount: number; facility: { name: string } }[] };
  block: { id: string; reasonLabel: string; details: string | null; createdAt: string } | null;
  owner: { grounds: { id: string; name: string; city: string; status: string; commissionRate: number | null; bookings: number }[]; commissionOwed: number; commissionPaid: number } | null;
  reasons: Record<string, string>;
  isSelf: boolean;
}

export const ROLE_LABEL: Record<string, string> = { USER: "Player", GROUND_OWNER: "Ground owner", GROUND_WORKER: "Ground worker", ADMIN: "Admin" };

const rs  = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const day = (d: string, utc = false) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(utc && { timeZone: "UTC" }) });

type Mode = null | "deactivate" | "warn" | "block" | "unblock";

/** Admin view of one account, with the actions an admin can take on it. Remounts per account. */
export default function UserDrawer(props: { userId: string | null; onClose: () => void; onChanged?: () => void }) {
  return <UserPanel key={props.userId ?? "none"} {...props} />;
}

function UserPanel({ userId, onClose, onChanged }: { userId: string | null; onClose: () => void; onChanged?: () => void }) {
  const [data,   setData]   = useState<Detail | null>(null);
  const [error,  setError]  = useState("");
  const [notice, setNotice] = useState("");
  const [mode,   setMode]   = useState<Mode>(null);
  const [busy,   setBusy]   = useState(false);
  const [text,   setText]   = useState("");
  const [reason, setReason] = useState("NO_SHOWS");
  const [blockPhone, setBlockPhone] = useState(false);

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}`, { cache: "no-store" }).catch(() => null);
    const d   = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { setError(d.error ?? "Couldn't load this account."); return; }
    setError(""); setData(d);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    fetch(`/api/admin/users/${userId}`, { cache: "no-store" })
      .then(async (res) => { const d = await res.json().catch(() => ({})); if (live) { if (res.ok) setData(d); else setError(d.error ?? "Couldn't load this account."); } })
      .catch(() => { if (live) setError("Couldn't load this account."); });
    return () => { live = false; };
  }, [userId]);

  async function act(url: string, init: RequestInit, done: string) {
    if (!userId) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const d   = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "That didn't work. Try again."); return; }
      setNotice(done); setMode(null); setText("");
      await load(userId);
      onChanged?.();
    } catch { setError("Network error. Try again."); }
    finally { setBusy(false); }
  }

  const u = data?.user;
  const isPlayer = u?.role === "USER";
  const canManage = !!u && u.role !== "ADMIN" && !data?.isSelf;

  const footer = !canManage || !u ? null : mode === null ? (
    <div className="flex flex-wrap gap-2 justify-end">
      {isPlayer && !data!.block && (
        <button onClick={() => setMode("warn")} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl">
          <MessageSquareWarning className="w-4 h-4" />Send warning
        </button>
      )}
      {isPlayer && (data!.block
        ? <button onClick={() => setMode("unblock")} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-green-700 border border-green-200 bg-white hover:bg-green-50 rounded-xl"><Unlock className="w-4 h-4" />Unblock</button>
        : <button onClick={() => setMode("block")} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-red-600 border border-red-200 bg-white hover:bg-red-50 rounded-xl"><Ban className="w-4 h-4" />Block from GoPlay…</button>)}
      {!(isPlayer && data!.block) && (
        <button onClick={() => u.isActive ? setMode("deactivate") : act(`/api/admin/users/${u.id}/status`, { method: "PATCH", body: JSON.stringify({ isActive: true }) }, "Account reactivated.")}
          disabled={busy}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-xl border bg-white ${u.isActive ? "text-slate-700 border-slate-200 hover:bg-slate-50" : "text-green-700 border-green-200 hover:bg-green-50"}`}>
          {u.isActive ? <><ShieldAlert className="w-4 h-4" />Deactivate…</> : <><CircleCheck className="w-4 h-4" />Reactivate</>}
        </button>
      )}
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      {mode === "deactivate" && (
        <p className="text-sm text-slate-700">
          {u.name} is signed out everywhere and can&apos;t sign in until you reactivate the account. Their email stays free to use.
          {isPlayer && " To stop them coming back with a new account, block them instead."}
        </p>
      )}
      {mode === "warn" && (
        <>
          <label htmlFor="warn-text" className="text-sm font-medium text-slate-800">Warning sent by email and in the app</label>
          <textarea id="warn-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} autoFocus
            placeholder="e.g. Two grounds have reported you didn't turn up. Another no-show will restrict your account."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </>
      )}
      {mode === "block" && (
        <>
          <p className="text-sm text-slate-700">Blocking deactivates {u.name}, frees slots they hold without payment, bars <span className="font-medium">{u.email}</span> from signing up again, and emails them why.</p>
          <label className="text-sm font-medium text-slate-800">Reason
            <select value={reason} onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-200">
              {Object.entries(data!.reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} aria-label="Details"
            placeholder={reason === "OTHER" ? "Explain the reason (required)" : "Details for the player (optional)"}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
          {u.phone && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={blockPhone} onChange={(e) => setBlockPhone(e.target.checked)} /> Also block {u.phone}
            </label>
          )}
        </>
      )}
      {mode === "unblock" && (
        <>
          <p className="text-sm text-slate-700">{u.name} can sign in and book again. No-show restrictions stay as they are.</p>
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} aria-label="Note"
            placeholder="Why you're lifting the block (kept for admins)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
        </>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={() => { setMode(null); setText(""); }} className="px-4 py-2 text-sm font-medium text-slate-600 rounded-xl hover:bg-slate-100">Back</button>
        {mode === "deactivate" && (
          <button disabled={busy} onClick={() => act(`/api/admin/users/${u.id}/status`, { method: "PATCH", body: JSON.stringify({ isActive: false }) }, "Account deactivated.")}
            className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-xl disabled:opacity-50 inline-flex items-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}Deactivate account
          </button>
        )}
        {mode === "warn" && (
          <button disabled={busy || text.trim().length < 10} onClick={() => act("/api/admin/trust/warn", { method: "POST", body: JSON.stringify({ userId: u.id, message: text }) }, "Warning sent.")}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl disabled:opacity-50 inline-flex items-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}Send warning
          </button>
        )}
        {mode === "block" && (
          <button disabled={busy || (reason === "OTHER" && text.trim().length < 5)}
            onClick={() => act("/api/admin/trust/block", { method: "POST", body: JSON.stringify({ userId: u.id, reason, details: text, blockPhone }) }, "Player blocked and emailed.")}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50 inline-flex items-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}Block player
          </button>
        )}
        {mode === "unblock" && (
          <button disabled={busy} onClick={() => act("/api/admin/trust/unblock", { method: "POST", body: JSON.stringify({ blockId: data!.block!.id, note: text }) }, "Block lifted.")}
            className="px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-50 inline-flex items-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}Unblock
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Drawer open={!!userId} onClose={onClose} title={u?.name ?? "Account"}
      subtitle={u && (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{ROLE_LABEL[u.role] ?? u.role}</span>
          {data!.block ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Blocked</span>
            : !u.isActive && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-white">Deactivated</span>}
          <span>Joined {day(u.createdAt)}</span>
        </span>
      )}
      footer={footer}>
      {error && <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-xl bg-green-50 border border-green-100 text-green-800 text-sm px-4 py-3">{notice}</div>}
      {!data && !error && <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" />Loading account…</div>}

      {u && data && (
        <>
          <Section title="Contact">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Fact label="Email">
                <a href={`mailto:${u.email}`} className="text-blue-600 hover:underline inline-flex items-center gap-1 break-all"><Mail className="w-3.5 h-3.5 shrink-0" />{u.email}</a>
                <span className={`block text-xs ${u.emailVerifiedAt ? "text-green-700" : "text-slate-500"}`}>{u.emailVerifiedAt ? "verified" : "not verified"}</span>
              </Fact>
              <Fact label="Phone">{u.phone ? <a href={`tel:${u.phone}`} className="text-blue-600 hover:underline inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{u.phone}</a> : "—"}</Fact>
            </dl>
          </Section>

          {data.block && (
            <Section title="Blocked from GoPlay">
              <p className="text-sm text-slate-800">{data.block.reasonLabel}{data.block.details ? `: ${data.block.details}` : ""}</p>
              <p className="text-xs text-slate-500 mt-0.5">Since {day(data.block.createdAt)}. Their email can&apos;t be used to sign up again.</p>
            </Section>
          )}

          {isPlayer && (
            <Section title="As a player" action={
              (u.requiresOnlinePayment || u.isBookingSuspended) && !data.block ? (
                <button disabled={busy} onClick={() => act("/api/admin/trust/restrictions", { method: "POST", body: JSON.stringify({ userId: u.id }) }, "Restrictions lifted.")}
                  className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50">Lift restrictions</button>
              ) : undefined
            }>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "Completed", value: data.bookings.completed },
                  { label: "Upcoming",  value: data.bookings.upcoming },
                  { label: "No-shows",  value: data.bookings.noShows, warn: data.bookings.noShows > 0 },
                  { label: "Cancelled", value: data.bookings.cancelled },
                  { label: "Lobby spots", value: data.bookings.lobbySpots },
                  { label: "Spent",     value: rs(data.bookings.spent) },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl px-3 py-2 ${s.warn ? "bg-orange-50" : "bg-slate-50"}`}>
                    <p className={`text-base font-bold tabular-nums ${s.warn ? "text-orange-700" : "text-slate-900"}`}>{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>
              {(u.requiresOnlinePayment || u.isBookingSuspended) && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  {u.isBookingSuspended ? "Can't book right now" : "Must pay by bank transfer"} ({u.noShowCount} no-show{u.noShowCount === 1 ? "" : "s"}, {u.cashCancelCount} late cash cancel{u.cashCancelCount === 1 ? "" : "s"}).
                </p>
              )}
            </Section>
          )}

          {data.owner && (
            <Section title="As a ground owner" action={<Link href="/admin/commissions" className="text-xs font-medium text-blue-600 hover:underline">Commissions</Link>}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mb-3">
                <Fact label="Commission owed"><span className={data.owner.commissionOwed > 0 ? "text-orange-700 font-semibold" : ""}>{rs(data.owner.commissionOwed)}</span></Fact>
                <Fact label="Commission settled">{rs(data.owner.commissionPaid)}</Fact>
                <Fact label="Business">{u.groundOwnerProfile?.businessName ?? "—"}</Fact>
                <Fact label="Payout account">
                  {u.groundOwnerProfile?.accountNumber
                    ? <>{u.groundOwnerProfile.bankName}<span className="block text-xs text-slate-500">{u.groundOwnerProfile.accountHolderName}, {u.groundOwnerProfile.accountNumber}</span></>
                    : <span className="text-amber-700">Not added. Lobby payouts can&apos;t be sent.</span>}
                </Fact>
              </dl>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {data.owner.grounds.map((g) => (
                  <li key={g.id}>
                    <Link href={`/admin/grounds/${g.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900 truncate">{g.name}</span>
                        <span className="block text-xs text-slate-500">{g.city}, {g.bookings} bookings, {g.commissionRate != null ? `${g.commissionRate}% commission` : "default commission"}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${g.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{g.status.toLowerCase()}</span>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </span>
                    </Link>
                  </li>
                ))}
                {data.owner.grounds.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No grounds yet.</li>}
              </ul>
            </Section>
          )}

          {u.facilityWorker && (
            <Section title="As a ground worker">
              <Link href={`/admin/grounds/${u.facilityWorker.facility.id}`} className="text-sm text-blue-600 hover:underline">{u.facilityWorker.facility.name}</Link>
            </Section>
          )}

          {data.bookings.recent.length > 0 && (
            <Section title="Recent bookings" action={<Link href={`/admin/bookings?q=${encodeURIComponent(u.email)}`} className="text-xs font-medium text-blue-600 hover:underline">All {data.bookings.total}</Link>}>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {data.bookings.recent.map((b) => {
                  const st = BOOKING_STATUS[b.status];
                  return (
                    <li key={b.id}>
                      <Link href={`/admin/bookings?booking=${b.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50">
                        <span className="min-w-0">
                          <span className="block text-sm text-slate-900 truncate">{b.facility.name}</span>
                          <span className="block text-xs text-slate-500 tabular-nums">{day(b.bookingDate, true)}, {b.startTime} · {rs(b.totalAmount)}</span>
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${st?.cls ?? ""}`}>{st?.label ?? b.status}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {!canManage && <p className="text-xs text-slate-500 mt-2">{data.isSelf ? "This is your account." : "Admin accounts can't be changed here."}</p>}
        </>
      )}
    </Drawer>
  );
}
