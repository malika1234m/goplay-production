"use client";

import { useState, useEffect, useCallback, use, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, MapPin, Calendar, Clock, Users, Loader2,
  CheckCircle2, Phone, Mail, Trophy, Zap, Share2,
  ChevronRight, AlertCircle, ExternalLink, PartyPopper,
  ShieldCheck, CreditCard,
} from "lucide-react";
import ContactNumberField, { useContactNumber } from "@/components/shared/ContactNumberField";
import PlayerPaymentPanel from "@/components/payments/PlayerPaymentPanel";
import type { Complaint, PaymentDetails, PaymentStatus } from "@/components/payments/types";

interface UserInfo { id: string; name: string; avatar: string | null; phone: string | null; email: string | null; }
interface Spot { id: string; groupSize: number; status: string; paymentStatus: string; amountPaid: number; createdAt: string; user: UserInfo; }
interface Match {
  id: string;
  lobbyCode: string | null;
  preferredDate: string; preferredStartTime: string; preferredEndTime: string;
  totalSpotsNeeded: number; spotsReserved: number; status: string;
  expiresAt: string; serviceFeePct: number; matchBookingId: string | null;
  facility: { id: string; name: string; address: string; city: string; images: string[]; hourlyRate: number; latitude: number | null; longitude: number | null; capacity: number | null; };
  category: { id: string; name: string; icon: string; minPlayers: number };
  spots: Spot[];
  mySpot: {
    id: string; groupSize: number; status: string; paymentStatus: PaymentStatus; amountDue: number;
    receiptUrl: string | null; receiptRejectReason: string | null;
    latestComplaint: Complaint | null; paymentDetails: PaymentDetails | null; receiptWindowMinutes: number | null;
  } | null;
}

function Countdown({ target }: { target: string }) {
  const [diff, setDiff] = useState(0);
  useEffect(() => {
    const update = () => setDiff(Math.max(0, new Date(target).getTime() - Date.now()));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [target]);

  if (diff === 0) return <span className="text-red-600 font-semibold">Expired</span>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <span className="font-bold tabular-nums">
      {h > 0 && `${h}h `}{m}m {String(s).padStart(2, "0")}s
    </span>
  );
}

function LobbyDetailInner({ id }: { id: string }) {
  const { data: ses } = useSession();
  const contact       = useContactNumber();
  const searchParams  = useSearchParams();
  const justCreated   = searchParams.get("created") === "1";

  const [match,             setMatch]            = useState<Match | null>(null);
  const [loading,           setLoading]          = useState(true);
  const [joining,           setJoining]          = useState(false);
  const [cancelling,        setCancelling]       = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelResult,      setCancelResult]     = useState<{ fineLabel: string; isSuspended: boolean } | null>(null);
  const [groupSize,         setGroupSize]        = useState(1);
  const [error,             setError]            = useState("");
  const [success,           setSuccess]          = useState("");
  const [copied,            setCopied]           = useState(false);

  const fetchMatch = useCallback(async () => {
    const res = await fetch(`/api/open-matches/${id}`);
    if (res.ok) setMatch(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  const activeSpots      = match?.spots.filter((s) => ["RESERVED", "CONFIRMED"].includes(s.status)) ?? [];
  const mySpot           = activeSpots.find((s) => s.user.id === ses?.user?.id);
  const isParticipant    = !!mySpot;
  const minPlayers       = match?.category.minPlayers ?? 1;
  const facilityCapacity = match?.facility.capacity ?? (match ? match.totalSpotsNeeded + 4 : 1);
  const spotsToTrigger   = match ? Math.max(0, minPlayers - match.spotsReserved) : 0;
  const joinCapLeft      = match ? Math.max(0, facilityCapacity - match.spotsReserved) : 0;
  const pctFilled        = match ? Math.min(100, Math.round((match.spotsReserved / minPlayers) * 100)) : 0;
  const isMatched     = match?.status === "MATCHED";
  const isCollecting  = match?.status === "COLLECTING";
  const isExpired     = match?.status === "EXPIRED";
  const isCancelled   = match?.status === "CANCELLED";

  const hours = match
    ? Math.max(0, (new Date(`1970-01-01T${match.preferredEndTime}`).getTime() -
       new Date(`1970-01-01T${match.preferredStartTime}`).getTime()) / 3600000) || 0
    : 0;
  const totalCost       = match ? match.facility.hourlyRate * hours : 0;
  const costDivisor     = match ? (match.status === "COLLECTING" ? minPlayers : Math.max(match.spotsReserved, 1)) : 1;
  const perPersonBase   = match ? totalCost / costDivisor : 0;
  const perPersonGoPlay = Math.round(perPersonBase * (match?.serviceFeePct ?? 0) / 100);
  const perPersonTotal  = Math.round(perPersonBase + perPersonGoPlay);
  const myGroupCost     = Math.round(perPersonTotal * groupSize);

  async function handlePay() {
    if (!contact.validate()) {
      // The mobile sticky bar can be tapped while the field is off-screen
      document.getElementById("contact-number")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError(""); setJoining(true);
    try {
      const res = await fetch(`/api/open-matches/${id}/join`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ groupSize, contactNumber: contact.value }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to reserve a spot."); return; }
      setSuccess("Spot held! Transfer the amount to the ground and upload your receipt below to secure it.");
      await fetchMatch();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setJoining(false);
    }
  }

  const hoursUntilMatch = match
    ? (new Date(`${match.preferredDate.split("T")[0]}T${match.preferredStartTime}:00`).getTime() - Date.now()) / 3_600_000
    : 0;

  const cancelWarning =
    hoursUntilMatch < 4
      ? "Less than 4 hours before the match — this is a late cancellation and will be recorded as a strike on your account."
      : hoursUntilMatch < 24
      ? "Less than 24 hours before the match — this will be recorded as a strike on your account."
      : hoursUntilMatch < 48
      ? "Less than 48 hours before the match — this will be noted on your account."
      : "You are cancelling well in advance. A strike will still be recorded but no payment penalty applies.";

  async function handleCancel() {
    setError(""); setCancelling(true);
    try {
      const res  = await fetch(`/api/open-matches/${id}/spot`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to cancel."); return; }
      setShowCancelConfirm(false);
      setCancelResult({ fineLabel: data.fineLabel, isSuspended: data.isSuspended });
      setSuccess(data.message);
      fetchMatch();
    } finally { setCancelling(false); }
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: `Join my ${match?.category.name} lobby`, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="w-6 h-6 animate-spin text-green-600" />
    </div>
  );

  if (!match) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-slate-400">
      <AlertCircle className="w-10 h-10" />
      <p className="font-medium">Lobby not found.</p>
      <Link href="/open-matches" className="text-green-600 hover:underline text-sm">Back to lobbies</Link>
    </div>
  );

  const showJoin = isCollecting && !isParticipant && ses?.user?.role === "USER";

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-0">

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link href="/open-matches" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center font-bold text-green-700 text-xs shrink-0">
              {match.category.name.charAt(0)}
            </div>
            <span className="font-bold text-slate-900 truncate">{match.category.name} — {match.facility.name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {match.lobbyCode && (
              <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg tracking-wider">
                #{match.lobbyCode}
              </span>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              isMatched   ? "bg-green-100 text-green-700" :
              isExpired   ? "bg-slate-100 text-slate-500" :
              isCancelled ? "bg-red-100 text-red-600"     :
                            "bg-amber-100 text-amber-700"
            }`}>
              {isMatched ? "Matched" : isCollecting ? "Filling…" : match.status}
            </span>
            <button onClick={handleShare}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Share lobby">
              <Share2 className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
        {copied && (
          <div className="bg-green-600 text-white text-xs text-center py-1 font-medium">
            Link copied to clipboard!
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

        {/* ── Alerts ───────────────────────────────────────────────── */}
        {error   && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">{success}</div>}

        {/* ── Creation celebration (full width) ────────────────────── */}
        {justCreated && isCollecting && (
          <div className="mb-6 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <PartyPopper className="w-5 h-5 text-yellow-300" />
              <span className="font-bold text-lg">Your lobby is live!</span>
            </div>
            <p className="text-green-100 text-sm mb-4 max-w-xl">
              Share this link with friends or let others discover it on the hub. GoPlay auto-books as soon as {minPlayers} players join — up to {facilityCapacity} total.
            </p>
            <button onClick={handleShare}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 border border-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
              <Share2 className="w-4 h-4" /> Share Lobby Link
            </button>
          </div>
        )}

        {/* ── Matched banner (full width) ──────────────────────────── */}
        {isMatched && (
          <div className="mb-6 bg-green-600 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-300" />
              <span className="font-bold text-lg">Match Confirmed!</span>
            </div>
            <p className="text-green-100 text-sm mb-3">GoPlay has booked the facility. Show up and play!</p>
            <div className="bg-white/10 rounded-xl p-3 inline-block">
              <p className="font-semibold">{match.facility.name}</p>
              <p className="text-green-100 text-sm">{match.facility.address}, {match.facility.city}</p>
            </div>
          </div>
        )}

        {/* ── Two-column layout ────────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-5 lg:gap-8 lg:items-start">

          {/* ── LEFT COLUMN (main content) ─────────────────────────── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Facility card */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              {match.facility.images[0] && (
                <img src={match.facility.images[0]} alt={match.facility.name}
                  className="w-full h-48 object-cover" />
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-900 text-lg">{match.facility.name}</h2>
                    <div className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" /> {match.facility.address}, {match.facility.city}
                    </div>
                  </div>
                  <Link href={`/grounds/${match.facility.id}`}
                    className="shrink-0 flex items-center gap-1 text-xs text-green-700 font-medium hover:underline">
                    View ground <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                {match.facility.latitude && match.facility.longitude && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${match.facility.latitude},${match.facility.longitude}`}
                    target="_blank" rel="noreferrer"
                    className="mt-3 flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 transition-colors">
                    <MapPin className="w-3.5 h-3.5" /> Get directions on Google Maps
                  </a>
                )}
              </div>
            </div>

            {/* Session details + progress */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Session Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 mb-5">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  {new Date(match.preferredDate).toLocaleDateString("en-LK", { weekday: "long", month: "long", day: "numeric" })}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  {match.preferredStartTime} – {match.preferredEndTime} ({hours}h)
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  {match.category.name} · min {minPlayers} players (up to {facilityCapacity})
                </div>
                {isCollecting && (
                  <div className="flex items-center gap-2 text-sm text-amber-700">
                    <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                    Closes in <Countdown target={match.expiresAt} />
                  </div>
                )}
              </div>

              <div className="mb-1.5 flex justify-between text-sm text-slate-600">
                <span className="font-medium">{match.spotsReserved} / {minPlayers} minimum joined</span>
                <span className={`font-semibold ${spotsToTrigger === 0 ? "text-green-600" : spotsToTrigger <= 2 ? "text-amber-500" : "text-slate-400"}`}>
                  {spotsToTrigger === 0 ? "Ready to book!" : `${spotsToTrigger} more to start`}
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pctFilled}%` }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{pctFilled}% of minimum · up to {joinCapLeft} more can still join</p>
            </div>

            {/* Players in lobby */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" /> Players in Lobby
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-normal ml-auto">
                  {match.spotsReserved}/{minPlayers} min
                </span>
              </h3>

              {activeSpots.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No players yet — be the first to join!</p>
              ) : (
                <div className="space-y-3">
                  {activeSpots.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-sm shrink-0">
                          {s.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {s.user.name}
                            {s.user.id === ses?.user?.id && <span className="text-xs text-green-600 ml-1.5 font-normal">(you)</span>}
                          </p>
                          <p className="text-xs text-slate-400">{s.groupSize} spot{s.groupSize > 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isParticipant && s.user.id !== ses?.user?.id && (
                          <div className="flex items-center gap-2">
                            {s.user.phone && (
                              <a href={`tel:${s.user.phone}`}
                                className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium">
                                <Phone className="w-3 h-3" /> {s.user.phone}
                              </a>
                            )}
                            {s.user.email && (
                              <a href={`mailto:${s.user.email}`} className="text-slate-400 hover:text-slate-600">
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        )}
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                          s.status === "CONFIRMED"
                            ? "bg-green-100 text-green-700"
                            : s.paymentStatus === "PAID"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {s.status === "CONFIRMED" && <CheckCircle2 className="w-3 h-3 inline mr-0.5" />}
                          {s.status === "CONFIRMED" ? "Confirmed" : s.paymentStatus === "PAID" ? "Paid" : s.paymentStatus === "RECEIPT_SUBMITTED" ? "Receipt sent" : "Awaiting payment"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isParticipant && isCollecting && (
                <p className="text-xs text-slate-400 mt-4 text-center">Join to see co-players&apos; contact details</p>
              )}
            </div>

            {/* Cost breakdown */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Cost Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Court (Rs. {match.facility.hourlyRate.toLocaleString()} × {hours}h)</span>
                  <span className="font-medium">Rs. {totalCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    {match.status === "COLLECTING"
                      ? `Split by ${minPlayers} (minimum players)`
                      : `Split by ${match.spotsReserved} player${match.spotsReserved !== 1 ? "s" : ""}`}
                  </span>
                  <span className="font-medium">Rs. {Math.round(perPersonBase).toLocaleString()}/person</span>
                </div>
                {perPersonGoPlay > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Tax & service charge</span>
                    <span>+ Rs. {perPersonGoPlay.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-100 text-base">
                  <span>Per person total</span>
                  <span className="text-green-700">Rs. {perPersonTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

          </div>{/* end left column */}

          {/* ── RIGHT COLUMN (sticky join / status panel) ─────────────── */}
          <div className="lg:col-span-2 mt-4 lg:mt-0">
            <div className="lg:sticky lg:top-20 space-y-4">

              {/* ── Pay to join panel ────────────────────────────────── */}
              {showJoin && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-2xl font-bold text-slate-900">Rs. {perPersonTotal.toLocaleString()}</span>
                    <span className="text-sm text-slate-400">/ person</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-5">Paid straight to the ground by bank transfer</p>

                  <div className="mb-4">
                    <p className="text-sm font-semibold text-slate-700 mb-1">How many spots do you need?</p>
                    <p className="text-xs text-slate-400 mb-3">Join solo or bring your group — up to {joinCapLeft} spot{joinCapLeft !== 1 ? "s" : ""} available.</p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setGroupSize(Math.max(1, groupSize - 1))}
                        disabled={groupSize <= 1}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center font-bold text-slate-700 text-lg transition-colors">
                        −
                      </button>
                      <span className="flex-1 text-center font-bold text-2xl text-slate-900">{groupSize}</span>
                      <button onClick={() => setGroupSize(Math.max(1, Math.min(joinCapLeft, groupSize + 1)))}
                        disabled={groupSize >= joinCapLeft}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center font-bold text-slate-700 text-lg transition-colors">
                        +
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-1">Min 1 · Max {joinCapLeft}</p>
                  </div>

                  <div id="contact-number" className="mb-4">
                    <ContactNumberField contact={contact} />
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total for {groupSize} player{groupSize > 1 ? "s" : ""}</span>
                      <span className="font-bold text-green-800">Rs. {myGroupCost.toLocaleString()}</span>
                    </div>
                  </div>

                  <button onClick={handlePay} disabled={joining || groupSize > joinCapLeft || joinCapLeft === 0}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-base mb-3">
                    {joining
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Reserving…</>
                      : <><CreditCard className="w-4 h-4" /> Reserve &amp; Pay Rs. {myGroupCost.toLocaleString()} <ChevronRight className="w-4 h-4" /></>}
                  </button>

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <ShieldCheck className="w-3 h-3 text-green-500" />
                      Pay the ground directly
                    </div>
                    <span className="text-slate-200">·</span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      Refund guaranteed
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                    After reserving, you&apos;ll see the ground&apos;s bank details. Transfer and upload the receipt — your spot counts once the owner confirms it. Full refund from the ground if the lobby expires without enough players.
                  </p>
                </div>
              )}

              {/* Sign in prompt */}
              {isCollecting && !ses?.user && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
                  <p className="text-sm text-slate-500 mb-4">Sign in to reserve a spot in this lobby.</p>
                  <Link href="/login"
                    className="block bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-colors">
                    Sign in to Join
                  </Link>
                </div>
              )}

              {/* Already joined: payment status, transfer details and receipt upload */}
              {isParticipant && isCollecting && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      mySpot?.paymentStatus === "PAID" ? "bg-green-100" : "bg-amber-50"
                    }`}>
                      {mySpot?.paymentStatus === "PAID"
                        ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                        : <CreditCard className="w-5 h-5 text-amber-500" />
                      }
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">
                        {mySpot?.paymentStatus === "PAID" ? "You're in!" : mySpot?.paymentStatus === "RECEIPT_SUBMITTED" ? "Receipt with the ground" : "Spot held — payment needed"}
                      </p>
                      <p className="text-xs text-slate-400">{mySpot?.groupSize} spot{(mySpot?.groupSize ?? 1) > 1 ? "s" : ""} reserved</p>
                    </div>
                  </div>
                  {mySpot?.paymentStatus === "PAID" ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 mb-4">
                      Waiting for the lobby to fill. You will be notified when enough players join.
                    </div>
                  ) : match.mySpot && (
                    <div className="mb-4">
                      <PlayerPaymentPanel
                        paymentStatus={match.mySpot.paymentStatus}
                        amount={match.mySpot.amountDue}
                        reference={match.mySpot.id.slice(0, 8).toUpperCase()}
                        paymentDetails={match.mySpot.paymentDetails}
                        receiptUrl={match.mySpot.receiptUrl}
                        rejectReason={match.mySpot.receiptRejectReason}
                        latestComplaint={match.mySpot.latestComplaint}
                        receiptWindowMinutes={match.mySpot.receiptWindowMinutes}
                        uploadEndpoint={`/api/open-matches/${id}/receipt`}
                        spotId={match.mySpot.id}
                        onChanged={fetchMatch}
                      />
                    </div>
                  )}

                  {cancelResult && (
                    <div className={`rounded-xl px-3 py-2.5 text-xs mb-3 ${
                      cancelResult.isSuspended
                        ? "bg-red-50 border border-red-200 text-red-800"
                        : "bg-slate-50 border border-slate-200 text-slate-600"
                    }`}>
                      {cancelResult.fineLabel}
                    </div>
                  )}

                  {showCancelConfirm ? (
                    <div className="space-y-3">
                      <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-800">
                        <p className="font-semibold mb-1">Are you sure?</p>
                        <p>{cancelWarning}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCancelConfirm(false)}
                          className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-colors"
                        >
                          Keep My Spot
                        </button>
                        <button
                          type="button"
                          onClick={handleCancel}
                          disabled={cancelling}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                          Yes, Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(true)}
                      className="w-full border border-red-200 text-red-500 hover:bg-red-50 font-medium py-2.5 rounded-xl transition-colors text-sm"
                    >
                      Cancel My Spot
                    </button>
                  )}
                </div>
              )}

              {/* Lobby summary box */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Lobby Summary</h4>
                <div className="space-y-2.5 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-300 shrink-0" />
                    {new Date(match.preferredDate).toLocaleDateString("en-LK", { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-300 shrink-0" />
                    {match.preferredStartTime} – {match.preferredEndTime}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-300 shrink-0" />
                    {match.spotsReserved} / {match.totalSpotsNeeded} spots filled
                  </div>
                  {isCollecting && (
                    <div className="flex items-center gap-2 text-amber-700">
                      <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                      <Countdown target={match.expiresAt} />
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>{/* end right column */}

        </div>{/* end grid */}
      </div>

      {/* ── Mobile sticky bottom bar ──────────────────────────────────── */}
      {showJoin && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-3 shadow-lg lg:hidden">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 truncate">{match.category.name} · {joinCapLeft} spot{joinCapLeft !== 1 ? "s" : ""} left</p>
            <p className="text-sm font-bold text-slate-900">Rs. {perPersonTotal.toLocaleString()}<span className="text-xs text-slate-400 font-normal">/person</span></p>
          </div>
          <button onClick={handlePay} disabled={joining || groupSize > joinCapLeft || joinCapLeft === 0}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 text-sm shrink-0">
            {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            Reserve
          </button>
        </div>
      )}
    </div>
  );
}

export default function LobbyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>}>
      <LobbyDetailInner id={id} />
    </Suspense>
  );
}
