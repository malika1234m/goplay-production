"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, AlertTriangle, UserX, ShieldOff, ShieldCheck,
  RefreshCw, XCircle, RotateCcw, CreditCard, Banknote,
  ChevronRight, User, MapPin, Calendar, Ban, CheckCircle,
  ClipboardList, X, Clock, PhoneCall, Building2,
} from "lucide-react";

// ─── API types ────────────────────────────────────────────────────────────────
interface Summary {
  totalCancellations:    number;
  cancelledByUser:       number;
  cancelledByOwner:      number;
  noShowTotal:           number;
  suspendedUsers:        number;
  restrictedUsers:       number;
  facilitiesWithStrikes: number;
  suspendedListings:     number;
  refundNeeded:          number;
  totalRefundValue:      number;
}
interface NoShow {
  id: string; bookingDate: string; startTime: string; endTime: string;
  totalAmount: number; paymentMethod: string; noShowMarkedAt: string | null;
  user: { id: string; name: string; email: string; noShowCount: number; requiresOnlinePayment: boolean; isBookingSuspended: boolean };
  facility: { name: string; city: string };
}
interface FacilityStrike {
  id: string; name: string; city: string;
  cancelStrikeCount: number; strikeResetAt: string | null; isListingSuspended: boolean;
  owner: { user: { id: string; name: string; email: string } };
}
interface SuspendedUser {
  id: string; name: string; email: string;
  noShowCount: number; cashCancelCount: number;
  requiresOnlinePayment: boolean; isBookingSuspended: boolean; createdAt: string;
}
interface Cancellation {
  id: string; bookingDate: string; startTime: string; endTime: string;
  totalAmount: number; paymentMethod: string; paymentStatus: string;
  refundStatus: string; refundAmount: number | null; refundPercent: number | null;
  cancelledAt: string | null; cancelledBy: string | null;
  user: { id: string; name: string; email: string };
  facility: { name: string; city: string };
}

// ─── Review drawer types ──────────────────────────────────────────────────────
interface UserHistory {
  user: {
    id: string; name: string; email: string; phone: string | null; createdAt: string;
    noShowCount: number; cashCancelCount: number;
    requiresOnlinePayment: boolean; isBookingSuspended: boolean;
  };
  cancellations: {
    id: string; bookingDate: string; startTime: string; endTime: string;
    totalAmount: number; paymentMethod: string; cancelledAt: string | null;
    cancelledBy: string | null; refundPercent: number | null; refundAmount: number | null;
    facility: { name: string; city: string };
  }[];
  noShows: {
    id: string; bookingDate: string; startTime: string; endTime: string;
    totalAmount: number; paymentMethod: string; noShowMarkedAt: string | null;
    facility: { name: string; city: string };
  }[];
}
interface FacilityHistory {
  facility: {
    id: string; name: string; city: string; address: string;
    cancelStrikeCount: number; strikeResetAt: string | null; isListingSuspended: boolean;
    createdAt: string;
    owner: { user: { id: string; name: string; email: string; phone: string | null; createdAt: string } };
  };
  cancellations: {
    id: string; bookingDate: string; startTime: string; endTime: string;
    totalAmount: number; paymentMethod: string; cancelledAt: string | null;
    cancelledBy: string | null; refundPercent: number | null; refundAmount: number | null;
    user: { name: string; email: string };
  }[];
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt   = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;
const fmtD  = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtDT = (d: string) => new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

type Tab = "overview" | "noshow" | "strikes" | "users" | "history";

// ─── User Review Drawer ───────────────────────────────────────────────────────
function UserReviewDrawer({
  userId, onClose, onAction,
}: {
  userId: string;
  onClose: () => void;
  onAction: (action: string, userId: string) => Promise<void>;
}) {
  const [data,    setData]    = useState<UserHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(false);
  const [done,    setDone]    = useState("");

  useEffect(() => {
    fetch(`/api/admin/cancellations/user/${userId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [userId]);

  const handle = async (action: string) => {
    setActing(true);
    await onAction(action, userId);
    // Re-fetch to show updated state
    const r = await fetch(`/api/admin/cancellations/user/${userId}`);
    const d = await r.json();
    setData(d);
    setActing(false);
    setDone(action === "unsuspend-user" ? "Account fully activated." : "Restriction applied.");
  };

  const u = data?.user;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-white h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm">
              {u?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="font-bold text-slate-900">{u?.name ?? "Loading…"}</p>
              <p className="text-xs text-slate-400">{u?.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading history…</span>
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Failed to load.</div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* Status + stats */}
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex flex-wrap gap-2 mb-4">
                {u!.isBookingSuspended && (
                  <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-100 px-2.5 py-1 rounded-full font-semibold">
                    <Ban className="w-3 h-3" />Booking Suspended
                  </span>
                )}
                {u!.requiresOnlinePayment && !u!.isBookingSuspended && (
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-full font-semibold">
                    <CreditCard className="w-3 h-3" />Online Payments Only
                  </span>
                )}
                {!u!.isBookingSuspended && !u!.requiresOnlinePayment && (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full font-semibold">
                    <CheckCircle className="w-3 h-3" />Active
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "No-Shows",     value: u!.noShowCount,     color: "text-purple-600" },
                  { label: "Cash Cancels", value: u!.cashCancelCount, color: "text-red-500"    },
                  { label: "Joined",       value: fmtD(u!.createdAt), color: "text-slate-700", small: true },
                ].map(({ label, value, color, small }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                    <p className={`font-bold ${small ? "text-sm" : "text-xl"} ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              {u!.phone && (
                <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                  <PhoneCall className="w-3.5 h-3.5" />{u!.phone}
                </div>
              )}
            </div>

            {/* No-show history */}
            {data.noShows.length > 0 && (
              <div className="px-6 py-4 border-b border-slate-100">
                <p className="text-xs font-bold uppercase tracking-widest text-purple-600 mb-3 flex items-center gap-2">
                  <UserX className="w-3.5 h-3.5" />No-Show History ({data.noShows.length})
                </p>
                <div className="flex flex-col gap-2">
                  {data.noShows.map((ns, i) => (
                    <div key={ns.id} className="flex items-start gap-3 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                      <span className="w-5 h-5 rounded-full bg-purple-200 text-purple-800 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="font-semibold text-slate-800">{ns.facility.name}, {ns.facility.city}</p>
                        <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3" />{fmtD(ns.bookingDate)} · {ns.startTime}–{ns.endTime}
                        </p>
                        <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                          {ns.paymentMethod === "ONLINE" ? <CreditCard className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                          {fmt(ns.totalAmount)}
                          {ns.noShowMarkedAt && <span className="text-slate-400 ml-1">· Marked {fmtDT(ns.noShowMarkedAt)}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancellation history */}
            {data.cancellations.length > 0 && (
              <div className="px-6 py-4 border-b border-slate-100">
                <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3 flex items-center gap-2">
                  <XCircle className="w-3.5 h-3.5" />Cancelled Bookings ({data.cancellations.length})
                </p>
                <div className="flex flex-col gap-2">
                  {data.cancellations.map((c) => (
                    <div key={c.id} className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs">
                      <p className="font-semibold text-slate-800">{c.facility.name}, {c.facility.city}</p>
                      <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />{fmtD(c.bookingDate)} · {c.startTime}–{c.endTime}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-slate-500">
                        <span className="flex items-center gap-1">
                          {c.paymentMethod === "ONLINE" ? <CreditCard className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                          {fmt(c.totalAmount)}
                        </span>
                        {c.paymentMethod === "ONLINE" && c.refundPercent != null && (
                          <span className={`font-medium ${c.refundPercent === 100 ? "text-green-600" : c.refundPercent === 0 ? "text-red-600" : "text-amber-600"}`}>
                            {c.refundPercent}% refund
                          </span>
                        )}
                        {c.paymentMethod === "ON_ARRIVAL" && (
                          <span className="text-slate-400">Cash — no refund</span>
                        )}
                      </div>
                      {c.cancelledAt && <p className="text-slate-400 mt-0.5">Cancelled {fmtDT(c.cancelledAt)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.noShows.length === 0 && data.cancellations.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-slate-400">No offenses recorded.</div>
            )}
          </div>
        )}

        {/* Action footer */}
        {!loading && u && (
          <div className="border-t border-slate-100 px-6 py-4 space-y-3">
            {done && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />{done}
              </p>
            )}
            {(u.isBookingSuspended || u.requiresOnlinePayment) && (
              <button
                onClick={() => handle("unsuspend-user")}
                disabled={acting}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-xl transition-colors"
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Activate Account — Lift All Restrictions
              </button>
            )}
            {!u.isBookingSuspended && u.requiresOnlinePayment === false && (
              <p className="text-center text-xs text-slate-400">This account has no active restrictions.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Facility Review Drawer ───────────────────────────────────────────────────
function FacilityReviewDrawer({
  facilityId, onClose, onAction,
}: {
  facilityId: string;
  onClose: () => void;
  onAction: (action: string, facilityId: string) => Promise<void>;
}) {
  const [data,    setData]    = useState<FacilityHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState(false);
  const [done,    setDone]    = useState("");

  useEffect(() => {
    fetch(`/api/admin/cancellations/facility/${facilityId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [facilityId]);

  const handle = async (action: string) => {
    setActing(true);
    await onAction(action, facilityId);
    const r = await fetch(`/api/admin/cancellations/facility/${facilityId}`);
    const d = await r.json();
    setData(d);
    setActing(false);
    setDone(action === "reset-strikes" ? "Strikes reset. Listing restored." : "Listing restored.");
  };

  const f = data?.facility;
  const owner = f?.owner?.user;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-white h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900">{f?.name ?? "Loading…"}</p>
              <p className="text-xs text-slate-400">{f?.city}{owner ? ` · Owner: ${owner.name}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading history…</span>
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Failed to load.</div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* Strike status + owner info */}
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border-2 ${
                    n <= f!.cancelStrikeCount
                      ? "bg-red-500 border-red-400 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-300"
                  }`}>{n}</div>
                ))}
                <div className="ml-2">
                  {f!.isListingSuspended ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-100 px-2.5 py-1 rounded-full font-semibold">
                      <ShieldOff className="w-3 h-3" />Listing Suspended
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full font-semibold">
                      <ShieldCheck className="w-3 h-3" />Listing Active
                    </span>
                  )}
                </div>
              </div>
              {f!.strikeResetAt && (
                <p className="text-xs text-slate-400 mb-3">Strike window started: {fmtD(f!.strikeResetAt)} · resets 90 days from first strike</p>
              )}

              {/* Owner info */}
              {owner && (
                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                    {owner.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="font-semibold text-slate-800">{owner.name}</p>
                    <p className="text-slate-400">{owner.email}</p>
                    {owner.phone && <p className="text-slate-400 flex items-center gap-1"><PhoneCall className="w-3 h-3" />{owner.phone}</p>}
                  </div>
                  <div className="text-xs text-slate-400">Owner since {fmtD(owner.createdAt)}</div>
                </div>
              )}
            </div>

            {/* Cancellation history that caused strikes */}
            <div className="px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3 flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5" />
                Cancellations That Caused Strikes ({data.cancellations.length})
              </p>
              {data.cancellations.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No owner/worker cancellations on record.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.cancellations.map((c, i) => (
                    <div key={c.id} className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-5 h-5 rounded-full bg-red-200 text-red-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {i + 1}
                            </span>
                            <p className="font-semibold text-slate-800">Booked by {c.user.name}</p>
                          </div>
                          <p className="text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />{fmtD(c.bookingDate)} · {c.startTime}–{c.endTime}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5 text-slate-500">
                            <span className="flex items-center gap-1">
                              {c.paymentMethod === "ONLINE" ? <CreditCard className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                              {fmt(c.totalAmount)}
                            </span>
                            {c.paymentMethod === "ONLINE" && (
                              <span className="text-green-600 font-medium">100% refunded to player</span>
                            )}
                          </div>
                          {c.cancelledAt && <p className="text-slate-400 mt-0.5">Cancelled {fmtDT(c.cancelledAt)}</p>}
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                          c.cancelledBy === "worker"
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {c.cancelledBy === "worker" ? "by worker" : "by owner"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action footer */}
        {!loading && f && (
          <div className="border-t border-slate-100 px-6 py-4 space-y-3">
            {done && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />{done}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => handle("reset-strikes")}
                disabled={acting}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 disabled:opacity-50 rounded-xl transition-colors"
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Reset Strikes
              </button>
              {f.isListingSuspended && (
                <button
                  onClick={() => handle("restore-listing")}
                  disabled={acting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-xl transition-colors"
                >
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Restore Listing
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 text-center">
              {f.isListingSuspended
                ? "Reset Strikes clears the count and restores the listing. Restore Listing keeps the strike count but re-activates the listing."
                : "Resetting strikes gives the owner a clean slate for the next 90-day window."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminCancellationsPage() {
  const [data, setData] = useState<{
    summary: Summary;
    noShows: NoShow[];
    facilitiesWithStrikes: FacilityStrike[];
    suspendedUsers: SuspendedUser[];
    cancellations: Cancellation[];
  } | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tab,     setTab]       = useState<Tab>("overview");
  const [msg,     setMsg]       = useState("");
  const [reviewUser,     setReviewUser]     = useState<string | null>(null);
  const [reviewFacility, setReviewFacility] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/admin/cancellations");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action: string, facilityId?: string, userId?: string): Promise<void> => {
    setMsg("");
    const res  = await fetch("/api/admin/cancellations", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action, facilityId, userId }),
    });
    const json = await res.json();
    if (res.ok) { setMsg(json.message ?? "Done."); await load(); }
    else        { setMsg(json.error  ?? "Failed."); }
  };

  const doActionForDrawer = async (action: string, id: string): Promise<void> => {
    const isFacilityAction = ["reset-strikes", "restore-listing"].includes(action);
    await doAction(action, isFacilityAction ? id : undefined, isFacilityAction ? undefined : id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Loading cancellation data…</span>
      </div>
    );
  }

  const s       = data?.summary ?? {} as Summary;
  const noShows = data?.noShows ?? [];
  const strikes = data?.facilitiesWithStrikes ?? [];
  const users   = data?.suspendedUsers ?? [];
  const history = data?.cancellations ?? [];

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "noshow",   label: "No-Shows",        badge: s.noShowTotal },
    { key: "strikes",  label: "Owner Strikes",    badge: s.facilitiesWithStrikes },
    { key: "users",    label: "User Flags",        badge: (s.suspendedUsers ?? 0) + (s.restrictedUsers ?? 0) },
    { key: "history",  label: "All Cancellations", badge: s.totalCancellations },
  ];

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cancellations & No-Shows</h1>
          <p className="text-slate-500 text-sm mt-0.5">Review suspended accounts and facilities before activating them</p>
        </div>
        <button onClick={() => load()}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          <RefreshCw className="w-4 h-4" />Refresh
        </button>
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />{msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
        {tabs.map(({ key, label, badge }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              tab === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {label}
            {badge != null && badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === key ? "bg-slate-100 text-slate-600" : "bg-slate-200 text-slate-500"
              }`}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "overview" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: XCircle,      label: "Total Cancellations",      value: s.totalCancellations,     sub: `${s.cancelledByUser} by player · ${s.cancelledByOwner} by owner`, color: "red"    },
              { icon: UserX,        label: "No-Shows",                 value: s.noShowTotal,            sub: "player didn't arrive",                                             color: "purple" },
              { icon: AlertTriangle,label: "Facilities w/ Strikes",    value: s.facilitiesWithStrikes,  sub: `${s.suspendedListings} suspended`,                                 color: "amber"  },
              { icon: Ban,          label: "Flagged Users",            value: (s.suspendedUsers ?? 0) + (s.restrictedUsers ?? 0), sub: `${s.suspendedUsers} suspended · ${s.restrictedUsers} online-only`, color: "slate" },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-${color}-50`}>
                  <Icon className={`w-5 h-5 text-${color}-600`} />
                </div>
                <p className="text-2xl font-bold text-slate-900">{value}</p>
                <p className="text-xs font-medium text-slate-600 mt-0.5">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {s.suspendedListings > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">{s.suspendedListings} listing{s.suspendedListings > 1 ? "s" : ""} suspended due to owner strikes</p>
                <p className="text-xs text-amber-700 mt-0.5">Review each facility's cancellation history before restoring.</p>
                <button onClick={() => setTab("strikes")} className="mt-2 flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900">
                  Review Strikes <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {s.suspendedUsers > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <Ban className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">{s.suspendedUsers} user account{s.suspendedUsers > 1 ? "s" : ""} suspended</p>
                <p className="text-xs text-red-700 mt-0.5">Review each user's offense history before lifting restrictions.</p>
                <button onClick={() => setTab("users")} className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900">
                  Review Users <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── No-Shows ── */}
      {tab === "noshow" && (
        <div className="flex flex-col gap-4">
          {noShows.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 px-6 py-16 text-center">
              <UserX className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No no-shows recorded</p>
            </div>
          ) : noShows.map((ns) => (
            <div key={ns.id} className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm shrink-0">
                    {ns.user.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{ns.user.name}</p>
                    <p className="text-xs text-slate-400">{ns.user.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full font-medium">
                    <UserX className="w-3 h-3" />{ns.user.noShowCount} no-show{ns.user.noShowCount !== 1 ? "s" : ""}
                  </span>
                  {ns.user.isBookingSuspended && (
                    <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full font-medium">
                      <Ban className="w-3 h-3" />Suspended
                    </span>
                  )}
                  {ns.user.requiresOnlinePayment && !ns.user.isBookingSuspended && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-medium">
                      <CreditCard className="w-3 h-3" />Online Only
                    </span>
                  )}
                  <button
                    onClick={() => setReviewUser(ns.user.id)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ClipboardList className="w-3 h-3" />Review
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ns.facility.name}, {ns.facility.city}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtD(ns.bookingDate)}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ns.startTime}–{ns.endTime}</span>
                <span className="flex items-center gap-1">
                  {ns.paymentMethod === "ONLINE" ? <CreditCard className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                  {fmt(ns.totalAmount)}
                </span>
              </div>
              {ns.noShowMarkedAt && (
                <p className="text-xs text-slate-400 mt-2">Marked no-show: {fmtDT(ns.noShowMarkedAt)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Owner Strikes ── */}
      {tab === "strikes" && (
        <div className="flex flex-col gap-4">
          {strikes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 px-6 py-16 text-center">
              <ShieldCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No owner strikes on record</p>
            </div>
          ) : strikes.map((f) => (
            <div key={f.id} className={`bg-white rounded-2xl border p-5 ${f.isListingSuspended ? "border-red-200" : "border-slate-100"}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900">{f.name}</p>
                    <span className="text-xs text-slate-400">{f.city}</span>
                    {f.isListingSuspended && (
                      <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full font-medium">
                        <ShieldOff className="w-3 h-3" />Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Owner: {f.owner.user.name} · {f.owner.user.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold border-2 ${
                      n <= f.cancelStrikeCount
                        ? "bg-red-500 border-red-400 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-300"
                    }`}>{n}</div>
                  ))}
                </div>
              </div>
              {f.strikeResetAt && (
                <p className="text-xs text-slate-400 mt-2">Strike window started: {fmtD(f.strikeResetAt)} · resets after 90 days</p>
              )}
              <div className="mt-3">
                <button
                  onClick={() => setReviewFacility(f.id)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-xl transition-colors"
                >
                  <ClipboardList className="w-4 h-4" />
                  Review Cancellation History
                  {f.isListingSuspended && " & Restore Listing"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── User Flags ── */}
      {tab === "users" && (
        <div className="flex flex-col gap-4">
          {users.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 px-6 py-16 text-center">
              <User className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No flagged users</p>
            </div>
          ) : users.map((u) => (
            <div key={u.id} className={`bg-white rounded-2xl border p-5 ${u.isBookingSuspended ? "border-red-200" : "border-slate-100"}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                    {u.name[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{u.name}</p>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {u.isBookingSuspended && (
                    <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full font-medium">
                      <Ban className="w-3 h-3" />Suspended
                    </span>
                  )}
                  {u.requiresOnlinePayment && !u.isBookingSuspended && (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-medium">
                      <CreditCard className="w-3 h-3" />Online Only
                    </span>
                  )}
                  <button
                    onClick={() => setReviewUser(u.id)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-xl transition-colors"
                  >
                    <ClipboardList className="w-4 h-4" />Review & Activate
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-slate-400">No-Shows</p>
                  <p className="font-bold text-slate-800 text-base">{u.noShowCount}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-slate-400">Cash Cancels</p>
                  <p className="font-bold text-slate-800 text-base">{u.cashCancelCount}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5">
                  <p className="text-slate-400">Joined</p>
                  <p className="font-medium text-slate-700">{fmtD(u.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Cancellation History ── */}
      {tab === "history" && (
        <div className="flex flex-col gap-3">
          {history.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 px-6 py-16 text-center">
              <XCircle className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No cancellations on record</p>
            </div>
          ) : history.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                    {c.user.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{c.user.name}</p>
                    <p className="text-xs text-slate-400">{c.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                    c.cancelledBy === "owner"   ? "bg-orange-50 text-orange-700 border-orange-100" :
                    c.cancelledBy === "worker"  ? "bg-amber-50 text-amber-700 border-amber-100"   :
                    "bg-slate-50 text-slate-600 border-slate-200"
                  }`}>
                    {c.cancelledBy === "owner" ? "Owner cancelled" : c.cancelledBy === "worker" ? "Worker cancelled" : "Player cancelled"}
                  </span>
                  {c.refundStatus === "NEEDED" && (
                    <span className="text-xs bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full font-medium">Refund Needed</span>
                  )}
                  {c.refundStatus === "PROCESSED" && (
                    <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium">Refunded</span>
                  )}
                  <button
                    onClick={() => setReviewUser(c.user.id)}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ClipboardList className="w-3 h-3" />Review User
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.facility.name}, {c.facility.city}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtD(c.bookingDate)} · {c.startTime}–{c.endTime}</span>
                <span className="flex items-center gap-1">
                  {c.paymentMethod === "ONLINE" ? <CreditCard className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                  {fmt(c.totalAmount)}
                  {c.refundAmount != null && c.refundPercent != null && c.paymentMethod === "ONLINE" && (
                    <span className="ml-1 text-slate-400">→ refund {c.refundPercent}% = {fmt(c.refundAmount)}</span>
                  )}
                </span>
                {c.cancelledAt && <span className="text-slate-400">Cancelled {fmtDT(c.cancelledAt)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Review drawers ── */}
      {reviewUser && (
        <UserReviewDrawer
          userId={reviewUser}
          onClose={() => { setReviewUser(null); load(); }}
          onAction={doActionForDrawer}
        />
      )}
      {reviewFacility && (
        <FacilityReviewDrawer
          facilityId={reviewFacility}
          onClose={() => { setReviewFacility(null); load(); }}
          onAction={doActionForDrawer}
        />
      )}
    </div>
  );
}
