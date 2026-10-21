"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Ban, Bell, CheckCircle, Clock, Loader2, Mail, MapPin, MessageSquareWarning, RefreshCw,
  Search, ShieldAlert, ShieldCheck, Undo2, UserX, Users, X,
} from "lucide-react";

// Cash (pay-at-ground) bookings: judge no-show reports on evidence, chase grounds that never
// settle bookings, and warn or block players who abuse bookings.

type Leans = "player" | "ground" | "neutral";
interface Person { id: string; name: string; email: string; phone: string | null }
interface GroundRef { id: string; name: string; city: string; owner: { user: Person } }
interface Report {
  id: string; bookingDate: string; startTime: string; endTime: string; totalAmount: number; paymentMethod: string;
  noShowMarkedAt: string | null; review: "PENDING" | "CONFIRMED" | "OVERTURNED"; noShowDispute: string | null; noShowDisputedAt: string | null;
  noShowReviewedAt: string | null; noShowReviewNote: string | null; contactNumber: string | null;
  user: Person & { createdAt: string; noShowCount: number; requiresOnlinePayment: boolean; isBookingSuspended: boolean; isActive: boolean };
  facility: GroundRef; reporter: { name: string; role: string } | null; minsAfterStart: number | null;
  playerCompleted: number; playerNoShows: number; signals: { text: string; leans: Leans }[];
  hint: "likely_genuine" | "check_ground" | "review"; blocked: boolean;
}
interface Unresolved { id: string; bookingDate: string; startTime: string; endTime: string; totalAmount: number; status: string; user: Person; facility: GroundRef }
interface Player extends Person {
  createdAt: string; isActive: boolean; noShowCount: number; cashCancelCount: number; requiresOnlinePayment: boolean; isBookingSuspended: boolean;
  cashBookings: number; completed: number; noShows: number; noShowGrounds: number; noShowRate: number; risk: number; lastBooking: string | null;
  block: { id: string; reason: string; details: string | null; createdAt: string } | null;
}
interface Ground extends GroundRef { completed: number; noShows: number; overturned: number; total: number; noShowRate: number; unresolved: number; flags: string[] }
interface Block { id: string; email: string; phone: string | null; userId: string | null; reasonLabel: string; details: string | null; createdAt: string; liftedAt: string | null; liftNote: string | null }
interface Data {
  summary: { reportsToReview: number; disputed: number; unresolved: number; flaggedGrounds: number; blocked: number; platformNoShowRate: number };
  reports: Report[]; unresolved: Unresolved[]; players: Player[]; grounds: Ground[]; blocks: Block[]; reasons: Record<string, string>;
}

const fmt  = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const day  = (d: string) => new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const pct  = (r: number) => `${Math.round(r * 100)}%`;
const LEAN_STYLE: Record<Leans, string> = { player: "bg-red-50 text-red-700 border-red-100", ground: "bg-blue-50 text-blue-700 border-blue-100", neutral: "bg-slate-50 text-slate-600 border-slate-200" };
const HINT: Record<Report["hint"], { label: string; style: string }> = {
  likely_genuine: { label: "Likely a genuine no-show", style: "bg-red-50 text-red-700" },
  check_ground:   { label: "Check the ground's side", style: "bg-blue-50 text-blue-700" },
  review:         { label: "Needs a closer look",     style: "bg-amber-50 text-amber-700" },
};

export default function TrustPage() {
  const [data,   setData]   = useState<Data | null>(null);
  const [tab,    setTab]    = useState<"reports" | "unresolved" | "players" | "grounds" | "blocked">("reports");
  const [busy,   setBusy]   = useState<string | null>(null);
  const [error,  setError]  = useState("");
  const [toast,  setToast]  = useState("");
  const [notes,  setNotes]  = useState<Record<string, string>>({});
  const [query,  setQuery]  = useState("");
  const [showDone, setShowDone] = useState(false);
  const [blockFor, setBlockFor] = useState<{ id: string; name: string; email: string } | null>(null);
  const [warnFor,  setWarnFor]  = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/trust", { cache: "no-store" });
    const d   = await res.json();
    if (!res.ok) { setError(d.error ?? "Couldn't load."); return; }
    setData(d);
    window.dispatchEvent(new Event("admin-tasks-changed")); // refresh the sidebar badges
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post(key: string, url: string, body: object) {
    setBusy(key); setError("");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d   = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(d.error ?? "That didn't work."); return false; }
    setToast(d.message ?? "Done.");
    setTimeout(() => setToast(""), 3500);
    await load();
    return true;
  }

  const q = query.trim().toLowerCase();
  const match = useCallback((...xs: (string | null | undefined)[]) => !q || xs.some((x) => x?.toLowerCase().includes(q)), [q]);
  const reports = useMemo(() => (data?.reports ?? []).filter((r) => (showDone || r.review === "PENDING") && match(r.user.name, r.user.email, r.facility.name)), [data, showDone, match]);

  if (!data && !error) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!data) return <p className="text-red-600">{error}</p>;
  const s = data.summary;

  const tabs = [
    { id: "reports",    label: "No-show reports",    count: s.reportsToReview, icon: UserX },
    { id: "unresolved", label: "Unsettled bookings", count: s.unresolved,      icon: Clock },
    { id: "players",    label: "Players",            count: 0,                 icon: Users },
    { id: "grounds",    label: "Grounds",            count: s.flaggedGrounds,  icon: MapPin },
    { id: "blocked",    label: "Blocked",            count: 0,                 icon: Ban },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cash Bookings & Trust</h1>
          <p className="text-slate-500 text-sm mt-0.5">Review no-show reports on evidence, chase unsettled cash bookings, and act on players who abuse bookings</p>
        </div>
        <button onClick={() => void load()} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl px-3 py-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "No-shows to review", value: s.reportsToReview, sub: s.disputed ? `${s.disputed} disputed by the player` : "none disputed", icon: UserX, tone: "bg-purple-50 text-purple-700" },
          { label: "Unsettled cash bookings", value: s.unresolved, sub: "ended, never marked", icon: Clock, tone: "bg-amber-50 text-amber-700" },
          { label: "Grounds flagged", value: s.flaggedGrounds, sub: "unusual patterns", icon: AlertTriangle, tone: "bg-blue-50 text-blue-700" },
          { label: "Blocked accounts", value: s.blocked, sub: "email blocklist", icon: Ban, tone: "bg-red-50 text-red-700" },
          { label: "Platform no-show rate", value: pct(s.platformNoShowRate), sub: "cash bookings, 90 days", icon: ShieldCheck, tone: "bg-emerald-50 text-emerald-700" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.tone}`}><c.icon className="w-4 h-4" /></div>
            <p className="mt-3 text-xl font-bold text-slate-900">{c.value}</p>
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              <t.icon className="w-4 h-4" /> {t.label}
              {t.count > 0 && <span className="bg-red-500 text-white text-[11px] font-bold rounded-full px-1.5 py-0.5">{t.count}</span>}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-1.5 mb-1.5 text-sm">
          <Search className="w-4 h-4 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search player, email or ground" className="outline-none w-52" />
        </label>
      </div>

      {error && <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertTriangle className="w-4 h-4" />{error}</div>}
      {toast && <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3"><CheckCircle className="w-4 h-4" />{toast}</div>}

      {/* ── No-show reports ─────────────────────────────────────────────── */}
      {tab === "reports" && (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500 self-end">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show reviewed reports (last 60 days)
          </label>
          {reports.length === 0 ? <Empty text="No no-show reports waiting for review." /> : reports.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 p-4 grid lg:grid-cols-[1.1fr_1.3fr_0.9fr] gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900">{r.user.name}</p>
                  {r.blocked && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">BLOCKED</span>}
                  {!r.blocked && r.user.isBookingSuspended && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">SUSPENDED</span>}
                  {!r.blocked && !r.user.isBookingSuspended && r.user.requiresOnlinePayment && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">ONLINE ONLY</span>}
                </div>
                <p className="text-xs text-slate-500">{r.user.email} · {r.contactNumber ?? r.user.phone ?? "no phone"}</p>
                <p className="text-sm text-slate-700 mt-1"><strong>{r.facility.name}</strong>, {r.facility.city}</p>
                <p className="text-xs text-slate-500">{day(r.bookingDate)} · {r.startTime}–{r.endTime} · {fmt(r.totalAmount)} {r.paymentMethod === "ON_ARRIVAL" ? "cash" : "online"}</p>
                <p className="text-xs text-slate-500">
                  Reported by {r.reporter ? `${r.reporter.name} (${r.reporter.role === "GROUND_WORKER" ? "worker" : "owner"})` : "the ground"}
                  {r.minsAfterStart !== null && <> · {r.minsAfterStart < 60 ? `${Math.max(0, r.minsAfterStart)} min` : `${Math.round(r.minsAfterStart / 60)} h`} after start</>}
                </p>
                <p className="text-xs text-slate-400">Owner: {r.facility.owner.user.name} · {r.facility.owner.user.phone ?? r.facility.owner.user.email}</p>
              </div>

              <div className="flex flex-col gap-2">
                <span className={`self-start text-[11px] font-bold px-2.5 py-1 rounded-full ${HINT[r.hint].style}`}>{HINT[r.hint].label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {r.signals.length === 0 ? <span className="text-xs text-slate-400">No other history — first report for this player.</span> : r.signals.map((sg) => (
                    <span key={sg.text} className={`text-[11px] border rounded-lg px-2 py-1 ${LEAN_STYLE[sg.leans]}`}>{sg.text}</span>
                  ))}
                </div>
                <p className="text-xs text-slate-500">Player record: {r.playerNoShows} no-show{r.playerNoShows === 1 ? "" : "s"} · {r.playerCompleted} completed · member since {new Date(r.user.createdAt).toLocaleDateString()}</p>
                {r.noShowDispute && (
                  <div className="text-sm text-slate-800 bg-blue-50/60 border border-blue-100 rounded-xl px-3 py-2">
                    <p className="text-[11px] font-semibold text-blue-700 mb-0.5">Player&apos;s side</p>
                    &ldquo;{r.noShowDispute}&rdquo;
                  </div>
                )}
                <p className="text-[11px] text-slate-400"><span className="text-red-600">Red</span> points to the player, <span className="text-blue-600">blue</span> to the ground.</p>
              </div>

              <div className="flex flex-col gap-2">
                {r.review === "PENDING" ? (
                  <>
                    <input className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400" placeholder="Note (optional, admin-only)"
                      value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
                    <button disabled={busy === r.id} onClick={() => post(r.id, `/api/admin/trust/noshow/${r.id}`, { decision: "confirm", note: notes[r.id] })}
                      className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2.5">
                      {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />} Confirm no-show
                    </button>
                    <button disabled={busy === r.id} onClick={() => post(r.id, `/api/admin/trust/noshow/${r.id}`, { decision: "overturn", note: notes[r.id] })}
                      className="flex items-center justify-center gap-2 border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 text-sm font-semibold rounded-xl py-2">
                      <Undo2 className="w-4 h-4" /> Overturn — player was there
                    </button>
                    <p className="text-[11px] text-slate-400 leading-4">Overturning marks the booking completed (the ground owes commission) and clears the player&apos;s penalty.</p>
                  </>
                ) : (
                  <p className={`text-xs rounded-xl px-3 py-2 ${r.review === "OVERTURNED" ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-700"}`}>
                    {r.review === "OVERTURNED" ? "Overturned" : "Confirmed"}{r.noShowReviewedAt && ` ${new Date(r.noShowReviewedAt).toLocaleDateString()}`}
                    {r.noShowReviewNote && <> — {r.noShowReviewNote}</>}
                  </p>
                )}
                {!r.blocked && (
                  <div className="flex gap-2">
                    <button onClick={() => setWarnFor({ id: r.user.id, name: r.user.name })} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-700 border border-amber-200 hover:bg-amber-50 rounded-lg py-2"><MessageSquareWarning className="w-3.5 h-3.5" />Warn</button>
                    <button onClick={() => setBlockFor({ id: r.user.id, name: r.user.name, email: r.user.email })} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-lg py-2"><Ban className="w-3.5 h-3.5" />Block</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Unsettled cash bookings ─────────────────────────────────────── */}
      {tab === "unresolved" && (() => {
        const rows = data.unresolved.filter((u) => match(u.user.name, u.user.email, u.facility.name));
        const byGround = new Map<string, Unresolved[]>();
        rows.forEach((u) => byGround.set(u.facility.id, [...(byGround.get(u.facility.id) ?? []), u]));
        return rows.length === 0 ? <Empty text="Every past cash booking has been settled." /> : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500">Cash bookings whose time ended over a day ago but the ground never marked completed or no-show. Commission is only counted on completed bookings, so these may be unpaid commission.</p>
            {[...byGround.values()].map((list) => (
              <div key={list[0].facility.id} className="bg-white rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <p className="font-semibold text-slate-900">{list[0].facility.name} <span className="font-normal text-slate-400">· {list[0].facility.city}</span></p>
                    <p className="text-xs text-slate-500">{list.length} unsettled · {fmt(list.reduce((t, u) => t + u.totalAmount, 0))} · owner {list[0].facility.owner.user.name} ({list[0].facility.owner.user.phone ?? list[0].facility.owner.user.email})</p>
                  </div>
                  <button disabled={busy === list[0].facility.id} onClick={() => post(list[0].facility.id, "/api/admin/trust/remind", { facilityId: list[0].facility.id, count: list.length })}
                    className="flex items-center gap-1.5 text-sm font-semibold border border-slate-200 hover:bg-slate-50 rounded-xl px-3 py-2">
                    {busy === list[0].facility.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />} Remind the ground
                  </button>
                </div>
                <div className="divide-y divide-slate-50">
                  {list.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="text-slate-700">{day(u.bookingDate)} · {u.startTime}–{u.endTime}</span>
                      <span className="text-slate-500 truncate">{u.user.name} · {u.user.phone ?? u.user.email}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${u.status === "PENDING" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{u.status === "PENDING" ? "NEVER CONFIRMED" : "CONFIRMED"}</span>
                      <span className="font-semibold text-slate-800">{fmt(u.totalAmount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Players ─────────────────────────────────────────────────────── */}
      {tab === "players" && (() => {
        const rows = data.players.filter((p) => match(p.name, p.email, p.phone));
        return rows.length === 0 ? <Empty text="No players with no-shows or cancellations." /> : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 border-b border-slate-100">
                <tr>{["Player", "Cash bookings", "No-shows", "Grounds reporting", "Cancels", "Status", ""].map((h) => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((p) => (
                  <tr key={p.id} className={p.block ? "bg-red-50/30" : ""}>
                    <td className="px-4 py-3"><p className="font-semibold text-slate-900">{p.name}</p><p className="text-xs text-slate-500">{p.email}{p.phone ? ` · ${p.phone}` : ""}</p></td>
                    <td className="px-4 py-3 text-slate-700">{p.cashBookings} <span className="text-xs text-slate-400">({p.completed} completed)</span></td>
                    <td className="px-4 py-3"><span className={p.noShows >= 2 ? "font-bold text-red-600" : "text-slate-700"}>{p.noShows}</span> <span className="text-xs text-slate-400">{pct(p.noShowRate)}</span></td>
                    <td className="px-4 py-3 text-slate-700">{p.noShowGrounds}</td>
                    <td className="px-4 py-3 text-slate-700">{p.cashCancelCount}</td>
                    <td className="px-4 py-3">
                      {p.block ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700" title={p.block.details ?? ""}>BLOCKED · {p.block.reason}</span>
                        : p.isBookingSuspended ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">SUSPENDED</span>
                        : p.requiresOnlinePayment ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">ONLINE ONLY</span>
                        : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">OK</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 justify-end">
                        {p.block ? (
                          <button disabled={busy === p.block.id} onClick={() => post(p.block!.id, "/api/admin/trust/unblock", { blockId: p.block!.id })} className="text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg px-2.5 py-1.5">Unblock</button>
                        ) : (
                          <>
                            {(p.requiresOnlinePayment || p.isBookingSuspended) && (
                              <button disabled={busy === p.id} onClick={() => post(p.id, "/api/admin/trust/restrictions", { userId: p.id })} className="text-xs font-semibold text-green-700 border border-green-200 hover:bg-green-50 rounded-lg px-2.5 py-1.5">Lift limits</button>
                            )}
                            <button onClick={() => setWarnFor({ id: p.id, name: p.name })} className="text-xs font-semibold text-amber-700 border border-amber-200 hover:bg-amber-50 rounded-lg px-2.5 py-1.5">Warn</button>
                            <button onClick={() => setBlockFor({ id: p.id, name: p.name, email: p.email })} className="text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-lg px-2.5 py-1.5">Block</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ── Grounds ─────────────────────────────────────────────────────── */}
      {tab === "grounds" && (() => {
        const rows = data.grounds.filter((g) => match(g.name, g.city, g.owner.user.name));
        return rows.length === 0 ? <Empty text="No cash booking activity yet." /> : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 border-b border-slate-100">
                <tr>{["Ground", "Cash bookings (90d)", "Completed", "No-shows", "No-show rate", "Overturned", "Unsettled", "Flags"].map((h) => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((g) => (
                  <tr key={g.id} className={g.flags.length ? "bg-blue-50/30" : ""}>
                    <td className="px-4 py-3"><p className="font-semibold text-slate-900">{g.name}</p><p className="text-xs text-slate-500">{g.city} · {g.owner.user.name}</p></td>
                    <td className="px-4 py-3 text-slate-700">{g.total}</td>
                    <td className="px-4 py-3 text-slate-700">{g.completed}</td>
                    <td className="px-4 py-3 text-slate-700">{g.noShows}</td>
                    <td className="px-4 py-3"><span className={g.flags.some((f) => f.startsWith("No-show rate")) ? "font-bold text-blue-700" : "text-slate-700"}>{pct(g.noShowRate)}</span></td>
                    <td className="px-4 py-3 text-slate-700">{g.overturned}</td>
                    <td className="px-4 py-3 text-slate-700">{g.unresolved}</td>
                    <td className="px-4 py-3">{g.flags.length === 0 ? <span className="text-xs text-slate-400">—</span> : (
                      <ul className="flex flex-col gap-1">{g.flags.map((f) => <li key={f} className="text-[11px] text-blue-700 bg-blue-50 rounded px-2 py-0.5">{f}</li>)}</ul>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-400 px-4 py-3 border-t border-slate-50">A ground that marks paid bookings as no-shows avoids commission. Look for high no-show rates, overturned reports and unsettled bookings.</p>
          </div>
        );
      })()}

      {/* ── Blocked ─────────────────────────────────────────────────────── */}
      {tab === "blocked" && (() => {
        const rows = data.blocks.filter((b) => match(b.email, b.phone));
        return rows.length === 0 ? <Empty text="No blocked accounts." /> : (
          <div className="flex flex-col gap-2">
            {rows.map((b) => (
              <div key={b.id} className={`bg-white rounded-2xl border p-4 flex items-center justify-between gap-4 flex-wrap ${b.liftedAt ? "border-slate-100 opacity-70" : "border-red-100"}`}>
                <div>
                  <p className="font-semibold text-slate-900">{b.email}{b.phone && <span className="font-normal text-slate-500"> · {b.phone}</span>}</p>
                  <p className="text-xs text-slate-500">{b.reasonLabel}{b.details ? ` — ${b.details}` : ""} · blocked {new Date(b.createdAt).toLocaleDateString()}</p>
                  {b.liftedAt && <p className="text-xs text-green-700">Lifted {new Date(b.liftedAt).toLocaleDateString()}{b.liftNote ? ` — ${b.liftNote}` : ""}</p>}
                </div>
                {!b.liftedAt && (
                  <button disabled={busy === b.id} onClick={() => post(b.id, "/api/admin/trust/unblock", { blockId: b.id })} className="text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl px-3 py-2">Unblock</button>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {blockFor && <BlockDialog target={blockFor} reasons={data.reasons} busy={busy === "block"} onClose={() => setBlockFor(null)}
        onSubmit={async (body) => { if (await post("block", "/api/admin/trust/block", { userId: blockFor.id, ...body })) setBlockFor(null); }} />}
      {warnFor && <WarnDialog target={warnFor} busy={busy === "warn"} onClose={() => setWarnFor(null)}
        onSubmit={async (message) => { if (await post("warn", "/api/admin/trust/warn", { userId: warnFor.id, message })) setWarnFor(null); }} />}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="bg-white rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">{text}</div>;
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="bg-white rounded-2xl w-full max-w-md p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">{title}</h2><button onClick={onClose} aria-label="Close"><X className="w-5 h-5 text-slate-400" /></button></div>
        {children}
      </div>
    </div>
  );
}

function BlockDialog({ target, reasons, busy, onClose, onSubmit }: {
  target: { name: string; email: string }; reasons: Record<string, string>; busy: boolean; onClose: () => void;
  onSubmit: (b: { reason: string; details: string; blockPhone: boolean }) => void;
}) {
  const [reason, setReason] = useState("NO_SHOWS");
  const [details, setDetails] = useState("");
  const [blockPhone, setBlockPhone] = useState(true);
  return (
    <Dialog title={`Block ${target.name}`} onClose={onClose}>
      <div className="text-xs text-slate-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 leading-5">
        Signs them out everywhere, cancels their unpaid upcoming bookings, and stops <strong>{target.email}</strong> signing up again — by password or Google.
        They&apos;ll get an email with the reason below.
      </div>
      <label className="text-xs font-medium text-slate-600">Reason
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
          {Object.entries(reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-600">Details (shown to the player)
        <textarea rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. 4 confirmed no-shows at 3 different grounds in October."
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={blockPhone} onChange={(e) => setBlockPhone(e.target.checked)} /> Also block their phone number</label>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="text-sm text-slate-600 px-4 py-2">Cancel</button>
        <button disabled={busy} onClick={() => onSubmit({ reason, details, blockPhone })} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl px-4 py-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Block & email
        </button>
      </div>
    </Dialog>
  );
}

function WarnDialog({ target, busy, onClose, onSubmit }: { target: { name: string }; busy: boolean; onClose: () => void; onSubmit: (message: string) => void }) {
  const [message, setMessage] = useState(`Hi ${target.name}, our records show missed bookings on your account. Grounds hold the slot for you, so please turn up or cancel in time. Further no-shows may lead to your account being blocked.`);
  return (
    <Dialog title={`Warn ${target.name}`} onClose={onClose}>
      <textarea rows={5} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
      <p className="text-[11px] text-slate-400">Sent by email and as an in-app notification.</p>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="text-sm text-slate-600 px-4 py-2">Cancel</button>
        <button disabled={busy} onClick={() => onSubmit(message)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl px-4 py-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Send warning
        </button>
      </div>
    </Dialog>
  );
}
